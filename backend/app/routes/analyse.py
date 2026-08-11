"""
MedBridge — /analyse route (rewritten)

Changes from original:
- Structured output via groq_json_call() + DischargeSummary Pydantic schema
- Self-correcting retry loop on schema validation failure
- Streaming SSE endpoint (/analyse/stream)
- Prompt injection guardrail on all inputs
- Auto-generate reminders after prescription extraction (closed-loop)
- Audit logging on every LLM call
- Fixed parse_visit to use schema validation
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from deep_translator import GoogleTranslator

from app.config import groq, supabase
from app.auth import get_user_id
from app.schemas import DischargeSummary, PrescriptionExtraction, VisitParsed
from app.llm_utils import groq_json_call, guardrail_check, log_audit, MAIN_MODEL

logger = logging.getLogger("medbridge.analyse")
router = APIRouter()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

LANG_CODES = {"hi": "hi", "ta": "ta"}
SUPPORTED_LANGS = {"en", "hi", "ta"}

def _translate_dict(d: dict, target: str) -> dict:
    """Translate all string values in a dict to target language."""
    translated = {}
    for k, v in d.items():
        if isinstance(v, str):
            try:
                translated[k] = GoogleTranslator(source="en", target=target).translate(v)
            except Exception:
                translated[k] = v  # fallback to English on translator error
        else:
            translated[k] = v
    return translated


def _build_discharge_prompt(text: str, language: str) -> list[dict]:
    lang_instruction = {
        "hi": "Respond entirely in Hindi (Devanagari script).",
        "ta": "Respond entirely in Tamil script.",
    }.get(language, "Respond entirely in English.")

    return [
        {
            "role": "system",
            "content": (
                "You are MedBridge, a compassionate medical assistant that explains "
                "hospital discharge summaries to non-medical patients in simple, "
                "reassuring language. You never diagnose — you explain and guide."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{lang_instruction}\n\n"
                "Explain this discharge summary in plain language for a patient with no medical background. "
                "Be warm, clear, and specific. Avoid jargon.\n\n"
                "Return a JSON object with these exact keys:\n"
                '{"what_happened": "...", "home_care": "...", "warning_signs": "...", "follow_up": "..."}\n\n'
                f"Discharge summary:\n{text}"
            ),
        },
    ]


# ---------------------------------------------------------------------------
# POST /analyse  (standard, non-streaming)
# ---------------------------------------------------------------------------

class AnalyseRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/analyse")
async def analyse(req: AnalyseRequest, user_id: str = Depends(get_user_id)):
    lang = req.language if req.language in SUPPORTED_LANGS else "en"

    # 1. Guardrail check
    safe, reason = guardrail_check(req.text)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "analyse", {"reason": reason, "input_preview": req.text[:100]})
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    # 2. Schema-constrained LLM call with self-correcting retry
    messages = _build_discharge_prompt(req.text, lang)
    result, meta = groq_json_call(messages, DischargeSummary)

    result_dict = result.model_dump()

    # 3. Post-translate if needed (LLM prompted in-language but backup translation applied)
    if lang in LANG_CODES and lang != "en":
        result_dict = _translate_dict(result_dict, lang)

    # 4. Persist to discharge_analyses
    try:
        supabase.table("discharge_analyses").insert({
            "user_id": user_id,
            "original_text": req.text,
            "language": lang,
            **result_dict,
        }).execute()
    except Exception as exc:
        logger.error(f"Failed to save discharge analysis: {exc}")

    # 5. Audit log
    log_audit(user_id, "discharge_analysis", "discharge_analyses", {
        **meta,
        "language": lang,
        "text_length": len(req.text),
    })

    return result_dict


# ---------------------------------------------------------------------------
# POST /analyse/stream  (SSE streaming — highest-visibility UX feature)
# ---------------------------------------------------------------------------

@router.post("/analyse/stream")
async def analyse_stream(req: AnalyseRequest, user_id: str = Depends(get_user_id)):
    """
    Server-Sent Events streaming endpoint for the discharge explainer.
    Streams tokens as they arrive from Groq, then sends a [DONE] sentinel.

    Client consumes via ReadableStream + TextDecoder.
    Each event: data: {"token": "..."}\n\n
    Final event: data: [DONE]\n\n
    """
    lang = req.language if req.language in SUPPORTED_LANGS else "en"

    # Guardrail before streaming starts
    safe, reason = guardrail_check(req.text)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "analyse/stream", {"reason": reason})
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    messages = _build_discharge_prompt(req.text, lang)

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            stream = groq.chat.completions.create(
                model=MAIN_MODEL,
                max_tokens=1200,
                temperature=0.3,
                messages=messages,
                stream=True,
            )

            full_text = ""
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    full_text += delta
                    yield f"data: {json.dumps({'token': delta})}\n\n"

            yield "data: [DONE]\n\n"

            # Best-effort: save streamed result to DB after stream completes
            try:
                # Parse the full streamed JSON to save it
                clean = full_text.strip()
                if clean.startswith("```"):
                    clean = clean.split("```")[1]
                    if clean.startswith("json"):
                        clean = clean[4:]
                    clean = clean.rsplit("```", 1)[0].strip()
                parsed = json.loads(clean)
                supabase.table("discharge_analyses").insert({
                    "user_id": user_id,
                    "original_text": req.text,
                    "language": lang,
                    **{k: parsed.get(k, "") for k in ["what_happened", "home_care", "warning_signs", "follow_up"]},
                }).execute()
                log_audit(user_id, "discharge_analysis_stream", "discharge_analyses", {
                    "language": lang, "text_length": len(req.text), "streamed": True
                })
            except Exception as save_err:
                logger.warning(f"Failed to save streamed discharge result: {save_err}")

        except Exception as exc:
            logger.error(f"Streaming error: {exc}")
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# GET /prescriptions
# ---------------------------------------------------------------------------

@router.get("/prescriptions")
async def get_prescriptions(user_id: str = Depends(get_user_id)):
    res = supabase.table("prescriptions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data


# ---------------------------------------------------------------------------
# POST /prescriptions/extract-and-save
# ---------------------------------------------------------------------------

class ExtractRequest(BaseModel):
    text: str


@router.post("/prescriptions/extract-and-save")
async def extract_and_save(req: ExtractRequest, user_id: str = Depends(get_user_id)):
    # Guardrail check
    safe, reason = guardrail_check(req.text)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "prescriptions/extract", {"reason": reason})
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    messages = [
        {
            "role": "system",
            "content": "You are a precise medical data extractor. Extract medications exactly as written.",
        },
        {
            "role": "user",
            "content": (
                "Extract ALL medications from this discharge summary.\n\n"
                "Return a JSON object with a 'medications' array:\n"
                '{"medications": [{"drug_name": "...", "dosage": "...", "frequency": "...", "duration": "...", "notes": "..."}]}\n\n'
                "Use null for any unknown fields. Include every medication mentioned.\n\n"
                f"Discharge summary:\n{req.text}"
            ),
        },
    ]

    result, meta = groq_json_call(messages, PrescriptionExtraction, max_tokens=1200)

    # Insert prescriptions
    rows = [
        {
            "user_id": user_id,
            "drug_name": p.drug_name,
            "dosage": p.dosage,
            "frequency": p.frequency,
            "duration": p.duration,
            "notes": p.notes,
            "source": "discharge_summary",
            "source_text": req.text[:500],
        }
        for p in result.medications
    ]

    saved_ids = []
    if rows:
        insert_result = supabase.table("prescriptions").insert(rows).execute()
        saved_ids = [r["id"] for r in (insert_result.data or [])]

        # ---------------------------------------------------------------
        # AUTO-GENERATE REMINDERS (closed-loop: extract → remind)
        # Each extracted medication becomes a morning reminder automatically.
        # ---------------------------------------------------------------
        reminder_rows = []
        for i, p in enumerate(result.medications):
            source_id = saved_ids[i] if i < len(saved_ids) else None
            reminder_rows.append({
                "user_id": user_id,
                "drug_name": p.drug_name,
                "dose": p.dosage or "",
                "time_of_day": "09:00:00",   # default morning; patient can edit
                "auto_generated": True,
                "source_prescription_id": source_id,
            })

        if reminder_rows:
            try:
                supabase.table("reminders").insert(reminder_rows).execute()
                logger.info(f"Auto-generated {len(reminder_rows)} reminders for user {user_id}")
            except Exception as exc:
                logger.error(f"Failed to auto-generate reminders: {exc}")

    log_audit(user_id, "prescription_extraction", "prescriptions", {
        **meta,
        "medications_found": len(result.medications),
        "reminders_created": len(rows),
    })

    return {"saved": len(rows), "reminders_created": len(rows)}


# ---------------------------------------------------------------------------
# DELETE /prescriptions/{id}
# ---------------------------------------------------------------------------

@router.delete("/prescriptions/{id}")
async def delete_prescription(id: str, user_id: str = Depends(get_user_id)):
    supabase.table("prescriptions") \
        .delete() \
        .eq("id", id) \
        .eq("user_id", user_id) \
        .execute()
    return {"deleted": id}


# ---------------------------------------------------------------------------
# POST /prescriptions/parse-visit
# ---------------------------------------------------------------------------

class ParseVisitRequest(BaseModel):
    text: str


@router.post("/prescriptions/parse-visit")
async def parse_visit(req: ParseVisitRequest, user_id: str = Depends(get_user_id)):
    safe, reason = guardrail_check(req.text)
    if not safe:
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    messages = [
        {
            "role": "system",
            "content": "You are a medical data extractor. Extract visit details precisely.",
        },
        {
            "role": "user",
            "content": (
                "Extract visit details from this text.\n"
                "Return a JSON object with these exact keys:\n"
                '{"patientName": "...", "patientAge": "...", "reasonForVisit": "...", '
                '"doctorName": "...", "prescriptionDate": "YYYY-MM-DD", '
                '"medicines": [{"drug_name":"...","dosage":"...","frequency":"...","duration":"...","notes":"..."}]}\n\n'
                "Use null for any unknown fields. Use YYYY-MM-DD format for date.\n\n"
                f"Text:\n{req.text}"
            ),
        },
    ]

    result, _ = groq_json_call(messages, VisitParsed, max_tokens=2000)
    log_audit(user_id, "visit_parse", "prescriptions", {"medicines_found": len(result.medicines)})
    return result.model_dump()
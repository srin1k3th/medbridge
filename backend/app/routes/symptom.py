"""
MedBridge — /symptom route (rewritten)

Changes from original:
- Fixed dead-code bug: supabase.insert was unreachable (return before it)
- Structured output via SymptomClassification Pydantic schema (confidence + reasoning)
- Longitudinal patient memory: last N symptom logs injected into prompt
- Pattern detection: flags repeated symptoms ("3x in 7 days → escalate")
- Prompt injection guardrail
- language param for i18n parity
- Full audit logging
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from deep_translator import GoogleTranslator

from app.config import groq, supabase
from app.auth import get_user_id
from app.schemas import SymptomClassification
from app.llm_utils import groq_json_call, guardrail_check, log_audit

logger = logging.getLogger("medbridge.symptom")
router = APIRouter()

SUPPORTED_LANGS = {"en", "hi", "ta"}

# ---------------------------------------------------------------------------
# Longitudinal Memory Helpers
# ---------------------------------------------------------------------------

def _fetch_symptom_history(user_id: str, limit: int = 10) -> list[dict]:
    """Fetch last N symptom logs for episodic memory injection."""
    try:
        res = supabase.table("symptom_logs") \
            .select("symptom_text, classification, confidence, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        return res.data or []
    except Exception as exc:
        logger.warning(f"Failed to fetch symptom history: {exc}")
        return []


def _build_pattern_context(history: list[dict]) -> str:
    """
    Detect temporal patterns in symptom history.
    Returns a natural-language summary injected into the LLM prompt.
    """
    if not history:
        return "No prior symptom history on record."

    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    three_days_ago = now - timedelta(days=3)

    # Parse timestamps safely
    recent_7d = []
    recent_3d = []
    urgent_count = 0

    for h in history:
        try:
            ts_str = h.get("created_at", "")
            if ts_str:
                # Handle both with/without microseconds
                ts_str = ts_str.replace("Z", "+00:00")
                ts = datetime.fromisoformat(ts_str)
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                if ts > week_ago:
                    recent_7d.append(h)
                if ts > three_days_ago:
                    recent_3d.append(h)
            if h.get("classification") == "URGENT":
                urgent_count += 1
        except Exception:
            pass

    lines = []
    lines.append(f"Patient has {len(history)} prior symptom records.")

    if recent_7d:
        lines.append(f"In the last 7 days: {len(recent_7d)} symptom check(s).")
        classifications = [h.get("classification", "?") for h in recent_7d]
        lines.append(f"Recent classifications: {', '.join(classifications)}.")

    if len(recent_3d) >= 3:
        lines.append(
            f"PATTERN ALERT: Patient has checked {len(recent_3d)} symptoms in 3 days — "
            f"consider escalating classification to URGENT or MONITOR even if individual symptom seems mild."
        )

    if urgent_count >= 2:
        lines.append(
            f"WARNING: Patient has had {urgent_count} URGENT classifications in their history. "
            f"Exercise caution and bias toward higher classification."
        )

    # Include most recent entries as context
    recent_summary = []
    for h in history[:5]:  # last 5
        symptom = h.get("symptom_text", "")[:60]
        cls = h.get("classification", "?")
        recent_summary.append(f"- \"{symptom}\" → {cls}")

    if recent_summary:
        lines.append("Most recent symptom checks:\n" + "\n".join(recent_summary))

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# POST /symptom
# ---------------------------------------------------------------------------

class SymptomRequest(BaseModel):
    symptom: str
    patient_context: str = ""
    language: str = "en"


@router.post("/symptom")
async def check_symptom(req: SymptomRequest, user_id: str = Depends(get_user_id)):
    lang = req.language if req.language in SUPPORTED_LANGS else "en"

    # 1. Guardrail check
    full_input = f"{req.symptom} {req.patient_context}"
    safe, reason = guardrail_check(full_input)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "symptom", {"reason": reason})
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    # 2. Fetch longitudinal history (episodic agent memory)
    history = _fetch_symptom_history(user_id)
    pattern_context = _build_pattern_context(history)

    # 3. Language instruction
    lang_instruction = {
        "hi": "Respond entirely in Hindi (Devanagari script).",
        "ta": "Respond entirely in Tamil script.",
    }.get(lang, "Respond entirely in English.")

    # 4. Build prompt with longitudinal context injected
    messages = [
        {
            "role": "system",
            "content": (
                "You are MedBridge, a clinical-grade symptom checker for post-discharge patients in India. "
                "You are cautious, evidence-based, and always recommend professional consultation for anything unclear. "
                "You NEVER diagnose. You classify symptoms based on urgency to help patients decide their next action."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{lang_instruction}\n\n"
                f"Patient context: {req.patient_context or 'No additional context provided.'}\n\n"
                f"Longitudinal history (use this to inform your assessment):\n{pattern_context}\n\n"
                f"Current symptom reported: \"{req.symptom}\"\n\n"
                "Classify this symptom as SAFE, MONITOR, or URGENT.\n\n"
                "Return a JSON object:\n"
                '{"classification": "SAFE"|"MONITOR"|"URGENT", '
                '"explanation": "2-3 sentence explanation", '
                '"action": "one concrete action for the patient", '
                '"confidence": 0.0-1.0, '
                '"reasoning": "brief chain-of-thought explaining your classification and confidence"}\n\n'
                "confidence < 0.7 means you are genuinely uncertain and the case should be escalated to human review."
            ),
        },
    ]

    # 5. Schema-constrained LLM call
    result, meta = groq_json_call(messages, SymptomClassification)

    result_dict = result.model_dump()

    # 6. Translate if needed
    if lang == "hi":
        for key in ("explanation", "action", "reasoning"):
            try:
                result_dict[key] = GoogleTranslator(source="en", target="hi").translate(result_dict[key])
            except Exception:
                pass
    elif lang == "ta":
        for key in ("explanation", "action", "reasoning"):
            try:
                result_dict[key] = GoogleTranslator(source="en", target="ta").translate(result_dict[key])
            except Exception:
                pass

    # 7. Save to symptom_logs (FIXED: was dead code in original)
    try:
        supabase.table("symptom_logs").insert({
            "user_id": user_id,
            "symptom_text": req.symptom,
            "classification": result.classification,
            "explanation": result_dict["explanation"],
            "action": result_dict["action"],
            "confidence": result.confidence,
            "reasoning": result_dict["reasoning"],
            "pattern_context": pattern_context,
            "language": lang,
        }).execute()
    except Exception as exc:
        logger.error(f"Failed to save symptom log: {exc}")

    # 8. Audit log
    log_audit(user_id, "symptom_check", "symptom_logs", {
        **meta,
        "classification": result.classification,
        "confidence": result.confidence,
        "language": lang,
        "history_entries_used": len(history),
    })

    # 9. Include pattern_context in response for frontend to surface
    result_dict["pattern_context"] = pattern_context
    result_dict["history_count"] = len(history)

    return result_dict
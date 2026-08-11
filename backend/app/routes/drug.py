"""
MedBridge — /drug route (rewritten)

Changes from original:
- Structured output via DrugLookupResult Pydantic schema
- Agentic RAG: pgvector retrieval of drug knowledge chunks with source citations
- Patient medication list injected for interaction grounding
- language param for i18n parity
- Prompt injection guardrail
- Audit logging
"""

from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from deep_translator import GoogleTranslator

from app.config import groq, supabase
from app.auth import get_user_id
from app.schemas import DrugLookupResult
from app.llm_utils import groq_json_call, guardrail_check, log_audit
from app.rag import retrieve_drug_context, format_rag_context

logger = logging.getLogger("medbridge.drug")
router = APIRouter()

SUPPORTED_LANGS = {"en", "hi", "ta"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _fetch_fda_data(drug_name: str) -> dict | None:
    """Fetch drug data from OpenFDA label API. Returns None on failure."""
    try:
        url = (
            f'https://api.fda.gov/drug/label.json'
            f'?search=openfda.brand_name:"{drug_name}"+openfda.generic_name:"{drug_name}"&limit=1'
        )
        async with httpx.AsyncClient(timeout=6.0) as client:
            res = await client.get(url)
            if res.status_code == 200:
                results = res.json().get("results", [])
                return results[0] if results else None
    except Exception as exc:
        logger.warning(f"OpenFDA fetch failed for '{drug_name}': {exc}")
    return None


def _get_patient_meds(user_id: str) -> list[str]:
    """Fetch patient's current medication list for RAG interaction grounding."""
    try:
        res = supabase.table("prescriptions") \
            .select("drug_name") \
            .eq("user_id", user_id) \
            .limit(20) \
            .execute()
        return [r["drug_name"] for r in (res.data or [])]
    except Exception as exc:
        logger.warning(f"Failed to fetch patient meds: {exc}")
        return []


# ---------------------------------------------------------------------------
# POST /drug
# ---------------------------------------------------------------------------

class DrugRequest(BaseModel):
    drug_name: str
    language: str = "en"


@router.post("/drug")
async def drug_lookup(req: DrugRequest, user_id: str = Depends(get_user_id)):
    lang = req.language if req.language in SUPPORTED_LANGS else "en"

    # 1. Guardrail check
    safe, reason = guardrail_check(req.drug_name)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "drug", {"reason": reason})
        raise HTTPException(status_code=400, detail=f"Input blocked by safety filter: {reason}")

    # 2. Fetch OpenFDA data (external source)
    fda_data = await _fetch_fda_data(req.drug_name)

    # 3. Fetch patient's current meds for interaction context
    patient_meds = _get_patient_meds(user_id)

    # 4. Agentic RAG: semantic retrieval from drug_knowledge (pgvector)
    rag_chunks = retrieve_drug_context(req.drug_name, patient_meds, top_k=5)
    rag_context = format_rag_context(rag_chunks)
    rag_used = len(rag_chunks) > 0

    # 5. Build prompt with retrieved context + FDA data
    lang_instruction = {
        "hi": "Respond entirely in Hindi (Devanagari script).",
        "ta": "Respond entirely in Tamil script.",
    }.get(lang, "Respond entirely in English.")

    # Assemble context block
    context_sections = []

    if rag_context:
        context_sections.append(rag_context)

    if fda_data:
        fda_context = {
            "brand_name": fda_data.get("openfda", {}).get("brand_name", []),
            "generic_name": fda_data.get("openfda", {}).get("generic_name", []),
            "indications_and_usage": fda_data.get("indications_and_usage", [])[:2],
            "dosage_and_administration": fda_data.get("dosage_and_administration", [])[:2],
            "warnings": fda_data.get("warnings", [])[:2],
            "adverse_reactions": fda_data.get("adverse_reactions", [])[:2],
            "drug_interactions": fda_data.get("drug_interactions", [])[:2],
        }
        import json
        context_sections.append(f"[OpenFDA Official Label Data]\n{json.dumps(fda_context, indent=2)}")

    if patient_meds:
        context_sections.append(
            f"[Patient's Current Medications — check for interactions]\n"
            + "\n".join(f"- {m}" for m in patient_meds)
        )

    context_block = "\n\n".join(context_sections) if context_sections else "No additional data retrieved."

    messages = [
        {
            "role": "system",
            "content": (
                "You are a clinical pharmacist for MedBridge. You explain medications clearly to patients. "
                "When interaction data is available, flag it prominently. Always cite your sources. "
                "You never make up drug information — if you're unsure, say so."
            ),
        },
        {
            "role": "user",
            "content": (
                f"{lang_instruction}\n\n"
                f"Patient looked up: \"{req.drug_name}\"\n\n"
                f"Available information:\n{context_block}\n\n"
                "Based on the above information, provide a patient-friendly drug summary.\n"
                "If interaction warnings are relevant to the patient's current medications, include them.\n"
                "Cite sources where possible (e.g. '[Source 1]' or '[OpenFDA]').\n\n"
                "Return a JSON object:\n"
                '{"generic_name": "...", "what_for": "...", "how_to_take": "...", '
                '"side_effects": "...", "avoid": "...", '
                '"interaction_warnings": "...", '
                '"source": "...", "cited_sources": ["..."]}'
            ),
        },
    ]

    # 6. Schema-constrained LLM call
    result, meta = groq_json_call(messages, DrugLookupResult, max_tokens=1000)

    result_dict = result.model_dump()

    # Override source field with factual info
    if rag_used and fda_data:
        result_dict["source"] = "RAG + OpenFDA"
    elif rag_used:
        result_dict["source"] = "RAG (curated drug knowledge)"
    elif fda_data:
        result_dict["source"] = "OpenFDA"
    else:
        result_dict["source"] = "LLM parametric knowledge"

    # 7. Post-translate if needed
    if lang == "hi":
        for key in ("what_for", "how_to_take", "side_effects", "avoid", "interaction_warnings"):
            if result_dict.get(key):
                try:
                    result_dict[key] = GoogleTranslator(source="en", target="hi").translate(result_dict[key])
                except Exception:
                    pass
    elif lang == "ta":
        for key in ("what_for", "how_to_take", "side_effects", "avoid", "interaction_warnings"):
            if result_dict.get(key):
                try:
                    result_dict[key] = GoogleTranslator(source="en", target="ta").translate(result_dict[key])
                except Exception:
                    pass

    # 8. Audit log
    log_audit(user_id, "drug_lookup", "drug_knowledge", {
        **meta,
        "drug_name": req.drug_name,
        "rag_chunks": len(rag_chunks),
        "fda_found": fda_data is not None,
        "patient_meds_count": len(patient_meds),
        "language": lang,
    })

    return result_dict

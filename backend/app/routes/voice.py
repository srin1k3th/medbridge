"""
MedBridge — Voice transcription via Groq Whisper API.

Uses whisper-large-v3 (fastest + most accurate free option, same Groq account).

Key feature: medical context prompt injection.
The patient's current drug list + diagnosis is passed as the Whisper 'prompt'
parameter, which dramatically improves accuracy for medical terminology.
e.g. "Metformin" won't be heard as "met form in", "Telmisartan" as "tell me start an".

Supports: English (en-IN), Hindi (hi), Tamil (ta)
Latency target: < 500ms on Groq infrastructure
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from app.config import groq, supabase
from app.auth import get_user_id
from app.llm_utils import log_audit

logger = logging.getLogger("medbridge.voice")
router = APIRouter()

# Groq Whisper model — large-v3 for best accuracy on medical terms
# whisper-large-v3-turbo is faster but slightly less accurate on domain terms
WHISPER_MODEL = "whisper-large-v3"

# Medical context always included — improves transcription of clinical terms
BASE_MEDICAL_CONTEXT = (
    "Medical transcription. Terms: patient, symptom, medication, prescription, "
    "discharge, diagnosis, dosage, tablet, capsule, injection, syrup, "
    "once daily, twice daily, three times daily, before meals, after meals, at bedtime, as needed, "
    "Metformin, Amlodipine, Atorvastatin, Ramipril, Aspirin, Clopidogrel, "
    "Pantoprazole, Omeprazole, Warfarin, Furosemide, Metoprolol, Insulin, "
    "Levothyroxine, Losartan, Telmisartan, Digoxin, Amiodarone, Spironolactone, "
    "Paracetamol, Azithromycin, Amoxicillin, Ciprofloxacin, Dexamethasone, Glimepiride, "
    "hypertension, diabetes, cardiac, renal, hepatic, thyroid, arrhythmia, "
    "dizziness, chest pain, shortness of breath, palpitations, swelling, nausea, vomiting. "
)

LANG_MAP = {
    "en": "en",
    "hi": "hi",
    "ta": "ta",
}


def _get_patient_drug_context(user_id: str) -> str:
    """
    Fetch the patient's current prescription list to build a context prompt.
    Injected into Whisper's prompt parameter so drug names are transcribed correctly.
    """
    try:
        res = supabase.table("prescriptions") \
            .select("drug_name, dosage, frequency") \
            .eq("user_id", user_id) \
            .limit(20) \
            .execute()

        meds = res.data or []
        if not meds:
            return BASE_MEDICAL_CONTEXT

        # Build a rich vocabulary hint — Whisper uses this to calibrate its vocabulary
        drug_names = [m["drug_name"] for m in meds if m.get("drug_name")]
        drug_str = ", ".join(drug_names)

        return (
            BASE_MEDICAL_CONTEXT
            + f"Patient's medications: {drug_str}. "
        )
    except Exception as exc:
        logger.warning(f"Failed to fetch patient meds for voice context: {exc}")
        return BASE_MEDICAL_CONTEXT


def _get_patient_profile_context(user_id: str) -> str:
    """Fetch diagnosis and doctor name to further enrich transcription context."""
    try:
        res = supabase.table("profiles") \
            .select("diagnosis, doctor_name, fname") \
            .eq("id", user_id) \
            .single() \
            .execute()

        profile = res.data or {}
        parts = []
        if profile.get("diagnosis"):
            parts.append(f"Diagnosis: {profile['diagnosis']}.")
        if profile.get("doctor_name"):
            parts.append(f"Doctor: {profile['doctor_name']}.")
        return " ".join(parts)
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# POST /voice/transcribe
# ---------------------------------------------------------------------------

@router.post("/voice/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    language: str = Form(default="en"),
    user_id: str = Depends(get_user_id),
):
    """
    Transcribe patient voice input using Groq Whisper large-v3.

    Accepts: audio/webm, audio/mp4, audio/wav, audio/ogg, audio/m4a
    (MediaRecorder in Chrome produces audio/webm by default)

    Returns: {transcript: str, language: str, duration_hint: str}
    """
    # Validate file type
    content_type = audio.content_type or ""
    allowed_types = {
        "audio/webm", "audio/mp4", "audio/wav", "audio/ogg",
        "audio/m4a", "audio/mpeg", "audio/flac", "audio/x-m4a",
        "application/octet-stream",  # some browsers send this
    }
    if content_type not in allowed_types and not content_type.startswith("audio/"):
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {content_type}. Use WebM, WAV, MP4, or OGG."
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Audio too short — please speak for at least 1 second")

    if len(audio_bytes) > 25 * 1024 * 1024:  # 25MB Whisper limit
        raise HTTPException(status_code=413, detail="Audio file too large (max 25MB)")

    # Build patient-specific medical context prompt
    drug_context = _get_patient_drug_context(user_id)
    profile_context = _get_patient_profile_context(user_id)
    context_prompt = drug_context + profile_context

    # Language mapping
    whisper_lang = LANG_MAP.get(language, "en")

    # Determine file extension from content type
    ext_map = {
        "audio/webm": "webm",
        "audio/mp4": "mp4",
        "audio/wav": "wav",
        "audio/ogg": "ogg",
        "audio/m4a": "m4a",
        "audio/x-m4a": "m4a",
        "audio/mpeg": "mp3",
        "audio/flac": "flac",
    }
    ext = ext_map.get(content_type, "webm")
    filename = f"voice_input.{ext}"

    try:
        transcription = groq.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model=WHISPER_MODEL,
            prompt=context_prompt,       # ← patient-specific medical vocabulary
            response_format="verbose_json",  # includes duration, language detected
            language=whisper_lang,
        )

        transcript = transcription.text.strip()

        if not transcript:
            raise HTTPException(
                status_code=422,
                detail="No speech detected. Please speak clearly into the microphone."
            )

        # Audit log
        log_audit(user_id, "voice_transcription", "voice", {
            "language": language,
            "audio_size_bytes": len(audio_bytes),
            "transcript_length": len(transcript),
            "model": WHISPER_MODEL,
        })

        logger.info(f"Transcribed {len(audio_bytes)} bytes → {len(transcript)} chars for user {user_id}")

        return {
            "transcript": transcript,
            "language": whisper_lang,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Whisper transcription failed: {exc}")
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {str(exc)}"
        )

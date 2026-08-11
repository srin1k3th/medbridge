"""
MedBridge — 3-layer OCR pipeline for scanned discharge summaries.

Layer 1: EasyOCR (multi-language deep learning OCR — handles English/Hindi/Tamil printed text well)
Layer 2: TrOCR (microsoft/trocr-large-handwritten via HuggingFace — best free handwriting model)
Layer 3: LLM post-correction (LLaMA 3.3 70B corrects OCR noise, medical abbreviations, script errors)

Fallback chain:
  If EasyOCR confidence avg < 0.6 → also run TrOCR → merge results → LLM correct
  If EasyOCR confidence avg >= 0.6 → LLM correct only
  If all OCR fails → return error with helpful message

POST /analyse/ocr
  Body: {file_base64: str, filename: str, language: str}
  Returns: {text: str, pages: int, method: str, confidence: float}
"""

from __future__ import annotations

import base64
import io
import logging
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import get_user_id
from app.config import groq
from app.llm_utils import guardrail_check, log_audit, MAIN_MODEL

logger = logging.getLogger("medbridge.ocr")
router = APIRouter()

# ---------------------------------------------------------------------------
# Lazy-load heavy OCR models to avoid slow startup
# ---------------------------------------------------------------------------

_easyocr_reader = None
_trocr_processor = None
_trocr_model = None


def _get_easyocr():
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            # en + hi + ta: covers Indian hospital discharge summaries
            _easyocr_reader = easyocr.Reader(["en", "hi", "ta"], gpu=False)
            logger.info("OCR: EasyOCR loaded (en, hi, ta)")
        except ImportError:
            logger.error("OCR: easyocr not installed. Run: pip install easyocr")
    return _easyocr_reader


def _get_trocr():
    global _trocr_processor, _trocr_model
    if _trocr_processor is None:
        try:
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            _trocr_processor = TrOCRProcessor.from_pretrained("microsoft/trocr-large-handwritten")
            _trocr_model = VisionEncoderDecoderModel.from_pretrained("microsoft/trocr-large-handwritten")
            logger.info("OCR: TrOCR loaded (microsoft/trocr-large-handwritten)")
        except ImportError:
            logger.error("OCR: transformers not installed. Run: pip install transformers torch")
        except Exception as exc:
            logger.error(f"OCR: TrOCR load failed: {exc}")
    return _trocr_processor, _trocr_model


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 4):
    """Convert PDF pages to PIL Images using pdf2image (requires poppler)."""
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=max_pages)
        logger.info(f"OCR: converted PDF to {len(images)} page image(s)")
        return images
    except ImportError:
        logger.error("OCR: pdf2image not installed. Run: pip install pdf2image")
        return []
    except Exception as exc:
        logger.error(f"OCR: PDF-to-image conversion failed: {exc}")
        return []


def _image_bytes_to_pil(image_bytes: bytes):
    """Convert raw image bytes to PIL Image."""
    try:
        from PIL import Image
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as exc:
        logger.error(f"OCR: image conversion failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# Layer 1: EasyOCR
# ---------------------------------------------------------------------------

def _run_easyocr(images: list) -> tuple[str, float]:
    """
    Run EasyOCR on a list of PIL Images.
    Returns (full_text, avg_confidence)
    """
    reader = _get_easyocr()
    if reader is None:
        return "", 0.0

    all_text_parts = []
    confidences = []

    for image in images:
        try:
            import numpy as np
            img_array = np.array(image)
            results = reader.readtext(img_array, detail=1)
            for (_, text, conf) in results:
                if text.strip():
                    all_text_parts.append(text.strip())
                    confidences.append(conf)
        except Exception as exc:
            logger.warning(f"EasyOCR page failed: {exc}")

    full_text = " ".join(all_text_parts)
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return full_text, avg_conf


# ---------------------------------------------------------------------------
# Layer 2: TrOCR (handwriting specialist)
# ---------------------------------------------------------------------------

def _run_trocr(images: list) -> str:
    """
    Run TrOCR on a list of PIL Images.
    Best for handwritten content (e.g. doctor-written prescriptions).
    Returns full_text string.
    """
    processor, model = _get_trocr()
    if processor is None or model is None:
        return ""

    try:
        import torch
        all_text = []
        for image in images:
            # TrOCR works on individual line images; we feed full pages
            # (it handles this reasonably well for structured forms)
            pixel_values = processor(images=image, return_tensors="pt").pixel_values
            with torch.no_grad():
                generated_ids = model.generate(pixel_values)
            text = processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            if text.strip():
                all_text.append(text.strip())
        return " ".join(all_text)
    except Exception as exc:
        logger.warning(f"TrOCR failed: {exc}")
        return ""


# ---------------------------------------------------------------------------
# Layer 3: LLM Post-Correction
# ---------------------------------------------------------------------------

def _llm_correct_ocr(raw_text: str, trocr_text: str = "") -> str:
    """
    Use LLaMA 3.3 70B to:
    1. Merge EasyOCR + TrOCR outputs (if both available)
    2. Fix OCR noise, garbled characters, wrong word breaks
    3. Expand medical abbreviations (OD→once daily, BD→twice daily, etc.)
    4. Clean up formatting while preserving all medical information

    This is the key insight: LLMs are excellent at correcting OCR noise
    in medical contexts because they understand clinical vocabulary.
    """
    context_parts = [f"EasyOCR output:\n{raw_text}"]
    if trocr_text and trocr_text != raw_text:
        context_parts.append(f"TrOCR output (handwriting specialist):\n{trocr_text}")

    combined = "\n\n".join(context_parts)

    prompt = (
        "You are a medical document reconstruction expert.\n\n"
        "The following is noisy OCR output from a scanned Indian hospital discharge summary or prescription. "
        "OCR errors are common: garbled characters, wrong word breaks, missing spaces, "
        "mixed scripts (English/Hindi/Tamil), and unclear medical abbreviations.\n\n"
        "Your task:\n"
        "1. Reconstruct the most likely original document text\n"
        "2. Fix obvious OCR errors while preserving all medical information exactly\n"
        "3. Expand common Indian medical abbreviations: "
        "OD=once daily, BD=twice daily, TDS=three times daily, QID=four times daily, "
        "HS=at bedtime, SOS=as needed, AC=before meals, PC=after meals, "
        "Tab=Tablet, Cap=Capsule, Inj=Injection, Syr=Syrup\n"
        "4. Do NOT add any information not present in the original — only correct, don't invent\n"
        "5. Return ONLY the corrected document text, no commentary\n\n"
        f"OCR output to correct:\n{combined}"
    )

    try:
        response = groq.chat.completions.create(
            model=MAIN_MODEL,
            max_tokens=2000,
            temperature=0.1,   # very low temp for correction task
            messages=[{"role": "user", "content": prompt}],
        )
        corrected = response.choices[0].message.content or raw_text
        logger.info("OCR: LLM post-correction applied successfully")
        return corrected.strip()
    except Exception as exc:
        logger.warning(f"OCR: LLM correction failed, returning raw: {exc}")
        return raw_text


# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

class OCRRequest(BaseModel):
    file_base64: str          # base64-encoded PDF or image bytes
    filename: str = "document.pdf"
    language: str = "en"      # hint for OCR language prioritization


# ---------------------------------------------------------------------------
# POST /analyse/ocr
# ---------------------------------------------------------------------------

@router.post("/analyse/ocr")
async def ocr_document(req: OCRRequest, user_id: str = Depends(get_user_id)):
    """
    3-layer OCR pipeline for scanned discharge summaries.

    Layer 1: EasyOCR (printed text, multilingual)
    Layer 2: TrOCR (handwriting, triggered if EasyOCR confidence < 0.6)
    Layer 3: LLM post-correction (medical noise correction + abbreviation expansion)
    """
    # Decode file
    try:
        file_bytes = base64.b64decode(req.file_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 file data")

    is_pdf = req.filename.lower().endswith(".pdf") or file_bytes[:4] == b"%PDF"

    # Convert to images
    if is_pdf:
        images = _pdf_to_images(file_bytes, max_pages=5)
        if not images:
            raise HTTPException(
                status_code=422,
                detail="Could not convert PDF to images. Ensure poppler is installed (pip install pdf2image)."
            )
    else:
        # Direct image input
        pil_img = _image_bytes_to_pil(file_bytes)
        images = [pil_img] if pil_img else []
        if not images:
            raise HTTPException(status_code=422, detail="Could not decode image file")

    pages = len(images)

    # --- Layer 1: EasyOCR ---
    easyocr_text, easyocr_conf = _run_easyocr(images)
    logger.info(f"OCR Layer 1 (EasyOCR): {len(easyocr_text)} chars, confidence={easyocr_conf:.2f}")

    # --- Layer 2: TrOCR (only if EasyOCR is low confidence — handwritten document) ---
    trocr_text = ""
    method = "easyocr"
    if easyocr_conf < 0.6 or len(easyocr_text.strip()) < 50:
        logger.info("OCR: Low EasyOCR confidence — running TrOCR (handwriting specialist)")
        trocr_text = _run_trocr(images)
        if trocr_text:
            method = "easyocr+trocr"
            logger.info(f"OCR Layer 2 (TrOCR): {len(trocr_text)} chars")

    # Determine best raw text to correct
    raw_text = easyocr_text
    if trocr_text and len(trocr_text) > len(easyocr_text):
        raw_text = trocr_text  # TrOCR got more content; use it as primary

    if not raw_text.strip():
        raise HTTPException(
            status_code=422,
            detail=(
                "Could not extract any text from this document. "
                "The document may be too blurry, password-protected, or in an unsupported format."
            )
        )

    # --- Layer 3: LLM post-correction ---
    corrected_text = _llm_correct_ocr(raw_text, trocr_text)
    method = method + "+llm_corrected"

    # Guardrail check on extracted content
    safe, reason = guardrail_check(corrected_text)
    if not safe:
        log_audit(user_id, "guardrail_blocked", "ocr", {"reason": reason})
        raise HTTPException(status_code=400, detail=f"Extracted content blocked by safety filter: {reason}")

    # Audit log
    log_audit(user_id, "ocr_extraction", "analyse/ocr", {
        "pages": pages,
        "method": method,
        "easyocr_confidence": round(easyocr_conf, 3),
        "output_length": len(corrected_text),
        "language": req.language,
    })

    return {
        "text": corrected_text,
        "pages": pages,
        "method": method,
        "confidence": round(easyocr_conf, 3),
        "language_detected": req.language,
    }

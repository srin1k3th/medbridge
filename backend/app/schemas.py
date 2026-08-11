"""
MedBridge — Pydantic schemas for every LLM output shape.
Used by groq_json_call() in llm_utils.py to validate and retry LLM responses.
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Literal


# ---------------------------------------------------------------------------
# Discharge Analysis
# ---------------------------------------------------------------------------

class DischargeSummary(BaseModel):
    what_happened: str = Field(..., description="Plain-language explanation of the patient's condition and what was done")
    home_care: str = Field(..., description="Specific care instructions for recovery at home")
    warning_signs: str = Field(..., description="Symptoms that should trigger an immediate doctor call")
    follow_up: str = Field(..., description="Follow-up appointments and next steps")


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------

class PrescriptionItem(BaseModel):
    drug_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    notes: Optional[str] = None


class PrescriptionExtraction(BaseModel):
    medications: List[PrescriptionItem] = Field(default_factory=list)


class VisitParsed(BaseModel):
    patientName: Optional[str] = None
    patientAge: Optional[str] = None
    reasonForVisit: Optional[str] = None
    doctorName: Optional[str] = None
    prescriptionDate: Optional[str] = None
    medicines: List[PrescriptionItem] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Symptom Classification
# ---------------------------------------------------------------------------

class SymptomClassification(BaseModel):
    classification: Literal["SAFE", "MONITOR", "URGENT"]
    explanation: str = Field(..., description="2-3 sentence explanation of the classification")
    action: str = Field(..., description="One concrete action the patient should take")
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence in classification from 0.0 (very uncertain) to 1.0 (very certain)"
    )
    reasoning: str = Field(
        ...,
        description="Brief chain-of-thought: why this classification was chosen and what drove the confidence score"
    )

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v: float) -> float:
        return max(0.0, min(1.0, v))


# ---------------------------------------------------------------------------
# Drug Lookup
# ---------------------------------------------------------------------------

class DrugLookupResult(BaseModel):
    generic_name: str
    what_for: str = Field(..., description="What this drug treats, in simple language")
    how_to_take: str = Field(..., description="How and when to take this medication")
    side_effects: str = Field(..., description="Most common side effects the patient should know about")
    avoid: str = Field(..., description="Foods, activities, or other drugs to avoid")
    interaction_warnings: Optional[str] = Field(
        None,
        description="Specific warnings about interactions with the patient's current medications"
    )
    source: Optional[str] = None
    cited_sources: Optional[List[str]] = Field(
        default_factory=list,
        description="Source citations from retrieved drug knowledge chunks"
    )


# ---------------------------------------------------------------------------
# Guardrail / Safety Screening
# ---------------------------------------------------------------------------

class GuardrailResult(BaseModel):
    safe: bool
    reason: str = Field(..., description="One-sentence explanation of why input is safe or unsafe")


# ---------------------------------------------------------------------------
# OCR Result
# ---------------------------------------------------------------------------

class OCRResult(BaseModel):
    text: str
    pages: int
    method: str  # "easyocr" | "trocr" | "llm_corrected" | "pdfjs"
    confidence: Optional[float] = None
    language_detected: Optional[str] = None

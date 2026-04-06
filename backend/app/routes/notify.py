from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import twilio, supabase
from app.auth import get_user_id
import os

router = APIRouter()

class NotifyRequest(BaseModel):
    symptom_text: str
    classification: str
    patient_name: str
    patient_age: str
    patient_diagnosis: str
    doctor_name: str
    doctor_whatsapp: str
    medications: list[str] = []

@router.post("/notify")
async def notify_doctor(req: NotifyRequest, user_id: str = Depends(get_user_id)):
    doc_first  = req.doctor_name.split()[-1]
    meds_line  = f"\n*Medications:* {', '.join(req.medications)}" if req.medications else ""
    message    = (
        f"Hi Dr. {doc_first},\n\n"
        f"Your patient *{req.patient_name} ({req.patient_age}, {req.patient_diagnosis})* "
        f"reported a symptom via MedBridge.\n\n"
        f"*Symptom:* \"{req.symptom_text}\"\n"
        f"*Classification:* {req.classification}"
        f"{meds_line}\n\n"
        f"Please follow up when convenient.\n\n— MedBridge"
    )
    twilio.messages.create(
        body=message,
        from_=os.getenv("TWILIO_WHATSAPP_FROM"),
        to=f"whatsapp:{req.doctor_whatsapp}"
    )
    supabase.table("symptom_logs").update(
    {"doctor_notified": True, "notified_at": "now()"}
    ).eq("user_id", user_id).execute()
    return {"status": "sent"}
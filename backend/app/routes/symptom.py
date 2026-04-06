from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import groq, supabase
from app.auth import get_user_id
import json

router = APIRouter()

class SymptomRequest(BaseModel):
    symptom: str
    patient_context: str = ""

@router.post("/symptom")
async def check_symptom(req: SymptomRequest, user_id: str = Depends(get_user_id)):
    prompt = f"""You are MedBridge symptom checker. {req.patient_context}
Patient reports: "{req.symptom}"
Classify: SAFE, MONITOR, or URGENT.
Return ONLY JSON: {{"classification":"SAFE"|"MONITOR"|"URGENT","explanation":"2-3 sentences","action":"one sentence"}}"""

    response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}]
    )
    return json.loads(response.choices[0].message.content.replace("```json","").replace("```","").strip())

    supabase.table("symptom_logs").insert({
        "user_id": user_id,
        "symptom_text": req.symptom,
        "classification": result["classification"],
        "explanation": result["explanation"]
    }).execute()

    return result
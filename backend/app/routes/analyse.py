from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import groq, supabase
from app.auth import get_user_id
from deep_translator import GoogleTranslator
import json

router = APIRouter()

def translate_result(result: dict, target_lang: str) -> dict:
    return {
        k: GoogleTranslator(source='en', target=target_lang).translate(v)
        for k, v in result.items()
    }

class AnalyseRequest(BaseModel):
    text: str
    language: str = "en"

@router.post("/analyse")
async def analyse(req: AnalyseRequest, user_id: str = Depends(get_user_id)):
    prompt = f"""You are MedBridge. Explain this discharge summary simply for a non-medical patient.
Respond entirely in English.
Return ONLY JSON: {{"what_happened":"...","home_care":"...","warning_signs":"...","follow_up":"..."}}
Discharge summary: {req.text}"""

    response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    result = json.loads(response.choices[0].message.content.replace("```json","").replace("```","").strip())

    if req.language == "ta":
        result = translate_result(result, "ta")
    elif req.language == "hi":
        result = translate_result(result, "hi")

    supabase.table("discharge_analyses").insert({
        "user_id": user_id,
        "original_text": req.text,
        "language": req.language,
        **result
    }).execute()

    return result


@router.get("/prescriptions")
async def get_prescriptions(user_id: str = Depends(get_user_id)):
    res = supabase.table("prescriptions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .execute()
    return res.data


class ExtractRequest(BaseModel):
    text: str

@router.post("/prescriptions/extract-and-save")
async def extract_and_save(req: ExtractRequest, user_id: str = Depends(get_user_id)):
    rx_prompt = f"""Extract all medications from this discharge summary.
Return ONLY a JSON array, no other text:
[{{"drug_name":"...","dosage":"...","frequency":"...","duration":"...","notes":"..."}}]
If a field is unknown, use null. Discharge summary: {req.text}"""

    rx_response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=1000,
        messages=[{"role": "user", "content": rx_prompt}]
    )
    prescriptions = json.loads(rx_response.choices[0].message.content.replace("```json","").replace("```","").strip())

    rows = [{"user_id": user_id, "drug_name": p.get("drug_name"), "dosage": p.get("dosage"),
             "frequency": p.get("frequency"), "duration": p.get("duration"),
             "notes": p.get("notes"), "source": "discharge_summary", "source_text": req.text}
            for p in prescriptions]
    supabase.table("prescriptions").insert(rows).execute()
    return {"saved": len(rows)}


@router.delete("/prescriptions/{id}")
async def delete_prescription(id: str, user_id: str = Depends(get_user_id)):
    supabase.table("prescriptions") \
        .delete() \
        .eq("id", id) \
        .eq("user_id", user_id) \
        .execute()
    return {"deleted": id}


class ParseVisitRequest(BaseModel):
    text: str

@router.post("/prescriptions/parse-visit")
async def parse_visit(req: ParseVisitRequest, user_id: str = Depends(get_user_id)):
    prompt = f"""You are a medical data extractor. Extract visit details from this text.
Return ONLY a valid JSON object, no other text or markdown:
{{
  "patientName": "...",
  "patientAge": "...",
  "reasonForVisit": "...",
  "doctorName": "...",
  "prescriptionDate": "YYYY-MM-DD",
  "medicines": [
    {{"drug_name":"...","dosage":"...","frequency":"...","duration":"...","notes":"..."}}
  ]
}}
Use null for any unknown fields. Use YYYY-MM-DD format for date if found, otherwise null.
Text:
{req.text}"""

    response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}]
    )
    content = response.choices[0].message.content.replace("```json","").replace("```","").strip()
    return json.loads(content)
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.config import groq
from app.auth import get_user_id
import httpx
import json

router = APIRouter()

class DrugRequest(BaseModel):
    drug_name: str

@router.post("/drug")
async def drug_lookup(req: DrugRequest, user_id: str = Depends(get_user_id)):
    fda_data = None
    try:
        async with httpx.AsyncClient() as client:
            fda_url = f"https://api.fda.gov/drug/label.json?search=openfda.brand_name:\"{req.drug_name}\"+openfda.generic_name:\"{req.drug_name}\"&limit=1"
            res = await client.get(fda_url)
            if res.status_code == 200:
                fda_data = res.json().get("results", [None])[0]
    except Exception as e:
        print(f"OpenFDA Error: {e}")

    if fda_data:
        context = {
            "brand_name": fda_data.get("openfda", {}).get("brand_name", []),
            "generic_name": fda_data.get("openfda", {}).get("generic_name", []),
            "indications_and_usage": fda_data.get("indications_and_usage", []),
            "dosage_and_administration": fda_data.get("dosage_and_administration", []),
            "warnings": fda_data.get("warnings", []),
            "adverse_reactions": fda_data.get("adverse_reactions", []),
            "drug_interactions": fda_data.get("drug_interactions", []),
        }
        prompt = f"""You are a pharmacist for MedBridge. A patient looked up "{req.drug_name}".
I have official FDA label data for this drug (some fields might be lists of strings, summarize them): {json.dumps(context)}

Please summarize this data into a patient-friendly format. 
Return ONLY JSON:
{{"generic_name":"...","what_for":"...","how_to_take":"...","side_effects":"...","avoid":"..."}}"""
    else:
        prompt = f"""You are a pharmacist for MedBridge. Patient looked up "{req.drug_name}".
I couldn't find official FDA data for this specific name, so please provide general information from your knowledge.
Return ONLY JSON:
{{"generic_name":"...","what_for":"...","how_to_take":"...","side_effects":"...","avoid":"..."}}"""

    response = groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}]
    )
    
    content = response.choices[0].message.content
    if "```json" in content:
        content = content.split("```json")[1].split("```")[0]
    elif "```" in content:
        content = content.split("```")[1].split("```")[0]
    
    result = json.loads(content.strip())
    result["source"] = "OpenFDA" if fda_data else None
    return result

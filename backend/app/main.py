from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import analyse, drug, symptom, notify

app = FastAPI(title="MedBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(analyse.router)
app.include_router(drug.router)
app.include_router(symptom.router)
app.include_router(notify.router)

@app.get("/")
def health():
    return {"status": "MedBridge API running"}
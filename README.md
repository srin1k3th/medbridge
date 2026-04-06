## MEDBRIDGE
MedBridge bridges the critical gap between hospital discharge and home recovery. It transforms complex medical discharge documents into simple, actionable guidance and keeps the patient's doctor in the loop when something goes wrong.

Every year, millions of patients are discharged from Indian hospitals with documents written for doctors, not patients. They go home confused about their diagnosis, unsure how to take their medications, and with no accessible support system when something feels wrong. This leads to missed doses, ignored warning signs, and preventable readmissions — disproportionately affecting elderly, low-literacy, and non-English-speaking patients.

## FEATURES EXPLAINED -

Discharge Explainer: Upload a discharge PDF or paste text → get a plain-language summary of diagnosis, home care steps, and warning signs in seconds 
Symptom Checker: Describe a symptom → AI classifies it as **Safe / Monitor / Urgent** based on the patient's age, diagnosis, and current medications. One tap sends a structured WhatsApp alert to the doctor 
Prescription Tracker: Upload a prescription PDF → AI extracts all medications and saves them to a personal history. No re-uploading needed 
Drug Lookup: Search any drug for usage, dosage, side effects, and interactions — contextualised to the patient's current regimen 
Reminders: Configurable medication and appointment reminders on the homepage, accessible to patients and caregivers 
Multilingual: Full support for English, Hindi, and Tamil 

## TECH STACK - 


 #### Frontend
 Next.js 16 with React 19 — mobile-first UI running in the browser
 pdfjs-dist — client-side PDF text extraction (no file uploads to server)
 Supabase Auth — JWT-based login and session management

 #### Backend
 Python + FastAPI — lightweight async REST API
 Every route is JWT-protected via Supabase

  AI / LLM
 Groq API with LLaMA 3.3 70B — powers discharge explanation, medication extraction, drug lookup, and symptom classification
 Response time under 2 seconds — critical for a patient-facing app where waiting feels alarming

  Database
 Supabase (PostgreSQL) with row-level security
 Patients can only read and write their own data — RLS enforced at the database level

  Messaging
 Twilio WhatsApp API — structured doctor notifications via WhatsApp, India's most-used messaging platform

  Language Support
 LLM is prompted to respond directly in Hindi or Tamil
 Deep Translator (Google Translate) for high-quality regional language 


## PREREQUISITES -

  Node.js    24.11.1  
  Python     It will not run on 3.14 so it's recommended to run on Python version 3.13.5 or below
  Supabase   https://supabase.com
  Groq API   https://console.groq.com
  Twilio     https://twilio.com



### CLONING -

 
 git clone https://github.com/sevizz/Medbridge
 


 ### ENVIRONMENT VARIABLES -

 in the frontend folder create file .env.local
       
       NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
       NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
       NEXT_PUBLIC_API_URL=http://localhost:8000

       

in the backend folder create file .env

      SUPABASE_URL=your_supabase_url
      SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
      GROQ_API_KEY=your_groq_api_key
      TWILIO_ACCOUNT_SID=your_twilio_sid
      TWILIO_AUTH_TOKEN=your_twilio_auth_token
      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

  
#### RUNNING THE BACKEND -

    cd backend
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

#### RUNNING THE FRONTEND -

    cd frontend
    npm install
    npm run dev

## PROJECT STRUCTURE -

    medbridge/
    ├── frontend/               # Next.js 16 + React 19
    │   ├── app/                # App router pages
    │   ├── components/         # Reusable UI components
    │   └── lib/                # Supabase client, API helpers
    │
    ├── backend/                # Python + FastAPI
    │   ├── main.py             # App entry point
    │   ├── routes/             # API route handlers
    │       ├── discharge.py    # Discharge explainer
    │       ├── symptoms.py     # Symptom checker + WhatsApp alert
    │       ├── prescriptions.py# Prescription extraction + history
    │       ├── drugs.py        # Drug lookup
    │       └── reminders.py    # Reminder management
    │  
    │
    └── README.md


## KNOWN LIMITATIONS -

   These are active work-in-progress items, not hidden issues:

   1. LLM Output Reliability — The system relies on the LLM returning valid JSON. Malformed output currently causes a crash. A retry mechanism with schema validation is planned.

   2. Scanned PDF Support — `pdfjs-dist` works well on digital PDFs but fails on scanned documents, which are extremely common in Indian hospitals. Google Vision API OCR integration is on the roadmap.

   3. Offline Support — All features require an internet connection. Background push notifications are not yet implemented, so reminders require the app to be open. PWA + Firebase Cloud Messaging support is planned.


## ROADMAP -

-   Structured LLM output with retry and schema validation
-  Google Vision OCR for scanned discharge summaries
-  PWA with offline mode
-  Firebase Cloud Messaging for background medication reminders
-  Doctor side of the portal to manage records




    


 
 

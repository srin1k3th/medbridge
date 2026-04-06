# MedBridge — Product Requirements Document

## Overview
MedBridge bridges the critical gap between hospital discharge and home recovery. It transforms complex medical discharge documents into simple, actionable guidance and keeps the patient's doctor in the loop when something goes wrong. Targeting elderly, low-literacy, and non-English-speaking patients in India.

## Tech Stack
- **Frontend**: Next.js 16 + React 19, running on http://localhost:3000
- **Backend**: Python + FastAPI, running on http://localhost:8000
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **AI**: Groq API with LLaMA 3.3 70B
- **Messaging**: Twilio WhatsApp API
- **Auth**: Supabase Auth (JWT-based)

## User Roles
- **Patient / Caregiver**: Primary user. Signs up, uploads discharge summaries, checks symptoms, manages medications and appointments.

## Core Features

### 1. Authentication
- **Sign Up**: User enters first name, age, email, password, diagnosis/condition, doctor's name, doctor's WhatsApp number. Profile is saved to Supabase `profiles` table.
- **Sign In**: Email + password login via Supabase Auth.
- **Sign Out**: Clears session and redirects to login.
- **Profile Page**: Displays user's name, age, condition, and doctor on record.

### 2. Discharge Explainer (`/discharge`)
- User pastes or uploads text from a discharge summary PDF.
- PDF text is extracted client-side using pdfjs-dist (no file upload to server).
- Text is sent to `POST /analyse` on the backend.
- LLM returns a plain-language JSON summary with 4 fields:
  - `what_happened`: Plain-language diagnosis explanation
  - `home_care`: Step-by-step home care instructions
  - `warning_signs`: Symptoms that should prompt a doctor visit
  - `follow_up`: Follow-up appointment and medication instructions
- Supports English, Hindi, and Tamil via `language` parameter.
- Result is saved to `discharge_analyses` table in Supabase.

### 3. Symptom Checker (`/symptom`)
- User describes a symptom in free text.
- Sent to `POST /symptom` with optional patient context (age, diagnosis, medications).
- LLM classifies as **SAFE**, **MONITOR**, or **URGENT** with explanation and recommended action.
- If URGENT or user chooses, a WhatsApp alert is sent to the doctor via `POST /notify`.
- Result saved to `symptom_logs` table.

### 4. Prescription Tracker (`/prescriptions`)
- User uploads a prescription PDF or pastes text.
- `POST /prescriptions/extract-and-save` extracts all medications using LLM.
- Returns: drug name, dosage, frequency, duration, notes.
- Saved to `prescriptions` table in Supabase.
- User can view full prescription history and delete individual prescriptions.
- `POST /prescriptions/parse-visit` extracts full visit details (patient name, doctor, date, medicines).

### 5. Drug Lookup (`/drugs`)
- User searches for any drug by name.
- `POST /drug` queries OpenFDA API first for official label data.
- If found, LLM summarises into patient-friendly format.
- If not found, LLM uses general knowledge.
- Returns: generic name, what it's for, how to take it, side effects, what to avoid.

### 6. Reminders (`/reminders`)
- Two types: **Medicine reminders** (daily, recurring) and **Appointment reminders** (specific date).
- User adds medicine name, dose, time of day.
- User adds appointment with doctor name, location, date, time.
- Can mark reminders as done (toggle) or delete them.
- Stored in `reminders` table. Today's medications shown separately from appointments.

### 7. Profile (`/profile`)
- Displays: name, age, condition/diagnosis, doctor name, doctor WhatsApp number.
- Sign out button.

## Navigation
- Bottom navigation bar: Home, Discharge, Symptom, Prescriptions, Reminders, Profile.
- Root `/` redirects to `/login` if unauthenticated, or `/home` if authenticated.

## Database Tables
| Table | Key Fields |
|---|---|
| `profiles` | id, fname, age, diagnosis, doctor_name, doctor_whatsapp |
| `discharge_analyses` | user_id, original_text, language, what_happened, home_care, warning_signs, follow_up |
| `prescriptions` | user_id, drug_name, dosage, frequency, duration, notes, source |
| `symptom_logs` | user_id, symptom_text, classification, explanation, doctor_notified |
| `reminders` | user_id, drug_name, dose, time_of_day, date, is_done |

## API Endpoints (Backend at http://localhost:8000)
| Method | Path | Description |
|---|---|---|
| POST | /analyse | Discharge summary → plain-language summary |
| POST | /prescriptions/extract-and-save | Extract medications from text |
| POST | /prescriptions/parse-visit | Parse full visit details |
| GET | /prescriptions | Get user's prescription history |
| DELETE | /prescriptions/{id} | Delete a prescription |
| POST | /symptom | Classify symptom |
| POST | /notify | Send WhatsApp alert to doctor |
| POST | /drug | Drug information lookup |
| POST | /profile | Upsert user profile |
| GET | /profile | Get user profile |

## Key User Flows

### Signup Flow
1. Navigate to `/signup`
2. Fill in name, age, email, password, diagnosis, doctor name, doctor WhatsApp
3. Click "Create Account"
4. Redirected to `/home`

### Discharge Analysis Flow
1. Navigate to `/discharge`
2. Upload a PDF or paste text
3. Select language (EN/HI/TA)
4. Click "Analyse"
5. View plain-language summary with 4 sections

### Symptom Check Flow
1. Navigate to `/symptom`
2. Describe symptom
3. Click "Check"
4. View SAFE/MONITOR/URGENT classification
5. Optionally tap "Alert Doctor" to send WhatsApp message

### Add Reminder Flow
1. Navigate to `/reminders`
2. Select Medicine or Appointment tab
3. Fill in details
4. Click "Add"
5. Reminder appears in today's list or appointments list

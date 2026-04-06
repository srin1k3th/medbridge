# MedBridge — Goals & Technical Roadmap

## What is MedBridge?
MedBridge bridges the gap between hospital discharge and home recovery. It transforms complex medical discharge documents into simple, actionable guidance and keeps the patient's doctor in the loop when something goes wrong. Targeting elderly, low-literacy, and non-English-speaking patients in India.

---

## 🛠️ Technical Wishlist (Priority Order)

| Priority | Improvement | Effort | Impact |
|---|---|---|---|
| 🥇 | Streaming LLM responses | Low | High UX |
| 🥈 | Structured LLM output / JSON Mode | Low | High reliability |
| 🥉 | RAG for drug lookup | Medium | High trust |
| 4 | Auto-generate reminders from discharge analysis | Medium | High utility |
| 5 | Prompt injection guardrails | Medium | Critical for safety |
| 6 | Longitudinal patient memory | High | High clinical value |
| 7 | Confidence scoring + uncertainty flagging | Low | Medium trust |

---

## 🔒 1. Structured Output / JSON Mode for LLM Calls
Currently `extractAndSavePrescriptions` uses a hacky regex to find a JSON array inside the LLM's free-text response — brittle and error-prone.

**Goal:** Use structured output (e.g., Groq's JSON mode / `response_format`) to guarantee the LLM always returns parseable data. No more try/catch regex fallbacks.

**Affected files:**
- `backend/app/routes/analyse.py` — all Groq calls
- `backend/app/routes/symptom.py`
- `frontend/lib/api.ts` — `extractAndSavePrescriptions` regex fallback

---

## 🧠 2. Patient Memory / Longitudinal Context
The app fetches a flat profile row (name, age, diagnosis) but knows nothing about the patient's history.

**Goal:** A session/memory layer that:
- Tracks symptom check history over time
- Detects patterns ("3rd time in 5 days reporting dizziness → escalate")
- Lets the LLM reference prior symptoms ("compared to last week...")

**Affected files:**
- `supabase/migrations/` — new `symptom_patterns` or enriched `symptom_logs` query
- `backend/app/routes/symptom.py` — fetch history before LLM call

---

## ⚡ 3. Streaming LLM Responses
Currently the UI spins for 3–5 seconds with no feedback during discharge analysis.

**Goal:** Stream responses word-by-word using Server-Sent Events (FastAPI `StreamingResponse` → Next.js `ReadableStream`), making the app feel dramatically faster.

**Affected files:**
- `backend/app/routes/analyse.py` — `StreamingResponse` with Groq streaming
- `frontend/app/discharge/` — consume SSE stream and render incrementally

---

## 🛡️ 4. Input Validation & Prompt Injection Defense
No sanitisation on user inputs before they go into prompts. A user could attempt prompt injection attacks — especially dangerous for a medical app.

**Goal:** A guardrail layer that screens inputs before the main LLM call.

**Options:**
- Fast classifier prompt (cheap LLM call screening for malicious intent)
- [Guardrails AI](https://github.com/guardrails-ai/guardrails) library

**Affected files:**
- `backend/app/routes/analyse.py`, `symptom.py`, `drug.py`

---

## 📊 5. Confidence Scoring + Uncertainty Flagging
The symptom checker returns `SAFE / MONITOR / URGENT` with no confidence signal.

**Goal:** Add a `confidence` field to the LLM response schema and surface it in the UI:
- "High confidence: SAFE"
- "Uncertain — please call your doctor"

**Affected files:**
- `backend/app/routes/symptom.py` — update prompt schema
- `frontend/app/symptom/` — render confidence indicator

---

## 🔔 6. Proactive Reminder Intelligence
Reminders are entirely manual right now. The discharge analysis already extracts medications — these two features are disconnected.

**Goal:**
- Auto-generate reminders from discharge analysis output
- Push notifications instead of app-open-required polling
- Flag missed doses for doctor notification

**Affected files:**
- `backend/app/routes/analyse.py` — trigger reminder insert after extraction
- `frontend/app/reminders/` — show auto-generated vs. manual reminders

---

## 🌐 7. Multilingual Support (Consistent i18n)
`/analyse` accepts a `language` param, but the rest of the app (symptom checker, drug lookup) ignores it.

**Goal:** Pass user's preferred language consistently across all LLM calls + full UI i18n for Hindi/Tamil.

**Affected files:**
- `backend/app/routes/symptom.py`, `drug.py` — accept + use `language` param
- `frontend/` — i18n layer for UI strings

---

## 🧪 Testing
- Using **TestSprite** for end-to-end AI-powered testing
- See `testsprite.config.*` for setup

---

## Known Limitations (Active WIP)
1. **LLM Output Reliability** — malformed JSON causes crashes; structured output (goal #1) fixes this
2. **Scanned PDF Support** — pdfjs-dist fails on scanned docs; Google Vision OCR on roadmap
3. **Offline Support** — all features require internet; PWA + FCM planned

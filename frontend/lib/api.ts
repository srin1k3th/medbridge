import { supabase } from './supabase'

const B = process.env.NEXT_PUBLIC_API_URL

async function h(isFormData = false) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || ''
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (!isFormData) headers['Content-Type'] = 'application/json'
  return headers
}

// ─── Discharge ───────────────────────────────────────────────────────────────

/** Non-streaming analyse (kept for compatibility) */
export async function analyseDischarge(text: string, language: string) {
  const res = await fetch(`${B}/analyse`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/** Returns a ReadableStream for SSE consumption — use in discharge page */
export async function analyseDischargeStream(text: string, language: string): Promise<ReadableStream> {
  const headers = await h()
  const res = await fetch(`${B}/analyse/stream`, {
    method: 'POST', headers,
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.body!
}

// ─── Drug Lookup ──────────────────────────────────────────────────────────────

export async function lookupDrug(drug_name: string, language = 'en') {
  const res = await fetch(`${B}/drug`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify({ drug_name, language }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Symptom Checker ──────────────────────────────────────────────────────────

export async function checkSymptom(symptom: string, patient_context: string, language = 'en') {
  const res = await fetch(`${B}/symptom`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify({ symptom, patient_context, language }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Doctor Notification ──────────────────────────────────────────────────────

export async function notifyDoctor(p: {
  symptom_text: string; classification: string; patient_name: string;
  patient_age: string; patient_diagnosis: string; doctor_name: string;
  doctor_whatsapp: string; medications: string[]
}) {
  const res = await fetch(`${B}/notify`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify(p),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Voice Transcription ──────────────────────────────────────────────────────

export async function transcribeVoice(audioBlob: Blob, language = 'en', filename = 'recording.webm') {
  const formData = new FormData()
  formData.append('audio', audioBlob, filename)
  formData.append('language', language)

  const res = await fetch(`${B}/voice/transcribe`, {
    method: 'POST',
    headers: await h(true),  // no Content-Type — browser sets multipart boundary
    body: formData,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<{ transcript: string; language: string }>
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function getReminders() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase.from('reminders')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', today)
    .order('date')
    .order('time_of_day')
  if (error) throw error
  return data || []
}

export async function addReminder(drug_name: string, dose: string, time_of_day: string, date?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('reminders').insert({
    user_id: user!.id, drug_name, dose, time_of_day, date: date || today,
  })
  if (error) throw error
}

export async function deleteReminder(id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('reminders').delete().eq('id', id).eq('user_id', user.id)
  if (error) throw error
}

export async function toggleReminder(id: string, is_done: boolean) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('reminders').update({ is_done }).eq('id', id).eq('user_id', user.id)
  if (error) throw error
}

// ─── Prescriptions ────────────────────────────────────────────────────────────

export async function getPrescriptions() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('prescriptions')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function deletePrescription(id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('prescriptions').delete().eq('id', id).eq('user_id', user.id)
  if (error) throw error
}

/**
 * Extract medications from discharge text via the backend (schema-validated,
 * auto-generates reminders). Replaces the old client-side regex approach.
 */
export async function extractAndSavePrescriptions(text: string): Promise<{ saved: number; reminders_created: number }> {
  const res = await fetch(`${B}/prescriptions/extract-and-save`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function parseVisitPrescription(text: string) {
  const res = await fetch(`${B}/prescriptions/parse-visit`, {
    method: 'POST', headers: await h(),
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Drugs ────────────────────────────────────────────────────────────────────

export async function getDrugs() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('drugs').select('*').eq('user_id', user.id).order('created_at')
  if (error) throw error
  return data || []
}

export async function saveDrug(drug_name: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('drugs').insert({ user_id: user!.id, drug_name })
  if (error) throw error
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export async function getAuditLog(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('audit_log')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
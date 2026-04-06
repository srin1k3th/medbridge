import { supabase } from './supabase'
const B = process.env.NEXT_PUBLIC_BACKEND_URL
async function h() {
  const { data } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }
}
export async function analyseDischarge(text: string, language: string) {
  const res = await fetch(`${B}/analyse`, { method: 'POST', headers: await h(), body: JSON.stringify({ text, language }) })
  if (!res.ok) throw new Error(await res.text()); return res.json()
}
export async function lookupDrug(drug_name: string) {
  const res = await fetch(`${B}/drug`, { method: 'POST', headers: await h(), body: JSON.stringify({ drug_name }) })
  if (!res.ok) throw new Error(await res.text()); return res.json()
}
export async function checkSymptom(symptom: string, patient_context: string) {
  const res = await fetch(`${B}/symptom`, { method: 'POST', headers: await h(), body: JSON.stringify({ symptom, patient_context }) })
  if (!res.ok) throw new Error(await res.text()); return res.json()
}
export async function notifyDoctor(p: { symptom_text: string; classification: string; patient_name: string; patient_age: string; patient_diagnosis: string; doctor_name: string; doctor_whatsapp: string; medications: string[] }) {
  const res = await fetch(`${B}/notify`, { method: 'POST', headers: await h(), body: JSON.stringify(p) })
  if (!res.ok) throw new Error(await res.text()); return res.json()
}
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
  if (error) throw error; return data || []
}
export async function addReminder(drug_name: string, dose: string, time_of_day: string, date?: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split('T')[0]
  const { error } = await supabase.from('reminders').insert({ user_id: user!.id, drug_name, dose, time_of_day, date: date || today })
  if (error) throw error
}
export async function deleteReminder(id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
}
export async function toggleReminder(id: string, is_done: boolean) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('reminders').update({ is_done }).eq('id', id).eq('user_id', user.id)
  if (error) throw error
}
export async function getDrugs() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase.from('drugs').select('*').eq('user_id', user.id).order('created_at')
  if (error) throw error; return data || []
}
export async function saveDrug(drug_name: string) {
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('drugs').insert({ user_id: user!.id, drug_name })
  if (error) throw error
}
export async function getPrescriptions() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
export async function deletePrescription(id: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('prescriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
  if (error) throw error
}
export async function extractAndSavePrescriptions(text: string) {
  const extractPrompt = `You are a medical data extractor. Extract ALL medications mentioned in this discharge summary.
Return ONLY a valid JSON array, no other text or markdown:
[{"drug_name":"...","dosage":"...","frequency":"...","duration":"...","notes":"..."}]
Use null for any unknown fields. Discharge summary:
${text}`

  const res = await fetch(`${B}/analyse`, {
    method: 'POST',
    headers: await h(),
    body: JSON.stringify({ text: extractPrompt, language: 'en' }),
  })
  if (!res.ok) throw new Error('Failed to extract prescriptions')

  const raw = await res.json()
  const responseText = typeof raw === 'string' ? raw : JSON.stringify(raw)
  let medications: any[] = []
  try {
    medications = JSON.parse(responseText)
  } catch {
    const match = responseText.match(/\[[\s\S]*\]/)
    if (match) medications = JSON.parse(match[0])
  }

  if (!Array.isArray(medications) || medications.length === 0) {
    throw new Error('No medications found')
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const rows = medications.map((p: any) => ({
    user_id: user.id,
    drug_name: p.drug_name,
    dosage: p.dosage || null,
    frequency: p.frequency || null,
    duration: p.duration || null,
    notes: p.notes || null,
  }))

  const { error } = await supabase.from('prescriptions').insert(rows)
  if (error) throw error
  return { saved: rows.length }
}

export async function parseVisitPrescription(text: string) {
  const { data } = await supabase.auth.getSession()
  const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/prescriptions/parse-visit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session?.access_token}`
    },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(await res.text());
  return res.json()
}
import { supabase } from './supabase'
export async function signUp(email: string, password: string, p: {fname:string;age:string;diagnosis:string;doctorName:string;doctorNum:string}) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  await supabase.from('profiles').insert({ id: data.user!.id, fname: p.fname, age: parseInt(p.age)||null, diagnosis: p.diagnosis, doctor_name: p.doctorName, doctor_whatsapp: p.doctorNum })
  return data
}
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error; return data
}
export async function signOut() { await supabase.auth.signOut() }
export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}
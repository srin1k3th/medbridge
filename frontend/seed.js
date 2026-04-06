import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sphcrbpqjxdlebplzqsz.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwaGNyYnBxanhkbGVicGx6cXN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTQzNjAsImV4cCI6MjA5MTAzMDM2MH0.eIAFEY2UfHxbFBPfCoBvEHuIB2MlHbCQZccmQOukhV8'
const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  console.log('Seeding test user example@gmail.com...')
  
  // 1. Sign up user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: 'example@gmail.com',
    password: 'password123',
  })
  if (authError) {
    if (authError.message.includes('already registered')) {
         console.log('User already exists, just upserting profile')
    } else {
         throw authError
    }
  }

  // Use email auth flow if needed or just upsert profile directly
  // 2. Fetch the newly created (or existing user id)
  const { data: { session } } = await supabase.auth.signInWithPassword({
    email: 'example@gmail.com',
    password: 'password123',
  })

  // 3. Upsert profile
  if (session?.user) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: session.user.id,
      fname: 'Test',
      age: 40,
      diagnosis: 'Testing',
      doctor_name: 'Dr. Test',
      doctor_whatsapp: '+1234567890'
    })
    if (profileError) throw profileError
    console.log('Test user created and profile seeded successfully!')
  }
}

seed().catch(console.error)

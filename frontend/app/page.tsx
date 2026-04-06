'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Root() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/home')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.replace('/home')
      } else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
        router.replace('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  return <div>Loading...</div>
}







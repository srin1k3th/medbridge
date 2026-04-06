'use client'
import { supabase } from '../../lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getProfile } from '@/lib/auth'
import { getReminders } from '@/lib/api'

const CARDS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      </svg>
    ),
    title: 'Discharge Explainer',
    desc: 'Upload your summary and get a plain-language explanation in your language.',
    path: '/discharge',
    grad: 'linear-gradient(135deg, rgba(255,90,95,0.18) 0%, rgba(255,90,95,0.03) 100%)',
    border: 'rgba(255,90,95,0.25)',
    accent: '#FF5A5F',
    glow: 'rgba(255,90,95,0.15)',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 2v2" />
        <path d="M5 2v2" />
        <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
        <circle cx="20" cy="10" r="2" />
      </svg>
    ),
    title: 'Symptom Checker',
    desc: 'Describe how you\'re feeling and get guidance on what to do next.',
    path: '/symptom',
    grad: 'linear-gradient(135deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.03) 100%)',
    border: 'rgba(167,139,250,0.25)',
    accent: '#A78BFA',
    glow: 'rgba(167,139,250,0.15)',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </svg>
    ),
    title: 'Prescription History',
    desc: 'View and manage your full prescription history over time.',
    path: '/prescriptions',
    grad: 'linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(251,191,36,0.03) 100%)',
    border: 'rgba(251,191,36,0.25)',
    accent: '#FBBF24',
    glow: 'rgba(251,191,36,0.12)',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
    title: 'Drug Lookup',
    desc: 'Search for medication details, side effects, and safety information.',
    path: '/prescriptions?tab=lookup',
    grad: 'linear-gradient(135deg, rgba(0,201,167,0.18) 0%, rgba(0,201,167,0.03) 100%)',
    border: 'rgba(0,201,167,0.25)',
    accent: '#00C9A7',
    glow: 'rgba(0,201,167,0.15)',
  },
]

export default function HomePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [reminders, setReminders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };

  const pendingCount = reminders.filter(r => !r.is_done).length
  const nextMed = reminders.find(r => !r.is_done && !r.drug_name.startsWith('[APPT]')) || null
  const nextAppt = reminders.find(r => !r.is_done && r.drug_name.startsWith('[APPT]')) || null

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session) { router.replace('/login'); return }
        Promise.all([
          getProfile().then(p => setProfile(p)),
          getReminders().then(r => setReminders(r)).catch(() => { })
        ]).finally(() => { clearTimeout(timeout); setLoading(false) })
      }
    })

    return () => { subscription.unsubscribe(); clearTimeout(timeout) }
  }, [router])

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    setScrolled(e.currentTarget.scrollTop > 260)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '80px' }}>
      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: 'rgba(245,240,232,0.25)', letterSpacing: '0.1em' }}>LOADING…</span>
    </div>
  )

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', paddingBottom: '96px' }}
      >
        <div style={{ padding: '20px 24px 20px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)', marginBottom: '4px' }}>
                Welcome back
              </div>
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: '2px', letterSpacing: '-0.03em' }}>
                {profile?.fname || '—'}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)', marginBottom: '4px' }}>
                {profile?.diagnosis || '—'}
              </div>
            </div>

            <div
              onClick={() => router.push('/profile')}
              style={{ position: 'relative', cursor: 'pointer' }}
            >
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.85)', transition: 'all 0.2s',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="7" r="4" />
                  <path d="M4 21v-1a8 8 0 0116 0v1" />
                </svg>
              </div>
              <div style={{
                position: 'absolute', bottom: '1px', right: '1px',
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#34D399', border: '2px solid #0F0C29',
                boxShadow: '0 0 8px rgba(52,211,153,0.5)'
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              onClick={() => router.push('/reminders')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '20px',
                padding: '5px 12px',
                cursor: 'pointer',
                transition: 'opacity 0.35s ease, transform 0.35s ease',
                opacity: scrolled ? 1 : 0,
                transform: scrolled ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.9)',
                pointerEvents: scrolled ? 'auto' : 'none',
              }}
            >
              <span style={{ fontSize: '0.95rem' }}>🔔</span>
              {pendingCount > 0 && (
                <span style={{
                  background: '#FF5A5F',
                  color: '#fff',
                  fontSize: '0.58rem',
                  fontWeight: 800,
                  fontFamily: 'JetBrains Mono, monospace',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  minWidth: '16px',
                  textAlign: 'center',
                }}>
                  {pendingCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>


          {nextMed && (
            <div
              onClick={() => router.push('/reminders')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid #FF5A5F`,
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: scrolled ? 0 : 1,
                maxHeight: scrolled ? '0px' : '100px',
                overflow: 'hidden',
                marginBottom: scrolled ? '-12px' : '4px',
                pointerEvents: scrolled ? 'none' : 'auto',
                boxShadow: '0 8px 24px rgba(255,90,95,0.12)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(255, 90, 95, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255,90,95,0.2)',
                  color: '#FF5A5F'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                    Next medication due
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px', fontWeight: 500 }}>
                    {nextMed.drug_name}
                  </div>
                </div>
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                color: '#FF7B7F',
                fontWeight: 600,
                background: 'rgba(255,90,95,0.08)',
                padding: '4px 8px',
                borderRadius: '6px'
              }}>
                {nextMed.time_of_day?.slice(0, 5)}
              </div>
            </div>
          )}

          {nextAppt && (
            <div
              onClick={() => router.push('/reminders')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderLeft: `4px solid #FF5A5F`,
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                opacity: scrolled ? 0 : 1,
                maxHeight: scrolled ? '0px' : '100px',
                overflow: 'hidden',
                marginBottom: scrolled ? '-12px' : '4px',
                pointerEvents: scrolled ? 'none' : 'auto',
                boxShadow: '0 8px 24px rgba(255,90,95,0.1)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: 'rgba(255, 90, 95, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(255,90,95,0.2)',
                  color: '#FF5A5F'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
                    Next appointment
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px', fontWeight: 500 }}>
                    {nextAppt.drug_name.replace('[APPT] ', '')} · {formatDate(nextAppt.date)}
                  </div>
                </div>
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem',
                color: '#FF7B7F',
                fontWeight: 600,
                background: 'rgba(255,90,95,0.08)',
                padding: '4px 8px',
                borderRadius: '6px'
              }}>
                {nextAppt.time_of_day?.slice(0, 5)}
              </div>
            </div>
          )}

          {!nextMed && !nextAppt && (
            <div
              onClick={() => router.push('/reminders')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '14px',
                opacity: scrolled ? 0 : 0.6,
                pointerEvents: scrolled ? 'none' : 'auto',
                transition: 'all 0.4s',
                marginBottom: '4px'
              }}
            >
              <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                All caught up for now
              </div>
            </div>
          )}

          {CARDS.map(card => (
            <div
              key={card.path}
              onClick={() => router.push(card.path)}
              className="pressable"
              style={{
                background: card.grad,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${card.border}`,
                borderRadius: '20px', padding: '20px',
                cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: `0 4px 20px ${card.glow}`,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.6rem',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  {card.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: '4px', letterSpacing: '-0.02em' }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, fontWeight: 500 }}>
                    {card.desc}
                  </div>
                </div>
                <div style={{
                  fontSize: '1.2rem',
                  color: card.accent,
                  flexShrink: 0,
                  opacity: 0.8,
                  transition: 'transform 0.2s ease'
                }}>›</div>
              </div>
              <div style={{
                position: 'absolute', top: '-20%', right: '-10%',
                width: '100px', height: '100px',
                background: card.accent,
                filter: 'blur(60px)',
                opacity: 0.1,
                pointerEvents: 'none'
              }} />
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}







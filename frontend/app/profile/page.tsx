'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getProfile, signOut } from '@/lib/auth'

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  useEffect(() => { getProfile().then(setProfile).catch(() => { }) }, [])

  async function logout() { await signOut(); router.push('/login') }

  const initials = profile?.fname ? profile.fname.slice(0, 2).toUpperCase() : '—'

  const ROW: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px', padding: '14px 16px',
    marginBottom: '8px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between',
  }
  const SEC: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.32)', marginBottom: '10px', marginTop: '18px',
  }

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '96px' }}>

        <div style={{
          padding: '28px 16px 32px', textAlign: 'center', position: 'relative',
          background: 'linear-gradient(180deg, rgba(255,90,95,0.12) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF5A5F 0%, #A78BFA 100%)',
            margin: '0 auto 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 800, color: '#fff',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            boxShadow: '0 0 0 3px rgba(255,90,95,0.25), 0 0 24px rgba(255,90,95,0.3)',
          }}>
            {initials}
          </div>

          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.3rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)' }}>
            {profile?.fname || '—'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.38)', marginTop: '5px' }}>
            {[profile?.age && `${profile.age} years`, profile?.diagnosis].filter(Boolean).join(' · ') || 'Patient'}
          </div>
        </div>

        <div style={{ padding: '0 12px 20px' }}>
          <div style={SEC}>Account</div>

          <div style={ROW}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Name</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', fontFamily: 'JetBrains Mono, monospace' }}>{profile?.fname || '—'}</span>
          </div>
          <div style={ROW}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Age</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', fontFamily: 'JetBrains Mono, monospace' }}>{profile?.age || '—'}</span>
          </div>
          <div style={ROW}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>Condition</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.42)', fontFamily: 'JetBrains Mono, monospace' }}>{profile?.diagnosis || '—'}</span>
          </div>

          <div style={SEC}>Doctor on Record</div>

          <div style={{
            background: 'rgba(37,211,102,0.06)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(37,211,102,0.2)',
            borderLeft: '3px solid #25D366',
            borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
          }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#25D366', marginBottom: '5px' }}>
              WhatsApp Alerts
            </div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
              {profile?.doctor_name || 'No doctor added'}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
              {profile?.doctor_whatsapp || '—'}
            </div>
          </div>

          <button
            onClick={logout}
            style={{
              width: '100%', padding: '14px',
              background: 'transparent',
              color: '#FF7B7F',
              border: '1px solid rgba(255,90,95,0.3)',
              borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700,
              cursor: 'pointer', marginTop: '35px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'all 0.2s',
            }}
          >
             Sign Out
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}







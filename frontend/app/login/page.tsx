'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth'

const GLS_INP: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '12px',
  padding: '13px 16px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: '0.88rem',
  color: 'rgba(255,255,255,0.95)',
  outline: 'none',
  transition: 'border-color 0.2s',
}
const LABEL: React.CSSProperties = {
  display: 'block',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(255,255,255,0.38)',
  marginBottom: '7px',
}

function EkgHero() {
  return (
    <div style={{ position: 'relative', height: '56px', marginBottom: '8px' }}>
      <svg viewBox="0 0 320 56" fill="none" style={{ width: '100%', height: '100%' }}>
        <polyline
          points="0,28 40,28 55,8 65,48 75,18 90,38 100,28 160,28 175,8 185,48 195,18 210,38 220,28 280,28 295,8 305,48 315,18 320,28"
          stroke="url(#ekg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 500,
            strokeDashoffset: 500,
            animation: 'ekg 1.8s ease-out forwards',
          }}
        />
        <defs>
          <linearGradient id="ekg" x1="0" y1="0" x2="320" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF5A5F" />
            <stop offset="0.5" stopColor="#A78BFA" />
            <stop offset="1" stopColor="#00C9A7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pulsing" style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: '#FF5A5F',
        boxShadow: '0 0 16px rgba(255,90,95,0.7)',
      }} />
    </div>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setErr('')
    if (!email || !pass) { setErr('Please enter your email and password.'); return }
    setLoading(true)
    try {
      await signIn(email, pass)
      router.replace('/home')
    } catch (e: any) { setErr(e.message || 'Login failed. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '430px',
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,90,95,0.18) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '320px', height: '320px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,201,167,0.12) 0%, transparent 70%)' }} />
      </div>

      <div style={{ padding: '28px 28px 20px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.04em', marginBottom: '4px' }}>
          Med<span style={{ color: '#FF5A5F', textShadow: '0 0 20px rgba(255,90,95,0.6)' }}>Bridge</span>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>
          Post-Discharge Care
        </div>
        <EkgHero />
      </div>

      <div style={{ padding: '4px 16px 36px', flex: 1, overflowY: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '4px', marginBottom: '22px' }}>
          <div style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: '10px', background: 'linear-gradient(135deg,#FF5A5F,#E04449)', boxShadow: '0 0 16px rgba(255,90,95,0.4)', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>Sign In</div>
          <div onClick={() => router.push('/signup')} style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Create Account</div>
        </div>

        {err && (
          <div style={{ background: 'rgba(255,90,95,0.12)', border: '1px solid rgba(255,90,95,0.3)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', color: '#FF7B7F', marginBottom: '14px' }}>
            {err}
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={LABEL}>Email</label>
          <input style={GLS_INP} type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={LABEL}>Password</label>
          <input style={GLS_INP} type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '15px',
            background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#FF5A5F,#E04449)',
            color: '#fff', border: 'none', borderRadius: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.92rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 24px rgba(255,90,95,0.45), 0 4px 16px rgba(255,90,95,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}
        >
          {loading
            ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Signing in…</>
            : 'Sign In →'}
        </button>

        <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'rgba(255,255,255,0.18)', margin: '14px 0', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>— or —</div>

        <button
          onClick={() => router.push('/signup')}
          style={{
            width: '100%', padding: '14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 600,
            cursor: 'pointer', color: 'rgba(255,255,255,0.75)',
            transition: 'all 0.2s',
          }}
        >
          Create an Account
        </button>
      </div>
    </div>
  )
}







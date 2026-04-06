'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth'

const GLS_INP: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '12px',
  padding: '12px 16px',
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSize: '0.85rem',
  color: 'rgba(255,255,255,0.95)',
  outline: 'none',
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

export default function SignupPage() {
  const router = useRouter()
  const [f, setF] = useState({ fname: '', age: '', email: '', password: '', diagnosis: '', doctorName: '', doctorNum: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }))

  async function handleSignup() {
    setErr(''); setOk('')
    if (!f.fname) { setErr('Please enter your first name.'); return }
    if (!f.email || !f.email.includes('@')) { setErr('Please enter a valid email address.'); return }
    if (f.password.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setLoading(true)
    try {
      await signUp(f.email, f.password, f)
      setOk(`Account created! Welcome, ${f.fname}. Signing you in…`)
      setTimeout(() => router.push('/home'), 900)
    } catch (e: any) { setErr(e.message || 'Signup failed. Please try again.') }
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

      <div style={{ padding: '20px 28px 14px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.95)', letterSpacing: '-0.04em', marginBottom: '4px' }}>
          Med<span style={{ color: '#FF5A5F', textShadow: '0 0 20px rgba(255,90,95,0.6)' }}>Bridge</span>
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: 'rgba(255,255,255,0.35)' }}>
          Create your account
        </div>
      </div>

      <div style={{ padding: '0 16px 36px', flex: 1, overflowY: 'auto', position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '4px', marginBottom: '18px' }}>
          <div onClick={() => router.push('/login')} style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Sign In</div>
          <div style={{ flex: 1, padding: '10px', textAlign: 'center', borderRadius: '10px', background: 'linear-gradient(135deg,#FF5A5F,#E04449)', boxShadow: '0 0 16px rgba(255,90,95,0.4)', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>Create Account</div>
        </div>

        {err && <div style={{ background: 'rgba(255,90,95,0.12)', border: '1px solid rgba(255,90,95,0.3)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', color: '#FF7B7F', marginBottom: '12px' }}>{err}</div>}
        {ok && <div style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.78rem', color: '#34D399', marginBottom: '12px' }}>{ok}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <div><label style={LABEL}>First name</label><input style={GLS_INP} placeholder="Your name" value={f.fname} onChange={e => set('fname', e.target.value)} /></div>
          <div><label style={LABEL}>Age</label><input style={GLS_INP} type="number" placeholder="45" value={f.age} onChange={e => set('age', e.target.value)} /></div>
        </div>

        {[
          { k: 'email', t: 'email', l: 'Email', ph: 'you@example.com', ws: false },
          { k: 'password', t: 'password', l: 'Password (min 6 chars)', ph: '••••••••', ws: false },
          { k: 'diagnosis', t: 'text', l: 'Condition / Diagnosis', ph: 'e.g. Post-cardiac…', ws: false },
          { k: 'doctorName', t: 'text', l: "Doctor's name", ph: 'Dr. Suresh Kumar', ws: false },
          { k: 'doctorNum', t: 'tel', l: "Doctor's WhatsApp number", ph: '+91 98765 43210', ws: true },
        ].map(({ k, t, l, ph, ws }) => (
          <div key={k} style={{ marginBottom: '12px' }}>
            <label style={LABEL}>{l}</label>
            <input style={GLS_INP} type={t} placeholder={ph} value={(f as any)[k]} onChange={e => set(k, e.target.value)} />
          </div>
        ))}

        <button
          onClick={handleSignup}
          disabled={loading}
          style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#FF5A5F,#E04449)',
            color: '#fff', border: 'none', borderRadius: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.92rem', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 24px rgba(255,90,95,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '30px',
          }}
        >
          {loading
            ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /> Creating account…</>
            : 'Create Account →'}
        </button>
      </div>
    </div>
  )
}






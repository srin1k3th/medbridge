'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import { checkSymptom, notifyDoctor, getDrugs } from '@/lib/api'
import { getProfile } from '@/lib/auth'

const SUGGESTIONS = [
  'Feeling dizzy when I stand up',
  'Chest tightness and mild pain',
  'Swollen ankles and feet',
  'Short of breath climbing stairs',
  'Nausea after taking medications',
  'Fatigue and weakness all day',
]

const CLS: Record<string, { glow: string; border: string; badgeBg: string; badgeColor: string; label: string; emoji: string }> = {
  safe: { glow: 'rgba(52,211,153,0.2)', border: '#34D399', badgeBg: 'rgba(52,211,153,0.15)', badgeColor: '#34D399', label: 'Safe', emoji: '✅' },
  monitor: { glow: 'rgba(251,191,36,0.2)', border: '#FBBF24', badgeBg: 'rgba(251,191,36,0.15)', badgeColor: '#FBBF24', label: 'Monitor', emoji: '⚠️' },
  urgent: { glow: 'rgba(255,90,95,0.25)', border: '#FF5A5F', badgeBg: 'rgba(255,90,95,0.15)', badgeColor: '#FF7B7F', label: 'Urgent', emoji: '🚨' },
}

export default function SymptomPage() {
  const router = useRouter()
  const [symptom, setSymptom] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [drugs, setDrugs] = useState<string[]>([])

  const [modal, setModal] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTime, setSentTime] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getProfile().then(setProfile).catch(() => { })
    getDrugs().then(d => setDrugs(d.map((x: any) => x.drug_name))).catch(() => { })
  }, [])

  async function classify() {
    if (!symptom.trim()) return
    setLoading(true); setResult(null); setSent(false)
    const ctx = profile ? `Patient: ${profile.fname}, age ${profile.age || 'unknown'}. Condition: ${profile.diagnosis || 'unknown'}.` : ''
    try { setResult(await checkSymptom(symptom, ctx)) } catch { }
    setLoading(false)
  }

  async function sendNotify() {
    if (!profile?.doctor_whatsapp) return
    setSending(true)
    try {
      await notifyDoctor({ symptom_text: symptom, classification: result.classification, patient_name: profile.fname, patient_age: String(profile.age), patient_diagnosis: profile.diagnosis, doctor_name: profile.doctor_name, doctor_whatsapp: profile.doctor_whatsapp, medications: drugs })
      const now = new Date()
      setSentTime('Today ' + now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0'))
      setSent(true); setModal(false)
    } catch { }
    setSending(false)
  }

  const cls = result?.classification?.toLowerCase() || 'safe'
  const cs = CLS[cls] || CLS.safe
  const docLast = profile?.doctor_name?.split(' ').pop() || 'doctor'
  const now = new Date()
  const t = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Symptom Checker" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', paddingBottom: '96px', position: 'relative' }}>

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)', marginBottom: '8px' }}>
          Describe your symptom
        </div>
        <textarea
          value={symptom}
          onChange={e => setSymptom(e.target.value)}
          placeholder="e.g. I've been feeling dizzy when I stand up…"
          style={{
            width: '100%', padding: '14px 16px',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem',
            outline: 'none', background: 'rgba(255,255,255,0.06)',
            resize: 'none', height: '90px', lineHeight: 1.5,
            color: 'rgba(255,255,255,0.9)', marginBottom: '14px',
          }}
        />

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.38)', marginBottom: '8px' }}>
          Common post-discharge symptoms
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '18px' }}>
          {SUGGESTIONS.map(s => (
            <span
              key={s}
              onClick={() => setSymptom(s)}
              style={{
                padding: '6px 13px',
                border: '1px solid rgba(167,139,250,0.3)',
                borderRadius: '20px', fontSize: '0.72rem',
                color: 'rgba(167,139,250,0.85)', cursor: 'pointer',
                background: 'rgba(167,139,250,0.07)',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {s.split(' ').slice(0, 2).join(' ')}…
            </span>
          ))}
        </div>

        <button
          onClick={classify}
          disabled={loading || !symptom.trim()}
          style={{
            width: '100%', padding: '16px',
            background: loading || !symptom.trim() ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
            color: '#fff', border: 'none', borderRadius: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700,
            cursor: loading || !symptom.trim() ? 'not-allowed' : 'pointer',
            boxShadow: loading || !symptom.trim() ? 'none' : '0 0 20px rgba(167,139,250,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginBottom: '8px',
            opacity: !symptom.trim() ? 0.5 : 1,
            transition: 'all 0.2s',
          }}
        >
          {loading
            ? <><span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} /></>
            : ' Check Symptom'}
        </button>

        <button
          onClick={() => router.push('/prescriptions')}
          style={{
            width: '100%', padding: '13px',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.6)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', fontWeight: 600,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginBottom: '8px',
            transition: 'all 0.2s',
          }}
        >
           View Prescription History
        </button>

        {result && !sent && (
          <div className="fade-in" style={{
            borderRadius: '16px', padding: '18px', marginTop: '14px',
            border: `2px solid ${cs.border}`,
            background: `rgba(${cs.glow},0.1)`,
            boxShadow: `0 0 24px ${cs.glow}`,
          }}>
            <span style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '5px 12px', borderRadius: '20px', fontWeight: 600,
              marginBottom: '12px', display: 'inline-block',
              background: cs.badgeBg, color: cs.badgeColor,
            }}>
              {cs.emoji} {cs.label}
            </span>
            <div style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)', marginBottom: '12px' }}>
              {result.explanation} {result.action}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
               This is not a medical diagnosis. Always contact your doctor if unsure.
            </div>
            {profile?.doctor_whatsapp && (
              <button
                onClick={() => setModal(true)}
                style={{
                  width: '100%', padding: '13px', marginTop: '12px',
                  borderRadius: '10px', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s',
                  border: 'none',
                  background: cls === 'urgent' ? 'linear-gradient(135deg,#FF5A5F,#E04449)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  boxShadow: cls === 'urgent' ? '0 0 16px rgba(255,90,95,0.45)' : 'none',
                }}
              >
                {cls === 'urgent' ? `Alert Dr. ${docLast} now` : `Notify Dr. ${docLast}`}
              </button>
            )}
          </div>
        )}

        {sent && (
          <div className="fade-in" style={{
            background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.25)',
            borderRadius: '12px', padding: '14px', marginTop: '12px',
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
          }}>
            ✅ <strong>Message sent to {profile?.doctor_name || 'your doctor'}</strong> via WhatsApp.<br />
            Your doctor has been notified and will follow up when convenient.
            <div style={{ marginTop: '8px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)' }}>
              Logged · {sentTime}
            </div>
          </div>
        )}

        {modal && (
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(8,6,26,0.7)', display: 'flex', alignItems: 'flex-end', zIndex: 50, backdropFilter: 'blur(6px)' }}
            onClick={e => e.target === e.currentTarget && setModal(false)}
          >
            <div style={{
              width: '100%',
              background: 'linear-gradient(180deg, #1A1040 0%, #0F0C29 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '24px 24px 0 0', padding: '20px 20px 32px',
              animation: 'slideUp 0.3s ease',
            }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 20px' }} />
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', color: 'rgba(255,255,255,0.95)' }}>
                Notify your doctor?
              </div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: '16px', lineHeight: 1.5 }}>
                This exact message will be sent to their WhatsApp:
              </div>
              <div
                style={{ background: '#DCF8C6', borderRadius: '12px 12px 0 12px', padding: '12px 14px', fontSize: '0.76rem', lineHeight: 1.6, color: '#1A1A1A', marginBottom: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                dangerouslySetInnerHTML={{ __html: `<strong>Hi Dr. ${docLast},</strong><br><br>Your patient <strong>${profile?.fname} (${profile?.age}, ${profile?.diagnosis})</strong> has reported a symptom via MedBridge.<br><br><strong>Symptom:</strong> "${symptom}"<br><strong>Classification:</strong> ${result?.classification}  <br><br>Please follow up when convenient.<br><br>— MedBridge` }}
              />
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginBottom: '14px', fontFamily: 'JetBrains Mono, monospace' }}>MedBridge · {t}</div>
              <button
                onClick={sendNotify}
                disabled={sending}
                style={{ width: '100%', padding: '14px', background: '#25D366', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px', opacity: sending ? 0.7 : 1 }}
              >
                {sending ? 'Sending…' : 'Send via WhatsApp'}
              </button>
              <button
                onClick={() => setModal(false)}
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.82rem', cursor: 'pointer' }}
              >Not now</button>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}






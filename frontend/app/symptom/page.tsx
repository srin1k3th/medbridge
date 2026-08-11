'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import VoiceMicButton from '@/components/VoiceMicButton'
import { checkSymptom, notifyDoctor } from '@/lib/api'
import { supabase } from '@/lib/supabase'

const SUGGESTIONS = [
  'Chest pain or tightness',
  'Difficulty breathing',
  'Dizziness or fainting',
  'Severe headache',
  'High fever (above 102°F)',
  'Swelling in legs or feet',
  'Persistent vomiting',
  'Unusual weakness',
]

const LANGS = [['en', 'English'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी']]

const CLASSIFICATION_STYLES: Record<string, {
  border: string; glow: string; badgeBg: string; badgeColor: string; label: string; emoji: string
}> = {
  safe:    { border: '#34D399', glow: '52,211,153', badgeBg: 'rgba(52,211,153,0.12)', badgeColor: '#34D399', label: 'SAFE', emoji: '✅' },
  monitor: { border: '#FBBF24', glow: '251,191,36', badgeBg: 'rgba(251,191,36,0.12)', badgeColor: '#FBBF24', label: 'MONITOR', emoji: '⚠️' },
  urgent:  { border: '#FF5A5F', glow: '255,90,95',  badgeBg: 'rgba(255,90,95,0.12)',  badgeColor: '#FF5A5F', label: 'URGENT',  emoji: '🚨' },
  uncertain: { border: '#94A3B8', glow: '148,163,184', badgeBg: 'rgba(148,163,184,0.12)', badgeColor: '#94A3B8', label: 'UNCERTAIN', emoji: '🤔' },
}

export default function SymptomPage() {
  const router = useRouter()
  const [symptom, setSymptom] = useState('')
  const [lang, setLang] = useState('en')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [modal, setModal] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTime, setSentTime] = useState('')
  const [showReasoning, setShowReasoning] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  const classify = useCallback(async () => {
    if (!symptom.trim()) return
    setLoading(true); setResult(null); setSent(false); setShowReasoning(false)
    const ctx = profile
      ? `Patient: ${profile.fname}, age ${profile.age}, diagnosis: ${profile.diagnosis}.`
      : ''
    try {
      const res = await checkSymptom(symptom, ctx, lang)
      setResult(res)
      // Auto-open doctor modal on URGENT or low confidence
      if (res.classification === 'URGENT' || (res.confidence !== undefined && res.confidence < 0.7)) {
        setTimeout(() => profile?.doctor_whatsapp && setModal(true), 600)
      }
    } catch { }
    setLoading(false)
  }, [symptom, profile, lang])

  const handleVoiceTranscript = useCallback((text: string) => {
    setSymptom(prev => prev ? `${prev} ${text}` : text)
  }, [])

  const sendNotify = useCallback(async () => {
    if (!profile) return
    setSending(true)
    try {
      const meds = await supabase.from('prescriptions').select('drug_name').eq('user_id', profile.id)
      await notifyDoctor({
        symptom_text: symptom,
        classification: result?.classification || 'UNKNOWN',
        patient_name: profile.fname || '',
        patient_age: String(profile.age || ''),
        patient_diagnosis: profile.diagnosis || '',
        doctor_name: profile.doctor_name || '',
        doctor_whatsapp: profile.doctor_whatsapp || '',
        medications: (meds.data || []).map((m: any) => m.drug_name),
      })
      setSent(true); setModal(false)
      setSentTime(new Date().toLocaleTimeString())
    } catch { }
    setSending(false)
  }, [profile, symptom, result])

  const cls = result?.classification?.toLowerCase() || 'safe'
  const confidence: number | undefined = result?.confidence
  const isUncertain = confidence !== undefined && confidence < 0.7
  const cs = isUncertain ? CLASSIFICATION_STYLES.uncertain : (CLASSIFICATION_STYLES[cls] || CLASSIFICATION_STYLES.safe)
  const docLast = profile?.doctor_name?.split(' ').pop() || 'Doctor'
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  // Confidence arc rendering
  const renderConfidenceBar = (conf: number) => {
    const pct = Math.round(conf * 100)
    const color = conf >= 0.8 ? '#34D399' : conf >= 0.6 ? '#FBBF24' : '#FF5A5F'
    return (
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>
            Confidence
          </span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color }}>
            {pct}%{conf < 0.7 ? ' · escalating to human review' : ''}
          </span>
        </div>
        <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`, borderRadius: '3px',
            background: color,
            transition: 'width 0.6s ease',
            boxShadow: `0 0 8px ${color}88`,
          }} />
        </div>
        {isUncertain && (
          <div style={{
            marginTop: '8px', padding: '8px 12px', borderRadius: '8px',
            background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)',
            fontSize: '0.72rem', color: 'rgba(148,163,184,0.85)', lineHeight: 1.5,
          }}>
            🤔 <strong>Low confidence</strong> — AI is uncertain about this classification.
            {profile?.doctor_whatsapp ? ' Doctor notification recommended.' : ' Please consult your doctor.'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Symptom Checker" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', paddingBottom: '96px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {LANGS.map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)} style={{
              flex: 1, padding: '9px',
              border: `1px solid ${lang === code ? '#A78BFA' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px',
              background: lang === code ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.05)',
              color: lang === code ? '#A78BFA' : 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Voice input + text area */}
        <div style={{ position: 'relative' }}>
          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), classify())}
            placeholder="Describe your symptom… or tap 🎤 to speak"
            style={{
              width: '100%', padding: '13px 52px 13px 16px',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '14px',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.85rem',
              height: '90px', resize: 'none', outline: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.55, boxSizing: 'border-box',
            }}
          />
          {/* Voice button inset bottom-right of textarea */}
          <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
            <VoiceMicButton
              onTranscript={handleVoiceTranscript}
              language={lang}
              size={34}
            />
          </div>
        </div>

        {/* Quick suggestion chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {SUGGESTIONS.map(s => (
            <span key={s} onClick={() => setSymptom(s)} style={{
              padding: '6px 14px', borderRadius: '20px', fontSize: '0.72rem',
              color: 'rgba(167,139,250,0.85)', cursor: 'pointer',
              background: 'rgba(167,139,250,0.07)',
              border: '1px solid rgba(167,139,250,0.18)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              transition: 'all 0.15s',
            }}>
              {s.split(' ').slice(0, 3).join(' ')}…
            </span>
          ))}
        </div>

        {/* Classify button */}
        <button onClick={classify} disabled={loading || !symptom.trim()} style={{
          width: '100%', padding: '16px',
          background: loading || !symptom.trim() ? 'rgba(255,255,255,0.07)' : 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
          color: '#fff', border: 'none', borderRadius: '13px',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700,
          cursor: loading || !symptom.trim() ? 'not-allowed' : 'pointer',
          boxShadow: loading || !symptom.trim() ? 'none' : '0 0 20px rgba(167,139,250,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          opacity: !symptom.trim() ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          {loading
            ? <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
            : '🔬 Check Symptom'}
        </button>

        <button onClick={() => router.push('/prescriptions')} style={{
          width: '100%', padding: '13px', background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s',
        }}>
          📋 View Prescription History
        </button>

        {/* Result card */}
        {result && !sent && (
          <div className="fade-in" style={{
            borderRadius: '16px', padding: '18px', marginTop: '4px',
            border: `2px solid ${cs.border}`,
            background: `rgba(${cs.glow},0.08)`,
            boxShadow: `0 0 24px rgba(${cs.glow},0.2)`,
          }}>
            {/* Classification badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '5px 12px', borderRadius: '20px', fontWeight: 600,
                background: cs.badgeBg, color: cs.badgeColor,
              }}>
                {cs.emoji} {cs.label}
              </span>
            </div>

            {/* Confidence meter */}
            {confidence !== undefined && renderConfidenceBar(confidence)}

            {/* Explanation */}
            <div style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)', marginBottom: '12px' }}>
              {result.explanation}
            </div>
            <div style={{
              fontSize: '0.78rem', lineHeight: 1.55, color: 'rgba(255,255,255,0.65)',
              padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)', marginBottom: '12px',
            }}>
              💡 {result.action}
            </div>

            {/* Longitudinal context banner */}
            {result.history_count > 0 && (
              <div style={{
                fontSize: '0.68rem', color: 'rgba(167,139,250,0.7)', lineHeight: 1.4,
                padding: '7px 10px', borderRadius: '7px',
                background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)',
                marginBottom: '12px',
              }}>
                🧠 Based on {result.history_count} prior symptom record{result.history_count !== 1 ? 's' : ''} in your history
              </div>
            )}

            {/* Chain-of-thought reasoning (collapsible) */}
            {result.reasoning && (
              <div style={{ marginBottom: '12px' }}>
                <button onClick={() => setShowReasoning(r => !r)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                  fontSize: '0.67rem', color: 'rgba(255,255,255,0.35)',
                  fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
                  display: 'flex', alignItems: 'center', gap: '4px',
                }}>
                  {showReasoning ? '▲' : '▼'} WHY THIS CLASSIFICATION?
                </button>
                {showReasoning && (
                  <div style={{
                    marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
                    fontStyle: 'italic',
                  }}>
                    {result.reasoning}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              ⚕️ This is not a medical diagnosis. Always contact your doctor if unsure.
            </div>

            {profile?.doctor_whatsapp && (
              <button onClick={() => setModal(true)} style={{
                width: '100%', padding: '13px', marginTop: '12px', borderRadius: '10px',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s', border: 'none',
                background: (cls === 'urgent' || isUncertain) ? 'linear-gradient(135deg,#FF5A5F,#E04449)' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                boxShadow: (cls === 'urgent' || isUncertain) ? '0 0 16px rgba(255,90,95,0.45)' : 'none',
              }}>
                {cls === 'urgent' ? `🚨 Alert Dr. ${docLast} now` : isUncertain ? `⚠️ Escalate to Dr. ${docLast}` : `📱 Notify Dr. ${docLast}`}
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
              Logged @ {sentTime}
            </div>
          </div>
        )}

        {/* Doctor notification modal */}
        {modal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,6,26,0.75)', display: 'flex', alignItems: 'flex-end', zIndex: 50, backdropFilter: 'blur(6px)' }}
            onClick={e => e.target === e.currentTarget && setModal(false)}>
            <div style={{
              width: '100%', maxWidth: '430px', margin: '0 auto',
              background: 'linear-gradient(180deg, #1A1040 0%, #0F0C29 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '24px 24px 0 0', padding: '20px 20px 32px',
              animation: 'slideUp 0.3s ease',
            }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', margin: '0 auto 20px' }} />
              <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', color: 'rgba(255,255,255,0.95)' }}>
                {isUncertain ? '⚠️ Human Review Escalation' : '📱 Notify your doctor?'}
              </div>
              {isUncertain && (
                <div style={{ fontSize: '0.74rem', color: '#FBBF24', marginBottom: '10px', lineHeight: 1.5 }}>
                  AI confidence is low ({Math.round((confidence ?? 0) * 100)}%). Escalating to human review as a safety precaution.
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginBottom: '16px', lineHeight: 1.5 }}>
                This message will be sent to their WhatsApp:
              </div>
              <div style={{ background: '#DCF8C6', borderRadius: '12px 12px 0 12px', padding: '12px 14px', fontSize: '0.76rem', lineHeight: 1.6, color: '#1A1A1A', marginBottom: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                <strong>Hi Dr. {docLast},</strong><br /><br />
                Your patient <strong>{profile?.fname} ({profile?.age}, {profile?.diagnosis})</strong> reported a symptom via MedBridge.<br /><br />
                <strong>Symptom:</strong> "{symptom}"<br />
                <strong>Classification:</strong> {result?.classification}
                {confidence !== undefined && <><br /><strong>AI Confidence:</strong> {Math.round(confidence * 100)}%{isUncertain ? ' (low — human review needed)' : ''}</>}<br /><br />
                Please follow up when convenient.<br /><br />— MedBridge
              </div>
              <button onClick={sendNotify} disabled={sending} style={{
                width: '100%', padding: '14px', background: '#25D366', color: '#fff', border: 'none',
                borderRadius: '10px', fontSize: '0.88rem', fontWeight: 700,
                cursor: sending ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                marginBottom: '8px', opacity: sending ? 0.7 : 1,
              }}>
                {sending ? 'Sending…' : '📲 Send via WhatsApp'}
              </button>
              <button onClick={() => setModal(false)} style={{
                width: '100%', padding: '12px', background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px', fontSize: '0.82rem', cursor: 'pointer',
              }}>Not now</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <BottomNav />
    </div>
  )
}

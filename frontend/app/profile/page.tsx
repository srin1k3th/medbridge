'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { getProfile, signOut } from '@/lib/auth'
import { getAuditLog } from '@/lib/api'

const ACTION_META: Record<string, { icon: string; color: string; label: string }> = {
  discharge_analysis:        { icon: '📄', color: '#FF5A5F', label: 'Discharge Analysis' },
  discharge_analysis_stream: { icon: '⚡', color: '#FF5A5F', label: 'Discharge Analysis (Stream)' },
  symptom_check:             { icon: '🔬', color: '#A78BFA', label: 'Symptom Check' },
  drug_lookup:               { icon: '💊', color: '#00C9A7', label: 'Drug Lookup' },
  prescription_extraction:   { icon: '📋', color: '#34D399', label: 'Prescription Extraction' },
  visit_parse:               { icon: '🏥', color: '#34D399', label: 'Visit Parse' },
  doctor_notified:           { icon: '📲', color: '#25D366', label: 'Doctor Notified' },
  ocr_extraction:            { icon: '🔍', color: '#FBBF24', label: 'OCR Extraction' },
  voice_transcription:       { icon: '🎤', color: '#60A5FA', label: 'Voice Input' },
  guardrail_blocked:         { icon: '🛡️', color: '#FF5A5F', label: 'Input Blocked (Safety)' },
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [showAudit, setShowAudit] = useState(false)

  useEffect(() => {
    getProfile().then(setProfile).catch(() => { })
    getAuditLog(20).then(setAuditLog).catch(() => { })
  }, [])

  async function logout() { await signOut(); router.push('/login') }

  const initials = profile?.fname ? profile.fname.slice(0, 2).toUpperCase() : '?'

  const ROW: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
    padding: '14px 16px', marginBottom: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }
  const SEC: React.CSSProperties = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem',
    textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.32)', marginBottom: '10px', marginTop: '18px',
  }

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '96px' }}>

        {/* Profile header */}
        <div style={{
          padding: '28px 16px 32px', textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(255,90,95,0.12) 0%, transparent 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            background: 'linear-gradient(135deg,#FF5A5F 0%, #A78BFA 100%)',
            margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)',
            borderLeft: '3px solid #25D366', borderRadius: '12px', padding: '14px 16px', marginBottom: '8px',
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

          {/* ── Audit Log ── */}
          <div style={{ ...SEC, marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Activity History</span>
            <button onClick={() => setShowAudit(v => !v)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)',
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
            }}>
              {showAudit ? '▲ HIDE' : '▼ SHOW'}
            </button>
          </div>

          {/* Security trust badge */}
          <div style={{
            display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px',
          }}>
            {['RLS enforced', 'Audit trail', 'Guardrails active'].map(badge => (
              <span key={badge} style={{
                fontSize: '0.6rem', padding: '3px 10px', borderRadius: '20px',
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                color: '#34D399', fontFamily: 'JetBrains Mono, monospace',
              }}>🔒 {badge}</span>
            ))}
          </div>

          {showAudit && (
            <div style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', overflow: 'hidden', marginBottom: '16px',
            }}>
              {auditLog.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                  No activity yet
                </div>
              ) : auditLog.map((entry, i) => {
                const meta = ACTION_META[entry.action] || { icon: '•', color: 'rgba(255,255,255,0.3)', label: entry.action }
                return (
                  <div key={entry.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '11px 14px',
                    borderBottom: i < auditLog.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '1px' }}>{meta.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600, color: meta.color, marginBottom: '2px' }}>
                        {meta.label}
                      </div>
                      {entry.metadata?.classification && (
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {entry.metadata.classification}
                          {entry.metadata.confidence !== undefined && ` · ${Math.round(entry.metadata.confidence * 100)}% confidence`}
                        </div>
                      )}
                      {entry.metadata?.drug_name && (
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {entry.metadata.drug_name}
                          {entry.metadata.rag_chunks > 0 && ` · ${entry.metadata.rag_chunks} RAG chunks`}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                      {timeAgo(entry.created_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={logout} style={{
            width: '100%', padding: '14px', background: 'transparent', color: '#FF7B7F',
            border: '1px solid rgba(255,90,95,0.3)', borderRadius: '12px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700,
            cursor: 'pointer', marginTop: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s',
          }}>
            Sign Out
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  )
}

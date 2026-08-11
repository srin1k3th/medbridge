'use client'
import { useEffect, useState, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import VoiceMicButton from '@/components/VoiceMicButton'
import { lookupDrug, getDrugs, saveDrug } from '@/lib/api'

const LANGS = [['en', 'English'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी']]

export default function DrugsPage() {
  const [drugs, setDrugs] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [lang, setLang] = useState('en')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getDrugs().then(d => setDrugs(d.map((x: any) => x.drug_name))).catch(() => { })
  }, [])

  async function addDrug() {
    const v = input.trim()
    if (!v) return
    if (!drugs.includes(v)) { await saveDrug(v).catch(() => { }); setDrugs(p => [...p, v]) }
    setInput('')
    lookup(v)
  }

  async function lookup(name: string) {
    setSelected(name); setDetail(null); setLoading(true)
    try { setDetail(await lookupDrug(name, lang)) } catch { }
    setLoading(false)
  }

  const handleVoiceTranscript = useCallback((text: string) => {
    setInput(text.trim())
  }, [])

  const INFO_ROWS = detail ? [
    { label: 'What for',     val: detail.what_for,     accent: '#A78BFA' },
    { label: 'How to take',  val: detail.how_to_take,  accent: '#00C9A7' },
    { label: 'Side effects', val: detail.side_effects, accent: '#FBBF24' },
    { label: 'Avoid',        val: detail.avoid,        accent: '#FF5A5F' },
  ] : []

  const sourceColor =
    detail?.source?.includes('RAG') ? '#00C9A7'
    : detail?.source?.includes('OpenFDA') ? '#FBBF24'
    : 'rgba(255,255,255,0.3)'

  const sourceIcon =
    detail?.source?.includes('RAG') ? '🧠'
    : detail?.source?.includes('OpenFDA') ? '🏛️'
    : '💬'

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Drug Info Lookup" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', paddingBottom: '96px' }}>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {LANGS.map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)} style={{
              flex: 1, padding: '9px',
              border: `1px solid ${lang === code ? '#00C9A7' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px',
              background: lang === code ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.05)',
              color: lang === code ? '#00C9A7' : 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Input + voice */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDrug()}
              placeholder="Drug name… or tap 🎤"
              style={{
                width: '100%', padding: '12px 14px', boxSizing: 'border-box',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem',
                outline: 'none', background: 'rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.9)',
              }}
            />
          </div>
          <VoiceMicButton onTranscript={handleVoiceTranscript} language={lang} size={44} />
          <button onClick={addDrug} style={{
            padding: '12px 16px',
            background: 'linear-gradient(135deg,#00C9A7,#00A88E)',
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 0 14px rgba(0,201,167,0.35)',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>+ Add</button>
        </div>

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.61rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
          Your Medications
        </div>

        {drugs.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', padding: '8px 0 16px' }}>
            No drugs added yet — type one above and press + Add.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
          {drugs.map(d => (
            <div key={d} onClick={() => lookup(d)} style={{
              padding: '8px 16px', borderRadius: '20px', fontSize: '0.75rem',
              fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', fontWeight: 500,
              border: `1px solid ${selected === d ? '#00C9A7' : 'rgba(255,255,255,0.14)'}`,
              background: selected === d ? 'rgba(0,201,167,0.15)' : 'rgba(255,255,255,0.06)',
              color: selected === d ? '#00C9A7' : 'rgba(255,255,255,0.65)',
              boxShadow: selected === d ? '0 0 12px rgba(0,201,167,0.25)' : 'none',
              transition: 'all 0.2s',
            }}>{d}</div>
          ))}
        </div>

        {(loading || detail) && (
          <div style={{
            background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: '16px', padding: '20px',
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <div style={{ width: '22px', height: '22px', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#00C9A7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : detail && (
              <>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.15rem', fontWeight: 800, marginBottom: '2px', color: 'rgba(255,255,255,0.95)' }}>
                  {selected}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.38)', marginBottom: '18px' }}>
                  {detail.generic_name}
                </div>

                {INFO_ROWS.map(({ label, val, accent }) => val && (
                  <div key={label} style={{ display: 'flex', gap: '10px', marginBottom: '14px', paddingLeft: '10px', borderLeft: `2px solid ${accent}` }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{val}</div>
                    </div>
                  </div>
                ))}

                {/* Interaction warnings — highlighted if present */}
                {detail.interaction_warnings && (
                  <div style={{
                    padding: '12px 14px', borderRadius: '10px', marginBottom: '14px',
                    background: 'rgba(255,90,95,0.08)', border: '1px solid rgba(255,90,95,0.25)',
                  }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FF5A5F', marginBottom: '6px' }}>
                      ⚠️ Interaction Warnings
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255,200,200,0.85)', lineHeight: 1.6 }}>
                      {detail.interaction_warnings}
                    </div>
                  </div>
                )}

                {/* RAG source citations */}
                {detail.cited_sources && detail.cited_sources.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.25)', marginBottom: '6px' }}>
                      Sources
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {detail.cited_sources.map((src: string, i: number) => (
                        <span key={i} style={{
                          fontSize: '0.62rem', padding: '3px 8px', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>{src}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Source badge */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: sourceColor, background: `${sourceColor}18`, border: `1px solid ${sourceColor}30` }}>
                  {sourceIcon} {detail.source || 'LLM Knowledge'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <BottomNav />
    </div>
  )
}

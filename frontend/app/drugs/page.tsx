'use client'
import { useEffect, useState } from 'react'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import { lookupDrug, getDrugs, saveDrug } from '@/lib/api'

export default function DrugsPage() {
  const [drugs, setDrugs] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getDrugs().then(d => setDrugs(d.map((x: any) => x.drug_name))).catch(() => { })
  }, [])

  async function addDrug() {
    const v = input.trim(); if (!v) return
    if (!drugs.includes(v)) { await saveDrug(v).catch(() => { }); setDrugs(p => [...p, v]) }
    setInput(''); lookup(v)
  }

  async function lookup(name: string) {
    setSelected(name); setDetail(null); setLoading(true)
    try { setDetail(await lookupDrug(name)) } catch { }
    setLoading(false)
  }

  const INFO_ROWS = detail ? [
    { label: 'What for', val: detail.what_for, accent: '#A78BFA' },
    { label: 'How to take', val: detail.how_to_take, accent: '#00C9A7' },
    { label: 'Side effects', val: detail.side_effects, accent: '#FBBF24' },
    { label: 'Avoid', val: detail.avoid, accent: '#FF5A5F' },
  ] : []

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Drug Info Lookup" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', paddingBottom: '96px' }}>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDrug()}
            placeholder="Add a drug (e.g. Ramipril)…"
            style={{
              flex: 1, padding: '12px 14px',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem',
              outline: 'none', background: 'rgba(255,255,255,0.07)',
              color: 'rgba(255,255,255,0.9)',
            }}
          />
          <button
            onClick={addDrug}
            style={{
              padding: '12px 16px',
              background: 'linear-gradient(135deg,#00C9A7,#00A88E)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 0 14px rgba(0,201,167,0.35)',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}
          >+ Add</button>
        </div>

        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.61rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>
          Your Prescription
        </div>

        {drugs.length === 0 && (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', padding: '8px 0 16px' }}>
            No drugs added yet — type one above and press + Add.
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '22px' }}>
          {drugs.map(d => (
            <div
              key={d}
              onClick={() => lookup(d)}
              style={{
                padding: '8px 16px', borderRadius: '20px',
                fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace',
                cursor: 'pointer', fontWeight: 500,
                border: `1px solid ${selected === d ? '#FF5A5F' : 'rgba(255,255,255,0.14)'}`,
                background: selected === d ? 'rgba(255,90,95,0.18)' : 'rgba(255,255,255,0.06)',
                color: selected === d ? '#FF7B7F' : 'rgba(255,255,255,0.65)',
                boxShadow: selected === d ? '0 0 12px rgba(255,90,95,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >{d}</div>
          ))}
        </div>

        {(loading || detail) && (
          <div style={{
            background: 'rgba(255,255,255,0.07)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '16px', padding: '20px',
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                <div style={{ width: '22px', height: '22px', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#A78BFA', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : detail && (
              <>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '1.2rem', fontWeight: 800, marginBottom: '2px', color: 'rgba(255,255,255,0.95)' }}>
                  {selected?.split(' ')[0]}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: 'rgba(255,255,255,0.38)', marginBottom: '18px' }}>
                  {detail.generic_name}
                </div>
                {INFO_ROWS.map(({ label, val, accent }) => (
                  <div key={label} style={{ display: 'flex', gap: '10px', marginBottom: '14px', paddingLeft: '10px', borderLeft: `2px solid ${accent}` }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55 }}>{val}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.25)', padding: '5px 12px', borderRadius: '20px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#00C9A7' }}>
                  Sourced from OpenFDA
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}






'use client'
import { useState, useRef, useCallback } from 'react'
import BottomNav from '@/components/BottomNav'
import ScreenHeader from '@/components/ScreenHeader'
import VoiceMicButton from '@/components/VoiceMicButton'
import { extractAndSavePrescriptions } from '@/lib/api'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL

const SECTIONS = [
  { key: 'what_happened', label: 'What Happened', accent: '#FF5A5F', bg: 'rgba(255,90,95,0.06)' },
  { key: 'home_care',     label: 'What To Do At Home', accent: '#34D399', bg: 'rgba(52,211,153,0.06)' },
  { key: 'warning_signs', label: 'Warning Signs',       accent: '#FBBF24', bg: 'rgba(251,191,36,0.06)' },
  { key: 'follow_up',     label: 'Follow-Up Needed',    accent: '#A78BFA', bg: 'rgba(167,139,250,0.06)' },
]

const LANGS = [['en', 'English'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी']]

// ─── PDF Text Extraction (pdfjs) ────────────────────────────────────────────

async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const texts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    texts.push(content.items.map((item: any) => item.str).join(' '))
  }
  return texts.join('\n\n')
}

// ─── OCR Fallback (3-layer backend) ─────────────────────────────────────────

async function ocrDocument(file: File, language: string, token: string): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  const base64 = btoa(binary)

  const res = await fetch(`${API_URL}/analyse/ocr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ file_base64: base64, filename: file.name, language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'OCR failed')
  }
  const data = await res.json()
  return data.text || ''
}

// ─── Streaming Discharge Analysis ────────────────────────────────────────────

async function* streamAnalyse(text: string, language: string, token: string) {
  const res = await fetch(`${API_URL}/analyse/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) throw new Error(await res.text())

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload)
        if (parsed.token) yield parsed.token
        if (parsed.error) throw new Error(parsed.error)
      } catch { }
    }
  }
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function DischargePage() {
  const [text, setText] = useState('')
  const [lang, setLang] = useState('en')
  const [hasFile, setHasFile] = useState(false)
  const [fileName, setFileName] = useState('')
  const [pdfExtracting, setPdfExtracting] = useState(false)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [ocrMethod, setOcrMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [result, setResult] = useState<Record<string, string> | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<{ saved: number; reminders_created: number } | null>(null)
  const abortRef = useRef<boolean>(false)

  // ── Voice input: user narrates their symptoms/document notes
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setText(prev => prev ? `${prev}\n${transcript}` : transcript)
  }, [])

  // ── File upload handler
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setHasFile(true); setFileName(file.name); setResult(null); setStreamedText('')
    setOcrMethod(null); setExtracted(null)

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      setPdfExtracting(true)
      try {
        const extracted = await extractTextFromPdf(file)
        if (extracted.trim().length >= 150) {
          // Good text extraction from pdfjs
          setText(extracted)
          setPdfExtracting(false)
        } else {
          // Scanned PDF — fallback to 3-layer OCR
          setPdfExtracting(false)
          setOcrRunning(true)
          try {
            const { data } = await supabase.auth.getSession()
            const token = data.session?.access_token || ''
            const ocrText = await ocrDocument(file, lang, token)
            setText(ocrText)
            setOcrMethod('EasyOCR + TrOCR + LLM correction')
          } catch (err: any) {
            alert(`OCR failed: ${err.message}`)
            setText('')
          }
          setOcrRunning(false)
        }
      } catch {
        setPdfExtracting(false)
        setText('')
      }
    } else {
      const reader = new FileReader()
      reader.onload = ev => setText(ev.target?.result as string)
      reader.readAsText(file)
    }
  }

  // ── Streaming analysis
  async function analyse() {
    if (!text.trim()) return
    setLoading(true); setResult(null); setStreamedText(''); setExtracted(null)
    abortRef.current = false

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token || ''

      let fullText = ''
      for await (const token_ of streamAnalyse(text, lang, token)) {
        if (abortRef.current) break
        fullText += token_
        setStreamedText(fullText)
      }

      // Parse the final streamed JSON into sections
      try {
        const clean = fullText.trim().replace(/^```json?/, '').replace(/```$/, '').trim()
        const parsed = JSON.parse(clean)
        setResult(parsed)
        setStreamedText('')
      } catch {
        // If not JSON, show raw streamed text as "what_happened"
        setResult({ what_happened: fullText, home_care: '', warning_signs: '', follow_up: '' })
        setStreamedText('')
      }
    } catch (err: any) {
      console.error('Analysis error:', err)
    }
    setLoading(false)
  }

  // ── Extract & save prescriptions (also auto-creates reminders)
  async function handleExtract() {
    if (!text.trim()) return
    setExtracting(true)
    try {
      const res = await extractAndSavePrescriptions(text)
      setExtracted(res)
    } catch (err: any) {
      alert(`Extraction failed: ${err.message}`)
    }
    setExtracting(false)
  }

  const isProcessing = pdfExtracting || ocrRunning || loading

  return (
    <div style={{ width: '430px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ScreenHeader title="Discharge Explainer" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '96px' }}>

        {/* File upload zone */}
        <div onClick={() => !isProcessing && document.getElementById('file-input')?.click()} style={{
          border: `2px ${hasFile ? 'solid' : 'dashed'} ${hasFile ? '#00C9A7' : 'rgba(255,255,255,0.18)'}`,
          borderRadius: '16px', padding: '24px 20px', textAlign: 'center',
          cursor: isProcessing ? 'wait' : 'pointer',
          background: hasFile ? 'rgba(0,201,167,0.06)' : 'rgba(255,255,255,0.03)',
          transition: 'all 0.3s',
        }}>
          <input id="file-input" type="file" accept=".txt,.pdf,application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
          <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>
            {pdfExtracting ? '⏳' : ocrRunning ? '🔬' : hasFile ? '📄' : '📤'}
          </div>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: '4px' }}>
            {pdfExtracting ? 'Extracting PDF text…'
              : ocrRunning ? '3-Layer OCR running… (EasyOCR → TrOCR → LLM)'
              : hasFile ? fileName
              : 'Upload Discharge Summary'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.38)' }}>
            {ocrRunning ? 'Handwriting-aware OCR pipeline active' :
              hasFile ? 'Tap to upload a different file' : 'Supports printed & scanned PDFs · .txt'}
          </div>
          {ocrMethod && (
            <div style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', fontSize: '0.65rem', color: '#A78BFA' }}>
              🔬 {ocrMethod}
            </div>
          )}
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {LANGS.map(([code, label]) => (
            <button key={code} onClick={() => setLang(code)} style={{
              flex: 1, padding: '9px',
              border: `1px solid ${lang === code ? '#FF5A5F' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '10px',
              background: lang === code ? 'rgba(255,90,95,0.18)' : 'rgba(255,255,255,0.05)',
              color: lang === code ? '#FF7B7F' : 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', transition: 'all 0.2s',
            }}>{label}</button>
          ))}
        </div>

        {/* Text area + voice button */}
        <div style={{ position: 'relative' }}>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Or paste discharge summary text here… or tap 🎤 to narrate"
            style={{
              width: '100%', padding: '13px 52px 13px 16px',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.8rem',
              height: '80px', resize: 'none', outline: 'none',
              background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.9)',
              lineHeight: 1.5, boxSizing: 'border-box',
            }}
          />
          <div style={{ position: 'absolute', bottom: '10px', right: '10px' }}>
            <VoiceMicButton onTranscript={handleVoiceTranscript} language={lang} size={32} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={analyse} disabled={loading || !text.trim() || isProcessing} style={{
            flex: 1, padding: '15px',
            background: loading || !text.trim() ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#FF5A5F,#E04449)',
            color: '#fff', border: 'none', borderRadius: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.88rem', fontWeight: 700,
            cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
            boxShadow: loading || !text.trim() ? 'none' : '0 0 20px rgba(255,90,95,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s', opacity: !text.trim() ? 0.5 : 1,
          }}>
            {loading
              ? <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              : '⚡ Analyse'}
          </button>
          <button onClick={handleExtract} disabled={extracting || !text.trim()} style={{
            flex: 1, padding: '15px',
            background: extracting || !text.trim() ? 'rgba(255,255,255,0.05)' : 'rgba(0,201,167,0.15)',
            color: '#00C9A7', border: '1px solid rgba(0,201,167,0.3)', borderRadius: '13px',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '0.82rem', fontWeight: 700,
            cursor: extracting || !text.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            transition: 'all 0.2s', opacity: !text.trim() ? 0.4 : 1,
          }}>
            {extracting
              ? <span style={{ width: '14px', height: '14px', border: '2px solid rgba(0,201,167,0.3)', borderTopColor: '#00C9A7', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
              : '💊 Extract Meds'}
          </button>
        </div>

        {/* Auto-generated reminders banner */}
        {extracted && (
          <div className="fade-in" style={{
            background: 'rgba(0,201,167,0.08)', border: '1px solid rgba(0,201,167,0.25)',
            borderRadius: '12px', padding: '12px 16px',
            fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '1.4rem' }}>✅</span>
            <div>
              <strong>{extracted.saved} medication{extracted.saved !== 1 ? 's' : ''}</strong> saved to prescriptions.
              {extracted.reminders_created > 0 && (
                <> <strong>{extracted.reminders_created} reminder{extracted.reminders_created !== 1 ? 's' : ''}</strong> auto-generated (09:00 daily). </>
              )}
              <span style={{ color: 'rgba(0,201,167,0.7)', fontSize: '0.7rem' }}>Check Reminders to adjust times.</span>
            </div>
          </div>
        )}

        {/* Live streaming text (before JSON parse) */}
        {streamedText && !result && (
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px', padding: '16px', fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}>
            {streamedText}
            <span style={{ display: 'inline-block', width: '8px', height: '14px', background: '#FF5A5F', marginLeft: '2px', animation: 'blink 1s step-end infinite', borderRadius: '1px' }} />
          </div>
        )}

        {/* Final parsed result */}
        {result && (
          <div className="fade-in" style={{
            background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.09)', borderRadius: '16px', overflow: 'hidden',
          }}>
            {SECTIONS.map((s, i) => result[s.key] ? (
              <div key={s.key} style={{
                padding: '14px 16px',
                borderBottom: i < SECTIONS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderLeft: `3px solid ${s.accent}`,
                background: s.bg,
              }}>
                <span style={{
                  display: 'inline-block', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '3px 8px', borderRadius: '4px', marginBottom: '8px',
                  background: `${s.accent}22`, color: s.accent,
                }}>{s.label}</span>
                <div style={{ fontSize: '0.82rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.85)' }}>
                  {result[s.key]}
                </div>
              </div>
            ) : null)}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <BottomNav />
    </div>
  )
}

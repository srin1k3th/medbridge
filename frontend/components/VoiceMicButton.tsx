'use client'

/**
 * VoiceMicButton — Reusable voice-to-text input button powered by Groq Whisper.
 *
 * Records audio via MediaRecorder, sends to /voice/transcribe (backend),
 * and calls onTranscript(text) when done.
 *
 * Features:
 * - Animated recording state (pulsing red ring)
 * - Tap to start / tap to stop recording
 * - Language-aware (passes selected language to backend)
 * - Graceful error handling with user-visible messages
 * - Works in Chrome, Safari, Edge (MediaRecorder supported)
 */

import { useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void
  language?: string           // 'en' | 'hi' | 'ta'
  disabled?: boolean
  size?: number               // button diameter in px
  style?: React.CSSProperties
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'error'

export default function VoiceMicButton({
  onTranscript,
  language = 'en',
  disabled = false,
  size = 44,
  style,
}: VoiceMicButtonProps) {
  const [state, setState] = useState<RecordingState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const startRecording = useCallback(async () => {
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,        // Whisper prefers 16kHz
          channelCount: 1,          // mono
          echoCancellation: true,   // important for handheld mobile use
          noiseSuppression: true,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      // Prefer WebM (Chromium) → fallback to MP4 (Safari)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null

        if (chunksRef.current.length === 0) {
          setState('idle')
          return
        }

        setState('processing')

        const blob = new Blob(chunksRef.current, { type: mimeType })

        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData.session?.access_token
          if (!token) throw new Error('Not authenticated')

          const formData = new FormData()
          const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'
          formData.append('audio', blob, `recording.${ext}`)
          formData.append('language', language)

          const res = await fetch(`${API_URL}/voice/transcribe`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: 'Transcription failed' }))
            throw new Error(err.detail || 'Transcription failed')
          }

          const data = await res.json()
          if (data.transcript) {
            onTranscript(data.transcript)
          }
          setState('idle')
        } catch (err: any) {
          console.error('Voice transcription error:', err)
          setErrorMsg(err.message || 'Could not transcribe audio')
          setState('error')
          setTimeout(() => setState('idle'), 3000)
        }
      }

      recorder.start(250)   // collect chunks every 250ms
      setState('recording')

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Microphone permission denied')
      } else if (err.name === 'NotFoundError') {
        setErrorMsg('No microphone found')
      } else {
        setErrorMsg('Could not access microphone')
      }
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    }
  }, [language, onTranscript])

  const handleClick = useCallback(() => {
    if (disabled) return
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      startRecording()
    }
  }, [state, disabled, startRecording, stopRecording])

  // Visual state
  const isRecording = state === 'recording'
  const isProcessing = state === 'processing'
  const isError = state === 'error'

  const bgColor = isError
    ? 'rgba(255,90,95,0.25)'
    : isRecording
    ? 'rgba(255,60,60,0.2)'
    : isProcessing
    ? 'rgba(167,139,250,0.2)'
    : 'rgba(255,255,255,0.08)'

  const borderColor = isError
    ? '#FF5A5F'
    : isRecording
    ? '#FF3C3C'
    : isProcessing
    ? '#A78BFA'
    : 'rgba(255,255,255,0.15)'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        title={
          isRecording ? 'Tap to stop recording'
          : isProcessing ? 'Processing...'
          : 'Tap to speak'
        }
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1.5px solid ${borderColor}`,
          background: bgColor,
          cursor: disabled || isProcessing ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          position: 'relative',
          flexShrink: 0,
          boxShadow: isRecording ? `0 0 0 0 rgba(255,60,60,0.4)` : 'none',
          animation: isRecording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
          ...style,
        }}
      >
        {isProcessing ? (
          // Spinner
          <div style={{
            width: size * 0.4,
            height: size * 0.4,
            border: '2px solid rgba(167,139,250,0.3)',
            borderTopColor: '#A78BFA',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }} />
        ) : isRecording ? (
          // Stop square
          <div style={{
            width: size * 0.3,
            height: size * 0.3,
            background: '#FF3C3C',
            borderRadius: '3px',
          }} />
        ) : isError ? (
          // Error X
          <svg width={size * 0.4} height={size * 0.4} viewBox="0 0 16 16" fill="none">
            <path d="M4 4L12 12M12 4L4 12" stroke="#FF5A5F" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        ) : (
          // Mic icon
          <svg width={size * 0.42} height={size * 0.42} viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3" fill="rgba(255,255,255,0.75)"/>
            <path d="M5 11a7 7 0 0 0 14 0" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="12" y1="18" x2="12" y2="22" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round"/>
            <line x1="8" y1="22" x2="16" y2="22" stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </button>

      {/* Error tooltip */}
      {isError && errorMsg && (
        <div style={{
          position: 'absolute',
          top: size + 6,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,90,95,0.15)',
          border: '1px solid rgba(255,90,95,0.3)',
          borderRadius: '8px',
          padding: '4px 10px',
          fontSize: '0.65rem',
          color: '#FF7B7F',
          whiteSpace: 'nowrap',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          zIndex: 10,
        }}>
          {errorMsg}
        </div>
      )}

      <style>{`
        @keyframes micPulse {
          0%   { box-shadow: 0 0 0 0 rgba(255,60,60,0.5); }
          70%  { box-shadow: 0 0 0 ${size * 0.35}px rgba(255,60,60,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,60,60,0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

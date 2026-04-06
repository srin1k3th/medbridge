'use client'
import { useRouter } from 'next/navigation'

export default function ScreenHeader({ title, sub, back = '/home' }: { title: string; sub?: string; back?: string }) {
  const router = useRouter()
  return (
    <div style={{
      padding: '14px 20px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      flexShrink: 0,
    }}>
      <button
        onClick={() => router.push(back)}
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,90,95,0.4)',
          cursor: 'pointer',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FF5A5F',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >←</button>
      <div>
        <div style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: '1rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.95)',
        }}>{title}</div>
        {sub && (
          <div style={{
            fontSize: '0.62rem',
            color: 'rgba(255,255,255,0.35)',
            marginTop: '1px',
            fontFamily: 'JetBrains Mono, monospace',
            letterSpacing: '0.05em',
          }}>{sub}</div>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => router.push('/profile')}
        title="Profile"
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.8)',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M4 21v-1a8 8 0 0116 0v1" />
        </svg>
      </button>
    </div>
  )
}


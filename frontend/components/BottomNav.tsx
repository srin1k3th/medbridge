'use client'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { label: 'Home', path: '/home', icon: HomeIcon },
  { label: 'Discharge', path: '/discharge', icon: DocIcon },
  { label: 'Symptoms', path: '/symptom', icon: StethIcon },
  { label: 'Prescriptions', path: '/prescriptions', icon: RxIcon },
  { label: 'Reminders', path: '/reminders', icon: BellIcon },
]

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}
function DocIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  )
}
function StethIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v6a4 4 0 004 4h0a4 4 0 004-4V2" />
      <path d="M14 12v4a4 4 0 004 4v0a2 2 0 000-4" />
      <circle cx="18" cy="18" r="1" fill={c} />
    </svg>
  )
}
function RxIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
      <path d="M12 12h4M12 16h4M8 12h.01M8 16h.01" />
    </svg>
  )
}
function BellIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  )
}
function PersonIcon({ active }: { active: boolean }) {
  const c = active ? '#fff' : 'rgba(255,255,255,0.45)'
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-1a8 8 0 0116 0v1" />
    </svg>
  )
}

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div style={{
      position: 'fixed',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'calc(100% - 24px)',
      maxWidth: '406px',
      padding: '8px 6px 10px',
      display: 'flex',
      justifyContent: 'space-around',
      background: 'rgba(15, 12, 40, 0.45)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '28px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 0.5px rgba(255,255,255,0.06) inset',
      zIndex: 100,
    }}>
      {NAV.map(item => {
        const active = pathname === item.path
        const Icon = item.icon
        return (
          <div
            key={item.path}
            onClick={() => router.push(item.path)}
            className="pressable"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: '20px',
              flex: 1,
              background: active ? '#FF5A5F' : 'transparent',
              boxShadow: active ? '0 0 16px rgba(255,90,95,0.4)' : 'none',
              transition: 'all 0.2s ease',
              minWidth: 0,
            }}
          >
            <Icon active={active} />
            <span style={{
              fontSize: '0.46rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: active ? '#fff' : 'rgba(255,255,255,0.45)',
              fontFamily: 'JetBrains Mono, monospace',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}


import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MedBridge — Post-Discharge Care',
  description: 'Your personal guide after hospital discharge',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}






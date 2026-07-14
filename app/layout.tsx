import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🕵️ AI Detective — MADT',
  description: 'Think with AI, not just trust AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  )
}

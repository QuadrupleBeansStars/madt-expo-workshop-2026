import type { Metadata } from 'next'
import { Press_Start_2P, VT323, Sarabun } from 'next/font/google'
import './globals.css'

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel', display: 'swap' })
const retro = VT323({ weight: '400', subsets: ['latin'], variable: '--font-retro', display: 'swap' })
const thai = Sarabun({ weight: ['300', '400', '600', '700'], subsets: ['latin', 'thai'], variable: '--font-thai', display: 'swap' })

export const metadata: Metadata = {
  title: '🕵️ AI Detective — MADT',
  description: 'Think with AI, not just trust AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${pixel.variable} ${retro.variable} ${thai.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}

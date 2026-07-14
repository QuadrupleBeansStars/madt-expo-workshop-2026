'use client'
import type { Lang } from '@/lib/types'

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === 'th' ? 'en' : 'th')}
      className="fixed top-4 right-4 z-50 rounded-full border border-amber-700/50 bg-black/60 px-4 py-1.5 text-sm text-amber-300 hover:bg-amber-900/30"
      aria-label="Toggle language"
    >
      {lang === 'th' ? 'EN' : 'ไทย'}
    </button>
  )
}

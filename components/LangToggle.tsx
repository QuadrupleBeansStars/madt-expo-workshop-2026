'use client'
import type { Lang } from '@/lib/types'

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === 'th' ? 'en' : 'th')}
      className="fixed top-4 right-4 z-50 rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:bg-brand-navy-soft"
      aria-label="Toggle language"
    >
      {lang === 'th' ? 'EN' : 'ไทย'}
    </button>
  )
}

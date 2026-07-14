'use client'
import { useEffect, useRef, useState } from 'react'
import { CASES } from '@/content/cases'
import type { RoomStats } from '@/lib/stats'
import type { Lang } from '@/lib/types'
import { LangToggle } from '@/components/LangToggle'
import { t } from '@/lib/i18n'

const POLL_MS = 2500

const DIFFICULTY_DOT: Record<string, string> = {
  easy: '🟢', medium: '🟡', hard: '🟠', expert: '🔴', final: '⚫',
}

// Runtime shape check on the fetched JSON, mirroring app/dashboard/page.tsx.
// A 200 response with valid JSON but the wrong shape would otherwise throw
// during render on the projector, with no error boundary to catch it.
function isValidStats(d: unknown): d is RoomStats {
  if (!d || typeof d !== 'object') return false
  const s = d as Record<string, unknown>
  return (
    Array.isArray(s.caseStats) &&
    Array.isArray(s.leaderboard) &&
    typeof s.detectives === 'number' &&
    typeof s.finished === 'number'
  )
}

export default function RevealPage() {
  const [i, setI] = useState(0)
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [lang, setLang] = useState<Lang>('th')
  const seqRef = useRef(0)

  useEffect(() => {
    const load = async () => {
      const seq = ++seqRef.current
      try {
        const res = await fetch('/api/stats')
        if (seq !== seqRef.current) return // a newer poll already landed — drop this stale frame
        if (res.ok) {
          const d = await res.json()
          if (seq !== seqRef.current) return // newer poll landed while we awaited the body
          if (isValidStats(d)) setStats(d)
        }
        // A failed or malformed poll leaves `stats` untouched, so the
        // projector keeps showing the last good frame instead of blanking.
      } catch {
        /* projector keeps showing the last good frame */
      }
    }
    void load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, CASES.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const c = CASES[i]
  const stat = stats?.caseStats.find((s) => s.caseId === c.id)
  // Omit the figure entirely when nobody has answered yet — a 0% or NaN%
  // would misrepresent "no data" as "nobody was fooled."
  const hasFooledPct = !!stat && stat.answered > 0

  return (
    <main className="min-h-screen bg-ground p-16 text-text">
      <LangToggle lang={lang} onChange={setLang} />

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-baseline justify-between">
          <span className="text-xl uppercase tracking-widest text-brand-navy">
            {DIFFICULTY_DOT[c.difficulty]} {t('caseLabel', lang)} {c.order} / {CASES.length}
          </span>
          <span className="rounded-full bg-alert-soft px-4 py-1.5 text-lg font-semibold text-alert">
            {c.failureMode[lang]}
          </span>
        </div>

        <h2 className="mb-8 text-3xl font-semibold text-text">{c.question[lang]}</h2>

        <section className="mb-8 rounded-lg border border-brand-navy bg-brand-navy-soft p-6">
          <div className="mb-2 text-sm font-semibold text-brand-navy">{t('aiAnswer', lang)}</div>
          <p className="text-xl leading-relaxed text-text">{c.aiAnswer[lang]}</p>
        </section>

        {/* The live "% fooled" figure is the emotional payload of the reveal —
            kept big and dominant, and only shown once real answers exist. */}
        {hasFooledPct && (
          <div className="mb-8 flex items-center gap-6 rounded-lg border border-alert bg-alert-soft p-6">
            <span className="text-8xl font-black leading-none text-alert">{stat!.fooledPct}%</span>
            <span className="text-xl text-text">{t('fooledBy', lang)}</span>
          </div>
        )}

        <section className="rounded-lg border border-brand-orange bg-brand-orange-soft p-6">
          <div className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-orange-deep">
            {t('reveal', lang)}
          </div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-text">{c.reveal[lang]}</p>
        </section>

        <div className="mt-10 text-center text-sm text-text-dim">
          ← → {t('changeCaseHint', lang)}
        </div>
      </div>
    </main>
  )
}

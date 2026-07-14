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
    <main className="min-h-screen bg-neutral-950 p-16 text-neutral-100">
      <LangToggle lang={lang} onChange={setLang} />

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-baseline justify-between">
          <span className="text-xl uppercase tracking-widest text-amber-500">
            {DIFFICULTY_DOT[c.difficulty]} {t('caseLabel', lang)} {c.order} / {CASES.length}
          </span>
          <span className="rounded-full bg-red-950/60 px-4 py-1.5 text-lg text-red-300">
            {c.failureMode[lang]}
          </span>
        </div>

        <h2 className="mb-8 text-3xl font-semibold">{c.question[lang]}</h2>

        <section className="mb-8 rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-6">
          <div className="mb-2 text-sm text-cyan-400">{t('aiAnswer', lang)}</div>
          <p className="text-xl leading-relaxed">{c.aiAnswer[lang]}</p>
        </section>

        {/* The live "% fooled" figure is the emotional payload of the reveal —
            kept big and dominant, and only shown once real answers exist. */}
        {hasFooledPct && (
          <div className="mb-8 flex items-center gap-6 rounded-lg border border-red-900/50 bg-red-950/20 p-6">
            <span className="text-8xl font-black leading-none text-red-400">{stat!.fooledPct}%</span>
            <span className="text-xl text-neutral-300">{t('fooledBy', lang)}</span>
          </div>
        )}

        <section className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-6">
          <div className="mb-3 text-sm uppercase tracking-widest text-amber-400">
            {t('reveal', lang)}
          </div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-neutral-200">{c.reveal[lang]}</p>
        </section>

        <div className="mt-10 text-center text-sm text-neutral-600">
          ← → {t('changeCaseHint', lang)}
        </div>
      </div>
    </main>
  )
}

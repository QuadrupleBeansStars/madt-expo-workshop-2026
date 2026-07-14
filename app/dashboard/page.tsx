'use client'
import { useEffect, useRef, useState } from 'react'
import type { RoomStats } from '@/lib/stats'
import { t } from '@/lib/i18n'
import { CASES } from '@/content/cases'

const POLL_MS = 2500

// Runtime shape check on the fetched JSON. A 200 response with valid JSON
// but the wrong shape (e.g. missing `caseStats`) would otherwise throw
// during render — and with no error boundary in the app, that would blank
// the projector. Reject anything that doesn't match instead, so the last
// good frame stays up.
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

export default function DashboardPage() {
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [panel, setPanel] = useState<'wall' | 'board'>('wall')
  const lang = 'th' as const
  const seqRef = useRef(0)

  useEffect(() => {
    const load = async () => {
      const seq = ++seqRef.current
      try {
        const res = await fetch('/api/stats')
        if (seq !== seqRef.current) return // a newer poll already landed — drop this stale frame
        // A failed or bad poll leaves `stats` untouched, so the projector
        // keeps showing the last good frame instead of blanking or
        // rendering garbage on a flaky venue LAN.
        if (res.ok) {
          const d = await res.json()
          if (seq !== seqRef.current) return // newer poll landed while we awaited the body
          if (isValidStats(d)) setStats(d)
        }
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
      if (e.key.toLowerCase() === 'l') setPanel((p) => (p === 'wall' ? 'board' : 'wall'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="min-h-screen bg-neutral-950 p-12 text-neutral-100">
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className="text-4xl font-bold text-amber-300">{t('appTitle', lang)}</h1>
        <span className="text-sm text-neutral-600">{t('toggleHint', lang)}</span>
      </header>

      {!stats ? (
        <p className="text-2xl text-neutral-400">{t('waitingForDetectives', lang)}</p>
      ) : panel === 'wall' ? (
        <>
          <h2 className="mb-6 text-2xl text-amber-400">{t('statsWall', lang)}</h2>
          <div className="mb-10 flex gap-16">
            <div>
              <div className="text-6xl font-bold text-amber-200">{stats.detectives}</div>
              <div className="text-sm uppercase tracking-widest text-neutral-500">{t('detectives', lang)}</div>
            </div>
            <div>
              <div className="text-6xl font-bold text-emerald-300">{stats.finished}</div>
              <div className="text-sm uppercase tracking-widest text-neutral-500">{t('finishedCount', lang)}</div>
            </div>
          </div>

          <p className="mb-6 text-sm uppercase tracking-widest text-neutral-500">{t('fooledBy', lang)}</p>
          <div className="space-y-8">
            {stats.caseStats.map((c) => (
              <div key={c.caseId} className="flex items-center gap-8">
                <span className="w-24 shrink-0 text-lg text-neutral-400">
                  {t('caseLabel', lang)} {c.order}
                </span>
                <div className="h-10 flex-1 overflow-hidden rounded bg-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-red-600 transition-all duration-700"
                    style={{ width: `${c.answered > 0 ? c.fooledPct : 0}%` }}
                  />
                </div>
                <span className="w-48 shrink-0 text-right text-8xl font-black leading-none text-red-400">
                  {c.answered > 0 ? `${c.fooledPct}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h2 className="mb-8 text-2xl text-amber-400">{t('leaderboard', lang)}</h2>
          <ol className="space-y-3">
            {stats.leaderboard.slice(0, 12).map((row, i) => (
              <li key={row.codename} className="flex items-center gap-6 rounded-lg border border-neutral-800 p-4">
                <span className="w-12 text-2xl font-bold text-neutral-600">{i + 1}</span>
                <span className="flex-1 text-2xl text-neutral-100">{row.codename}</span>
                <span className="text-sm text-neutral-500">{row.correct}/{CASES.length}</span>
                <span className="w-28 text-right text-3xl font-bold text-amber-300">{row.score}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  )
}

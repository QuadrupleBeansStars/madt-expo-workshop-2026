'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, PublicGameState } from '@/lib/types'
import type { RoomStats } from '@/lib/stats'
import { ROUNDS } from '@/lib/game'
import { Countdown } from '@/components/game/Countdown'
import { Duck } from '@/components/game/Duck'
import { t } from '@/lib/i18n'

const HOST_TOKEN_KEY = 'aidet.hostToken'
const STATE_POLL_MS = 1000
const STATS_POLL_MS = 1500

export default function TvPage() {
  const [lang] = useState<Lang>('th')
  const [state, setState] = useState<PublicGameState | null>(null)
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [token, setToken] = useState('')
  const [tokenError, setTokenError] = useState(false)
  const [origin, setOrigin] = useState('')
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    setToken(localStorage.getItem(HOST_TOKEN_KEY) ?? '')
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    let alive = true
    const pollState = async () => {
      try {
        const res = await fetch('/api/state')
        if (!res.ok) return
        const next = (await res.json()) as PublicGameState
        if (alive && next.seq >= lastSeqRef.current) { lastSeqRef.current = next.seq; setState(next) }
      } catch { /* keep last good frame */ }
    }
    void pollState()
    const id = setInterval(pollState, STATE_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    let alive = true
    const pollStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok && alive) setStats(await res.json())
      } catch { /* keep last good frame */ }
    }
    void pollStats()
    const id = setInterval(pollStats, STATS_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const control = useCallback(async (action: 'start' | 'next') => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token },
        body: JSON.stringify({ action }),
      })
      setTokenError(res.status === 403)
    } catch { setTokenError(true) }
  }, [token])

  const saveToken = (v: string) => { setToken(v); try { localStorage.setItem(HOST_TOKEN_KEY, v) } catch { /* ignore */ } }

  return (
    <main className="crt relative min-h-screen overflow-hidden p-8" style={{ background: 'var(--rt-bg)', color: 'var(--rt-text)' }}>
      <TokenBar token={token} onSave={saveToken} error={tokenError} lang={lang} />
      <Stage state={state} stats={stats} lang={lang} origin={origin} onStart={() => control('start')} onNext={() => control('next')} />
    </main>
  )
}

function TokenBar({ token, onSave, error, lang }: { token: string; onSave: (v: string) => void; error: boolean; lang: Lang }) {
  return (
    <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--rt-panel)', border: '2px solid var(--rt-border)' }}>
      <label className="text-xs" style={{ fontFamily: 'var(--font-thai), sans-serif', color: error ? 'var(--rt-pink)' : 'var(--rt-text)' }}>{t('hostTokenLabel', lang)}</label>
      <input
        type="password"
        defaultValue={token}
        onBlur={(e) => onSave(e.target.value)}
        className="w-28 rounded bg-black/40 px-2 py-1 text-sm"
        style={{ border: '1px solid var(--rt-border)', color: 'var(--rt-text)' }}
      />
    </div>
  )
}

function Stage({
  state, stats, lang, origin, onStart, onNext,
}: {
  state: PublicGameState | null
  stats: RoomStats | null
  lang: Lang
  origin: string
  onStart: () => void
  onNext: () => void
}) {
  if (!state || state.phase === 'lobby') {
    const names = stats?.leaderboard.map((r) => r.codename) ?? []
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 text-center">
        <h1 className="pixel-title text-6xl">🕵️ AI DETECTIVE</h1>
        <p className="text-2xl" style={{ fontFamily: 'var(--font-retro), monospace', color: 'var(--rt-cyan)' }}>
          {t('joinOnPhone', lang)} <strong>{origin || '…'}</strong>
        </p>
        <div className="retro-panel min-w-[320px] p-4">
          <div className="pixel-title mb-2 text-sm">{t('detectivesInRoom', lang)}: {names.length}</div>
          <div className="flex flex-wrap justify-center gap-2" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
            {names.map((n) => <span key={n} className="rounded-full px-3 py-1" style={{ background: 'var(--rt-border)' }}>{n}</span>)}
          </div>
        </div>
        <button type="button" className="pixel-btn gold text-lg" onClick={onStart}>{t('hostStart', lang)}</button>
      </div>
    )
  }

  if (state.phase === 'final') {
    const rows = stats?.leaderboard.slice(0, 10) ?? []
    return (
      <div className="flex min-h-[80vh] flex-col items-center gap-6">
        <h1 className="pixel-title text-4xl">{t('finalTitle', lang)}</h1>
        <ol className="retro-panel w-full max-w-2xl p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          {rows.map((r, i) => (
            <li key={r.codename} className="flex justify-between border-b border-white/10 py-2 text-xl">
              <span>{i + 1}. {r.codename}</span>
              <span className="tabular-nums" style={{ color: 'var(--rt-gold)' }}>{r.score}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const round = ROUNDS[state.roundIndex]
  const caseStat = stats?.caseStats.find((c) => c.caseId === round.id)

  if (state.phase === 'investigate') {
    return (
      <div className="flex min-h-[80vh] flex-col gap-6">
        <header className="flex items-center justify-between">
          <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5</span>
          <span className="text-4xl"><Countdown remainingMs={state.remainingMs} /></span>
        </header>
        <div className="retro-panel p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          <div className="mb-4 text-3xl font-bold" style={{ color: 'var(--rt-cyan)' }}>{round.question[lang]}</div>
          <Duck bubble={round.aiAnswer[lang]} size={72} />
        </div>
        <div className="mt-auto text-center pixel-title text-3xl">
          {state.answeredCount} / {state.playerCount} {t('answered', lang)}
        </div>
      </div>
    )
  }

  // reveal
  const correct = round.options.find((o) => o.correct)!
  return (
    <div className="flex min-h-[80vh] flex-col gap-6">
      <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5 — {t('reveal', lang)}</span>
      <div className="retro-panel p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
        <div className="mb-2 text-sm" style={{ color: 'var(--rt-gold)' }}>{t('correctAnswer', lang)}:</div>
        <div className="mb-4 text-3xl font-bold" style={{ color: 'var(--rt-green)' }}>{correct.label[lang]}</div>
        <p className="text-xl">{round.reveal[lang]}</p>
      </div>
      {caseStat && caseStat.answered > 0 ? (
        <div className="text-center">
          <span className="pixel-title text-7xl" style={{ color: 'var(--rt-pink)' }}>{caseStat.believedAiPct}%</span>
          <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('believedAiLabel', lang)}</div>
        </div>
      ) : null}
      <button type="button" className="pixel-btn gold mx-auto mt-auto text-lg" onClick={onNext}>{t('hostNext', lang)}</button>
    </div>
  )
}

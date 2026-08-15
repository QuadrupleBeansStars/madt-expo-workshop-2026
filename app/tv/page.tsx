'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, PublicGameState } from '@/lib/types'
import type { RoomStats } from '@/lib/stats'
import { ROUNDS } from '@/lib/game'
import { QRCodeSVG } from 'qrcode.react'
import { Countdown } from '@/components/game/Countdown'
import { Duck } from '@/components/game/Duck'
import { Storyboard } from '@/components/game/Storyboard'
import { CaseFile } from '@/components/game/CaseFile'
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

  const control = useCallback(async (action: 'start' | 'reveal' | 'next') => {
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

  /*
  Vertical padding is capped by viewport HEIGHT, not left at a flat 2rem. `min-h-screen` plus
  `p-8` with border-box leaves the content 64px less than the screen, and on a 1366x768
  projector the lobby needs 714 of the 704 that leaves — so the join QR sat 10px below a fold
  a projector cannot scroll. Horizontal padding is untouched; width was never the constraint.
  `npm run check:projector` walks this route at both projector shapes and found exactly this.
   */
  return (
    <main className="crt relative min-h-screen overflow-hidden px-8 py-[min(2rem,2.2vh)]" style={{ background: 'var(--rt-bg)', color: 'var(--rt-text)' }}>
      <TokenBar token={token} onSave={saveToken} error={tokenError} lang={lang} />
      <Stage state={state} stats={stats} lang={lang} origin={origin} tokenError={tokenError} hasToken={token.trim().length > 0} onStart={() => control('start')} onReveal={() => control('reveal')} onNext={() => control('next')} />
    </main>
  )
}

function TokenBar({ token, onSave, error, lang }: { token: string; onSave: (v: string) => void; error: boolean; lang: Lang }) {
  const borderColor = error ? 'var(--rt-pink)' : token.trim() ? 'var(--rt-green)' : 'var(--rt-gold)'
  return (
    <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--rt-panel)', border: `2px solid ${borderColor}` }}>
      <label className="text-xs" style={{ fontFamily: 'var(--font-thai), sans-serif', color: error ? 'var(--rt-pink)' : 'var(--rt-text)' }}>{t('hostTokenLabel', lang)}</label>
      <input
        type="text"
        value={token}
        onChange={(e) => onSave(e.target.value)}
        placeholder="madt2026"
        className="w-32 rounded bg-black/40 px-2 py-1 text-sm"
        style={{ border: '1px solid var(--rt-border)', color: 'var(--rt-text)' }}
      />
    </div>
  )
}

/**
 * Rows of the between-questions leaderboard. FIVE, not ten.
 *
 * The reveal screen is the tightest layout in this app — it is where the 14px overflow fight in
 * `components/room/stages.css` happened — and the standings are being added to a screen that was
 * already full. Five rows is what fits at 1366x768 beside the "believed the AI" figure with the
 * host button still above the fold. `npm run check:projector` is the gate on this number; the
 * final screen still shows ten, because it has the whole screen to itself.
 */
const REVEAL_LEADERBOARD_ROWS = 5

function Stage({
  state, stats, lang, origin, tokenError, hasToken, onStart, onReveal, onNext,
}: {
  state: PublicGameState | null
  stats: RoomStats | null
  lang: Lang
  origin: string
  tokenError: boolean
  hasToken: boolean
  onStart: () => void
  onReveal: () => void
  onNext: () => void
}) {
  const tokenHint = tokenError
    ? (lang === 'th' ? '❌ รหัสผู้ดำเนินรายการไม่ถูกต้อง — พิมพ์ในกล่องมุมขวาบน แล้วกด Start อีกครั้ง' : '❌ Wrong host token — type it in the box (top-right), then press Start again')
    : !hasToken
      ? (lang === 'th' ? '⚠️ ใส่รหัสผู้ดำเนินรายการที่มุมขวาบนก่อนกด Start' : '⚠️ Enter the host token (top-right) before pressing Start')
      : null
  if (!state || state.phase === 'lobby') {
    const names = stats?.leaderboard.map((r) => r.codename) ?? []
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 text-center">
        <h1 className="pixel-title text-6xl">🕵️ AI DETECTIVE</h1>
        <p className="text-2xl" style={{ fontFamily: 'var(--font-retro), monospace', color: 'var(--rt-cyan)' }}>
          {t('joinOnPhone', lang)} <strong>{origin || '…'}</strong>
        </p>
        {origin ? (
          <div className="rounded-2xl bg-white p-5" aria-label="Join QR code">
            <QRCodeSVG value={origin} size={240} level="M" />
          </div>
        ) : null}
        <div className="retro-panel min-w-[320px] p-4">
          <div className="pixel-title mb-2 text-sm">{t('detectivesInRoom', lang)}: {names.length}</div>
          <div className="flex flex-wrap justify-center gap-2" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
            {names.map((n) => <span key={n} className="rounded-full px-3 py-1" style={{ background: 'var(--rt-border)' }}>{n}</span>)}
          </div>
        </div>
        <button type="button" className="pixel-btn gold text-lg" onClick={onStart}>{t('hostStart', lang)}</button>
        {tokenHint ? (
          <p className="max-w-lg text-lg font-bold" style={{ fontFamily: 'var(--font-thai), sans-serif', color: tokenError ? 'var(--rt-pink)' : 'var(--rt-gold)' }}>{tokenHint}</p>
        ) : null}
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
        <Storyboard panels={round.storyboard} lang={lang} />
        {/* Question and evidence SIDE BY SIDE, not stacked.
            The case file moved here off the phone, and stacking it under the question overflowed
            every case at 1366x768 — `goblinshark` has a 338-character AI answer and `citation` has
            four manifest rows plus three documents. A projector is wide and short: the width was
            always there, the height never was. The two columns are deliberately uneven — the duck's
            speech bubble sets the left column's height, and the evidence needs the wider half to
            keep document bodies down to three lines. */}
        <div className="grid min-h-0 flex-1 items-start gap-6" style={{ gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)' }}>
          <div className="retro-panel p-[min(2.4vh,24px)]" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
            <div className="mb-[min(1.6vh,16px)] font-bold" style={{ fontSize: 'min(3vh, 30px)', lineHeight: 1.25, color: 'var(--rt-cyan)' }}>{round.question[lang]}</div>
            <Duck bubble={round.aiAnswer[lang]} size={72} />
          </div>
          <CaseFile detectiveCase={round} lang={lang} />
        </div>
        {/* The answered count and the cut-it-short button belong together: the count IS the
            evidence the host reads before deciding the room is done. Splitting them would put
            the decision in one corner and the reason for it in another. */}
        <div className="mt-auto flex flex-col items-center gap-3">
          <div className="pixel-title text-3xl">
            {state.answeredCount} / {state.playerCount} {t('answered', lang)}
          </div>
          <button type="button" className="pixel-btn text-base" onClick={onReveal}>{t('hostRevealNow', lang)}</button>
          {tokenError ? (
            <p className="text-base font-bold" style={{ fontFamily: 'var(--font-thai), sans-serif', color: 'var(--rt-pink)' }}>{tokenHint}</p>
          ) : null}
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
      {/* The two things the room wants to see the instant a case closes: how many of them the AI
          fooled, and who is winning. Side by side rather than stacked — stacking them is what
          pushes the host button below the fold at 1366x768. The standings render from the same
          `stats` poll the final screen uses, so there is no new request per case. */}
      <div className="flex flex-1 items-center justify-center gap-10">
        {caseStat && caseStat.answered > 0 ? (
          <div className="text-center">
            <span className="pixel-title text-7xl" style={{ color: 'var(--rt-pink)' }}>{caseStat.believedAiPct}%</span>
            <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('believedAiLabel', lang)}</div>
          </div>
        ) : null}
        <RevealLeaderboard stats={stats} lang={lang} />
      </div>
      <div className="mx-auto flex flex-col items-center gap-2">
        <button type="button" className="pixel-btn gold text-lg" onClick={onNext}>{t('hostNext', lang)}</button>
        {tokenError ? (
          <p className="text-base font-bold" style={{ fontFamily: 'var(--font-thai), sans-serif', color: 'var(--rt-pink)' }}>{tokenHint}</p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The running standings between cases — the team's ask after the run-through: the room had no
 * idea who was ahead until the very end, so there was nothing to play for in the middle.
 *
 * Renders nothing at all before anyone has scored. An empty panel headed "STANDINGS" on the first
 * reveal reads as a bug to a room that has not been told the board is cumulative.
 */
function RevealLeaderboard({ stats, lang }: { stats: RoomStats | null; lang: Lang }) {
  const rows = stats?.leaderboard.slice(0, REVEAL_LEADERBOARD_ROWS) ?? []
  if (rows.length === 0) return null
  return (
    <ol className="retro-panel min-w-[300px] p-4" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      <li className="pixel-title mb-2 list-none text-sm">{t('standings', lang)}</li>
      {rows.map((r, i) => (
        <li key={r.codename} className="flex justify-between gap-6 border-b border-white/10 py-1 text-lg last:border-b-0">
          <span>{i + 1}. {r.codename}</span>
          <span className="tabular-nums" style={{ color: 'var(--rt-gold)' }}>{r.score}</span>
        </li>
      ))}
    </ol>
  )
}

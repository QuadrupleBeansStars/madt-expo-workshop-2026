'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DetectiveCase, Lang, PublicGameState } from '@/lib/types'
import type { RoomStats } from '@/lib/stats'
import { ROUNDS } from '@/lib/game'
import { QRCodeSVG } from 'qrcode.react'
import { Countdown } from '@/components/game/Countdown'
import { Duck } from '@/components/game/Duck'
import { Storyboard } from '@/components/game/Storyboard'
import { CaseFile } from '@/components/game/CaseFile'
import { ResetButton } from '@/components/host/ResetButton'
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
      {/* A reset with a bad token comes back 403 — surface it the same way a refused Start does,
          rather than leaving the host to wonder whether the room cleared. */}
      <TokenBar token={token} onSave={saveToken} error={tokenError} lang={lang} onReset={(ok) => { setTokenError(!ok); if (ok) lastSeqRef.current = -1 }} />
      <Stage state={state} stats={stats} lang={lang} origin={origin} tokenError={tokenError} hasToken={token.trim().length > 0} onStart={() => control('start')} onReveal={() => control('reveal')} onNext={() => control('next')} />
    </main>
  )
}

function TokenBar({ token, onSave, error, lang, onReset }: { token: string; onSave: (v: string) => void; error: boolean; lang: Lang; onReset: (ok: boolean) => void }) {
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
      {/* Lives in the host bar, not in the stage. The stage is what the room is looking at; the
          bar is the host's own strip and is already where the token goes. */}
      <ResetButton
        endpoint="/api/reset"
        token={token}
        label={t('hostReset', lang)}
        armedLabel={t('hostResetArmed', lang)}
        onDone={onReset}
        className="host-reset"
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
        {/* The clock sits on the LEFT, beside the case number.
            It used to be at the right end of a `justify-between` header — directly underneath
            <TokenBar>, which is `absolute right-4 top-4 z-50`. Measured: the clock occupied
            x 1190-1334 / y 17-63 and the bar x 1097-1350 / y 16-66, so the timer was completely
            covered and this workshop ran with no visible countdown at all. Nothing failed: the
            element rendered, ticked, and had a real bounding box the whole time.
            Not solved by reserving a right-hand slot — the bar's width changes when it shows the
            wrong-token hint, and hardcoding it into this header would tie the two together. */}
        <header className="flex items-center gap-6">
          <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5</span>
          <span className="text-5xl"><Countdown remainingMs={state.remainingMs} /></span>
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
    <div className="flex min-h-[80vh] flex-col gap-[min(2.2vh,22px)]">
      <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5 — {t('reveal', lang)}</span>
      {/*
        TWO COLUMNS, and it is not a style choice.
        Measured at 1366x768 before the teaching panel existed, this screen had 31px of clearance
        under the Next button on `citation` and `novabrew` — their reveal copy is 681 and 696 Thai
        characters. Anything stacked here goes straight through the fold. The room's payoff (how
        many were fooled, who is winning) moves into the right column and the reading moves left.
      */}
      <div className="grid min-h-0 flex-1 items-start gap-8" style={{ gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)' }}>
        <div className="flex min-h-0 flex-col gap-[min(1.8vh,18px)]">
          <div className="retro-panel p-[min(2.4vh,24px)]" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
            <div className="mb-2 text-sm" style={{ color: 'var(--rt-gold)' }}>{t('correctAnswer', lang)}:</div>
            <div className="mb-[min(1.4vh,14px)] font-bold" style={{ fontSize: 'min(2.8vh, 28px)', lineHeight: 1.25, color: 'var(--rt-green)' }}>{correct.label[lang]}</div>
            <p style={{ fontSize: 'min(1.9vh, 19px)', lineHeight: 1.4 }}>{round.reveal[lang]}</p>
          </div>
          <TeachingPanel round={round} lang={lang} />
        </div>
        <div className="flex flex-col items-center gap-[min(2.4vh,24px)]">
          {caseStat && caseStat.answered > 0 ? (
            <div className="text-center">
              <span className="pixel-title" style={{ fontSize: 'min(9vh, 90px)', color: 'var(--rt-pink)' }}>{caseStat.believedAiPct}%</span>
              <div className="mt-1 text-xl" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('believedAiLabel', lang)}</div>
            </div>
          ) : null}
          <RevealLeaderboard stats={stats} lang={lang} />
        </div>
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
 * The teaching beat — the reason the question was asked, rather than the answer to it.
 *
 * Two lines, and they do different jobs. `failureMode` names the trick so the room has a handle
 * for it ("stale knowledge", "invented source"); `checkNextTime` is the only thing on this screen
 * that is meant to be useful outside it. The panel deliberately has NO figures and NO score — it
 * sits under the reveal so the host has something to talk over while the room reads the standings
 * beside it.
 *
 * The header is neutral on purpose. "What this one was trying to fool you with" reads well on
 * cases 1-4 and is nonsense on case 5, where the AI is right and the lesson is that reflexive
 * suspicion is not a substitute for checking. One heading has to carry both.
 */
function TeachingPanel({ round, lang }: { round: DetectiveCase; lang: Lang }) {
  return (
    <section
      data-testid="teaching"
      className="rounded-lg p-[min(2.2vh,22px)]"
      style={{ fontFamily: 'var(--font-thai), sans-serif', background: 'var(--rt-panel)', borderLeft: '5px solid var(--rt-gold)' }}
    >
      <div className="mb-[min(1.4vh,14px)] font-bold" style={{ fontSize: 'min(1.7vh, 17px)', letterSpacing: '0.08em', color: 'var(--rt-gold)' }}>
        {t('teachingTitle', lang)}
      </div>
      <dl className="flex flex-col gap-[min(1.4vh,14px)]">
        <div>
          <dt style={{ fontSize: 'min(1.5vh, 15px)', color: 'var(--rt-cyan)' }}>{t('teachingTrick', lang)}</dt>
          <dd className="mt-1 font-bold" style={{ fontSize: 'min(2.1vh, 21px)', lineHeight: 1.3 }}>{round.failureMode[lang]}</dd>
        </div>
        <div>
          <dt style={{ fontSize: 'min(1.5vh, 15px)', color: 'var(--rt-cyan)' }}>{t('teachingCheck', lang)}</dt>
          <dd className="mt-1" style={{ fontSize: 'min(1.95vh, 20px)', lineHeight: 1.4 }}>{round.checkNextTime[lang]}</dd>
        </div>
      </dl>
    </section>
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

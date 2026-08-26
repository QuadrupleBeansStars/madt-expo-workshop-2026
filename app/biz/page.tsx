'use client'

// Café Persona — the projector.
//
// One host drives 200 people through ten stages in fifteen minutes from this page. Everything the
// room sees is rendered by `components/room/Stages.tsx`; this file owns only the four things that
// touch the outside world: the poll, the clock, the keyboard, and the token.
//
// POLLING DISCIPLINE (this repo has been burned before — see app/tv/page.tsx and the README):
//   - `seq` is monotonic. A frame older than the one on screen is dropped, never rendered.
//   - A failed or non-ok poll KEEPS the last good frame. The projector never blanks mid-workshop;
//     a stale screen is recoverable in front of a room, a blank one is not.
//   - The QR is computed client-side, so its absence is the tell that hydration failed.

// deck.css FIRST, above the component imports, and it has to stay there.
//
// `components/room/stages.css` is a layer on top of this sheet: it restyles deck classes
// (.deck-bi--body, .deck-bi--hero) at the same specificity, so the two tie constantly and the
// later sheet wins every tie. With `cssChunking: 'strict'` (next.config.ts) sheet order IS import
// order, and importing Stages before deck.css put the base sheet last — which silently reverted
// every size stages.css sets. The projector rendered the outcome stage's six-step chain at body
// type, three times its height, pushing the lesson and the board off the screen.
import './deck.css'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UI } from '@/content/room-labels'
import { ResetButton } from '@/components/host/ResetButton'
import { Stages, type RoomFrame } from '@/components/room/Stages'

const STATE_POLL_MS = 1000
/** The lobby's name board. Slower than the frame: nobody joins twice a second, and this is the one
 *  request in the workshop that carries a list rather than a handful of numbers. */
const NAMES_POLL_MS = 2000
/** How often the countdown re-renders between polls, so 45s does not tick in 1s jumps. */
const CLOCK_TICK_MS = 200
const TOKEN_KEY = 'decisionroom.hostToken'
/** Where phones join. NOT the origin — that is the AI Detective app on this same server. */
const PLAY_PATH = '/play'

/**
 * The login gate, and the reason the QR code is behind it.
 *
 * A LOGIN SCREEN, NOT A SECURITY BOUNDARY — the same distinction app/tv/page.tsx writes down.
 * `/api/room/control` and `/api/room/reset` both check `x-facilitator-token` server-side on every
 * call, and that check is the boundary; this only decides what the projector paints. What it buys
 * is that a laptop that wakes up on this URL in a hall full of people shows a closed door instead
 * of a live join code — and that the token has exactly ONE way in, so there is no field left on
 * screen for a host to mistype mid-workshop.
 */
function TokenGate({ value, onChange, onSubmit, error }: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  error: boolean
}) {
  return (
    <div className="pp-gate" data-testid="host-gate">
      <form className="pp-gate__card" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <p className="pp-gate__kicker" lang="th">{UI.title.th}</p>
        <h1 className="pp-gate__title" lang="th">{UI.gateTitle.th}</h1>
        <p className="pp-gate__blurb" lang="th">{UI.gateBlurb.th}</p>
        <input
          className="pp-gate__input"
          data-testid="gate-input"
          type="password"
          autoComplete="off"
          autoFocus
          aria-label={UI.hostToken.th}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="submit" className="pp-gate__btn" lang="th">{UI.gateButton.th}</button>
        {error ? (
          <p className="pp-gate__error" data-testid="gate-error" role="status" lang="th">
            {UI.tokenWrong.th}
          </p>
        ) : null}
      </form>
    </div>
  )
}

export default function RoomPage() {
  const [frame, setFrame] = useState<RoomFrame | null>(null)
  const [joinUrl, setJoinUrl] = useState('')
  /*
   * THREE STATES, not two. `null` = "localStorage has not been read yet", `''` = "read, and none
   * is held" (show the gate), anything else = "held" (show the room). Without the null state a
   * refresh mid-workshop would paint the full-screen gate across the projector for one commit
   * before the mount effect resolves — a closed door flashed at a room that is mid-question.
   */
  const [token, setToken] = useState<string | null>(null)
  /** The gate's draft. It only becomes `token` once the server has actually accepted it. */
  const [gateValue, setGateValue] = useState('')
  const [tokenError, setTokenError] = useState(false)
  const [names, setNames] = useState<string[]>([])
  const [offline, setOffline] = useState(false)
  const [, setTick] = useState(0)

  const lastSeqRef = useRef(-1)
  /** When the frame on screen was received, so the countdown can be interpolated locally. */
  const receivedAtRef = useRef(0)

  useEffect(() => {
    setJoinUrl(`${window.location.origin}${PLAY_PATH}`)
    try { setToken(localStorage.getItem(TOKEN_KEY) ?? '') } catch { setToken('') }
  }, [])

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch('/api/room/state')
        if (!res.ok) return   // keep the last good frame — a 500 is not a reason to blank a wall
        const next = (await res.json()) as RoomFrame
        if (!alive) return
        setOffline(false)
        // Monotonic guard: an out-of-order or replayed frame never moves the room backwards.
        if (next.seq < lastSeqRef.current) return
        lastSeqRef.current = next.seq
        receivedAtRef.current = Date.now()
        setFrame(next)
      } catch {
        if (alive) setOffline(true)   // keep the last good frame
      }
    }
    void poll()
    const id = setInterval(poll, STATE_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  /*
   * The name board, polled only while the room is in the lobby — it is the only screen that draws
   * names, and the moment the host starts, this list is dead weight on the wire and on the render.
   * A failed poll keeps whatever is already on the board, like every other poll on this page.
   */
  useEffect(() => {
    if (!token || frame?.phase !== 'lobby') return
    let alive = true
    const poll = async () => {
      try {
        const res = await fetch('/api/room/players')
        if (!res.ok) return
        const body = (await res.json()) as { names?: unknown }
        if (alive && Array.isArray(body.names)) setNames(body.names.filter((n): n is string => typeof n === 'string'))
      } catch { /* keep the board that is up */ }
    }
    void poll()
    const id = setInterval(poll, NAMES_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [token, frame?.phase])

  // Smooth countdown between polls. The server still owns the clock — this only interpolates the
  // last figure it sent, and never invents time beyond zero.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const control = useCallback(async (action: 'advance' | 'back') => {
    try {
      const res = await fetch('/api/room/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token ?? '' },
        body: JSON.stringify({ action }),
      })
      setTokenError(!res.ok)
    } catch {
      setTokenError(true)
    }
  }, [token])

  /*
   * The gate's own validation path. It cannot reuse `control` — that reads the CURRENT `token`
   * through its closure, which is still `''` at the moment the gate is submitted. `ping`
   * (app/api/room/control/route.ts) checks the token and does nothing else, in every phase, so a
   * wrong code still 403s and a right one 200s with no risk to a room that is already running.
   */
  const validateToken = useCallback(async (candidate: string) => {
    const value = candidate.trim()
    if (!value) { setTokenError(true); return }
    try {
      const res = await fetch('/api/room/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': value },
        body: JSON.stringify({ action: 'ping' }),
      })
      if (!res.ok) { setTokenError(true); return }
      setTokenError(false)
      setToken(value)
      try { localStorage.setItem(TOKEN_KEY, value) } catch { /* private mode: type it again */ }
    } catch {
      setTokenError(true)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The gate has an input and a button on screen. Without this guard a space in the token, or
      // an arrow key to fix a typo, would drive the live room from behind the closed door.
      //
      // BUTTON is in the list for a second reason: a focused button fires its own click on Space.
      // With the reset control on this bar, a host who pressed reset and then tapped Space to move
      // on would advance the room AND re-arm reset in one keystroke. ResetButton also blurs itself
      // after firing; this is the other half of that fix.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.isContentEditable)) return
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()   // space would otherwise scroll the projector
        void control('advance')
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        void control('back')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [control])

  const remainingMs = frame
    ? Math.max(0, frame.remainingMs - (Date.now() - receivedAtRef.current))
    : 0

  /*
   * TIME UP CLOSES THE VOTE, from this screen and only this screen.
   *
   * The server owns the clock and the projector is the one client holding the token, so the
   * projector is the only place this can fire without either trusting a phone or teaching the
   * store to advance itself on a timer nobody is watching.
   *
   * `firedForRef` keys the guard on the STAGE, not on a boolean: the countdown crosses zero on
   * every render at 5Hz, `advance` takes a round trip, and a plain flag would send the second
   * request before the first frame came back — closing the vote AND skipping the reveal behind it.
   * A stage can therefore auto-close exactly once, and walking `back` into it re-arms it.
   */
  const firedForRef = useRef<number | null>(null)
  useEffect(() => {
    if (!token || !frame) return
    if (frame.stageKind !== 'ask' || !frame.votingOpen) return
    if (remainingMs > 0) return
    if (firedForRef.current === frame.stageIndex) return
    firedForRef.current = frame.stageIndex
    void control('advance')
  }, [token, frame, remainingMs, control])

  const shown: RoomFrame = frame ?? {
    seq: -1, phase: 'lobby', stageIndex: 0, stageKind: null, questionId: null, questionIndex: null,
    votingOpen: false, remainingMs: 0, playerCount: 0, voteCount: 0,
  }

  // Hydration has not resolved: paint the ground and nothing else. See `token`'s comment above.
  if (token === null) return <main className="room-root" />

  if (token === '') {
    return (
      <main className="room-root">
        <TokenGate
          value={gateValue}
          onChange={setGateValue}
          onSubmit={() => void validateToken(gateValue)}
          error={tokenError}
        />
      </main>
    )
  }

  return (
    <main className="room-root">
      <Stages frame={shown} joinUrl={joinUrl} remainingMs={remainingMs} names={names} onStart={() => void control('advance')} />

      {/* The bar is absolutely positioned over the top-right of the slide, in this workshop's own
          cream-and-ink language rather than the deck's — it is the only chrome the room can see,
          and a green pill from the pitch-deck sheet read as a fifth colour on a screen whose four
          colours mean something. There is no token field on it: the gate is the only way a token
          gets in, so there is nothing here to mistype mid-workshop. */}
      <div className="pp-host" data-testid="host-bar">
        <button
          type="button"
          className="pp-host__btn pp-host__btn--ghost"
          aria-label={UI.backBtn.th}
          onClick={() => void control('back')}
        >
          ←
        </button>
        <button
          type="button"
          className="pp-host__btn"
          onClick={() => void control('advance')}
        >
          <span lang="th">{UI.advance.th}</span>
          <span aria-hidden>→</span>
        </button>
        {/* /api/room/reset, NOT /api/reset. The two workshops keep separate stores; the AI
            Detective endpoint would return 200 and clear the wrong room. */}
        <ResetButton
          endpoint="/api/room/reset"
          token={token}
          label="↺"
          ariaLabel={UI.reset.th}
          armedLabel={UI.resetArmed.th}
          className="pp-host__btn pp-host__btn--reset"
          onDone={(ok) => setTokenError(!ok)}
        />
      </div>

      {tokenError ? (
        <p className="pp-alert pp-alert--error" data-testid="token-error" role="status" lang="th">
          {UI.tokenWrong.th}
        </p>
      ) : null}

      {offline ? (
        <p className="pp-alert" data-testid="offline" role="status" lang="th">
          {UI.offline.th}
        </p>
      ) : null}
    </main>
  )
}

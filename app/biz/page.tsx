'use client'

// The Decision Room — the projector.
//
// One host drives 200 people through ten stages in fifteen minutes from this page. Everything the
// room sees is rendered by `components/room/Stages.tsx`; this file owns only the three things that
// touch the outside world: the poll, the clock, and the keyboard.
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
import { Bilingual } from '@/components/deck/Bilingual'
import { Stages, type RoomFrame } from '@/components/room/Stages'

const STATE_POLL_MS = 1000
/** How often the countdown re-renders between polls, so 45s does not tick in 1s jumps. */
const CLOCK_TICK_MS = 200
const TOKEN_KEY = 'decisionroom.hostToken'
/** Where phones join. NOT the origin — that is the AI Detective app on this same server. */
const PLAY_PATH = '/play'

export default function RoomPage() {
  const [frame, setFrame] = useState<RoomFrame | null>(null)
  const [joinUrl, setJoinUrl] = useState('')
  const [token, setToken] = useState('')
  const [tokenError, setTokenError] = useState(false)
  const [offline, setOffline] = useState(false)
  const [, setTick] = useState(0)

  const lastSeqRef = useRef(-1)
  /** When the frame on screen was received, so the countdown can be interpolated locally. */
  const receivedAtRef = useRef(0)

  useEffect(() => {
    setJoinUrl(`${window.location.origin}${PLAY_PATH}`)
    try { setToken(localStorage.getItem(TOKEN_KEY) ?? '') } catch { /* private mode: type it again */ }
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

  // Smooth countdown between polls. The server still owns the clock — this only interpolates the
  // last figure it sent, and never invents time beyond zero.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const advance = useCallback(async () => {
    try {
      const res = await fetch('/api/room/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token },
        body: JSON.stringify({ action: 'advance' }),
      })
      setTokenError(!res.ok)
    } catch {
      setTokenError(true)
    }
  }, [token])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // The host types the facilitator token into an input on this same screen. Without this
      // guard a space in the token, or an arrow key to fix a typo, advances the live room.
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault()   // space would otherwise scroll the projector
        void advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  const saveToken = (value: string) => {
    setToken(value)
    setTokenError(false)
    try { localStorage.setItem(TOKEN_KEY, value) } catch { /* ignore */ }
  }

  const remainingMs = frame
    ? Math.max(0, frame.remainingMs - (Date.now() - receivedAtRef.current))
    : 0

  const shown: RoomFrame = frame ?? {
    seq: -1, phase: 'lobby', stageIndex: 0, stageId: null, stageKind: null,
    votingOpen: false, remainingMs: 0, playerCount: 0, voteCount: 0, tallies: [], leaderboard: [],
  }

  return (
    <main className="room-root">
      <Stages frame={shown} joinUrl={joinUrl} remainingMs={remainingMs} />

      <div className="room-host" data-testid="host-bar">
        <label className="room-host__label" htmlFor="host-token">
          <span lang="en">{UI.hostToken.en}</span>
          <span lang="th">{UI.hostToken.th}</span>
        </label>
        <input
          id="host-token"
          data-testid="token-input"
          className="room-host__input"
          type="password"
          autoComplete="off"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
        />
        <button type="button" className="room-host__btn" onClick={() => void advance()}>
          <span lang="en">{UI.advance.en}</span>
          <span lang="th">{UI.advance.th}</span>
        </button>
      </div>

      {tokenError ? (
        <p className="room-alert room-alert--error" data-testid="token-error" role="status">
          <Bilingual text={token.trim() ? UI.tokenWrong : UI.tokenMissing} as="label" />
        </p>
      ) : null}

      {offline ? (
        <p className="room-alert" data-testid="offline" role="status">
          <Bilingual text={UI.offline} as="label" />
        </p>
      ) : null}
    </main>
  )
}

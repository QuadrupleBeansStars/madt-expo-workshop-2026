'use client'

// Café Persona — the projector.
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
import { ResetButton } from '@/components/host/ResetButton'
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

  const control = useCallback(async (action: 'advance' | 'back') => {
    try {
      const res = await fetch('/api/room/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token },
        body: JSON.stringify({ action }),
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
      //
      // BUTTON is in the list for a different reason: a focused button fires its own click on
      // Space. With the reset control on this bar, a host who pressed reset and then tapped Space
      // to move on would advance the room AND re-arm reset in one keystroke. ResetButton also
      // blurs itself after firing; this is the other half of that fix.
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

  const saveToken = (value: string) => {
    setToken(value)
    setTokenError(false)
    try { localStorage.setItem(TOKEN_KEY, value) } catch { /* ignore */ }
  }

  const remainingMs = frame
    ? Math.max(0, frame.remainingMs - (Date.now() - receivedAtRef.current))
    : 0

  const shown: RoomFrame = frame ?? {
    seq: -1, phase: 'lobby', stageIndex: 0, stageKind: null, questionId: null, questionIndex: null,
    votingOpen: false, remainingMs: 0, playerCount: 0, voteCount: 0,
  }

  return (
    <main className="room-root">
      <Stages frame={shown} joinUrl={joinUrl} remainingMs={remainingMs} />

      {/* The bar is absolutely positioned over the top-right of the slide and the storyboard strip
          runs the full width underneath it, so its WIDTH is a layout concern, not just chrome.
          The "รหัสผู้ดำเนินรายการ" label is setup instruction: it earns its ~150px while the field
          is empty and is dead weight for the rest of the workshop. Once a token is saved it goes,
          and the field keeps the accessible name. */}
      <div className="room-host" data-testid="host-bar" data-compact={token.trim() && !tokenError ? 'true' : 'false'}>
        <label className="room-host__label" htmlFor="host-token">
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
        <button type="button" className="room-host__btn room-host__btn--back" onClick={() => void control('back')}>
          <span lang="th">{UI.backBtn.th}</span>
        </button>
        <button type="button" className="room-host__btn" onClick={() => void control('advance')}>
          <span lang="th">{UI.advance.th}</span>
        </button>
        {/* /api/room/reset, NOT /api/reset. The two workshops keep separate stores; the AI
            Detective endpoint would return 200 and clear the wrong room. */}
        {/* The idle label is the GLYPH ALONE. This bar is absolutely positioned over the top-right
            of the slide, and the storyboard strip runs the full width underneath it — the spelled
            out label pushed the bar wide enough to cover the third panel's caption. Armed, it
            takes the full sentence and the extra width, which is correct: at that moment it is the
            most important thing on the host's screen and the room is not reading the strip. */}
        <ResetButton
          endpoint="/api/room/reset"
          token={token}
          label="↺"
          ariaLabel={UI.reset.th}
          armedLabel={UI.resetArmed.th}
          className="host-reset"
          onDone={(ok) => setTokenError(!ok)}
        />
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

'use client'

// The Decision Room — the phone (`/play`).
//
// Two hundred people join this once and follow the host for fifteen minutes on a mid-range Android
// over crowded venue Wi-Fi. It owns the three things that touch the outside world — identity, the
// poll, and the vote queue — and hands a frame to `PhoneBody`, which renders it and nothing else.
//
// RELIABILITY RULES, each one paid for by a bug in this repo:
//
//   1. RESET RECOVERY. `you` is present in every state response for a player the server knows, and
//      absent for one it does not. An ok response for the id we sent, with no `you`, means the room
//      was reset — the phone clears its identity and returns to the join screen THERE, in the poll
//      loop. The failure this guards against: waiting for a vote to fail with 400 instead, which
//      leaves the phone on "waiting for the host" looking healthy and ejects the player mid-round
//      on their next tap, costing them that round. AI Detective's phone (app/page.tsx) had exactly
//      that bug and now carries the same check — keep both in step.
//   2. MONOTONIC `seq`. A frame older than the one on screen is dropped, never rendered.
//   3. A failed poll KEEPS the last good frame. A stale screen is recoverable in a dark room; a
//      blank one makes 200 people reload at once.
//   4. A vote the network dropped is queued and retried. A vote the server rejected with 409
//      (round closed) is DROPPED — re-queuing it would retry until the venue Wi-Fi dies.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PHONE } from '@/content/room-labels'
import { NAME_MAX } from '@/lib/names'
import { Bilingual } from '@/components/deck/Bilingual'
import { PhoneBody, type PhoneFrame } from '@/components/room/PhoneBody'
import type { LocalizedText } from '@/lib/types'

/** Distinct from AI Detective's `aidet.*` keys: both apps are served from this one origin. */
const PLAYER_KEY = 'decisionroom.player'
const PENDING_KEY = 'decisionroom.pending'
const POLL_MS = 1000
/** How often the countdown re-renders between polls, so 30s does not tick in 1s jumps. */
const CLOCK_TICK_MS = 200
const REQ_TIMEOUT_MS = 5000
/** How long "the host reset the room" stays on the join screen before it clears itself. */
const RESET_NOTICE_MS = 2000

/** Identity ONLY. The shop's numbers live on the server, never in this phone's storage. */
type Identity = { playerId: string; name: string }
type QueuedVote = { playerId: string; questionId: string; choiceIndex: number }

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Identity>
    if (typeof p?.playerId === 'string' && p.playerId && typeof p.name === 'string') {
      return { playerId: p.playerId, name: p.name }
    }
  } catch { /* private mode or corrupt entry: join again */ }
  return null
}

function saveIdentity(id: Identity | null) {
  try {
    if (id) localStorage.setItem(PLAYER_KEY, JSON.stringify(id))
    else localStorage.removeItem(PLAYER_KEY)
  } catch { /* ignore */ }
}

function readPending(): QueuedVote[] {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    return Array.isArray(p) ? p : []
  } catch { return [] }
}

function writePending(list: QueuedVote[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQ_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function postJson(url: string, body: unknown): Promise<Response> {
  return fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default function PlayPage() {
  const [ready, setReady] = useState(false)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [frame, setFrame] = useState<PhoneFrame | null>(null)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [notice, setNotice] = useState<LocalizedText | null>(null)
  const [offline, setOffline] = useState(false)
  const [joining, setJoining] = useState(false)
  const [, setTick] = useState(0)

  const lastSeqRef = useRef(-1)
  /** When the frame on screen arrived, so the countdown can be interpolated between polls. */
  const receivedAtRef = useRef(0)
  /** One flush at a time: a flush still in flight when the next poll fires would double-post. */
  const flushingRef = useRef(false)
  /** The stage (phase:index) the notice on screen belongs to. */
  const stageKeyRef = useRef<string | null>(null)

  useEffect(() => {
    setIdentity(loadIdentity())
    setReady(true)
  }, [])

  /** Forget this phone's identity and go back to the join screen, with a reason. */
  const returnToJoin = useCallback((reason: LocalizedText | null) => {
    saveIdentity(null)
    writePending([])
    lastSeqRef.current = -1
    setIdentity(null)
    setFrame(null)
    setPicks({})
    setOffline(false)
    setNotice(reason)
  }, [])

  /*
   * THE RESET LINE CLEARS ITSELF AFTER TWO SECONDS — and ONLY that line.
   *
   * It is news, not a state: it explains why this phone is suddenly back on the join screen, and
   * once read it is a stale sentence sitting over the field the player is trying to type in. The
   * other notices stay: `joinFailed` is about the button they just pressed, and `tooLate` is
   * cleared by the stage it belongs to (see `stageKeyRef`), not by a clock.
   *
   * The match is on identity, which is exact here because `PHONE.roomReset` is a module constant
   * and `returnToJoin` is handed that same object at all three call sites. app/page.tsx does the
   * same for AI Detective — change one, change both.
   */
  useEffect(() => {
    if (notice !== PHONE.roomReset) return
    const id = setTimeout(() => setNotice(null), RESET_NOTICE_MS)
    return () => clearTimeout(id)
  }, [notice])

  const flushPending = useCallback(async (playerId: string) => {
    if (flushingRef.current) return
    const pending = readPending()
    if (pending.length === 0) return
    flushingRef.current = true
    try {
      const still: QueuedVote[] = []
      for (const vote of pending) {
        // A queued vote from a previous identity belongs to a shop that no longer exists.
        if (vote.playerId !== playerId) continue
        try {
          const res = await postJson('/api/room/vote', vote)
          if (res.status === 400) { returnToJoin(PHONE.roomReset); return }
          if (res.status === 409) continue          // round closed — drop, never re-queue
          if (!res.ok) still.push(vote)             // transient server error — try again later
        } catch {
          still.push(vote)                          // still offline
        }
      }
      writePending(still)
    } finally {
      flushingRef.current = false
    }
  }, [returnToJoin])

  // The poll. Runs only while this phone has an identity.
  useEffect(() => {
    if (!identity) return
    const me = identity.playerId
    let alive = true

    const poll = async () => {
      let next: PhoneFrame
      try {
        const res = await fetchWithTimeout(
          `/api/room/state?playerId=${encodeURIComponent(me)}`, { method: 'GET' },
        )
        if (!res.ok) { if (alive) setOffline(true); return }   // keep the last good frame
        next = (await res.json()) as PhoneFrame
      } catch {
        if (alive) setOffline(true)                            // keep the last good frame
        return
      }
      if (!alive) return
      setOffline(false)
      if (typeof next.seq === 'number' && next.seq < lastSeqRef.current) return
      lastSeqRef.current = next.seq

      // Rule 1. The server answered, for the id we sent, and does not know this player: the room
      // was reset. Leave now, on a holding screen, rather than mid-round on a failed tap.
      if (!next.you) { returnToJoin(PHONE.roomReset); return }

      // A notice belongs to the stage it happened in. "Too late" must not ride along on the
      // holding screens of later stages, under a live role="status".
      const stageKey = `${next.phase}:${next.stageIndex}:${next.stageKind ?? ''}`
      if (stageKey !== stageKeyRef.current) {
        stageKeyRef.current = stageKey
        setNotice(null)
      }

      receivedAtRef.current = Date.now()
      setFrame(next)
      void flushPending(me)
    }

    void poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [identity, returnToJoin, flushPending])

  // Smooth countdown between polls. The server still owns the clock; this only interpolates the
  // last figure it sent and never invents time beyond zero.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const join = useCallback(async (raw: string) => {
    const name = raw.trim()
    if (!name) { setNotice(PHONE.nameRequired); return }
    if (joining) return
    setJoining(true)
    try {
      const res = await postJson('/api/room/join', { name })
      if (!res.ok) throw new Error('bad status')
      const { player } = (await res.json()) as { player: { id: string; name?: string } }
      if (!player?.id) throw new Error('no player')
      const id: Identity = { playerId: player.id, name: player.name || name }
      saveIdentity(id)
      writePending([])
      lastSeqRef.current = -1
      setNotice(null)
      setIdentity(id)
    } catch {
      setNotice(PHONE.joinFailed)
    } finally {
      setJoining(false)
    }
  }, [joining])

  const vote = useCallback(async (questionId: string, choiceIndex: number) => {
    if (!identity) return
    const queued: QueuedVote = { playerId: identity.playerId, questionId, choiceIndex }
    setPicks((p) => ({ ...p, [questionId]: choiceIndex }))   // optimistic, until the server confirms
    setNotice(null)
    try {
      const res = await postJson('/api/room/vote', queued)
      if (res.status === 400) { returnToJoin(PHONE.roomReset); return }
      if (res.status === 409) {
        // Rule 4. The question is closed. Drop the optimistic pick so the phone stops showing a
        // vote that never landed, and never re-queue this one.
        setPicks((p) => { const next = { ...p }; delete next[questionId]; return next })
        setNotice(PHONE.tooLate)
        return
      }
      if (!res.ok) throw new Error('bad status')
    } catch {
      // One queued vote per question: a player who taps twice queues their latest answer, not both.
      writePending([...readPending().filter((v) => v.questionId !== questionId), queued])
    }
  }, [identity, returnToJoin])

  // Nothing on screen until localStorage has been read, so a phone that already has an identity
  // never flashes the join screen at a player who joined ten minutes ago.
  // `phone-root` is not decoration: phone.css hangs every --phone-* token AND the
  // .deck-bi stacking rules off it. Without it the join screen loses the token space
  // and Thai renders inline after English instead of beneath it.
  if (!ready) return <div className="phone-root phone-join" />

  if (!identity) {
    return <JoinScreen onJoin={join} joining={joining} notice={notice} />
  }

  const remainingMs = frame
    ? Math.max(0, frame.remainingMs - (Date.now() - receivedAtRef.current))
    : 0

  return (
    <PhoneBody
      name={identity.name}
      frame={frame}
      remainingMs={remainingMs}
      picked={frame?.questionId ? (picks[frame.questionId] ?? null) : null}
      onVote={(questionId, choiceIndex) => void vote(questionId, choiceIndex)}
      notice={notice}
      offline={offline}
    />
  )
}

function JoinScreen({
  onJoin, joining, notice,
}: {
  onJoin: (name: string) => void
  joining: boolean
  notice: LocalizedText | null
}) {
  const [name, setName] = useState('')

  return (
    <main className="phone-root phone-join" data-testid="phone-join">
      {/* The mark anchors the top. Taking the "ตอบ 8 ข้อ…" blurb out left a title, a label, a
          field and a button floating in the middle of an otherwise blank screen with nothing
          holding any of them anywhere. */}
      <div className="phone-join__brand">
        <svg className="phone-join__cup" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M17 10.5h1.6a2.4 2.4 0 0 1 0 4.8H17" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 2.5c-.9 1.2-.9 2.3 0 3.5M12 2.5c-.9 1.2-.9 2.3 0 3.5"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <Bilingual text={PHONE.joinTitle} as="hero" />
        <span className="phone-join__rule" aria-hidden />
      </div>

      {notice ? (
        <p className="phone-notice" data-testid="phone-notice" role="status">
          <Bilingual text={notice} as="label" />
        </p>
      ) : null}

      {/* THE FORM SITS AT THE BOTTOM, and that is a keyboard decision rather than a taste one: a
          form centred vertically is the one a phone keyboard slides up over. Pinned low, the
          keyboard arrives underneath it and the button stays in reach. */}
      <form
        className="phone-join__form"
        onSubmit={(e) => { e.preventDefault(); onJoin(name) }}
      >
        <span className="phone-join__labelrow">
          <label htmlFor="phone-name">
            <Bilingual text={PHONE.namePrompt} as="label" />
          </label>
          {/* The cap is thirty now, and a shop name is long enough to reach it. Counting up in
              front of the player beats a field that silently stops accepting letters. */}
          <span className="phone-join__count" data-testid="name-count" aria-hidden>
            {name.length} / {NAME_MAX}
          </span>
        </span>
        <input
          id="phone-name"
          data-testid="name-input"
          className="phone-join__input"
          type="text"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          enterKeyHint="go"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="phone-join__btn"
          data-testid="join-button"
          disabled={joining}
        >
          <span lang="th">{joining ? PHONE.joining.th : PHONE.joinButton.th}</span>
        </button>
      </form>
    </main>
  )
}

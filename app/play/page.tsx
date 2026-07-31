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
//      loop. AI Detective's phone (app/page.tsx) instead waits for a vote to fail with 400: it sits
//      on "waiting for the host" until the player taps, then ejects them mid-round. That is the
//      exact failure this file exists to not repeat.
//   2. MONOTONIC `seq`. A frame older than the one on screen is dropped, never rendered.
//   3. A failed poll KEEPS the last good frame. A stale screen is recoverable in a dark room; a
//      blank one makes 200 people reload at once.
//   4. A vote the network dropped is queued and retried. A vote the server rejected with 409
//      (round closed) is DROPPED — re-queuing it would retry until the venue Wi-Fi dies.

import { useCallback, useEffect, useRef, useState } from 'react'
import { PHONE } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import { PhoneBody, type PhoneFrame } from '@/components/room/PhoneBody'
import type { LocalizedText } from '@/lib/types'

/** Distinct from AI Detective's `aidet.*` keys: both apps are served from this one origin. */
const PLAYER_KEY = 'decisionroom.player'
const PENDING_KEY = 'decisionroom.pending'
const POLL_MS = 1000
/** How often the countdown re-renders between polls, so 45s does not tick in 1s jumps. */
const CLOCK_TICK_MS = 200
const REQ_TIMEOUT_MS = 5000

/** Identity ONLY. The shop's numbers live on the server, never in this phone's storage. */
type Identity = { playerId: string; name: string }
type QueuedVote = { playerId: string; stageId: string; optionId: string }

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
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<LocalizedText | null>(null)
  const [offline, setOffline] = useState(false)
  const [joining, setJoining] = useState(false)
  const [, setTick] = useState(0)

  const lastSeqRef = useRef(-1)
  /** When the frame on screen arrived, so the countdown can be interpolated between polls. */
  const receivedAtRef = useRef(0)
  /** One flush at a time: a flush still in flight when the next poll fires would double-post. */
  const flushingRef = useRef(false)
  /** The stage the notice on screen belongs to. */
  const stageIdRef = useRef<string | null>(null)

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

      // A notice belongs to the round it happened in. "Too late" must not ride along on the
      // holding screens of the next three stages, under a live role="status".
      if (next.stageId !== stageIdRef.current) {
        stageIdRef.current = next.stageId
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

  const vote = useCallback(async (stageId: string, optionId: string) => {
    if (!identity) return
    const queued: QueuedVote = { playerId: identity.playerId, stageId, optionId }
    setPicks((p) => ({ ...p, [stageId]: optionId }))   // optimistic, until the server confirms
    setNotice(null)
    try {
      const res = await postJson('/api/room/vote', queued)
      if (res.status === 400) { returnToJoin(PHONE.roomReset); return }
      if (res.status === 409) {
        // Rule 4. The round is closed. Drop the optimistic pick so the phone stops showing a vote
        // that never landed, and never re-queue this one.
        setPicks((p) => { const next = { ...p }; delete next[stageId]; return next })
        setNotice(PHONE.tooLate)
        return
      }
      if (!res.ok) throw new Error('bad status')
    } catch {
      // One queued vote per stage: a player who taps twice queues their latest answer, not both.
      writePending([...readPending().filter((v) => v.stageId !== stageId), queued])
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
      picked={frame?.stageId ? (picks[frame.stageId] ?? null) : null}
      onVote={(stageId, optionId) => void vote(stageId, optionId)}
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
      <div>
        <Bilingual text={PHONE.joinTitle} as="hero" />
        <Bilingual text={PHONE.joinBlurb} as="body" />
      </div>

      {notice ? (
        <p className="phone-notice" data-testid="phone-notice" role="status">
          <Bilingual text={notice} as="label" />
        </p>
      ) : null}

      <form
        className="phone-join__form"
        onSubmit={(e) => { e.preventDefault(); onJoin(name) }}
      >
        <label htmlFor="phone-name">
          <Bilingual text={PHONE.namePrompt} as="label" />
        </label>
        <input
          id="phone-name"
          data-testid="name-input"
          className="phone-join__input"
          type="text"
          value={name}
          maxLength={40}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="submit"
          className="phone-join__btn"
          data-testid="join-button"
          disabled={joining}
        >
          <span lang="en">{joining ? PHONE.joining.en : PHONE.joinButton.en}</span>
          {' · '}
          <span lang="th">{joining ? PHONE.joining.th : PHONE.joinButton.th}</span>
        </button>
      </form>
    </main>
  )
}

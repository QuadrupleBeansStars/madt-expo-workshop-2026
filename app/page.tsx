'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicGameState, Verdict } from '@/lib/types'
import { CodenameScreen } from '@/components/CodenameScreen'
import { Patrol } from '@/components/game/Patrol'
import { t } from '@/lib/i18n'

const RUN_KEY = 'aidet.run'   // identity ONLY: { playerId, codename }
const PENDING_KEY = 'aidet.pending'
const POLL_MS = 1200
const REQ_TIMEOUT_MS = 5000

/**
 * The phases the investigation room is painted behind: waiting, `rules`, `reading` and `question`.
 * `reveal`, `actcard`, `tally` and `podium` carry the content the room exists to frame and keep
 * `.det`'s flat wall colour instead.
 *
 * `rules` joins the list rather than sitting on flat black because it is the same KIND of screen as
 * `reading` — a short holding beat with the two stamps present and locked underneath it. The room
 * is what tells a player those two screens are the same moment of the game.
 */
const ROOM_PHASES: ReadonlySet<PublicGameState['phase']> = new Set(['lobby', 'rules', 'reading', 'question'])

/** Thai everywhere on this screen. Referenced through the CSS variable, never by family name, or
 *  the offline font bundle stops resolving on the day. */
const THAI = 'var(--font-thai), system-ui, sans-serif'

/**
 * Where the floor line sits on a PHONE, as a fraction of the screen height.
 *
 * NOT the reference's 0.722, and the difference is arithmetic rather than taste. That constant is
 * read off a 1280x720 slide; on a 390x844 portrait screen the bottom 28% is precisely where the
 * two vote buttons live (2 x 104px of `.verdict-btn` plus a 20px gap plus 24px of column padding,
 * so they begin at y≈592), and a floor line at 0.722 lands at 608 — the detective and the duck
 * would walk the whole round hidden behind ผ่าน. At 0.55 the line is at 464, the pair stands at
 * 487–553, and the buttons rest ON the floor in front of them, which is what a room looks like.
 */
const PHONE_FLOOR = 0.55

type Identity = { playerId: string; codename: string }
type QueuedAnswer = { playerId: string; questionId: string; verdict: Verdict }

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Identity>
    if (typeof p?.playerId === 'string' && p.playerId && typeof p.codename === 'string') {
      return { playerId: p.playerId, codename: p.codename }
    }
  } catch { /* ignore */ }
  return null
}
function saveIdentity(id: Identity | null) {
  try { id ? localStorage.setItem(RUN_KEY, JSON.stringify(id)) : localStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
}
function readPending(): QueuedAnswer[] {
  try { const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]'); return Array.isArray(p) ? p : [] } catch { return [] }
}
function writePending(list: QueuedAnswer[]) {
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

export default function PlayerPage() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [gameState, setGameState] = useState<PublicGameState | null>(null)
  const [joinError, setJoinError] = useState(false)
  const [sessionWasReset, setSessionWasReset] = useState(false)
  // Ephemeral memory of my verdict per questionId (for the reveal screen). NOT persisted.
  const [picks, setPicks] = useState<Record<string, Verdict>>({})
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    setIdentity(loadIdentity())
  }, [])

  const returnToCodename = useCallback((wasReset: boolean) => {
    saveIdentity(null)
    writePending([])
    setIdentity(null)
    setGameState(null)
    setPicks({})
    lastSeqRef.current = -1
    setSessionWasReset(wasReset)
  }, [])

  // Poll the server heartbeat while we have an identity.
  useEffect(() => {
    if (!identity) return
    let alive = true
    const poll = async () => {
      try {
        const res = await fetchWithTimeout(`/api/state?playerId=${encodeURIComponent(identity.playerId)}`, { method: 'GET' })
        if (!res.ok) return
        const next = (await res.json()) as PublicGameState
        if (!alive) return

        // RESET RECOVERY. The server answered, for the id we sent, and does not know this
        // player: the host reset the room. Leave HERE, in the poll, on the join screen — not
        // mid-round on a failed tap. Before this check the phone sat on "waiting for the host"
        // looking perfectly healthy and only ejected the player when they answered, costing
        // them the round they were in. The vote-time 400 below is now the backstop, not the
        // primary path. Mirrors app/play/page.tsx, which was built with this from the start.
        if (!next.you) { returnToCodename(true); return }

        if (typeof next.seq === 'number' && next.seq >= lastSeqRef.current) {
          lastSeqRef.current = next.seq
          setGameState(next)
        }
      } catch { /* transient — keep last good frame */ }
    }
    void poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [identity, returnToCodename])

  const join = async (codenameInput: string) => {
    try {
      const res = await fetchWithTimeout('/api/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codename: codenameInput }),
      })
      if (!res.ok) throw new Error('bad status')
      const { player } = await res.json()
      const id: Identity = { playerId: player.id, codename: player.codename ?? codenameInput }
      saveIdentity(id)
      setIdentity(id)
      setJoinError(false)
      setSessionWasReset(false)
    } catch {
      setJoinError(true)
    }
  }

  const flushPending = useCallback(async () => {
    const pending = readPending()
    if (pending.length === 0) return
    const still: QueuedAnswer[] = []
    for (const a of pending) {
      try {
        const res = await fetchWithTimeout('/api/answer', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a),
        })
        if (res.status === 400) { returnToCodename(true); return }
        if (res.status === 409) continue            // round closed — drop, never requeue
        if (!res.ok) still.push(a)                   // transient
      } catch { still.push(a) }
    }
    writePending(still)
  }, [returnToCodename])

  // Posts the verdict, not an option id — the projector owns the question, the phone owns only
  // the tap. Same first-answer-wins/offline-retry shape as the old commit(): optimistic local
  // lock, then a real POST, queued for retry on a network failure and dropped (never requeued)
  // once the round has closed under us.
  const submit = async (verdict: Verdict) => {
    if (!identity || !gameState?.questionId) return
    const questionId = gameState.questionId
    setPicks((p) => ({ ...p, [questionId]: verdict }))   // optimistic lock
    const answer: QueuedAnswer = { playerId: identity.playerId, questionId, verdict }
    try {
      const res = await fetchWithTimeout('/api/answer', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer),
      })
      if (res.status === 400) { returnToCodename(true); return }
      if (res.status === 409) return                  // too late — locked, drop
      if (!res.ok) throw new Error('bad status')
    } catch {
      writePending([...readPending().filter((a) => a.questionId !== questionId), answer])
    }
    void flushPending()
  }

  const message = joinError ? t('joinFailed', 'th') : sessionWasReset ? t('sessionReset', 'th') : undefined

  return (
    <main className="det relative min-h-dvh">
      {/*
        * THE ROOM, behind the whole screen (spec §6, v3.1 fidelity pass) — not a strip inside the
        * column any more. `inset-0` is <main>'s padding box, so the wall runs the full height and
        * the floor takes the bottom of it with the detective walking on the line; the column above
        * carries `relative z-10` and stands on it.
        *
        * A BARE <canvas>, deliberately not wrapped in a div: `scripts/check-projector-fit.mjs`
        * finds the phone's content column with `document.querySelector('main > div')`, and a
        * wrapper here would hand that probe the backdrop instead and quietly report a healthy
        * layout for a column it never measured.
        *
        * MOUNTED BEHIND THE JOIN SCREEN TOO, as of v3.2. It was not before, and the reason was
        * stated here: `CodenameScreen` was still on the Decision Room's light palette, and a dark
        * investigation room behind a light form is neither design. That screen is now the case
        * folder lying on the desk (spec §7), so the room is the desk it lies on — the first screen
        * a player sees is the same place as every screen after it.
        */}
      {(!identity || !gameState || ROOM_PHASES.has(gameState.phase)) && (
        <Patrol floor={PHONE_FLOOR} className="pointer-events-none absolute inset-0 h-full w-full" />
      )}

      {!identity ? (
        <CodenameScreen onJoin={join} message={message} />
      ) : (
        <PhoneBody state={gameState} picks={picks} onSubmit={submit} />
      )}
    </main>
  )
}

function PhoneBody({
  state, picks, onSubmit,
}: {
  state: PublicGameState | null
  picks: Record<string, Verdict>
  onSubmit: (verdict: Verdict) => void
}) {
  if (!state || state.phase === 'lobby') {
    return <Centered>{t('waitingToStart', 'th')}</Centered>
  }

  const myVerdict = state.questionId ? picks[state.questionId] : undefined

  return (
    /*
     * `relative z-10`: the room is painted behind <main>, and the column stands on it.
     *
     * `min-h-dvh`, NOT Tailwind's `min-h-screen` (`100vh`). On every mobile browser `vh` means the
     * viewport with the URL BAR COLLAPSED, so with the bar showing a `100vh` column is taller than
     * the screen — and this column pushes its two stamps to its own bottom with `mt-auto`, which
     * put them below the fold on a real phone while every jsdom test and every headless screenshot
     * said they were fine. `dvh` is the viewport as it actually is.
     *
     * `overflow-x-clip` IS THE STAMP SLAM'S CONTAINER, and it was found in a real browser, not
     * reasoned about: the chosen stamp scales in from 2.6x, which for one frame makes a 342px
     * stamp 889px wide. That widened the DOCUMENT to 657px, and Chrome's mobile viewport zoomed
     * the whole page out to fit — and stayed zoomed out for the rest of the round, because
     * nothing zooms a page back in. Every following screen was then rendered at 60% size on the
     * player's phone.
     *
     * `clip`, not `hidden`: `hidden` would make this a scroll container, and the clip happens at
     * the PADDING edge — 390px, the full viewport — so the landed stamp at -11deg (355px of
     * rotated bounding width) is nowhere near it. Only the transient giant is clipped, and it is
     * clipped at the screen edge, which is where it was invisible anyway. `overflow-y` is left
     * `visible` so the stamp can still land ACROSS the dimmed one, which is the whole picture.
     */
    <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col overflow-x-clip p-6">
      {/*
        * THE TWO HOLDING BEATS — `rules` (spec §3) and `reading` (spec §2). Both stamps are already
        * HERE on both of them, and visibly so — locked, not absent. A player who spends the beat
        * looking at a blank phone and then has two controls appear under their thumb has to find
        * them before they can use them, and the fifteen-second answer window is where that cost
        * lands. Nothing appears out of nowhere.
        *
        * There is no timer bar on either, deliberately: that bar means "you may answer now" and
        * nothing else, and showing it while the server will refuse every answer teaches the room
        * the wrong signal.
        *
        * The lock needs no server cooperation to be real — `recordAnswer` already rejects anything
        * arriving outside `phase === 'question'` (lib/store.ts), so both beats hold against a
        * crafted POST, not merely against a disabled button.
        */}
      {state.phase === 'rules' && (
        state.you?.spectator
          ? <SpectatingPanel />
          : (
            <>
              {/* The rules themselves are on the projector, read by the room together — three
                  numbered lines and the scoring chips do not survive being cut down to a phone,
                  and a player reading their own copy is a player not looking up. This is the same
                  shape as `reading` below, one screen earlier: a line, and the two stamps waiting.
                  Untimed, so there is no countdown to show — the host advances it. */}
              <HoldingPanel line="อ่านกติกาที่จอใหญ่" note="เดี๋ยวเริ่มข้อแรก" />
              <StampPanel onPick={onSubmit} picked={undefined} locked />
            </>
          )
      )}
      {state.phase === 'reading' && (
        state.you?.spectator
          ? <SpectatingPanel />
          : (
            <>
              {/* The instruction and the countdown float in the upper wall rather than sitting on
                  the column's top edge. `my-auto` here against `mt-auto` on the stamps splits the
                  slack three ways, which drops them to roughly a quarter of the way down — over
                  the room's wall, and well clear of the floor line the characters walk. Before the
                  room went in behind the whole screen this band was ~40% empty black, which is the
                  complaint the patrol was built to answer one phase later. */}
              <HoldingPanel line="อ่านคำถามบนจอใหญ่" remainingMs={state.remainingMs} />
              <StampPanel onPick={onSubmit} picked={undefined} locked />
            </>
          )
      )}
      {state.phase === 'question' && (
        state.you?.spectator
          ? <SpectatingPanel />
          : (
            /* Nothing above the stamps but the room — the question itself is on the projector.
               `mt-auto` on the panel keeps them on the floor at the bottom of the screen. */
            <StampPanel onPick={onSubmit} picked={myVerdict} locked={state.youAnswered === true || myVerdict !== undefined} />
          )
      )}
      {state.phase === 'reveal' && <RevealPanel you={state.you} playerCount={state.playerCount} />}
      {state.phase === 'actcard' && <LookUpPanel />}   {/* 👀 ดูจอใหญ่ — no buttons, by design */}
      {state.phase === 'tally' && <MyTallyPanel wrongPass={state.you?.wrongPass ?? 0} />}
      {state.phase === 'podium' && <MyResultPanel you={state.you} />}
    </div>
  )
}

/**
 * The upper band of both holding beats: one Thai line saying where to look, and — on `reading`
 * only — the seconds left before the stamps unlock.
 *
 * A NUMERAL, NOT THE OLD FOUR DOTS, and this is the READING_MS change (spec §3), not a restyle.
 * The dots were four, one going out per second, which silently encoded a five-second beat: at ten
 * seconds all four sit lit for the first six of them and the countdown says nothing for more than
 * half its length. A count of seconds is correct at ANY duration, so this never has to be
 * revisited if the beat moves again.
 *
 * And it is derived from `remainingMs`, deliberately, rather than from `READING_MS` itself.
 * Importing that constant would pull `lib/game.ts` into this page's client bundle, and
 * `lib/game.ts` imports `content/questions` at module scope — which would ship the ANSWER KEY
 * (every question's `verdict`, `truth` and `tell`) to every player's phone. The projector may
 * import it; the phone must not. This file imports nothing but types and `lib/i18n` for that
 * reason, and a countdown is the most natural place for someone to break it.
 *
 * Still not a timer bar: spec §2 makes the point that a sliding bar is the "you may answer now"
 * signal and both of these phases are the opposite of that, so the two affordances must not look
 * alike from the back of a room. A bare number does not read as a track filling up.
 */
function HoldingPanel({ line, note, remainingMs }: { line: string; note?: string; remainingMs?: number }) {
  const secs = remainingMs === undefined ? null : Math.max(0, Math.ceil(remainingMs / 1000))
  return (
    <div className="my-auto flex flex-col items-center gap-3">
      <p className="det-thai text-center text-[22px]" style={{ color: 'var(--det-gold)' }}>{line}</p>
      {note && (
        <p className="text-center text-[17px]" style={{ fontFamily: THAI, color: 'var(--det-cyan)' }}>{note}</p>
      )}
      {secs !== null && (
        /* VT323, the terminal face — numerals only, so no Thai glyph question arises. Bigger than
           the projector's own clock, not smaller: this is the only countdown a player holding the
           phone can actually see. */
        <p className="det-term leading-none" style={{ fontSize: 72, color: 'var(--det-cyan)' }}>{secs}</p>
      )}
    </div>
  )
}

/*
 * THE TWO RUBBER STAMPS (spec §7), and the CSS for them.
 *
 * IT LIVES HERE, NOT IN app/globals.css, and that is a scope decision rather than a preference:
 * this pass owns the phone and not the stylesheet. Every selector is written `.det .det-stamp…`,
 * so it is namespaced exactly like everything else in the premium palette and cannot reach The
 * Decision Room even by accident. `.verdict-btn` / `.verdict-pass` / `.verdict-reject` in
 * globals.css are left unused by anything — a tidy-up for whoever owns that file next.
 *
 * A stamp is ink on paper: cream ground, a heavy double rule in the verdict's own ink, and a Thai
 * label in the same ink. The 10% wash of that ink over the paper is what keeps the two telling
 * apart as COLOUR FIELDS at a glance in a dark hall — a player under a fifteen-second clock finds
 * green-vs-red before they read either word.
 *
 * The slam: the chosen stamp scales in from 2.6x, overshoots, and settles at -11deg, where it
 * stays. The rotation lives on `.is-picked` as a plain declaration as well as inside the
 * keyframes, so the mark sits at -11deg with the animation suppressed too — which is exactly what
 * the reduced-motion block at the bottom does. It removes the SLAM, not the stamp; a player who
 * has asked their phone to stop moving things must still be able to see which one they chose.
 *
 * That block is last on purpose. These rules are unlayered (this is a plain <style> element, not
 * `@layer components`), so between rules of equal specificity source order is the only lever —
 * the same trap app/globals.css documents twice. Do not move it up.
 */
const STAMP_CSS = `
.det .det-stamp {
  position: relative;
  min-height: 104px;
  padding: 18px 22px;
  font-family: var(--font-thai), system-ui, sans-serif;
  font-weight: 700;
  font-size: 26px;
  border: 5px double currentColor;
  border-radius: 12px;
  box-shadow: -4px 4px 0 rgba(0, 0, 0, 0.55);
  cursor: pointer;
  transition: opacity 0.18s ease, transform 0.1s ease, box-shadow 0.1s ease;
}
.det .det-stamp-pass {
  color: #146c43;
  background: linear-gradient(rgba(20, 108, 67, 0.1), rgba(20, 108, 67, 0.1)), var(--det-paper);
}
.det .det-stamp-reject {
  color: #b32d2d;
  background: linear-gradient(rgba(179, 45, 45, 0.1), rgba(179, 45, 45, 0.1)), var(--det-paper);
}
.det .det-stamp:hover:not(:disabled) { transform: translate(2px, -2px); box-shadow: -6px 6px 0 rgba(0, 0, 0, 0.55); }
.det .det-stamp:active:not(:disabled) { transform: translate(-2px, 2px); box-shadow: -2px 2px 0 rgba(0, 0, 0, 0.55); }
.det .det-stamp:disabled { cursor: default; opacity: 0.55; }
.det .det-stamp.is-dimmed { opacity: 0.25; }
.det .det-stamp.is-picked {
  opacity: 1;
  z-index: 2;
  transform: rotate(-11deg);
  animation: det-stamp-slam-kf 0.5s cubic-bezier(0.2, 1.6, 0.35, 1) both;
}
@keyframes det-stamp-slam-kf {
  0%   { transform: scale(2.6) rotate(-11deg); opacity: 0; }
  55%  { transform: scale(0.92) rotate(-11deg); opacity: 1; }
  78%  { transform: scale(1.05) rotate(-11deg); opacity: 1; }
  100% { transform: scale(1) rotate(-11deg); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .det .det-stamp.is-picked { animation: none; }
}
`

// Two stamps. Nothing else on the screen during a question — the question text is on the
// projector, and duplicating it here is what pushed v2's last option below the fold.
//
// `locked` is NOT `!!picked`. `picked` comes from `picks`, which is ephemeral state — "NOT
// persisted" by design (see the comment on its useState above). A reload mid-question loses
// `picked` but must not re-open the stamps: `POST /api/answer` maps a second submit for the
// same question to `'duplicate'`, which the route answers with 200 `{ok:true}`, not a rejection
// — so an unlocked second tap would silently overwrite the phone's displayed verdict with one
// the server never recorded. `state.youAnswered` is the server's memory of that; it survives a
// reload even though `picked` does not.
function StampPanel({ onPick, picked, locked }: { onPick: (v: Verdict) => void; picked?: Verdict; locked: boolean }) {
  /* `disabled` already stops a real tap; this is the second half of the same statement, so that
     the lock survives anything that reaches the handler without going through the pointer — and so
     that during `rules` and `reading`, when both stamps are locked for everyone, there is no path
     from this component to a POST at all. */
  const pick = (v: Verdict) => { if (locked) return; onPick(v) }
  const cls = (v: Verdict) =>
    `det-stamp det-stamp-${v}`
    + (picked === v ? ' is-picked' : '')
    + (picked && picked !== v ? ' is-dimmed' : '')
  return (
    /* `gap-7`, up from v3.1's `gap-5`: a stamp at -11deg reaches about 33px past its own box at
       each end, and the extra room keeps it landing ON the dimmed one rather than through it. */
    <div className="mt-auto flex flex-col gap-7">
      <style>{STAMP_CSS}</style>
      <button type="button" disabled={locked} onClick={() => pick('pass')} className={cls('pass')}>
        ✓ ผ่าน
      </button>
      <button type="button" disabled={locked} onClick={() => pick('reject')} className={cls('reject')}>
        ✕ ตีกลับ
      </button>
    </div>
  )
}

// A spectator (joined mid-session) sees this instead of the two buttons — there is nothing for
// them to tap. `you.spectator` / `you.rank === 0` is the server's "not playing" sentinel — see
// lib/types.ts's PublicGameState.you.
function SpectatingPanel() {
  return <p className="m-auto text-center text-lg" style={{ color: 'var(--det-gold)', fontFamily: THAI }}>{t('spectating', 'th')}</p>
}

/*
 * THE REVEAL. Three beats, in this order of prominence (spec §7):
 *
 *  1. The mark and the points. What just happened.
 *  2. THE RANK AND THE GAP. `อันดับ 4` on its own is a fact; `ห่างอันดับ 3 อยู่ 85 แต้ม` is a
 *     reason to still be holding the phone at question seven — it says the next question can
 *     change it, which a bare total never can. This is Kahoot's move and it is the whole reason
 *     `gapToNext` exists on the wire.
 *  3. What the room did — NOT SHIPPED, and deliberately not faked. See the note at the end.
 *
 * RANK 1 GETS A DIFFERENT LINE, and this is the one place absence is load-bearing. `gapToNext` is
 * ABSENT for the leader, never `0` (lib/types.ts spells out why: ranks are positional, so two
 * players on the same score sit at n and n+1 and the lower one's real gap IS `0` — if the leader
 * were sent `0` too the phone could not tell "you lead" from "you are level with the person above
 * you", which are opposite messages). So the leader is detected by `rank === 1`, never by the gap
 * being falsy, and never renders a "0 แต้ม" line.
 *
 * Spec §5b's older half still holds: ถูก/ผิด and the points come from the SERVER's
 * `you.lastCorrect`/`you.lastPoints`, computed in lib/store.ts#getPublicState from the player's
 * actual recorded answer, not from this component's `picks`. `picks` is ephemeral (explicitly
 * "NOT persisted", see its useState comment above) — a reload mid-reveal used to lose it and fall
 * through to "หมดเวลา!" even for a player who answered and was simply wrong. `?? null`, never
 * `||`: `lastCorrect: false` (a real wrong answer) must not collapse into the same branch as
 * "never answered" (`lastCorrect` absent).
 *
 * MISSING, AND KNOWN: "ห้องนี้ 68% ตอบพลาดข้อนี้". There is no phone-side source for it. It needs
 * the room's split for this question AND the question's correct verdict; `/api/stats` publishes
 * the split but not the verdict, and the verdict lives in `content/questions`, which this page
 * must never import (see HoldingPanel's note — it would ship the answer key to every player).
 * Inferring the verdict from the player's own tap plus `lastCorrect` reconstructs the same secret
 * on the client and is only correct while `picks` survives, which is exactly the reload this
 * component was rewritten to fix. It wants one derived, reveal-gated number on `you` beside
 * `lastCorrect`/`lastPoints` — server-side, where the verdict already is.
 */
function RevealPanel({ you, playerCount }: { you?: PublicGameState['you']; playerCount: number }) {
  if (you?.spectator) return <SpectatingPanel />
  const correct = you?.lastCorrect ?? null
  const rank = you?.rank ?? 0
  const gap = you?.gapToNext
  const roomWrongPct = you?.roomWrongPct
  return (
    <div className="m-auto flex flex-col items-center gap-3 text-center" style={{ fontFamily: THAI }}>
      <p
        className="text-3xl font-bold"
        style={{ color: correct === null ? 'var(--det-gold)' : correct ? 'var(--det-cyan)' : 'var(--det-pink)' }}
      >
        {correct === null ? t('timesUp', 'th') : correct ? t('youWereRight', 'th') : t('youWereFooled', 'th')}
      </p>
      {correct !== null && (
        <p className="text-xl font-bold" style={{ color: 'var(--det-gold)' }}>+{you?.lastPoints ?? 0} คะแนน</p>
      )}
      {rank > 0 && (
        /* Ruled off from the result above: this is a different subject — not this question, but
           where the player now stands in the room. */
        <div
          className="mt-1 flex flex-col items-center gap-1 px-6 pt-4"
          style={{ borderTop: '2px solid var(--det-border)' }}
        >
          <p className="text-2xl font-bold" style={{ color: 'var(--det-cyan)' }}>
            อันดับ {rank} <span className="text-base font-normal opacity-70">จาก {playerCount}</span>
          </p>
          {rank === 1
            ? <p className="text-lg" style={{ color: 'var(--det-gold)' }}>คุณนำห้องอยู่ตอนนี้</p>
            : gap !== undefined && (
              <p className="text-lg" style={{ color: 'var(--det-gold)' }}>
                ห่างอันดับ {rank - 1} อยู่ {gap} แต้ม
              </p>
            )}
          {/* What the room did, under what the player did. This is the workshop's whole argument
              in one line: knowing you were not the only one fooled is what lets a person accept
              it, instead of quietly deciding they are bad at this and disengaging for the rest of
              the session. Rendered only when the server sent it — absent means nobody answered,
              which is not the same as 0% and must not read as it. */}
          {roomWrongPct !== undefined && (
            <p className="mt-1 text-base opacity-80" style={{ color: 'var(--det-text)' }}>
              ห้องนี้ {roomWrongPct}% ตอบพลาดข้อนี้
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Deliberately nothing to read here, and no buttons. The act card — the story, the lesson, the
// "at work" line — is on the projector (app/tv/page.tsx), read by the whole room together; this
// is the beat where the phone must go dark so the room looks UP instead of down at it.
function LookUpPanel() {
  return (
    <div className="m-auto flex flex-col items-center gap-3 text-center">
      <div className="text-6xl">👀</div>
      {/* `.det-thai`, NOT `.pixel-title`. That class sets Press Start 2P, which carries no Thai
          glyphs at all — this line fell through to the generic monospace and lost its vowel
          marks. Same fix in MyTallyPanel and MyResultPanel below. */}
      <p className="det-thai text-2xl" style={{ color: 'var(--det-gold)' }}>ดูจอใหญ่</p>
    </div>
  )
}

function MyTallyPanel({ wrongPass }: { wrongPass: number }) {
  return (
    <div className="m-auto flex flex-col items-center gap-2 text-center" style={{ fontFamily: THAI }}>
      <div className="text-5xl">📊</div>
      <p className="det-thai text-xl" style={{ color: 'var(--det-gold)' }}>ดูสรุปผลบนจอใหญ่</p>
      {/* Deliberately gated on wrongPass > 0, unlike MyResultPanel's own wrongPass line below: this
          screen's whole point is the ROOM's number, delivered by the host over the projector — a
          personal "0 ครั้ง" here is noise ahead of that moment, not a result worth a line. The
          podium is the actual final tally per player, where a 0 is a real result worth showing. */}
      {wrongPass > 0 && <p style={{ color: 'var(--det-cyan)' }}>เชื่อ AI ผิดไป {wrongPass} ครั้ง</p>}
    </div>
  )
}

/*
 * THE LAST SCREEN A PLAYER SEES, and it has NO REPLAY BUTTON — that is the point of it, not a
 * tidy-up (spec §7).
 *
 * "🔄 เล่นอีกครั้ง" called `returnToCodename`, which clears the identity and drops the phone back
 * on the join screen. Pressed DURING the event — and it sat under the player's thumb at exactly
 * the moment the host was talking, which is when it would be pressed — that phone rejoins as a
 * BRAND NEW PLAYER on zero, while `playerCount` and the closing tally go on counting them. The
 * tally is the number the entire workshop walks toward ("this room passed N pieces of wrong
 * information"), and one bored player could move it. There is no rejoin the room can afford here;
 * the host's reset is the only way back to a join screen, and it clears everyone at once.
 *
 * So the screen ends on the player's OWN lesson instead, and then points at the projector where
 * the room's number is. `wrongPass` is not a score — it is the count of times this person waved
 * something through that was wrong, which is the one number from this game that means anything on
 * a Tuesday at work.
 */
function MyResultPanel({ you }: { you?: PublicGameState['you'] }) {
  // rank is 0 for anyone off the leaderboard (spectator, or unranked) — the server's sentinel.
  // Never render "#0" / "อันดับ 0"; a spectator gets the spectating state instead of a rank.
  const onBoard = !!you && !you.spectator && you.rank > 0
  const wrong = you?.wrongPass ?? 0
  return (
    <div className="m-auto flex flex-col items-center gap-4 px-2 text-center" style={{ fontFamily: THAI }}>
      <p className="det-thai text-2xl" style={{ color: 'var(--det-gold)' }}>{t('finalTitle', 'th')}</p>
      {onBoard ? (
        <>
          <p className="det-term text-6xl leading-none" style={{ color: 'var(--det-cyan)' }}>#{you.rank}</p>
          <p className="text-lg">{you.score} คะแนน</p>
          {/* The lesson, ruled off from the score above it — the score is the game, this is the
              part that leaves the room. NOT gated on `wrongPass > 0`, unlike MyTallyPanel: a
              clean game is a real result and deserves saying out loud. */}
          <div className="flex flex-col gap-2 pt-4" style={{ borderTop: '2px solid var(--det-border)' }}>
            <p className="text-xl font-bold" style={{ color: 'var(--det-gold)' }}>
              {wrong > 0
                ? <>คุณกด &quot;ผ่าน&quot; ให้ข้อมูลผิด {wrong} ครั้ง</>
                : <>คุณไม่เคยกด &quot;ผ่าน&quot; ให้ข้อมูลผิดเลย</>}
            </p>
            <p className="text-[17px] leading-relaxed opacity-85">
              {wrong > 0
                ? <>ถ้าเป็นงานจริง คือข้อมูลผิด {wrong} ครั้งที่หลุดออกไปโดยไม่มีใครทัน</>
                : <>ถ้าเป็นงานจริง คือไม่มีข้อมูลผิดหลุดผ่านคุณออกไปเลย</>}
            </p>
          </div>
        </>
      ) : (
        <p style={{ color: 'var(--det-gold)' }}>{t('spectating', 'th')}</p>
      )}
      <p className="text-lg" style={{ color: 'var(--det-cyan)' }}>👀 ดูสรุปของทั้งห้องบนจอใหญ่</p>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    /*
     * `relative z-10`, like every other direct child of <main>, and it is load-bearing rather than
     * tidy: this is the WAITING screen, which is a `lobby` phase, which is a phase the room is
     * painted behind. A static sibling of an `absolute inset-0` canvas loses to it in paint order
     * no matter which comes first in the source — positioned descendants paint after
     * non-positioned block-level ones — so without this the opaque wall lands on top of the one
     * line a player reads for the whole minute before the host presses Start.
     *
     * `min-h-dvh` rather than `100vh`, for the reason PhoneBody's column gives.
     */
    <div className="relative z-10 flex min-h-dvh items-center justify-center p-6 text-center" style={{ fontFamily: THAI }}>
      <p className="text-lg" style={{ color: 'var(--det-gold)' }}>{children}</p>
    </div>
  )
}

'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/* `useLayoutEffect` warns when it runs on the server, and this page server-renders. The board's
 * measure-then-place pass MUST happen before paint (see `NameBoard`), so the hook itself cannot be
 * downgraded — it is selected per environment instead. On the server the effect body would
 * early-return on a null ref anyway. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
import type { PublicGameState, Question } from '@/lib/types'
import { NEXT_GUARD_MS, QUESTIONS_IN_ORDER, QUESTION_COUNT, QUESTION_MS, READING_MS } from '@/lib/game'
import { scoreAnswer } from '@/lib/scoring'
import { CLOSING_LINES } from '@/content/questions'
import { QRCodeSVG } from 'qrcode.react'
import { Duck } from '@/components/game/Duck'
import { Dossier } from '@/components/game/Dossier'
import { TimerBar } from '@/components/game/TimerBar'
import { SplitBar } from '@/components/game/SplitBar'
import { Standings, type LeaderboardRow, type RankDeltas } from '@/components/game/Standings'
import { Tally } from '@/components/game/Tally'
import { Podium } from '@/components/game/Podium'
import { ResetButton } from '@/components/host/ResetButton'
import { Patrol } from '@/components/game/Patrol'
import { t } from '@/lib/i18n'

// Locally declared to match /api/stats's payload shape (Task 6) — @/lib/stats is deleted.
type RoomStats = {
  leaderboard: LeaderboardRow[]
  /** The lobby's name cards: the most recent arrivals in JOIN order, already capped server-side.
   *  Deliberately not `leaderboard` — see the comment on the field in app/api/stats/route.ts. */
  recent: { codename: string; avatar: string }[]
  split: { pass: number; reject: number } | null
  roomWrongPass: number
  roomAccuracy: { correct: number; wrong: number }
  playerCount: number
}

/**
 * How many of the nine cases the duck could NOT have answered "รู้ได้ยังไง" for — the ones whose
 * correct action is ตีกลับ. The closing screen states this out loud to a hundred people, so it is
 * COUNTED from the content and never typed: `content/questions.ts` carries a live decision to add a
 * third true case, and the day it lands this number changes by itself instead of quietly becoming
 * a lie on the projector. Safe to derive here and not on the phone — /tv is the host's screen and
 * already holds the whole answer key (see `PHONE_CASE_COUNT` for the side that must not).
 */
const UNBACKED_COUNT = QUESTIONS_IN_ORDER.filter((q) => q.verdict === 'reject').length

const HOST_TOKEN_KEY = 'aidet.hostToken'
const STATE_POLL_MS = 1000
const STATS_POLL_MS = 1500

/**
 * THE TYPE SCALE (spec §1), and the reason this batch exists.
 *
 * Every size on this screen used to be written `clamp(<px>, <n>vh, <px>)`, and all eighteen tiers
 * hit their pixel CEILING between 944px and 1067px of screen height. A 1080p monitor is already
 * past every one of them, so the design got *relatively smaller as the monitor got bigger* — on a
 * 4K panel the smallest text was 1/120 of the screen against an 8H minimum of 1/50.
 *
 * The fix is in the UNIT, not in the numbers: `2vh` **is** 1/50 of the screen height at every
 * resolution, so once a size is expressed in plain `vh` the 8H rule holds by construction and
 * never has to be re-checked against a new monitor. Raising the ceilings was considered and
 * rejected — whatever ceiling is chosen, a larger display exists.
 *
 * THE FLOOR IS 3.1vh, not the 8H minimum of 2vh: the AV sources are explicit that 1/50 is a bare
 * minimum "not for guaranteed easy reading", and it degrades with room brightness, projector
 * sharpness and viewer age, all unknown in an expo hall with walk-up seating. Lobby name cards at
 * 3.0vh are the ONE sanctioned exception (§1) — short proper nouns, not running text, and the size
 * is what buys the board its capacity.
 *
 * A label that cannot justify its size is DELETED, not shrunk — but the defect was always the
 * UNIT and not the label. `คำถาม / สถานการณ์:` and `เจ้าเป็ด AI ตอบว่า:` both measured a flat
 * 14.6px, which is 1/74 of a 1080p screen and 1/148 of a 4K one, and both were cut. The
 * QUESTION'S label stayed cut: a sheet holding one sentence with a question mark on it does not
 * need to be told it is holding a question.
 *
 * THE DUCK'S CAME BACK, as `เป็ด AI ตอบว่า` at 2.9vh — see `CaseBoard`, which is where the reason
 * lives. 2.9 is knowingly a shade under the floor, and it is the second sanctioned exception after
 * the lobby's name cards, for the same kind of reason they are: two words of attribution over the
 * sentence they attribute is not running text, and at the floor the label starts competing with
 * the answer it is labelling. What was actually wrong at 14.6px is fixed either way — 2.9vh is a
 * fraction of the SCREEN, so it grows with the projector instead of shrinking against it.
 *
 * `components/game/type-scale.test.ts` is the source-level guard that no px-ceilinged tier — and
 * no fixed-pixel Tailwind text class — comes back.
 */
const TYPE = {
  /**
   * The question the room is judging, and the largest type on the paper.
   *
   * IT WENT 5.7 -> 4.8 AND BACK, and the round trip is worth a sentence because the reasoning that
   * dropped it was sound and still wrong. The case sheet gained three things — the
   * `เป็ด AI ตอบว่า` label, the answer in a thought bubble, and a 23vh duck in the corner — the
   * sheet's height is fixed by the room behind it, so something had to yield, and the question
   * looked like the line that could: the room reads it once, while the ANSWER is the line it
   * re-reads hunting for the lie.
   *
   * What that misses is WHERE the reading happens. Both lines are read from the back of a hall, at
   * whatever distance the venue's seating puts a person at, and the question is the one that has
   * to land BEFORE the eight-second clock starts. Buying layout room by shrinking it spends the
   * only budget that cannot be topped up. The room the sheet actually needed came from the stamp's
   * column and from `pb-[16vh]` -> `pb-[10.7vh]`, neither of which costs anyone legibility.
   *
   * Two lines is the normal case at this size and that is fine — it is a case file, not a headline
   * — and `textWrap: 'balance'` below is what stops the second one being a single orphaned word.
   */
  question: '5.7vh',
  /** The duck's answer, on the paper. */
  answer: '4.6vh',
  /** Anything the host presses or reads to run the room. */
  control: '3.6vh',
  /** The floor. Nothing on `/tv` is smaller, lobby name cards excepted. */
  floor: '3.1vh',
  /*
   * The lobby's name cards — the one sanctioned exception to the 3.1vh floor, and still above the
   * 8H minimum of 2vh.
   *
   * IT CAME DOWN FROM 3.0 WHEN THE BOARD STOPPED TRUNCATING. A thirty-character name drawn at 3.0
   * was most of a shelf on its own, and a board of them seated barely half a full room. These are
   * proper nouns read at a glance by someone hunting for their own, not running text — the size
   * that matters is the one that fits the room on the board, and `npm run check:projector` seats a
   * hundred of them at this one.
   */
  card: '2.4vh',
} as const

/**
 * The phases the investigation room is painted behind (spec §6).
 *
 * `reveal`, `tally` and `podium` are deliberately absent: those three carry the content
 * the room exists to frame — a case file being read out, an act's lesson, the room's own numbers —
 * and a floor with someone walking on it competes with all of them. They keep `.det`'s flat wall
 * colour and nothing else.
 *
 * `lobby` LEFT THIS SET in v3.2. The lobby board is now shelf-packed to capacity with name cards
 * (§2), and a detective walking across the bottom of it either walks behind a hundred cards, where
 * he is not visible, or the bottom shelves have to be reserved for him, which costs the board a
 * sixth of its capacity for a figure nobody can see. `rules` is absent for the same kind of
 * reason: it is a modal over a scrim, and the scrim covers the room.
 */
const ROOM_PHASES: ReadonlySet<PublicGameState['phase']> = new Set(['reading', 'question'])

/* ── THE GROUND: a desk under a lamp ──────────────────────────────────────────────────────────
 *
 * The approved design's projector ground, and it is an acceptance criterion rather than dressing:
 * the room is meant to read as a corkboard wall above a desk, lit from a lamp hanging just off the
 * top edge of the screen.
 *
 * IT IS A CHILD ELEMENT, NEVER AN INLINE STYLE ON THE ELEMENT CARRYING `det`. An inline
 * `background` there beats `.det`'s whole premium palette on specificity alone, silently, and
 * `app/globals.det.test.ts` guards exactly that. It is also not in app/globals.css, which is out
 * of bounds for this pass — so it lives here, on its own absolutely-positioned layer.
 *
 * LAYER ORDER IS THE OPPOSITE OF READING ORDER in a CSS `background` shorthand: the FIRST layer
 * listed paints on TOP. The cork/desk gradient is opaque, so it has to be last or it would hide
 * the two layers tinting it; the tooth sits on the cork, and the lamp spill washes over both.
 * Written bottom-up it is: cork wall to 68%, a hard 0.4% cut into the desk, the corkboard tooth,
 * then the warm spill.
 *
 * The 94° on the tooth is deliberate — a straight 90° reads as a printing artefact rather than as
 * a material. The 68% → 68.4% cut is what makes this a ROOM instead of a gradient: an abrupt
 * horizon is a surface meeting another surface, a soft one is fog.
 */
const DESK_GROUND = [
  'radial-gradient(120% 62% at 50% -8%, rgba(255,225,160,.18), transparent 62%)',
  'repeating-linear-gradient(94deg, rgba(0,0,0,.05) 0 3px, transparent 3px 7px)',
  'linear-gradient(180deg, #8a6236 0%, #6b4a28 68%, #2b1d10 68.4%, #241809 100%)',
].join(', ')

/* The flat phases — reveal, act card, tally, podium — carry the content the room exists to frame,
 * and a corkboard behind a case file competes with it. They keep `.det`'s own wall colour and just
 * the warm top spill, which is what makes them read as the SAME room rather than a different one:
 * the lamp is still overhead, the desk is simply out of shot. */
const FLAT_GROUND = 'radial-gradient(120% 62% at 50% -8%, rgba(255,225,160,.18), transparent 62%)'

/* The lamp's cone, as its own element above the ground and below the content — a background layer
 * could not be anchored to the top edge at 80% × 66% independently of the ground's own sizing. */
const LAMP_CONE =
  'conic-gradient(from 180deg at 50% 0%, transparent 158deg, rgba(255,231,178,.15) 172deg, ' +
  'rgba(255,231,178,.24) 180deg, rgba(255,231,178,.15) 188deg, transparent 202deg)'

/** The phases that stand in the room proper and get the desk under them.
 *
 *  `podium` IS ONE OF THEM, which the flat-ground list used to miss. The approved artifact draws
 *  the podium on the cork wall over the desk with the lamp behind it — three pinned paper cards on
 *  a board, which is the same object the lobby is made of, so the end of the game reads as the
 *  same room as the start. On flat black the spotlight cone behind first place also had nothing to
 *  fall on and rendered as a grey rectangle with visible edges. */
/* EVERY phase. The reveal, the act card and the standings used to sit on flat black while the
   lobby, the rules screen and the podium stood in the room — so the game changed worlds twice per
   question. One ground throughout is what the team asked for, and it is the rules screen's ground
   they picked. Row and panel fills had to stop being translucent white to survive it. */
const DESK_PHASES: ReadonlySet<PublicGameState['phase']> = new Set(
  ['lobby', 'rules', 'reading', 'question', 'reveal', 'tally', 'podium'],
)

/**
 * NO `crt` CLASS ANYWHERE. `.crt::after` is still in app/globals.css as dead code, and this repo
 * once stacked it on top of `.det::after` — two scanline overlays over each other. `.det` on the
 * page root already paints the CRT at `z-index: 99`, over everything including this ground, which
 * is the one place it belongs.
 */
function StageGround({ desk }: { desk: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{ background: desk ? DESK_GROUND : FLAT_GROUND }}
      />
      {desk ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-[66%] w-[80%] -translate-x-1/2"
          style={{ background: LAMP_CONE }}
        />
      ) : null}
    </>
  )
}

/**
 * A login screen, not a security boundary — and the distinction matters enough to write down.
 * Every control route validates `x-facilitator-token` server-side on every call, and an unset
 * FACILITATOR_TOKEN still means 403. This screen exists so the host stops typing a shared secret
 * in front of a hundred people, and so the lobby's top-right corner can be empty.
 */
function TokenGate({ value, onChange, onSubmit, error }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; error: boolean
}) {
  return (
    <div className="grid min-h-screen place-items-center">
      <form
        className="det-goldbox w-[min(52vw,72vh)] px-[4vh] py-[4vh] text-center"
        onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      >
        <div className="text-[9vh] leading-none">🔒</div>
        <h1 className="det-pixel mt-[2vh] text-[4.6vh] text-[var(--det-gold)]">EVIDENCE ROOM</h1>
        <p className="det-thai mt-[1.2vh] text-[4.6vh]">ห้องเก็บหลักฐาน</p>
        <p className="det-thai mt-[1.4vh] text-[3.1vh] font-normal opacity-70">
          ใส่รหัสผู้ดำเนินรายการเพื่อเปิดห้อง
        </p>
        <input
          type="password" value={value} onChange={(e) => onChange(e.target.value)}
          aria-label={t('hostTokenLabel', 'th')}
          // The brief's own reference (task-3-brief.md) named this class `det-num`, which does not
          // exist anywhere in app/globals.css or the plan's own class list (`.det-pixel`,
          // `.det-title`, `.det-thai`, `.det-term`, `.det-btn`, `.det-btn-gold`, `.det-frame`,
          // `.det-goldbox`, `.det-paper`) — the plan's own context names `.det-term` as "VT323, for
          // the token field," which is exactly this input. Using the class as literally typed would
          // apply no styling at all; `det-term` is the one that was actually meant.
          className="det-term mt-[3vh] w-2/3 rounded border-2 border-[var(--det-cyan)] bg-[#05060f]
                     px-[2vh] py-[1.4vh] text-center text-[3.6vh] tracking-[.2em]
                     text-[var(--det-cyan)] outline-none"
        />
        <div>
          {/* `det-btn-thai`: this label is Thai and `.det-btn`'s own face has no Thai glyphs.
              Its size comes from the `--det-btn-size` set on the page root. (Spelled out rather
              than written as the tag: app/globals.det.test.ts finds that element by the FIRST
              `<main` in this file, and a mention in a comment above it would be the one it found.) */}
          <button type="submit" className="det-btn det-btn-thai mt-[3vh]">
            เปิดห้อง
          </button>
        </div>
        {error && <p className="det-thai mt-[1.6vh] text-[3.1vh] text-[var(--det-pink)]">รหัสไม่ถูกต้อง</p>}
      </form>
    </div>
  )
}

export default function TvPage() {
  const [state, setState] = useState<PublicGameState | null>(null)
  const [stats, setStats] = useState<RoomStats | null>(null)
  // `null` = "not yet read from storage" (hydration hasn't resolved: we don't know whether a
  // token is held), `''` = "read, and none is held" (show the gate), anything else = "held" (show
  // the app). Collapsing `null` into `''` would mean a refresh mid-`question`/`reveal` paints the
  // full-screen gate across the projector for one commit before the mount effect below resolves
  // it — a stray reload costing the room the screen, which is exactly what this state split
  // exists to prevent. Initialised to `null`, never read from `localStorage` in a lazy `useState`
  // initialiser, because this page still server-renders and `localStorage` doesn't exist there —
  // that would be a hydration mismatch, not just a flash. The effect just below is the only place
  // that ever resolves it.
  const [token, setToken] = useState<string | null>(null)
  const [tokenError, setTokenError] = useState(false)
  // The gate's own draft input — NOT a second source of truth for the token itself. It only ever
  // becomes `token` (via `saveToken`, below) once the server has actually accepted it; until then
  // it's scratch state for a controlled <input>, same as any other form field.
  const [gateValue, setGateValue] = useState('')
  const [origin, setOrigin] = useState('')
  const [nextPending, setNextPending] = useState(false)
  const lastSeqRef = useRef(-1)
  const nextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (!alive) return
        // Strict `>`, not `>=`: a poll that repaints the SAME seq is not evidence the projector
        // caught up with a phase change, and clearing the guard on every no-op poll would defeat
        // it entirely (see onNext's comment). Only a genuine advance — including one driven by
        // the server's own timers, not just this tab's last Next press — clears it, which is
        // exactly the signal NEXT_GUARD_MS's fixed delay could only approximate.
        if (next.seq > lastSeqRef.current) {
          setNextPending(false)
          if (nextTimerRef.current) { clearTimeout(nextTimerRef.current); nextTimerRef.current = null }
        }
        if (next.seq >= lastSeqRef.current) { lastSeqRef.current = next.seq; setState(next) }
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

  useEffect(() => () => { if (nextTimerRef.current) clearTimeout(nextTimerRef.current) }, [])

  const control = useCallback(async (action: 'start' | 'next' | 'hold' | 'ping') => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        // `control` only ever fires from HostControls, which only renders once `token` is a
        // held (non-null, non-empty) string — the `?? ''` is here purely so `string | null`
        // type-checks; it is never actually reached with `null` in practice.
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token ?? '' },
        body: JSON.stringify({ action }),
      })
      setTokenError(res.status === 403)
      return res.ok
    } catch {
      setTokenError(true)
      return false
    }
  }, [token])

  const saveToken = (v: string) => { setToken(v); try { localStorage.setItem(HOST_TOKEN_KEY, v) } catch { /* ignore */ } }

  /**
   * The gate's validation path. It cannot reuse `control` below — `control` reads the CURRENT
   * `token` state via closure, which is still empty the moment the gate is submitted (that's the
   * whole reason we're here), and calling `saveToken` first wouldn't help within the same tick:
   * `control` was created on an earlier render and won't see a state update until React re-renders
   * it. So this takes the candidate value directly and is now the ONLY caller of `saveToken` at
   * all — `HostControls` used to carry a second, always-visible token field, which spec §3 is
   * explicitly against ("the host stops typing a shared secret in front of a hundred people"), so
   * it is gone and `token` has exactly one path in.
   *
   * Sends `ping`, not `hold`: `hold` was the original choice because it's a no-op outside a
   * reveal — but that's ONLY a no-op outside a reveal. A host authenticating fresh mid-reveal
   * (cleared storage, a second laptop, a dropped key) would silently toggle Hold on and freeze
   * the room's clock as a side effect of logging in, invisibly, since HostControls hasn't
   * rendered yet to show it. `ping` (app/api/control/route.ts) checks the token and does
   * nothing else, in every phase — a wrong token still 403s, a right one 200s, with no risk to
   * whatever the room is doing right now.
   */
  const validateToken = async (candidate: string) => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': candidate },
        body: JSON.stringify({ action: 'ping' }),
      })
      if (res.ok) { setTokenError(false); saveToken(candidate) } else { setTokenError(true) }
    } catch {
      setTokenError(true)
    }
  }

  /*
   * WHICH BEAT OF THE REVEAL THE ROOM IS ON, and it is advanced by the HOST, not by a clock. Every
   * reveal but the LAST one has two beats — see `revealHasStandings` below for why case ten has
   * only the verdict.
   *
   * It was a 5.5s timer inside a 12s reveal, and that lost the standings outright: a host reading
   * a fast room presses ถัดไป at four seconds, the phase advances to the next case, and the
   * scoreboard for that case is never shown — silently, with nothing on screen to say so. The
   * user's report was "the scoreboard is gone".
   *
   * So the FIRST ถัดไป on a reveal flips this and posts nothing (see `onNext`), and the second
   * one advances the room. A press cannot skip the standings because the press IS what shows them.
   *
   * NO FALLBACK TIMER. There used to be one, because the SERVER auto-advanced a reveal after
   * REVEAL_MS whether or not anyone pressed anything — so a host who simply talked through the
   * reveal lost the standings anyway. The reveal is untimed now (lib/game.ts): it leaves only on a
   * press, so the press is the only thing that can move the beat, and a clock that could take the
   * screen away mid-sentence is gone from both sides.
   */
  const [revealBeat, setRevealBeat] = useState<'verdict' | 'standings'>('verdict')
  const revealPhase = state?.phase === 'reveal'
  const revealQuestionId = state?.questionId ?? null
  /*
   * THE LAST CASE HAS NO STANDINGS BEAT. Every other reveal earns one — the room needs to see the
   * board move before the next case. After the final case it is two screens from the podium
   * (tally, then the winners), and a leaderboard shown here is the same board the room is about to
   * be shown properly, one press later. It steals the ending's surprise and costs the host a press.
   *
   * Read off the last authored question, not off QUESTION_COUNT: the count and the order come from
   * the same array, but an id compare cannot drift if a case is ever added or pulled.
   */
  const lastQuestionId = QUESTIONS_IN_ORDER.at(-1)?.id ?? null
  const revealHasStandings = revealPhase && revealQuestionId !== lastQuestionId

  useEffect(() => {
    if (!revealPhase) setRevealBeat('verdict')
  }, [revealPhase, revealQuestionId])

  /*
   * THE DOUBLE-TAP HAZARD. Two quick presses during a reveal could advance to question N+1 AND
   * immediately past it into ITS reveal — the room never gets that question's answer window, and
   * nothing on screen says so until the leaderboard looks wrong later. Projectors lag; hosts tap
   * twice.
   *
   * THE SERVER IS THE GUARANTEE, not this component. `MemoryRoomStore#next` (lib/store.ts) ignores
   * a `next` that arrives within `NEXT_GUARD_MS` of the previous successful advance and is a true
   * no-op when it does. That guard is what actually holds on the day, because this component's
   * state is per-tab: a page refresh, a second `/tv` tab open on the laptop screen AND the
   * projector (a real configuration), or a slow POST all defeat client-side disabling on their own.
   *
   * What follows is AFFORDANCE, layered on top so the one-host-one-tab common case never has to
   * find out the server said no: `nextPending` disables the button (and swaps its label) the
   * instant the click fires, before the request even resolves — so a second physical tap while the
   * POST is still in flight does nothing locally either. Once a successful response comes back, the
   * button stays disabled for up to NEXT_GUARD_MS more, OR until the state poll observes the seq
   * actually change — whichever comes first (see the `pollState` effect above) — so a laggy
   * projector still gets visual feedback without the fixed delay outlasting a poll that already
   * confirmed the advance. A failed request re-enables immediately, so a genuine network blip does
   * not strand the host on a dead button.
   */
  const onNext = useCallback(async () => {
    if (nextPending) return
    /*
     * The reveal's own second beat, taken locally and WITHOUT advancing the room: it has seen the
     * verdict and now gets the standings. The next press advances the case.
     *
     * IT STILL PINGS. `ping` (app/api/control/route.ts) checks the token and does nothing else, in
     * every phase — so a host whose token has gone stale finds out on the FIRST press rather than
     * discovering it one press later when the room is waiting. Without it this press was the one
     * host action that could silently do nothing at all: `scripts/check-projector-fit.mjs` probes
     * exactly that, on a reveal, and caught it.
     */
    if (revealHasStandings && revealBeat === 'verdict') {
      setRevealBeat('standings')
      /*
       * IT TAKES THE SAME GUARD A REAL ADVANCE TAKES, and that is not tidiness. Returning here
       * without arming `nextPending` left the button live with no guard window open — and the
       * server's own `NEXT_GUARD_MS` cannot cover it either, because this press posts `ping`, not
       * `next`. A host who taps twice in 200ms (this file's own note: "Projectors lag; hosts tap
       * twice") would flip to the standings and immediately advance past them, which is the exact
       * symptom this whole change exists to remove.
       */
      setNextPending(true)
      nextTimerRef.current = setTimeout(() => setNextPending(false), NEXT_GUARD_MS)
      void control('ping')
      return
    }
    setNextPending(true)
    const ok = await control('next')
    if (ok) {
      nextTimerRef.current = setTimeout(() => setNextPending(false), NEXT_GUARD_MS)
    } else {
      setNextPending(false)
    }
  }, [nextPending, control, revealHasStandings, revealBeat])

  const question = state?.questionId ? QUESTIONS_IN_ORDER.find((q) => q.id === state.questionId) ?? null : null

  /*
   * THE RANK ARROWS ARE COMPUTED HERE, ON THE PROJECTOR (spec §5).
   *
   * The server keeps nothing extra: this diffs the board it is already polling against the board
   * it saw at the PREVIOUS reveal, held in a ref. The snapshot is keyed on the question, so the
   * 1.5s stats poll cannot re-diff the same reveal against itself and wipe every arrow one and a
   * half seconds after it appeared.
   *
   * A mid-game refresh of `/tv` costs that round's arrows and nothing else — the ref starts empty,
   * every row reads as "new", and the next reveal is diffed normally. That is an acceptable price
   * for a presentational cue and is the reason this is not worth storing server-side.
   *
   * The ref lives at page level, not inside `Standings`: that component unmounts between reveals,
   * and a ref inside it would be empty every single time.
   */
  const [rankDeltas, setRankDeltas] = useState<RankDeltas>({})
  /* The `+150` beside a total comes from the SERVER now (`LeaderboardEntry.gained`), not from a
     diff. Diffing is right for the arrows and wrong for this: with ten places and a hundred
     players, someone climbing into the top ten from below has no previous row to subtract, so
     their whole running total was rendered as this question's gain. */
  const gainsFromBoard: RankDeltas = {}
  for (const row of stats?.leaderboard ?? []) {
    if (row.gained !== undefined && row.gained > 0) gainsFromBoard[row.codename] = row.gained
  }
  const prevRanksRef = useRef<Record<string, number> | null>(null)
  const snapshotKeyRef = useRef<string | null>(null)
  const board = stats?.leaderboard
  useEffect(() => {
    if (!state || state.phase !== 'reveal') return
    if (!board || board.length === 0) return
    const key = state.questionId ?? ''
    if (snapshotKeyRef.current === key) return
    snapshotKeyRef.current = key

    const previous = prevRanksRef.current
    const current: Record<string, number> = {}
    for (const row of board) { current[row.codename] = row.rank }
    const deltas: RankDeltas = {}
    if (previous) {
      for (const row of board) {
        const was = previous[row.codename]
        // `undefined` stays undefined — a player who has just appeared on the board did not climb.
        if (was !== undefined) deltas[row.codename] = was - row.rank
      }
    }
    prevRanksRef.current = current
    setRankDeltas(deltas)
  }, [state, board])

  /*
   * Vertical padding is capped by viewport HEIGHT, not left at a flat 2rem — a projector is wide
   * and short, and `min-h-screen overflow-hidden` below means a stage that grows past the screen
   * is CLIPPED, not scrolled. `npm run check:projector` is the real-browser gate on every phase;
   * jsdom cannot see this at all (see the comment atop app/tv/tv.test.tsx).
   *
   * `--det-btn-size` / `--det-btn-pad` are read by `.det-btn` in app/globals.css, which is where
   * the lobby's Start button and the gate's own button get their size. They are set HERE, on the
   * stage element, rather than in that stylesheet, because the phone shares `.det-btn` and wants
   * a thumb-sized default in px — the projector is the screen that has to scale with the room.
   */
  return (
    <main
      className="det relative min-h-screen overflow-hidden px-[3.4vh] py-[2.2vh]"
      style={{ '--det-btn-size': TYPE.control, '--det-btn-pad': '1.6vh 3.2vh' } as React.CSSProperties}
    >
      {/*
        * THE ROOM, behind everything (spec §6, v3.1 fidelity pass). `inset-0` is the padding box
        * of <main>, so this is genuinely full-bleed — wall above, floor across the bottom ~28%,
        * the detective walking it with the duck in tow. Everything else on the page carries
        * `relative z-10` and sits on top of it, which is the reference's own arrangement
        * (`.canvas-wrapper` at z-index 1, `.title-overlay-container` at 5).
        *
        * MOUNTED ONCE, HERE, rather than inside `StageFrame`: that frame is shared by the in-game
        * phases and most of them must NOT have it. One mount point, one predicate.
        *
        * Gated on `token` as well as on the phase, so the login gate keeps the flat wall it has
        * now, and on a NON-NULL state, so the first poll does not paint a room the lobby no
        * longer wants behind it (see ROOM_PHASES).
        */}
      {/* Before <Patrol> in DOM order on purpose: neither carries a z-index of its own, so source
          order is what stacks them, and the canvas paints its own opaque wall and floor over this
          on the two phases it runs. The gate keeps the flat wall it has now — it is not a screen
          of the game, and `tv.test.tsx` pins that nothing but the form renders there. */}
      {token ? <StageGround desk={!state || DESK_PHASES.has(state.phase)} /> : null}

      {token && state && ROOM_PHASES.has(state.phase) && (
        <Patrol className="pointer-events-none absolute inset-0 h-full w-full" />
      )}

      {token === null ? (
        // Hydration hasn't resolved yet — we do not know whether a token is held. Rendering
        // nothing here (not the gate, not the app) is what keeps a refresh mid-question/reveal
        // from flashing the full-screen EVIDENCE ROOM gate across the projector for one commit;
        // `.det`'s own background still paints, so this is a bare dark ground, not a blank white
        // flash. See the `token` state's own comment above for the full reasoning.
        null
      ) : token === '' ? (
        <TokenGate
          value={gateValue}
          onChange={setGateValue}
          onSubmit={() => void validateToken(gateValue)}
          error={tokenError}
        />
      ) : (
        <Stage
          state={state}
          stats={stats}
          origin={origin}
          question={question}
          rankDeltas={rankDeltas}
          gains={gainsFromBoard}
          revealBeat={revealBeat}
          tokenError={tokenError}
          hostToken={token}
          onReset={(ok) => { setTokenError(!ok); if (ok) lastSeqRef.current = -1 }}
          onStart={() => void control('start')}
          /*
           * ABSENT IN THE LOBBY, and from the first phase onward it lives in the HUD's right slot
           * and never moves again (spec §4). The lobby's only control is Start, in the middle of
           * the screen where the host cannot miss it; `Next`, `Hold` and reset have nothing to act
           * on until a game is running, and a corner panel of three dead buttons is three chances
           * to mis-tap during the one minute the room is looking at the QR code.
           *
           * `rules` DOES get them, and that is load-bearing rather than incidental: the rules
           * screen is host-advanced with no countdown (spec §3), so Next is the only way off it.
           */
          hostControls={state && state.phase !== 'lobby' ? (
            <HostControls
              token={token}
              tokenError={tokenError}
              phase={state.phase}
              nextPending={nextPending}
              onNext={() => void onNext()}
              onReset={(ok) => { setTokenError(!ok); if (ok) lastSeqRef.current = -1 }}
            />
          ) : null}
        />
      )}
    </main>
  )
}

/** Every host control on the projector, on one size (spec §1). `.pixel-btn`/`.host-reset` in
 *  app/globals.css pin these at 13px and 12px, and that file is out of bounds for this pass, so
 *  the size is declared inline where it outranks both. The FACE is set here too: those classes
 *  ask for Press Start 2P, which carries no Thai glyphs at all, and every label below is Thai —
 *  at 13px the broken vowel marks were merely illegible, at 3.6vh they would be conspicuous. */
const HOST_BTN: React.CSSProperties = {
  fontSize: TYPE.control,
  fontFamily: 'var(--font-thai), system-ui, sans-serif',
  fontWeight: 700,
  letterSpacing: 'normal',
  padding: '0.8vh 1.6vh',
  whiteSpace: 'nowrap',
}

function HostControls({
  token, tokenError, phase, nextPending, onNext, onReset,
}: {
  token: string
  tokenError: boolean
  phase: PublicGameState['phase']
  nextPending: boolean
  onNext: () => void
  onReset: (ok: boolean) => void
}) {
  const canNext = phase !== 'lobby' && phase !== 'podium' && !nextPending

  /*
   * NO TOKEN FIELD. v3 kept an always-visible text input holding the live facilitator token in
   * this corner for the whole game — on the projector, in front of the room. That is the exact
   * thing the login gate exists to stop (spec §3), and leaving it here would have made the gate
   * decorative. The token now has one path in, the gate; this panel reads it from page state and
   * hands it to ResetButton directly.
   *
   * NO ERROR LINE EITHER, since v3.1. It used to hang under these three buttons, which was
   * survivable while the panel floated over the stage on `absolute` — but this panel now sits in
   * the HUD as a flow item, and a second row appearing inside it would grow the band and shove
   * the whole stage down mid-reveal. The message moved to the HUD's own centre slot instead,
   * where it replaces the phase plate: one line in, one line out, no height change, and it lands
   * in the middle of the screen where a host who just mistyped is far more likely to see it.
   * `scripts/check-projector-fit.mjs` probes exactly this state, on `reveal`, for both reasons.
   */
  /*
   * NO PANEL AND NO RING. This cluster used to sit in a dark box outlined in `--rt-green` — a v2
   * token, on a screen themed entirely in `--det-*` — which made a healthy room look like it was
   * being warned about something and made the three controls read as a separate widget bolted into
   * the corner. The token error still has a home: `StageFrame` puts the message in the HUD's
   * centre slot, in the middle of the screen, where a host who just mistyped will actually see it.
   *
   * The three buttons are the SAME OBJECT as the lobby's Start and the phone's action button —
   * `.det-btn`, gold with dark ink for the one that moves the room forward, purple for the two
   * that do not. `--det-btn-pad` is tightened here because this is a corner cluster rather than a
   * splashy CTA; the size still comes from the page root, so it scales with the projector.
   */
  return (
    <div
      className="flex items-center gap-[1vh]"
      style={{ '--det-btn-pad': '0.8vh 1.6vh' } as React.CSSProperties}
    >
      <button type="button" className="det-btn det-btn-gold det-btn-thai" style={HOST_BTN} disabled={!canNext} onClick={onNext}>
        {nextPending ? '✓ ส่งแล้ว' : t('hostNext', 'th')}
      </button>
      {/* NO HOLD BUTTON. It froze the reveal's auto-advance, and the reveal is untimed now —
          every screen that is not reading or question waits for a press, so there is no clock
          left to pause. A control that cannot do anything is worse than an absent one: the host
          reaches for it under pressure and nothing happens. */}
      <ResetButton
        endpoint="/api/reset"
        token={token}
        label={t('hostReset', 'th')}
        armedLabel={t('hostResetArmed', 'th')}
        onDone={onReset}
        className="det-btn det-btn-thai det-btn-danger"
        style={HOST_BTN}
      />
    </div>
  )
}


/**
 * THE SCENE, and the reason this component exists.
 *
 * Every in-game phase is framed the same way: a HUD band across the top (clock left, phase plate
 * centred, the host's controls right, a 3px rule under all three), the stage itself in the
 * middle, and a status line along the bottom. That is the reference's composition, and it is what
 * turns a black field with text on it into a workspace someone is standing at.
 *
 * IT ALSO FIXES A MEASURED PROBLEM. `reveal` used to leave roughly 200px of dead black along the
 * bottom of a 1366x768 projector, which held the type smaller than it needed to be on the screen
 * the room reads longest. Pinning a status line to the bottom and letting the middle take the
 * slack (`flex-1`) puts that space back into the case file instead of leaving it black.
 *
 * HEIGHT BINDS, NOT WIDTH. `/tv`'s <main> is `min-h-screen overflow-hidden`, so a stage that
 * grows past the fold is CLIPPED, never scrolled — nothing here may be sized in `px` alone.
 * `npm run check:projector` measures the status line's own bottom edge against the fold, because
 * the document-height metric cannot see a clipped element at all.
 */
function StageFrame({
  plate, tokenError, hostControls, hudCentre, status, statusCentre, statusRight, foot, children,
}: {
  /** The HUD's left slot: `CASE 04 / 09`, in gold pixel type. Latin and numerals ONLY — Press
   *  Start 2P carries no Thai glyphs at all. This IS the plate now: the approved artifact's HUD
   *  is the case number on the left and the host's controls on the right, and nothing else. The
   *  centre slot it used to fill with a phase name (`INVESTIGATION`, `CASE CLOSED`) said the same
   *  thing twice from two feet apart and is now empty unless the token is wrong. */
  plate: string
  tokenError: boolean
  hostControls: React.ReactNode
  status?: React.ReactNode
  /** The bottom band's centre — `reading`'s ten dots. */
  /** Top-centre of the HUD. Yields to the bad-token message, which needs the same slot. */
  hudCentre?: React.ReactNode
  statusCentre?: React.ReactNode
  /** The bottom band's right — `question`'s answered counter. */
  statusRight?: React.ReactNode
  /** Pinned under the bottom band, full width: `question`'s cyan clock bar. */
  foot?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    /* `relative z-10`: the room canvas is painted behind <main> at `inset-0`, and the stage has to
       sit on top of it rather than under it. See the `<Patrol>` mount in TvPage.
     *
     * 95vh, not 90. The extra 5vh is spent pushing the status line BELOW the floor line the room
     * paints across the bottom of the screen on the two phases that still carry it. <main>'s own
     * `py-[min(2rem,2.2vh)]` leaves the status line clear of the fold on both projector shapes —
     * `npm run check:projector` measures exactly that edge. */
    <div className="relative z-10 flex min-h-[95vh] flex-col">
      <div className="det-hud">
        <div className="det-title truncate text-[3.1vh]">{plate}</div>
        {/* The bad-token message takes the centre slot the phase plate used to hold — one line in,
            one line out, no height change, and it lands in the middle of the screen where a host
            who just mistyped is far more likely to see it. `scripts/check-projector-fit.mjs`
            probes exactly this state, on `reveal`, and asserts the band's height is unchanged. */}
        {tokenError ? (
          <p className="det-thai truncate text-[3.1vh]" style={{ color: 'var(--det-pink)' }}>
            ❌ รหัสผู้ดำเนินรายการไม่ถูกต้อง
          </p>
        ) : (
          <div className="flex items-center justify-center">{hudCentre}</div>
        )}
        <div className="flex items-center gap-3">{hostControls}</div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      {/* THE BOTTOM BAND. `.det-status` is also the lowest element on the stage and therefore the
          first thing a stage that grew too tall loses — `scripts/check-projector-fit.mjs` measures
          this element's own bottom edge against the fold for exactly that reason, so it stays on
          every phase even when the artifact leaves it empty. */}
      <div className="det-status">
        <span className="det-thai text-[3.1vh] opacity-75">{status}</span>
        <span className="flex items-center">{statusCentre}</span>
        <span className="flex items-baseline gap-[1.4vh]">{statusRight}</span>
      </div>
      {foot}
    </div>
  )
}

/**
 * THE CLOCK BAR'S HEIGHT, HELD OPEN WHEN THERE IS NO CLOCK IN IT.
 *
 * `reading` and `question` are ONE SCENE HELD FOR TWO BEATS — same sheet, same question, same
 * answer, same duck — and the only intended differences are that the beat has no clock (answering
 * is impossible, so a running bar would be a lie) and no answered counter (nobody can have
 * answered, and a row of zeroes reads as a fault). Anything else that moves between them is a
 * fault, because the room is looking straight at it when the host presses ถัดไป.
 *
 * `foot: reading ? null : <TimerBar/>` moved the whole stage. `StageFrame` is a 95vh flex column
 * whose middle takes the slack, so removing the bar handed its 1.8vh to the case sheet for the
 * length of the beat and took it back the instant the question opened — the sheet grew, then
 * snapped up by 1.8vh at the exact moment attention was highest. Reserving the space instead
 * costs nothing and the sheet does not move at all.
 *
 * NOT `visibility: hidden` ON A LIVE `<TimerBar>`: that would leave a real countdown mounted and
 * tweening behind an invisible box during a beat where no clock is supposed to exist, and any
 * assertion asking "is there a timer on this phase" would find one. This is an empty box.
 *
 * 1.8vh IS COPIED FROM `components/game/TimerBar.tsx`, which declares its own height inline, and
 * the two have to stay in step: if the bar's height changes there and not here, the jump this
 * exists to remove comes back at the difference. It is not asserted in a test on purpose — the
 * owner has banned size assertions, and a test on this number would go red for a redesign rather
 * than for a defect.
 */
function FootSpacer() {
  return <div aria-hidden="true" className="w-full shrink-0" style={{ height: '1.8vh' }} />
}

/**
 * THE ANSWERED COUNTER'S HEIGHT, HELD OPEN THE SAME WAY — and this one was the LARGER half of the
 * jump, which is only visible from a measurement.
 *
 * `.det-status` (app/globals.css) has no height of its own: it is a flex row and its height is
 * whatever its tallest child needs. During `reading` that is the 3.1vh Thai line on the left;
 * during `question` the counter arrives on the right with a 4.6vh numeral in it and the whole band
 * grows. Measured on the render: the band went 46.7px → 64.0px at 1366x768 and 52.9px → 73.1px at
 * 1600x900, and because `StageFrame`'s middle takes the slack, every one of those pixels came out
 * of the case sheet. Reserving the clock bar's 1.8vh alone left 17.3px of the jump still there.
 *
 * ZERO-WIDTH SPACES, in the counter's own two faces at the counter's own two sizes. A line box
 * takes its height from the font metrics of the inline boxes on it, not from the glyphs, so an
 * empty box in Sarabun-3.1vh beside an empty box in VT323-4.6vh, baseline-aligned exactly as the
 * real counter is, reserves exactly the height the real counter will need — at any projector size,
 * with no number copied from anywhere and nothing to keep in step.
 *
 * NOT the real counter hidden: `tv.test.tsx` asserts that `ตอบแล้ว` is absent during the beat, and
 * it should stay absent. Nothing here claims to be a counter — there is no text to read, and it is
 * `aria-hidden` besides.
 */
function CounterSpacer() {
  return (
    <>
      <span aria-hidden="true" className="det-thai text-[3.1vh]">{'\u200B'}</span>
      <span aria-hidden="true" className="det-term text-[4.6vh]">{'\u200B'}</span>
    </>
  )
}

/** The HUD's plate: `CASE 04 / 09`. Latin and numerals ONLY — this is Press Start 2P and it
 *  carries no Thai glyphs at all. ONE text node, so it cannot collide with any bare-number
 *  assertion elsewhere on the same screen. */
const pad2 = (n: number) => String(n).padStart(2, '0')
const casePlate = (order: number) => `CASE ${pad2(order)} / ${pad2(QUESTION_COUNT)}`
const allCasesPlate = () => `CASES ${pad2(QUESTION_COUNT)} / ${pad2(QUESTION_COUNT)}`

function Stage({
  state, stats, origin, question, rankDeltas, gains, revealBeat, tokenError, hostControls, hostToken, onReset, onStart,
}: {
  state: PublicGameState | null
  stats: RoomStats | null
  origin: string
  question: Question | null
  rankDeltas: RankDeltas
  gains: RankDeltas
  /** Which beat of the reveal the host has advanced to. Owned by `TvPage`, because the control
   *  that changes it is up there. */
  revealBeat: 'verdict' | 'standings' 
  tokenError: boolean
  hostControls: React.ReactNode
  /** Non-empty by construction: `Stage` only renders once the gate has resolved a held token. */
  hostToken: string
  onReset: (ok: boolean) => void
  onStart: () => void
}) {
  if (!state || state.phase === 'lobby') {
    return (
      <Lobby
        joinUrl={origin}
        names={stats?.recent ?? []}
        playerCount={state?.playerCount ?? stats?.recent.length ?? 0}
        hostToken={hostToken}
        onReset={onReset}
        onStart={onStart}
      />
    )
  }

  const frame = (
    props: Omit<Parameters<typeof StageFrame>[0], 'tokenError' | 'hostControls'>,
  ) => (
    <StageFrame tokenError={tokenError} hostControls={hostControls} {...props} />
  )

  /* THE RULES, once, between the lobby and the first reading (spec §3). Inside the frame rather
     than floating over the stage as a bare modal, because the frame is where the host's Next
     button lives — and this screen has NO countdown, so Next is the only way off it. */
  if (state.phase === 'rules') {
    return frame({
      plate: 'BRIEFING',
      status: 'ก่อนเริ่มคดีแรก',
      children: <RulesStage />,
    })
  }

  if (state.phase === 'reading' || state.phase === 'question') {
    if (!question) return null
    const reading = state.phase === 'reading'
    return frame({
      plate: casePlate(question.order),
      status: reading ? (
        <span style={{ color: 'var(--det-gold)' }}>อ่านให้จบก่อน แล้วค่อยตัดสิน</span>
      ) : null,
      /* READING'S COUNTDOWN IS TEN DOTS ALONG THE BOTTOM, one per second of the beat, not four in
         the top corner. Ten was rejected once on the grounds that it would be "a row of specks" —
         which was true of the 1vh dot it was rejected against and is not true of the 2.6vh dot the
         approved artifact draws. At ten they also stop lying about the length of the beat: four
         dots over ten seconds sit fully lit for the first six of them. */
      hudCentre: <HudClock remainingMs={state.remainingMs} />,
      statusCentre: reading ? <DotCountdown remainingMs={state.remainingMs} /> : null,
      /* THE CLOCK IS A CYAN BAR ALONG THE VERY BOTTOM EDGE (the artifact's `.tbar`), the full width
         of the screen — not a framed badge in the top-left corner. It is the one affordance that
         means "you may answer now", it reads from the back of a hall without being read, and at
         full width the room cannot miss it starting. `reading` deliberately has no clock — but it
         KEEPS THE BAR'S HEIGHT, as an empty box. See `FootSpacer`: this slot used to be `null` on
         the beat, and the 1.8vh it gave back to the stage made the case sheet grow for ten seconds
         and then snap up the moment the question opened. */
      foot: reading ? <FootSpacer /> : <TimerBar remainingMs={state.remainingMs} totalMs={QUESTION_MS} />,
      statusRight: reading ? <CounterSpacer /> : (
        /*
         * THE ANSWERED COUNTER (spec §9) — `ตอบแล้ว 84/103`, bottom-right. Without it the host
         * cannot tell whether the room is still deciding or has finished and is waiting on them.
         * It is the one addition in this pass that serves the person RUNNING the game rather than
         * the people watching it.
         *
         * The word and the count are separate nodes so each sits on the face that can render it:
         * VT323 has no Thai glyphs and Sarabun is not the numeral face. Rendered ONLY during
         * `question` — nobody can have answered during the reading beat, and a row of zeroes for
         * ten seconds reads as a fault rather than as a beat.
         *
         * ITS HEIGHT IS RESERVED ON THE BEAT ANYWAY (`CounterSpacer`). `.det-status` is sized by
         * its tallest child, so the 4.6vh numeral arriving here grew the whole band and pulled the
         * case sheet up with it — the same defect as the clock bar's, and the bigger half of it.
         */
        <>
          <span className="det-thai text-[3.1vh]">{t('answered', 'th')}</span>
          <span className="det-term text-[4.6vh]" style={{ color: 'var(--det-gold)' }}>
            {state.answeredCount}/{state.playerCount}
          </span>
        </>
      ),
      children: <CaseBoard question={question} />,
    })
  }

  if (state.phase === 'reveal') {
    if (!question) return null
    return frame({
      plate: casePlate(question.order),
      status: null,
      children: (
        <RevealStage
          question={question}
          split={stats?.split ?? null}
          top={stats?.leaderboard ?? []}
          rankDeltas={rankDeltas}
          gains={gains}
          beat={revealBeat}
        />
      ),
    })
  }

  /* THE FULL-BLEED MOMENTS. No dossier is forced onto these three — they are single ideas that
     want the whole stage, and a case file wrapped round a podium would be decoration pretending
     to be structure. They keep the HUD only so the host's controls never move between phases. */

  if (state.phase === 'tally') {
    return frame({
      plate: allCasesPlate(),
      status: `จบครบทั้ง ${QUESTION_COUNT} คดี`,
      children: (
        <Tally
          accuracy={stats?.roomAccuracy ?? { correct: 0, wrong: 0 }}
          caseCount={QUESTION_COUNT}
          unbacked={UNBACKED_COUNT}
          closing={CLOSING_LINES}
        />
      ),
    })
  }

  return frame({
    plate: allCasesPlate(),
    status: 'ปิดคดีทั้งหมดแล้ว',
    children: <Podium top={(stats?.leaderboard ?? []).slice(0, 3)} detectives={stats?.playerCount ?? 0} />,
  })
}

/**
 * THE RULES SCREEN (spec §3) — a paper-coloured modal over a scrim, host-advanced, no countdown.
 * A hundred people read at a hundred speeds, and this is the one screen where spending an extra
 * ten seconds costs the run nothing.
 *
 * IT DOES NOT MENTION THE SPEED BONUS, and that omission is deliberate rather than an oversight:
 * telling the room that faster answers score more makes them rush, which is the opposite of what
 * this workshop teaches. The bonus stays a silent tiebreaker.
 */
function RulesStage() {
  /* BUILT FROM THE SCORING CODE, never typed. These four strings are the room's only statement of
   how points work and the one place a wrong number would never be noticed — nobody in the audience
   can check it and nothing else on the projector repeats it. They were literals, and a retune of
   the streak rule left them claiming +200/+300 while the game paid +150/+200.

   `QUESTION_MS` elapsed means the slowest correct answer, so `speedBonus` is 0 and each figure is
   base plus streak alone — exactly what a chip promises. */
const chips = [
  `ถูก +${scoreAnswer(true, 1, QUESTION_MS)}`,
  `ติดกัน2 +${scoreAnswer(true, 2, QUESTION_MS)}`,
  `ติดกัน3+ +${scoreAnswer(true, 3, QUESTION_MS)}`,
  'ผิด 0',
]
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center">
      {/* The scrim. `.det`'s own wall is already dark; this is what makes the paper read as a sheet
          held up in front of the room rather than as another panel on it. */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'rgba(2, 3, 10, 0.72)' }} />

      <div
        className="det-paper relative flex w-full max-w-6xl flex-col self-stretch"
        style={{
          border: '0.5vh solid #382c1f',
          borderRadius: '1.4vh',
          boxShadow: '0.8vh 0.8vh 0 rgba(0,0,0,0.55)',
          padding: '4vh 4.4vh',
          fontFamily: 'var(--font-thai), system-ui, sans-serif',
          fontWeight: 700,
        }}
      >
        {/* A centred heading, in Thai — the artifact's `กติกา`. The room reads this screen as a
            document, and a document with no title reads as an excerpt of one. */}
        <h2 className="text-center" style={{ fontSize: '5.6vh', fontWeight: 800, lineHeight: 1.2 }}>กติกา</h2>
        <hr className="det-dossier-rule my-[2vh]" />

        <ol className="flex flex-col gap-[2.4vh]" style={{ fontSize: TYPE.answer, lineHeight: 1.35 }}>
          <li className="flex gap-[2vh]">
            <span className="det-term shrink-0" style={{ color: '#8c593b' }}>1</span>
            <span>จอจะขึ้น <strong style={{ color: '#b32d2d' }}>คำถาม</strong> กับ <strong style={{ color: '#b32d2d' }}>คำตอบของ AI</strong></span>
          </li>
          <li className="flex flex-col gap-[1.4vh]">
            <span className="flex gap-[2vh]">
              <span className="det-term shrink-0" style={{ color: '#8c593b' }}>2</span>
              {/* DERIVED, never typed. This line read "อ่าน 10 วิ แล้วตัดสินใน 15 วิ" while the
                  answer window was already 8 — the rules screen was telling the room the wrong
                  number, and only a test's failure output caught it. Both come from the constants
                  now, so retuning either clock cannot leave this behind. */}
              <span>{`อ่าน ${READING_MS / 1000} วิ แล้วตัดสินใน ${QUESTION_MS / 1000} วิ`}</span>
            </span>
            {/* THE TWO VERDICTS AS THE PAIR THEY ARE ON THE PHONE — outlined, side by side, green
                and red. Written as a sentence they were a slash between two parentheses; drawn as
                two boxes they are the two things about to appear under every thumb in the room,
                in the same inks and the same order. */}
            <span className="flex gap-[2.8vh]">
              {[
                { label: '✓ ผ่าน — เชื่อได้', ink: '#1c7a2e' },
                { label: '✗ ตีกลับ — มีปัญหา', ink: '#b3253f' },
              ].map((v) => (
                <span
                  key={v.ink}
                  className="flex-1 text-center"
                  style={{
                    color: v.ink,
                    border: `0.5vh solid ${v.ink}`,
                    borderRadius: '0.7vh',
                    padding: '1.1vh 0',
                    fontWeight: 800,
                    fontSize: '3.4vh',
                  }}
                >
                  {v.label}
                </span>
              ))}
            </span>
          </li>
          <li className="flex gap-[2vh]">
            <span className="det-term shrink-0" style={{ color: '#8c593b' }}>3</span>
            {/* "ผิดหรือไม่ทัน", not just "ผิด". `scorePlayer` resets the streak on a MISSING
                answer exactly as it does on a wrong one (lib/scoring.ts: `if (!a) { streak = 0 }`),
                and with an eight-second window not answering is going to happen to somebody every
                round. The rules screen has to state the rule the code actually applies. */}
            {/* CONCRETE, and tied to the chips below it. This read "ถูกติดกันยิ่งได้เยอะ ผิดหรือไม่ทัน
                เริ่มนับใหม่", which left three things unsaid: how many in a row starts it, what
                "ได้เยอะ" is worth, and what "นับ" is counting. The chips already answer the second;
                this line now answers the first and the third and points at them. */}
            <span>
              ถูกติดกัน <strong>2 ข้อขึ้นไป</strong> ได้โบนัสเพิ่ม —{' '}
              <strong style={{ color: '#b32d2d' }}>ตอบผิดหรือไม่ทัน โบนัสหายหมด</strong>
            </span>
          </li>
          {/* THE SPEED BONUS IS NOW ANNOUNCED. It used to be kept off this screen deliberately, on
              the argument that telling a room faster scores more makes it rush — the opposite of
              what the workshop teaches. The team decided the other way, and the wording carries the
              proportion so it cannot be misread as a reason to hurry: ten points against a hundred
              for being right, which is the whole invariant behind MAX_SPEED_BONUS. */}
          <li className="flex gap-[2vh]">
            <span className="det-term shrink-0" style={{ color: '#8c593b' }}>4</span>
            <span>ตอบไวได้โบนัสนิดหน่อย <strong style={{ color: '#8c593b' }}>แต่ตอบถูกสำคัญกว่ามาก</strong></span>
          </li>
        </ol>

        {/* The chips take the bottom edge of the sheet and the slack lands above them, so the
            modal fills the stage at any projector height instead of floating at its own intrinsic
            one with a band of scrim under it. */}
        <hr className="det-dossier-rule mb-[2.4vh] mt-auto" />

        <div className="flex flex-wrap justify-center gap-[1.6vh]">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full"
              style={{
                fontSize: TYPE.floor,
                padding: '0.7vh 2vh',
                border: '0.25vh solid #d4c1ad',
                background: 'rgba(235, 217, 204, 0.6)',
                color: '#5c3f28',
                whiteSpace: 'nowrap',
              }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}


/* ── The lobby board (spec §2) ────────────────────────────────────────────────────────────────
 *
 * SHELF PACKING, NOT SCATTERING, and the difference is the whole section.
 *
 * Two earlier attempts scattered cards and tried to dodge collisions. Neither can reach "no
 * overlap": a hundred cards at a readable size occupy most of the board, and random placement
 * jams long before they all fit — the dodging loop runs out of tries and either drops the card or
 * drops it on top of another one. Overlap has to be impossible BY CONSTRUCTION, not merely
 * unlikely.
 *
 * So the board is cut into invisible shelves, each one card-height plus GAP_Y tall. Every shelf
 * carries a list of occupied x-ranges; the furniture (the title, the QR, Start, the counter)
 * blocks an x-range on every shelf it crosses. A new card takes the free gaps of each shelf and
 * lands in one chosen at random from the four shelves with the most free width — empty space
 * wins, but not so rigidly that the board reads as sorted.
 *
 * NOTHING ABOUT THE RIGHT EDGE IS RESERVED. An earlier draft positioned cards by a left offset
 * capped at `100 − cardWidth`, which silently left a card's width of dead space down the right
 * side of every board. Gaps here are walked to the true edge.
 */

/** The gutters, in fractions of the board's own height/width — the same units the packer works in. */
export const GAP_Y_VH = 1.35
export const GAP_X_VH = 1.1

export type Rect = { x: number; y: number; w: number; h: number }
export type Placement = { x: number; y: number; tilt: number }

/**
 * The packer, as a pure function of geometry — no DOM, no React, no randomness beyond the `rand`
 * it is handed. That is what makes "no two cards overlap" assertable at all: jsdom performs no
 * layout, so a test against the rendered lobby could never measure a rectangle. This can be fed
 * measured rectangles and checked directly.
 *
 * All lengths are in the SAME unit as `board` — the caller works in device pixels and converts at
 * the edges. Returns one placement per card, in order, and STOPS when the board is genuinely
 * full: the remaining cards get no placement and the caller reports the shortfall rather than
 * stacking them (spec §2 — capacity at 3.0vh is about a hundred; past that the choice is smaller
 * cards or accepting overlap, and this pass makes neither).
 */
export function packShelves({
  board, cards, furniture, gapX, gapY, jitterY, rand,
}: {
  board: { w: number; h: number }
  /** One entry per card, in placement order. */
  cards: { w: number; h: number }[]
  /** Rectangles nothing may be placed under, already in board coordinates. */
  furniture: Rect[]
  gapX: number
  gapY: number
  /** Maximum vertical wobble, applied inside the shelf's own slack. */
  jitterY: number
  /** Injected so a test can be deterministic. Returns [0, 1). */
  rand: () => number
}): (Placement | null)[] {
  const cardH = cards.length > 0 ? Math.max(...cards.map((c) => c.h)) : 0
  const shelfH = cardH + gapY
  const shelfCount = cardH > 0 ? Math.floor(board.h / shelfH) : 0
  if (shelfCount <= 0) return cards.map(() => null)

  // Occupied x-ranges per shelf, seeded with whatever furniture crosses that shelf.
  const occupied: [number, number][][] = Array.from({ length: shelfCount }, (_, s) => {
    const top = s * shelfH
    const bottom = top + shelfH
    const blocks: [number, number][] = []
    for (const f of furniture) {
      // A rectangle blocks a shelf if it overlaps it vertically at all, padded by the gutter.
      if (f.y - gapY < bottom && f.y + f.h + gapY > top) {
        blocks.push([Math.max(0, f.x - gapX), Math.min(board.w, f.x + f.w + gapX)])
      }
    }
    return merge(blocks)
  })

  return cards.map((card) => {
    const need = card.w + gapX
    /* The free width of each shelf, and the gaps that could actually take this card. Walked to
       `board.w` — the true right edge — never to `board.w - card.w`. */
    const options = occupied.map((blocks, s) => {
      const gaps = freeGaps(blocks, board.w).filter(([a, b]) => b - a >= need)
      const free = gaps.reduce((sum, [a, b]) => sum + (b - a), 0)
      return { s, gaps, free }
    }).filter((o) => o.gaps.length > 0)

    if (options.length === 0) return null

    // The four emptiest shelves, then one of them at random. Pure "emptiest wins" sorts the board
    // into neat descending rows; pure random jams the wide shelves early.
    options.sort((a, b) => b.free - a.free)
    const pool = options.slice(0, Math.min(4, options.length))
    const chosen = pool[Math.floor(rand() * pool.length)] ?? pool[0]

    const gap = chosen.gaps[Math.floor(rand() * chosen.gaps.length)] ?? chosen.gaps[0]
    const x = gap[0] + rand() * (gap[1] - gap[0] - need)
    occupied[chosen.s] = merge([...occupied[chosen.s], [x, x + need]])

    /* The card sits in the middle of its own shelf, wobbled by at most `jitterY`. The shelf is
       `cardH + gapY` tall, so the wobble eats into the gutter rather than into a neighbour, and
       the tilt below (±1.5°) costs at most half a card-width times sin(1.5°) of vertical reach —
       which is what `gapY` at 1.35vh is sized to absorb. */
    const slack = Math.max(0, (shelfH - card.h) / 2)
    const y = chosen.s * shelfH + slack + (rand() * 2 - 1) * Math.min(jitterY, slack)
    return { x, y, tilt: (rand() * 2 - 1) * 1.5 }
  })
}

/** Union of overlapping/touching ranges, sorted. */
function merge(ranges: [number, number][]): [number, number][] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const out: [number, number][] = [sorted[0]]
  for (const [a, b] of sorted.slice(1)) {
    const last = out[out.length - 1]
    if (a <= last[1]) last[1] = Math.max(last[1], b)
    else out.push([a, b])
  }
  return out
}

/** The complement of `blocks` within `[0, width]` — every gap, out to the true right edge. */
function freeGaps(blocks: [number, number][], width: number): [number, number][] {
  const gaps: [number, number][] = []
  let cursor = 0
  for (const [a, b] of blocks) {
    if (a > cursor) gaps.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < width) gaps.push([cursor, width])
  return gaps
}

/*
 * NO TRUNCATION ON THE BOARD.
 *
 * This used to clip at 14 characters and hang an ellipsis on the rest, which quietly broke the one
 * thing the board is for: a player scans it for the name THEY typed, and `สมชายผู้พิชิตกาแฟเย็น…`
 * is not that name. The host reads these out loud and teases the room with them, and a truncated
 * one cannot be read out.
 *
 * The cap moved to the door instead — `lib/names.ts`, thirty characters, enforced in the join
 * route for both workshops — so what the store holds is already short enough to draw whole. Card
 * type came down with it (TYPE.card) to buy the shelves back the width a full-length name costs.
 */
const truncate = (name: string) => name

/**
 * The name board.
 *
 * TWO PASSES, IN ONE LAYOUT EFFECT. A card's width depends on the codename inside it and on the
 * font actually loaded, so it has to be MEASURED, not estimated — and the furniture rectangles
 * likewise come off the live DOM (spec §2 is explicit: never hard-coded, so they stay correct at
 * any stage size). Unplaced cards render at `visibility: hidden` in the top-left; the layout
 * effect measures them, runs the packer, and commits the placements before the browser paints, so
 * there is no visible flash of a stacked pile.
 *
 * PLACEMENTS PERSIST IN A REF, keyed by codename. The lobby re-renders on every stats poll (1.5s),
 * and re-running a random packer per render would reshuffle the whole board twice a second while
 * the room watched — the exact failure the old deterministic `pinSpot` was written to avoid. Only
 * genuinely new arrivals are placed; everyone already on the board stays where they are. A resize
 * is the one thing that clears them, because every measured rectangle changed.
 *
 * EVERY CARD RENDERS AT FULL OPACITY. The age-based and coverage-based fading of earlier drafts is
 * deleted outright: nothing is covered any more, so there is nothing for a fade to apologise for.
 */
/**
 * The board's paging.
 *
 * THE BOARD CANNOT SEAT A FULL ROOM AND NEVER COULD. Measured at the twenty-character cap
 * (lib/names.ts), a 1366×768 projector seats roughly fifty cards at a size the back of a hall can
 * read — so a room of a hundred had half its names on the wall and the other half nowhere, with
 * nothing on screen admitting it. Which half you were in came down to when you joined. The board
 * now shows a page at a time and everyone reaches the wall inside one cycle.
 *
 * A PAGE IS "WHATEVER FIT", NOT A FIXED COUNT. A fixed forty was safe against a room where every
 * name is twenty characters and left a third of the board empty in the room you actually get,
 * where most people type "ปุ๊ก". So the packer is handed a WINDOW of candidates, seats as many as
 * the shelves hold, and the next page starts at the first one it could not seat. Long names make
 * short pages, short names make full ones, and the board is packed either way.
 *
 * The window is a runaway guard, not a target: it only has to exceed what any projector could
 * possibly seat.
 *
 * THE HOST TURNS IT, not a timer. A wall that swaps itself every five seconds takes the decision
 * away from the person who can see the room: they cannot hold a page while they read a name out,
 * and they cannot turn it early once everybody has found themselves. The drawer label is the
 * control — there is no second button, because a lobby with two host controls in it is a lobby
 * where one of them gets pressed by mistake.
 */
const BOARD_WINDOW = 160

function NameBoard({
  names, boardRef, onPage, onTurn,
}: {
  names: { codename: string; avatar: string }[]
  boardRef: React.RefObject<HTMLDivElement | null>
  /** Reports which page is on the board and whether there is more than one, so the lobby can
   *  label it. There is no total: a page is as long as the shelves allowed, so the count is not
   *  known until the board has been round once. */
  onPage?: (page: number, paging: boolean) => void
  /** Hands the lobby the page-turn action, so the drawer label can be the control. */
  onTurn?: (turn: () => void) => void
}) {
  const placedRef = useRef<Map<string, Placement>>(new Map())
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const [, setTick] = useState(0)
  const [resizeKey, setResizeKey] = useState(0)
  /** Where this page starts in join order, and which page number it is (for the label). */
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)

  // A resize invalidates every measurement at once — the board, the furniture and each card. There
  // is no partial repair; drop the lot and let the effect below pack again from scratch.
  useEffect(() => {
    const el = boardRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      placedRef.current = new Map()
      setResizeKey((k) => k + 1)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [boardRef])

  /* A room that shrank under the cursor (a reset) goes back to the top rather than showing
     nothing. */
  const start = cursor < names.length ? cursor : 0
  const shown = useMemo(
    () => names
      .slice(start, start + BOARD_WINDOW)
      .map((n) => ({ ...n, label: truncate(n.codename) })),
    [names, start],
  )

  /*
   * WHERE THIS PAGE ENDS: the first card in the window the packer could NOT seat.
   *
   * Not "how many were seated". `packShelves` fills shelves in order but is free to skip a card
   * too wide for the gap it is looking at and seat a later, narrower one — so the seated set is
   * not always a prefix of the window. Advancing the cursor by a COUNT therefore steps over the
   * ones that were skipped in the middle, and at 200 players three people never reached the wall.
   * Advancing to the first unseated index cannot skip anyone: the worst it does is show a card
   * twice, which costs nothing.
   *
   * Read during render off the ref rather than held in state. It is one frame behind on the very
   * first pass, and the board re-renders every stats poll, so the label and the control appear
   * within a second of the board being full — and nothing on screen depends on the number itself.
   */
  const firstUnplaced = shown.findIndex((n) => !placedRef.current.has(n.codename))
  /** Turning at all only when the board cannot hold the whole room at once. */
  const paging = names.length > 0 && (start > 0 || firstUnplaced !== -1 || shown.length < names.length)
  useEffect(() => { onPage?.(page, paging) }, [page, paging, onPage])

  /*
   * THE PAGE TURN.
   *
   * It invalidates every placement, exactly the way a resize does: the cards on the board are
   * about to be a different set, and a placement kept from the previous page would seat a new card
   * on top of one that is no longer there. The next page begins where this one ran out of shelves,
   * so wrapping is by CURSOR — the page length is not known until the packer has run, and there is
   * no total to modulo against. A page that seated nothing still advances by one, or the control
   * would do nothing and read as broken.
   *
   * READ AT THE PRESS, off the placement map, NOT from whatever the last measuring pass happened
   * to leave behind: that effect early-returns whenever there is nothing new to place, which is
   * exactly what happens on a page whose cards were all seated on an earlier pass. `placedRef` is
   * the truth about what is on the wall right now, so ask it — and ask it for the first card it
   * could NOT seat, per the note above.
   */
  const turn = useCallback(() => {
    const unplaced = shown.findIndex((n) => !placedRef.current.has(n.codename))
    const seated = Math.max(1, unplaced === -1 ? shown.length : unplaced)
    setCursor((c) => {
      const next = c + seated
      if (next >= names.length) { setPage(0); return 0 }
      setPage((p) => p + 1)
      return next
    })
    placedRef.current = new Map()
  }, [names.length, shown])

  useEffect(() => { onTurn?.(turn) }, [turn, onTurn])


  useIsomorphicLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const boardRect = board.getBoundingClientRect()
    if (boardRect.width === 0 || boardRect.height === 0) return

    const pending = shown.filter((n) => !placedRef.current.has(n.codename))
    if (pending.length === 0) return


    const vh = window.innerHeight / 100
    const measured = pending.map((n) => {
      const el = cardRefs.current.get(n.codename)
      const r = el?.getBoundingClientRect()
      return { w: r?.width ?? 0, h: r?.height ?? 0 }
    })
    if (measured.some((m) => m.w === 0)) return

    /* THE FURNITURE, off the live DOM. Anything carrying `data-lobby-furniture` — the title, the
       QR panel, the Start button and the counter — blocks the shelves it crosses. Measured rather
       than declared, so moving one of them in the JSX cannot leave a stale rectangle behind. */
    const furniture: Rect[] = [...board.querySelectorAll('[data-lobby-furniture]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left - boardRect.left, y: r.top - boardRect.top, w: r.width, h: r.height }
    })

    // Already-placed cards are furniture too, as far as a new arrival is concerned.
    for (const n of shown) {
      const p = placedRef.current.get(n.codename)
      const el = cardRefs.current.get(n.codename)
      if (!p || !el) continue
      const r = el.getBoundingClientRect()
      furniture.push({ x: p.x, y: p.y, w: r.width, h: r.height })
    }

    const placements = packShelves({
      board: { w: boardRect.width, h: boardRect.height },
      cards: measured,
      furniture,
      gapX: GAP_X_VH * vh,
      gapY: GAP_Y_VH * vh,
      jitterY: 0.25 * vh,
      rand: Math.random,
    })

    placements.forEach((p, i) => { if (p) placedRef.current.set(pending[i].codename, p) })
    /* An unseated card stays pending and is retried on the next poll. NOTHING IS REPORTED: the
       overflow note this used to feed ("+36 did not fit") was cut by the team — a player is
       looking for their own name and the count beside the board is the authoritative number
       either way — and the `capped` state it fed then sat here set-but-never-read. */
    setTick((n) => n + 1)
  }, [shown, resizeKey, boardRef])

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {shown.map((p) => {
        /* No placement yet means one of two things, and they render identically: the card is in
           the measuring pass (the effect below is about to place it), or the board is genuinely
           full and it never will be. Either way it is hidden rather than stacked in the corner —
           half a card poking out from under another one is worse than the counter simply being
           ahead of the board, and the counter says so. */
        const placement = placedRef.current.get(p.codename)
        return (
          <div
            key={p.codename}
            ref={(el) => { if (el) cardRefs.current.set(p.codename, el); else cardRefs.current.delete(p.codename) }}
            className="det-pin absolute"
            style={{
              left: placement ? `${placement.x}px` : 0,
              top: placement ? `${placement.y}px` : 0,
              visibility: placement ? 'visible' : 'hidden',
            }}
          >
            {/* The tilt sits on the CHILD and the drop-in on the parent: both are `transform`, and
                one element carrying both would let the landing animation override the tilt while
                it ran and then snap it back. */}
            <span
              className="det-thai det-paper relative inline-block whitespace-nowrap rounded px-[1.2vh] py-[0.6vh]"
              style={{
                fontSize: TYPE.card,
                lineHeight: 1.25,
                boxShadow: '0.3vh 0.55vh 0.9vh rgba(0,0,0,0.55)',
                transform: `rotate(${placement?.tilt ?? 0}deg)`,
              }}
            >
              {/* THE PUSHPIN, straddling the card's top edge. It is what makes these evidence
                  cards pinned to a board rather than chips in a list — and it is the same object
                  the podium's three cards are pinned with, which is how the end of the game reads
                  as the same world as the start. */}
              <span
                aria-hidden="true"
                className="absolute left-1/2 block rounded-full"
                style={{
                  top: '-0.75vh', width: '1.5vh', height: '1.5vh', marginLeft: '-0.75vh',
                  background: '#d4342f',
                  boxShadow: 'inset -0.3vh -0.3vh 0 rgba(0,0,0,0.35)',
                }}
              />
              {p.avatar} {p.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * The lobby (spec §2): a big screen title, a QR on paper, the join URL, and Start — the biggest
 * control in the workshop — with the room's own names packed around all of it.
 *
 * NO RED STRING, and NO PATROL. The string was decoration over the one screen that has to carry a
 * hundred names, and the detective walked the band the bottom shelves now use.
 *
 * The QR, Start and the counter all render ABOVE the name layer, each with a dark halo, so they
 * stay readable over a full board.
 */
function Lobby({
  joinUrl, names, playerCount, hostToken, onReset, onStart,
}: {
  joinUrl: string
  names: { codename: string; avatar: string }[]
  playerCount: number
  hostToken: string
  onReset: (ok: boolean) => void
  onStart: () => void
}) {
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [board, setBoard] = useState({ page: 0, paging: false })
  const onPage = useCallback((page: number, paging: boolean) => setBoard({ page, paging }), [])
  const turnRef = useRef<() => void>(() => {})
  const onTurn = useCallback((turn: () => void) => { turnRef.current = turn }, [])

  return (
    <div ref={boardRef} className="relative z-10 min-h-[95vh]">
      <NameBoard names={names} boardRef={boardRef} onPage={onPage} onTurn={onTurn} />

      {/*
        * WHICH DRAWER THE BOARD IS SHOWING.
        *
        * The board cannot seat a full room at a readable size, so it pages (NameBoard, BOARD_PAGE)
        * — and a wall of names that silently swaps every three seconds reads as a glitch unless
        * something on screen says it is turning. In this workshop's own language that is a case
        * file: แฟ้ม 1, แฟ้ม 2. Top left, the one corner of the lobby nothing else occupies.
        *
        * It renders only when there is more than one, so a small room never sees a label for a
        * board that is not turning. `data-lobby-furniture` keeps the packer off it — the shelf
        * packer reads these rectangles off the live DOM, so this needs no change to the packer.
        */}
      {board.paging ? (
        /*
         * THE DRAWER LABEL, AND THE CONTROL, in one object. The board holds one page of a room too
         * big to draw at once and the host turns it by pressing this — there is no separate arrow,
         * because a second host control in the lobby is a second thing to hit by mistake next to
         * Start.
         *
         * Bare type in the HUD's own gold, the same treatment as `CASE 04 / 09`, because it is the
         * same kind of thing: a label the host reads off the chrome, not an object on the board. A
         * filled plate here read as a card that had landed crooked on top of the names.
         *
         * `data-lobby-furniture` keeps the shelf packer off it — the packer reads these rectangles
         * off the live DOM, so this needs no change to the packer.
         */
        <button
          type="button"
          data-lobby-furniture
          data-testid="lobby-page-plate"
          onClick={() => turnRef.current()}
          className="det-thai absolute left-0 top-0 cursor-pointer"
          style={{
            fontSize: TYPE.control,
            lineHeight: 1.15,
            color: 'var(--det-gold)',
            background: 'transparent',
            border: 0,
            padding: 0,
          }}
        >
          แฟ้ม {board.page + 1} ▸
        </button>
      ) : null}

      {/*
        * RESET, in the corner — and it is the only host control the lobby carries besides Start.
        *
        * v3.1's rule was that the lobby carries none at all, on the grounds that Next and Hold have
        * nothing to act on before a game runs. Reset is the exception, and the gap was real: this
        * control rendered ONLY on non-lobby phases, so a host wanting to clear a rehearsal room had
        * to START the game in order to reach the control that clears it.
        *
        * A CORNER AFFORDANCE, NOT A PEER OF START. The middle of this screen holds the QR and the
        * button the host actually presses, and nothing else may compete with them. `ResetButton`'s
        * own two-step arming (first press arms, second confirms, and it disarms itself on a
        * timeout and on blur) is what makes a destructive control safe to put somewhere visible —
        * so nothing here adds a second confirmation on top of it, and nothing here weakens it.
        *
        * `data-lobby-furniture` like every other fixed thing on the board: the shelf packer reads
        * these rectangles off the live DOM, so this needed no change to the packer at all.
        */}
      <div data-lobby-furniture className="absolute right-0 top-0 z-20">
        <ResetButton
          endpoint="/api/reset"
          token={hostToken}
          label={t('hostReset', 'th')}
          armedLabel={t('hostResetArmed', 'th')}
          onDone={onReset}
          className="det-btn det-btn-thai det-btn-danger"
          style={{ fontSize: TYPE.control, '--det-btn-pad': '0.8vh 1.6vh' } as React.CSSProperties}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-[2.2vh]">
        <h1 data-lobby-furniture className="det-screen-title">
          ห้องสืบสวน
          {/* English — `.det-screen-title small` is Press Start 2P, which has no Thai glyphs. */}
          <small>SCAN TO JOIN THE CASE</small>
        </h1>

        {/* THE ONE HALO ON THE BOARD, and it is a RING rather than a plate — the artifact's own
            `0 0 0 .8cqh rgba(4,5,14,.55)` plus a drop shadow. It separates white paper from cream
            paper; the title and the Start button need nothing, because the shelf packer blocks
            their rectangles and no card can ever land on them. */}
        {joinUrl ? (
          <div data-lobby-furniture>
            <div
              className="det-paper rounded-2xl p-[2.2vh]"
              style={{ boxShadow: '0 0 0 0.8vh rgba(4,5,14,0.55), 1vh 1.4vh 2.4vh rgba(0,0,0,0.75)' }}
              aria-label="Join QR code"
            >
              {/* `size` is a pixel count on this component's own API, so the rendered <svg>
                  carries fixed width/height ATTRIBUTES. The class is what actually sizes it: a CSS
                  declaration outranks a presentation attribute, so the code scales with the
                  projector while `size` only fixes the module resolution. */}
              <QRCodeSVG value={joinUrl} size={220} level="M" className="h-[30vh] w-[30vh]" />
            </div>
          </div>
        ) : null}

        {/* NO printed join URL. The team cut it: the middle of this screen holds the QR and the
            Start button and nothing else, and a LAN address like 10.88.20.4:3000 is not something
            a room of a hundred types anyway — the QR is the way in, and the host says the address
            aloud in the rare case a camera will not scan. Removing it is also what let the QR grow
            from 29% to 41% of the screen height, which matters far more to someone at the back. */}

        <div data-lobby-furniture className="pointer-events-auto">
          <button
            type="button"
            onClick={onStart}
            className="det-btn det-btn-gold det-btn-thai det-pulse"
          >
            {t('hostStart', 'th')}
          </button>
        </div>

        {/* A DARK ROUNDED PILL, not a soft halo: this is the authoritative count and it sits at
            the bottom edge where the board is densest, so it needs an edge of its own. */}
        <p
          data-lobby-furniture
          className="flex items-baseline justify-center gap-[1.2vh]"
          style={{ background: 'rgba(4,5,14,0.72)', padding: '0.9vh 2.6vh', borderRadius: '5vh' }}
        >
          <span className="det-thai text-[3.1vh] opacity-80">{t('detectivesInRoom', 'th')}</span>
          {/* The authoritative number, on the numeral face — the cards behind it are the board's
              own view of the same room, and when the board runs out of shelves this is what still
              tells the truth. */}
          <span className="det-term text-[4.6vh] text-[var(--det-gold)]">{playerCount}</span>
          {/* NO overflow note. That the board holds fewer cards than the room holds is not
              something the room needs told: a player is looking for their own name, and the count
              beside it is the authoritative number either way. Announcing "+36 did not fit" only
              points at a limit nobody was troubled by — and it made this paragraph's width depend
              on a number known only AFTER packing, which is how two name cards ended up sitting
              on top of it. */}
        </p>
      </div>
    </div>
  )
}

/**
 * `reading`'s countdown: ten discrete dots along the bottom of the screen, one per second of the
 * beat, going out as it runs. Never a bar — spec §2 is explicit that the timer bar means "you may
 * answer now" and nothing else, so the two phases must not carry affordances that look alike from
 * the back of a hall.
 *
 * TEN, not four. Four encoded a five-second beat in its own length: at ten seconds all four sit
 * lit for the first six and the countdown says nothing for more than half its length. Ten was
 * rejected once as "a row of specks", which was true of the dot it was rejected against and is not
 * true of the 2.6vh dot the approved artifact draws.
 */
/**
 * THE CLOCK, top centre — the one number the whole room is acting on, in the one place every eye
 * already returns to between the question and the answer.
 *
 * Seconds, not a bar: a bar says "some time left" and a numeral says "seven", and a room of a
 * hundred deciding together needs the second one. The bar stays along the bottom as the ambient
 * read; this is the one you look up at.
 *
 * Turns pink under four seconds. That threshold is the point where the advice changes from "think"
 * to "commit", and it should be legible as a colour before it is legible as a number.
 */
function HudClock({ remainingMs }: { remainingMs: number }) {
  const secs = Math.max(0, Math.ceil(remainingMs / 1000))
  const urgent = secs <= 3
  return (
    <span
      className="det-term flex items-baseline gap-[1vh] tabular-nums"
      style={{ fontSize: '10vh', color: urgent ? 'var(--det-pink)' : 'var(--det-gold)', lineHeight: 1 }}
      aria-label={`เหลือเวลา ${secs} วินาที`}
    >
      <span aria-hidden="true" style={{ fontSize: '5.6vh' }}>⏱</span>
      {secs}
    </span>
  )
}

function DotCountdown({ remainingMs }: { remainingMs: number }) {
  const DOTS = 10
  const lit = Math.max(0, Math.min(DOTS, Math.ceil(remainingMs / 1000)))
  return (
    <div className="flex items-center gap-[2.1vh]" role="presentation">
      {Array.from({ length: DOTS }, (_, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: '2.6vh', height: '2.6vh',
            background: i < lit ? 'var(--det-cyan)' : 'rgba(255,255,255,.22)',
          }}
        />
      ))}
    </div>
  )
}

/** The file header printed along the top of a sheet. Latin and numerals only — VT323 has no Thai.
 *  `pr` clears the CLASSIFIED DOSSIER rubber stamp, which `.det-dossier::before` pins to the
 *  paper's own top-right corner. */
function FileHeader({ text }: { text: string }) {
  return (
    <div className="det-dossier-head det-term pr-[35vh] text-[3.1vh]">
      {text}
    </div>
  )
}

/**
 * `เป็ด AI ตอบว่า` — who is talking. A component rather than two copies of five declarations,
 * because it renders on BOTH cream sheets: the case board, over the duck's answer in its bubble,
 * and the reveal, over the same sentence with the lie marked in it. Same size, same ink, same
 * dashed rule, one definition — and on the reveal it is the ONLY thing that says whose sentence is
 * being marked up, because that sheet carries no duck and no bubble.
 *
 * 2.9vh, knowingly under the 3.1vh floor. The reasoning is in `CaseBoard`'s comment below.
 *
 * `det-thai` is not optional: `body` is `Arial, Helvetica, sans-serif` and nothing between it and
 * this span sets a face, so without the class the label falls out of the Thai webfont every other
 * Thai string on the paper is set in. `#8c593b` is `.det-dossier-label`'s ink, written inline
 * because the size and letter-spacing have to be inline anyway and splitting one label's five
 * declarations across two files helps nobody read it.
 *
 * The rule beside it is `aria-hidden` and drawn as a repeating gradient rather than a `border`:
 * it is the dashes of a form field waiting to be filled in, and a screen reader announcing a
 * separator after the label would be describing a structure that is not on the page. The dash
 * period is in px like `.det-dossier-rule`'s own `2px dashed` — a dash pattern is texture, not
 * type, and a texture that scaled with the projector would be a different texture on every wall.
 */
function DuckSaysLabel() {
  return (
    <div className="flex items-center gap-[1.2vh]">
      <span className="det-thai" style={{ fontSize: '2.9vh', fontWeight: 800, letterSpacing: '0.04em', color: '#8c593b' }}>
        เป็ด AI ตอบว่า
      </span>
      <span
        aria-hidden="true"
        className="flex-1"
        style={{ height: '0.25vh', background: 'repeating-linear-gradient(90deg,#d4c1ad 0 6px,transparent 6px 12px)' }}
      />
    </div>
  )
}

/**
 * `reading` and `question`, which are the same scene — the room gets the question and the duck's
 * answer in full, and the ONLY differences are in the frame around them (spec §2): during the beat
 * there is no clock bar, because answering is impossible, and no answered counter, because nobody
 * can have answered yet and a row of zeroes reads as a fault rather than as a beat. Both of those
 * live in `StageFrame`'s slots, which is why one component serves both phases here.
 *
 * WHAT THE APPROVED ARTIFACT DRAWS, and what this had that it does not:
 *
 *  - NO FOLDER TAB. The artifact's case file is a plain sheet, rounded on all four corners, and
 *    the tab was the projector's own invention. The square top-left corner goes with it — that
 *    corner only reads as intentional when something sits above it.
 *  - NO `FILE 01 / 09 — AI STATEMENT` HEADER. The HUD says `CASE 01 / 09` two inches above it.
 *  - THE QUESTION IS PLAIN INK ON PAPER, not text inside a tinted block. A tinted block reads as
 *    a form field; the question is the sentence typed on the sheet.
 *  - THE DUCK'S ANSWER IS PALE BLUE ON CREAM (`#eef4ff`), not a dark navy screen with a portrait
 *    beside it. On cream paper the dark panel read as a hole cut in the sheet.
 *
 * THE ANSWER IS A THOUGHT BUBBLE NOW, AND THE DUCK SITS IN THE CORNER OF THE SHEET.
 *
 * The cyan rule down the left edge is gone, and no scalloped edge replaced it — scallops were
 * drawn and rejected. What carries the meaning is the TAIL: two circles shrinking out of the
 * bubble's bottom-left corner toward the duck's head, which is the one convention that says
 * "this is what that character said" with no type doing the saying. The quotation marks went with
 * the box for the same reason — a thought bubble is already marked as speech by its own shape, and
 * quote marks inside one read as the duck quoting somebody else.
 *
 * The duck is 23vh and ABSOLUTELY POSITIONED in the sheet's bottom-left corner, which is the only
 * reason it can be that big. In the flow at 7.4vh it was a thumbnail paying for itself out of the
 * sentence's width; out of the flow it costs the sentence nothing, so the answer spans the sheet
 * at the size the back of the hall needs AND the duck is three times what it was. Yes, it repeats
 * the duck walking the floor below, and that repetition is the point: the sheet has to say who is
 * talking, and a figure strolling along the bottom of the room is scenery, not attribution.
 *
 * THE QUESTION'S OWN LABEL STAYS GONE (spec §1). `คำถาม / สถานการณ์:` measured 14.6px, and the
 * question is obviously the question.
 *
 * THE DUCK'S LABEL CAME BACK, as `เป็ด AI ตอบว่า`. It was deleted alongside the other one and the
 * owner asked for it back: a room that walks in mid-case cannot tell who is speaking, and nothing
 * else on the sheet says. It returns at 2.9vh rather than at the flat 14.6px that got it deleted —
 * a fraction of the screen, so it grows with the projector — and knowingly a shade under the 3.1vh
 * floor, because two words of attribution over the sentence they attribute are not running text
 * and at the floor they start competing with the answer. Latin `AI`, never `เอไอ`.
 */
function CaseBoard({ question }: { question: Question }) {
  return (
    /*
     * `pb-[10.7vh]` LANDS THE PAPER ON THE DETECTIVE'S HAT, and the number came off the render,
     * because the arithmetic route to it gives an answer that is 3.7vh wrong.
     *
     * THE ARITHMETIC ROUTE, and why it does not work. `components/game/Patrol.tsx` stands the man
     * with his feet at `MAN.feetFrac` (92.5%) of a canvas that is `inset-0` over the whole
     * viewport and `MAN.hFrac` (20%) of it tall, and `TvPage` mounts it with no `floor` override —
     * so his sprite's BOX tops out at 72.5vh. But `drawSherlockSprite` does not fill that box: it
     * translates to the box's centre and then paints in the reference's own scene units, and its
     * topmost rect is the hat brim at local y = −44 of a box that is ±67.5 tall. The drawn hat
     * therefore starts about 3.4vh BELOW the line the fractions predict, and a sheet stopped at
     * 72.5vh leaves a visible band of bare wall — the exact band this change exists to remove.
     *
     * SO IT WAS MEASURED INSTEAD. The canvas is transparent except for the two figures, so the
     * topmost opaque pixel on it IS the top of the hat. Scanned over forty frames (he bounces
     * `sin(frame * 0.22) * 3`), it sits at 75.89–76.78vh at 1600x900 and 75.91–76.69vh at
     * 1366x768 — the same line on both, which is what a fraction-of-the-stage sprite should do.
     * At `pb-[10.7vh]` the paper's bottom border lands at 75.91vh and 75.59vh respectively: on the
     * hat at one shape, two and a half pixels above it at the other, and `.det-dossier`'s hard 6px
     * offset shadow closes that on both. It reads as the paper resting on him, which is the ask.
     *
     * (The residual 0.3vh between the two shapes is `.det-hud` and `.det-status`, which pad and
     * rule themselves in px — 8 + 3 each — so the band above the stage is a slightly larger share
     * of a 768px screen than of a 900px one. Both are inside the hat's own 0.9vh of bounce.)
     *
     * IT WAS 16, which stopped the paper at 70.9vh. That clearance was deliberate and closing it
     * is the owner's call, for the scene rather than for the arithmetic: a file and a man with a
     * strip of bare wall between them are two objects on a screen, and a man walking directly
     * under the file he is working on is one picture. (At 27 the paper stopped at 60vh and left a
     * band of empty wall the size of the characters themselves.)
     *
     * WHAT THIS COSTS: the sheet is ~5.3vh taller than it was, its body is `justify-center`, and
     * the duck is pinned to its floor — so everything on the paper moved down with it and was
     * re-checked at both projector shapes rather than assumed.
     *
     * `px` in vh rather than vw on purpose: every other measurement on this stage is a fraction of
     * HEIGHT, and mixing the two makes the layout a different shape on a 16:10 panel than on 16:9
     * — which is the one thing the projector is not allowed to do.
     */
    <div className="flex min-h-0 flex-1 flex-col px-[7vh] pt-[2vh] pb-[9.6vh]">
      {/* THERE IS NO `pt-[Nvh]` HERE ANY MORE, AND THAT IS NOT AN OVERSIGHT — it never did
          anything. This body used to carry `pt-[10vh]` with a comment saying it cleared the
          CLASSIFIED stamp. Measured on the render, `.det-dossier`'s computed `padding-top` is 16px
          at every projector size: the class and `.det-dossier` have equal specificity, `.det-dossier`
          is deliberately UNLAYERED in app/globals.css (that file says so in as many words, twice)
          and Tailwind's utilities live in `@layer utilities`, so the stylesheet wins on order and
          the utility is dead. Ten, seven, any number — all of them were dead. It is gone rather
          than made `!`-important because the number would not have solved the problem anyway; see
          the question's own `paddingRight` below for what actually does.

          `relative` is belt-and-braces and deliberately so: `.det-dossier` already declares
          `position: relative` for the stamp's sake, and the duck below is positioned against it.
          Naming the dependency here is what stops a future edit to app/globals.css — a file this
          pass is not allowed to touch — from silently dropping the duck into the corner of the
          SCREEN instead of the corner of the sheet. (Every other utility in `bodyClassName` DOES
          apply: `.det-dossier` declares no display, no flex and no gap, so only `padding` collides.) */}
      <Dossier className="min-h-0 w-full flex-1" bodyClassName="relative flex min-h-0 flex-1 flex-col justify-center gap-[2.4vh]">
        {/*
          * `paddingRight` IS THE CLASSIFIED STAMP'S OWN COLUMN, and it is on the QUESTION rather
          * than on the sheet because the question is the only thing that ever reaches it.
          *
          * `.det-dossier::before` pins the stamp to the paper's top-right corner and rotates it
          * -11deg. Measured from the pseudo-element's own computed box, its left edge lands 287px
          * in from the question's right edge at 1366x768 and 339px in at 1600x900 — 37.4vh and
          * 37.7vh, the same column on both, which is what a `vh`-and-`vw` stamp should do. 38vh
          * clears it at both with a little to spare.
          *
          * WHY NOT CLEAR IT FROM ABOVE, which is what this sheet did before. Two reasons, and the
          * first is embarrassing: the `pt-[10vh]` that claimed to do it was never applied at all
          * (see the note above). The second is that it could not have. The stamp's painted bottom
          * sits 11.4vh below the paper's inner top; this body is `justify-center` and case 09's
          * question runs to two lines, which leaves under 10vh of slack in the whole sheet — there
          * is no arrangement of top padding that puts a two-line question below the stamp and
          * still fits the label, the bubble and the duck underneath it.
          *
          * WHAT IT COSTS: a question longer than about 870px at 1366 wraps a line earlier than it
          * otherwise would. That is the same trade `FileHeader` already makes on this same sheet
          * with `pr-[35vh]`, for the same stamp, and it is paid by the question's own lines only —
          * the label, the bubble and the duck all keep the full width of the paper.
          */}
        {/*
          * THE STAMP GETS A FLOAT, NOT A PADDING — and the difference is the whole point.
          *
          * `paddingRight: '38vh'` reserved the CLASSIFIED stamp's column on EVERY line of the
          * question, for the full height of the paragraph. But the stamp is one object in the
          * top-right corner: measured on the render its rotated box ends 120px down at 1600x900,
          * which is inside the FIRST line and nothing else. Every line after it was being held
          * back from a corner of paper that is empty. On `mum-teng-nong` — the room's first case —
          * line one ended with 792px of blank sheet to its right and still wrapped.
          *
          * A right float is the mechanism CSS already has for this: it shortens the line boxes it
          * overlaps and no others. So line one steps around the stamp and every line below it gets
          * the whole width of the paper.
          *
          * ITS HEIGHT IS ONE LINE, deliberately. `1.3em` is this paragraph's own `lineHeight`, so
          * the reserve is exactly the line that sits beside the stamp and cannot leak into the
          * next one at any projector size or any font-size change — the two cannot drift, because
          * one is written in terms of the other. Measured, the stamp's rotated box clears line
          * one's bottom by ~7px and never reaches line two.
          *
          * `34vh` is the stamp's own reach, not a round number: the pseudo-element is 292.4px wide
          * at 1600x900 and rotated -11deg, so its bounding box is 292.4·cos11 + 57.3·sin11 ≈ 298px
          * ≈ 33.1vh, and 34 clears it with a little to spare at both projector shapes.
          *
          * `textWrap: 'pretty'` REPLACES `'balance'`, which caused the very problem this comment
          * is about. `balance` equalises the lengths of ALL lines, so a question needing 1.15
          * lines was rendered as two lines at 58% width each and read as breaking early for no
          * reason. `pretty` only refuses to leave the LAST line a single orphaned word — which is
          * the actual defect it was brought in for (`ครับ?` alone under a full line) — and leaves
          * every other line to fill the width it has. Unsupported, text wraps greedily, which is
          * merely today's behaviour; there is no fallback to write.
          */}
        <p className="det-thai" style={{ fontSize: TYPE.question, lineHeight: 1.3, textWrap: 'pretty' }}>
          <span aria-hidden="true" style={{ float: 'right', width: '34vh', height: '1.3em' }} />
          {question.ask}
        </p>

        <DuckSaysLabel />

        {/*
          * THE DUCK'S ANSWER, AS A THOUGHT BUBBLE — and the two margins are the whole layout.
          *
          * `32vh` on the left is THE DUCK'S LANE, `8vh` on the bottom is the tail's headroom, and
          * the two circles run leftward along the corridor between them. Nothing here is
          * `justify`-ed against the duck, because the duck is out of the flow entirely: the lane
          * is what keeps them apart, and it has to be arithmetic rather than eye, because the two
          * are positioned from OPPOSITE edges — the duck from the sheet's floor, the bubble from
          * wherever `justify-center` leaves it.
          *
          * THE CLEARANCE IS SIDEWAYS, NOT DOWNWARD, and that is the part worth writing down. At
          * 1366x768, where 1vh = 7.68px and the sheet is at its tightest:
          *
          *   duck   — `bottom: 1.4vh` + 23vh tall, so it tops out 24.4vh above the sheet's inner
          *            floor. Its BOX ends 2.6 + 23 = 25.6vh across; its drawn art ends sooner, at
          *            viewBox x=59 of 64 — the magnifying glass — which is 2.6 + 21.2 = 23.8vh.
          *   bubble — its left edge is 32vh from the sheet's CONTENT edge, which `.det-dossier`'s
          *            own `padding: 16px 20px` already holds 20px further in.
          *
          * So the duck's head at 24.4vh and the bubble's underside at 14–18vh OVERLAP in height,
          * by design and unavoidably: the sheet is 57.7vh tall at 768 and a 12.2vh bubble cannot
          * be stacked above a 24.4vh duck inside it. The bird is beside its thought, not under it,
          * and the two never touch because 32 − 25.6 = 6.4vh (plus that 20px) of paper runs
          * between them at every height.
          *
          * THE LANE WIDENED FROM 26 TO 32 BECAUSE OF THE TAIL, not because of the bubble. At 26
          * the corridor between the magnifying glass (23.8vh) and the bubble (26vh) was 2.2vh and
          * the two circles are 5.2vh of diameter between them, so they had to be threaded past the
          * duck vertically — and `justify-center` moves the bubble 3.1vh DOWN the moment a
          * question runs to two lines, which case 09 (`einstein-fish`) does at both projector
          * shapes. Measured: at 26 the small circle landed in the middle of the magnifying glass
          * on that one case and nowhere else. At 32 the corridor is 8.2vh, both circles sit inside
          * it — 24.4→26.4vh and 27.4→30.6vh — and no bubble height can put either on the bird.
          *
          * The 8vh bottom margin is what keeps the lower circle off the sheet's bottom border.
          */}
        <div className="relative" style={{ margin: '0 0 8vh 32vh' }}>
          {/* The two tail circles, shrinking toward the duck's head — LEFTWARD and barely
              descending, because the head is beside the bubble rather than under it (see the
              arithmetic above). `aria-hidden`: they are the punctuation of the bubble, and there is
              no reading of "circle, circle" that helps anyone. */}
          <span aria-hidden="true" style={{ position: 'absolute', left: '-4.6vh', bottom: '-2.4vh', width: '3.2vh', height: '3.2vh',
                borderRadius: '50%', background: '#eef4ff', border: '0.4vh solid var(--det-cyan)' }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: '-7.6vh', bottom: '-2.8vh', width: '2vh', height: '2vh',
                borderRadius: '50%', background: '#eef4ff', border: '0.4vh solid var(--det-cyan)' }} />
          {/* NO QUOTATION MARKS. A thought bubble is already marked as speech by its own shape, and
              quote marks inside one read as the duck quoting somebody else — which is the exact
              wrong claim on a screen where the room is deciding whether the duck made it up. */}
          <p className="det-thai" style={{ background: '#eef4ff', border: '0.4vh solid var(--det-cyan)', borderRadius: '2.4vh',
                width: 'fit-content', maxWidth: '100%', padding: '3.6vh 4vh', fontSize: TYPE.answer, lineHeight: 1.35 }}>
            {question.duckSays}
          </p>
        </div>

        {/* THE DUCK, OUT OF THE FLOW, in the sheet's bottom-left corner.
            It is drawn, not typed: this was the 🦆 emoji, which renders as whatever face the
            projector laptop happens to ship — a different bird on Windows, Android and macOS — and
            on the one screen a hundred people look at, the character speaking must not change
            between venues. `components/game/Duck.tsx` is the pixel duck the rest of the game uses:
            yellow, deerstalker, magnifying glass raised.

            `absolute` is what makes 23vh affordable. At 7.4vh in the flow it was a thumbnail, and
            every pixel of it was taken out of the sentence's width; out of the flow it takes
            nothing, so the answer is as big as the back of the hall needs AND the bird is three
            times the size. */}
        <div className="absolute" style={{ left: '2.6vh', bottom: '1.4vh' }}>
          <Duck size="23vh" />
        </div>
      </Dossier>
    </div>
  )
}



/**
 * THE REVEAL, IN TWO BEATS — and the geometry is what forces it, not a preference.
 *
 * The approved artifact draws the standings as a FULL SCREEN: a 9cqh title at the top, then ten
 * rows at 8.0cqh pitch starting at 17cqh, which ends at 97cqh. That occupies the entire stage. It
 * cannot share one with a case file and a split bar in a side column, which is what this screen
 * used to be — and the artifact's own note says so in as many words: the lesson moved to the
 * middle of the screen "ส่วนอันดับย้ายไปเป็นจังหวะถัดไปแทนที่จะแย่งกันขึ้นพร้อมกัน" — the standings
 * moved to the next beat instead of competing to arrive at the same time.
 *
 * BEAT ONE is the answer: the verdict word, what the room did, the evidence, and the lesson.
 * BEAT TWO is where everyone now stands, and the HOST'S ถัดไป is what moves between them.
 *
 * THE EVIDENCE STAYS, and that is a deliberate deviation from the artifact's own sketch of beat
 * one, which draws only the verdict, the split and the teaching line and leaves the bottom half of
 * the screen empty. `question.truth` and `question.highlight` are schema-REQUIRED fields
 * (lib/types.ts documents `highlight` as "marked on the reveal") and this is their only render
 * site in the repo; dropping the sheet would orphan two fields the content the team just wrote is
 * carried in. They go in the band the sketch left empty, and the ruled teaching line moves BELOW
 * them — the artifact's note is explicit that the lesson is the last thing the room reads, and
 * putting it above the evidence would invert the reading order it was moved for.
 */
function RevealStage({
  question, split, top, rankDeltas, gains, beat,
}: {
  question: Question
  split: { pass: number; reject: number } | null
  top: LeaderboardRow[]
  rankDeltas: RankDeltas
  gains: RankDeltas
  /** Owned by `TvPage`, because the host's ถัดไป is what moves it. */
  beat: 'verdict' | 'standings'
}) {
  if (beat === 'standings' && top.length > 0) {
    return <Standings entries={top} caseOrder={question.order} deltas={rankDeltas} gains={gains} beat={question.order} />
  }

  // Case 5's shape rule, restated here: a "here's the trick" framing breaks on the one question
  // where the duck is right. The label names what the panel below is doing, not what went wrong.
  const truthLabel = question.verdict === 'reject' ? 'เป็ดพลาดตรงนี้' : 'ทำไมข้อนี้เชื่อได้'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[2vh] px-[7vh] pt-[2vh] pb-[2vh]">
      {/*
        * THE VERDICT, very large, at the top and centred — the first thing the room reads and the
        * only word on the screen that answers the question they just voted on. Thai face, NOT the
        * pixel one the artifact sets it in: Press Start 2P carries no Thai glyphs at all and
        * `ตีกลับ` would lose its vowel marks at the biggest size on the screen.
        */}
      <p
        className="det-thai shrink-0 text-center"
        style={{
          fontSize: '7.4vh',
          lineHeight: 1.1,
          color: question.verdict === 'reject' ? 'var(--det-pink)' : 'var(--det-green)',
        }}
      >
        {question.verdict === 'reject' ? 'ตีกลับ' : 'ผ่าน'}
      </p>

      {/* What the room did, full width, coloured by which side was CORRECT — see SplitBar. */}
      <div className="shrink-0">
        <SplitBar split={split} verdict={question.verdict} />
      </div>

      {/* The evidence: the duck's own sentence with the lie marked in it, and what was actually
          true. On the cream sheet, because it IS the case file's findings. */}
      {/* `paddingTop` INLINE, NOT `pt-[9vh]`. The utility that used to sit here never applied:
          `.det-dossier` is deliberately unlayered in app/globals.css and Tailwind's utilities live
          in `@layer utilities`, so at equal specificity the stylesheet wins on source order and
          every `pt-*` on this element — nine, ten, any number — was dead. The sheet has been
          rendering with `.det-dossier`'s own flat 16px all along. An inline declaration is not a
          utility and does not lose that fight.

          9vh is what the CLASSIFIED stamp needs cleared: `.det-dossier::before` pins it to the
          paper's top-right corner at -11deg, and this sheet's first line is the duck's own
          sentence with the lie marked in it — the one line on the reveal nothing may sit over. */}
      <Dossier
        className="min-h-0 flex-1"
        bodyClassName="flex min-h-0 flex-1 flex-col justify-center gap-[1.4vh]"
        bodyStyle={{ paddingTop: '9vh' }}
      >
        {/* The same `เป็ด AI ตอบว่า` label the case board carries, and it is needed MORE here: this
            sheet renders the duck's sentence with no duck, no bubble and no question above it, so
            without the label the marked-up line is an unattributed quotation the room is being
            asked to judge. The bubble and the bird deliberately do NOT come with it — this sheet
            already holds the evidence, the rule, the truth label and the truth, and its job is the
            marked-up sentence rather than the scene the sentence was said in. */}
        <DuckSaysLabel />
        <p className="det-thai" style={{ fontSize: '3.6vh', lineHeight: 1.35 }}>
          <HighlightedDuckLine text={question.duckSays} highlight={question.highlight} />
        </p>
        <hr className="det-dossier-rule" />
        <div className="det-dossier-label det-thai" style={{ fontSize: TYPE.floor }}>{truthLabel}</div>
        <p className="det-thai" style={{ fontSize: '4.2vh', lineHeight: 1.3 }}>{question.truth}</p>
      </Dossier>

      {/*
        * THE TEACHING LINE (spec §9), ruled above and below, spanning the screen, and LAST.
        *
        * It used to sit at 2.4vh in the bottom corner of the case file — the smallest thing on the
        * one screen where the lesson is supposed to land. At 4.2vh across the full width it is the
        * last thing the room reads on this screen and the only thing spanning it, which is the
        * weight a "here is how you could have caught it" line has to carry.
        */}
      <div
        className="shrink-0"
        style={{
          borderTop: '0.3vh solid rgba(255,215,0,.45)',
          borderBottom: '0.3vh solid rgba(255,215,0,.45)',
        }}
      >
        <p
          className="det-thai mx-auto max-w-6xl text-center"
          style={{ fontSize: '4.2vh', lineHeight: 1.25, padding: '1.6vh 0', color: '#ffe9a8' }}
        >
          {question.tell}
        </p>
      </div>
    </div>
  )
}

/** `highlight` is an EXACT substring of `duckSays` (enforced by lib/types.ts's QuestionSchema) —
 * "marked on the reveal", never on the question itself, which just shows the plain sentence. */
function HighlightedDuckLine({ text, highlight }: { text: string; highlight: string }) {
  const i = text.indexOf(highlight)
  if (i === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="reveal-highlight">{text.slice(i, i + highlight.length)}</mark>
      {text.slice(i + highlight.length)}
    </>
  )
}

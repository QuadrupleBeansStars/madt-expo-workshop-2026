import type { GameState, Question } from './types'
import { QUESTIONS } from '@/content/questions'

/** Play order. Everything downstream indexes into THIS, never into QUESTIONS' source order. */
export const QUESTIONS_IN_ORDER: Question[] = [...QUESTIONS].sort((a, b) => a.order - b.order)
export const QUESTION_COUNT = QUESTIONS_IN_ORDER.length

/**
 * 15s. v2 ran 45-60s windows built for four long option labels and a Case File to read; v3 has one
 * question line and one duck sentence, and the room finishes in single digits. A window longer
 * than the reading buys dead air, not thought.
 */
export const QUESTION_MS = 8_000

/**
 * The beat before the answer window opens, 10s of it. The room reads the question and the duck's
 * answer with no button to press.
 *
 * This is a PHASE, not a sub-state of `question`, and the reason is that two guarantees fall out of
 * that for free. `recordAnswer` already refuses anything arriving outside `phase === 'question'`, so
 * the server rejects an early answer without a line of new code — and to a crafted POST, not just to
 * a hidden button. And `elapsedMs` is measured from `phaseStartedAt`, so the speed-bonus clock
 * starts when answering opens. As a sub-state, every player would collect the full bonus because
 * the clock would have started ten seconds before anyone could act.
 *
 * 10s, up from v3.1's 5s. Five seconds is enough to READ a question line and a duck sentence and
 * not enough to think about either, which is the only thing this beat exists to buy.
 *
 * It ran at 12s for one pass and the team brought it back to ten: the two extra seconds bought
 * 20s across the ten cases and the room spent them waiting rather than thinking. The reading beat
 * is not where a slow question gets rescued — a question that needs longer than ten seconds to
 * take in is a question to shorten, not a clock to lengthen.
 */
/**
 * How many ranked places the standings screen carries. Five was a v3 constraint written when the
 * rows were small enough that ten would not fit; v3.2's row pitch (8.0vh under a full-size title)
 * makes ten fit with a 2.4vh gap between every pair, and ten is what the team asked for.
 *
 * Lives here, not in the component, because `app/api/stats/route.ts` slices the wire payload to
 * this number. When the two disagree the screen silently renders whichever is smaller — which is
 * exactly how v3.2 first shipped a ten-place component fed a five-row payload.
 */
export const STANDINGS_PLACES = 10

/**
 * How many lobby name cards go over the wire.
 *
 * The board is shelf-packed and holds roughly a hundred at 3.0vh, so this is deliberately a little
 * above that: the packer stops when it runs out of real gaps, and sending it slightly more than it
 * can place is what lets it fill the board rather than leaving the last shelf half empty. Sending
 * FEWER than the board can hold is the failure that matters — v3.2 first shipped a twelve-card
 * cap against a board built for a hundred, and the room saw twelve names under a counter reading
 * 100.
 *
 * The authoritative room size is `playerCount`, which is never capped.
 */
/*
 * How many arrivals /api/stats publishes for the lobby board.
 *
 * It is a WIRE cap, not a display one: the board itself now pages (app/tv/page.tsx, BOARD_PAGE), so
 * everyone in the room reaches the wall in turn — but only out of the names the route actually
 * sent. At 120 a room of 200 had eighty people who could never appear on any page. Two hundred
 * twenty-character names is a few kilobytes to the one screen that asks for them.
 */
export const LOBBY_CARDS = 400

export const READING_MS = 10_000

/**
 * 12s, and it AUTO-ADVANCES. This is the beat that makes nine rounds feel rapid instead of nine
 * separate host presses. The host's escape hatch is `toggleHold`, not a per-reveal button.
 */
/** @deprecated The reveal is untimed — kept only so a persisted v3.1 snapshot still parses. */
export const REVEAL_MS = 12_000

/**
 * Shared between the server's double-tap guard (`lib/store.ts#next`) and the client's
 * disabled-button feedback (`app/tv/page.tsx`). §3 says `Next` only does something on the three
 * untimed phases — but v3 shipped a UNIVERSAL `next` (see `nextState` above), because
 * `scripts/check-projector-fit.mjs` depends on `next` closing a QUESTION early to walk the whole
 * game without waiting out real 15s/12s clocks, and the phase machine already knows what comes
 * after any phase. Matching §3 literally was not free, so the spec was amended to describe this
 * instead (see the spec's §3 changelog note).
 *
 * That makes the double-tap hazard real on `question`/`reveal` too, not just the three untimed
 * phases — two quick presses during a reveal would skip the NEXT question's own answer window
 * entirely. The SERVER value here is the actual guarantee: a `next` inside this window of the
 * previous successful advance is a true no-op (see `MemoryRoomStore#next`). The client's disabled
 * button (same constant, imported rather than duplicated) is only feedback layered on top — it is
 * per-tab state that a refresh, a second `/tv` tab, or a slow POST silently defeats, and a laptop
 * screen plus a projector, both open, is a real configuration on the day.
 */
export const NEXT_GUARD_MS = 700

export const LOBBY_STATE: GameState = {
  phase: 'lobby', qIndex: 0, phaseStartedAt: 0, phaseDurationMs: 0, holding: false,
}

const readingState = (qIndex: number, now: number): GameState =>
  ({ phase: 'reading', qIndex, phaseStartedAt: now, phaseDurationMs: READING_MS, holding: false })

const questionState = (qIndex: number, now: number): GameState =>
  ({ phase: 'question', qIndex, phaseStartedAt: now, phaseDurationMs: QUESTION_MS, holding: false })

const untimed = (phase: GameState['phase'], qIndex: number, now: number): GameState =>
  ({ phase, qIndex, phaseStartedAt: now, phaseDurationMs: 0, holding: false })

/**
 * The rules screen, entered ONCE — `lobby` is the only phase that leads here, and `next()` cannot
 * re-enter `lobby` (see `MemoryRoomStore#next`), so "once per game" is a property of the graph
 * rather than a flag anyone has to remember to clear.
 *
 * UNTIMED (`phaseDurationMs: 0`), so `remainingMs` returns 0 and `shouldExpire` returns false for
 * it without either needing a case: the host presses Next when the room looks done reading.
 *
 * `qIndex: 0` because the game has not started; nothing renders a question here (`currentQuestion`
 * returns null off reading/question/reveal) and `isValidGameState` requires an in-range index.
 */
export function rulesState(now: number): GameState {
  return untimed('rules', 0, now)
}

/**
 * The worked example, entered ONCE, between the rules and the first case — the same shape as
 * `rulesState` above and for the same reasons: `rules` is the only phase that leads here and
 * nothing leads back, so "once per game" is a property of the graph rather than a flag.
 *
 * UNTIMED. It is the one screen in the game where the host can stand and point at things, which
 * is the whole reason it is a screen and not a paragraph on the rules sheet.
 *
 * `qIndex: 0` because the game has not started. The example it draws is `content/tutorial.ts`'s
 * `TUTORIAL_CASE`, which is NOT in `QUESTIONS_IN_ORDER` — `currentQuestion` returns null here, so
 * no real case can leak onto this screen and be spent before the room reaches it.
 */
export function tutorialState(now: number): GameState {
  return untimed('tutorial', 0, now)
}

/**
 * The state question 0 opens in — which is now exactly what `rules` advances to, not what leaving
 * the lobby produces. `startGame` puts the room on `rules` first.
 */
export function startedState(now: number): GameState {
  return readingState(0, now)
}

/**
 * The successor of any phase. ONE function, used by both the host's Next and the lazy expiry tick,
 * so a timed advance and a host advance can never disagree about what comes next.
 */
export function nextState(s: GameState, now: number): GameState {
  switch (s.phase) {
    case 'lobby':
      return rulesState(now)
    // The ONLY edge out of `rules`, and nothing leads back into it: every later question reaches
    // `reading` from `reveal` below, so the room sees these two screens once.
    case 'rules':
      return tutorialState(now)
    case 'tutorial':
      return startedState(now)
    case 'reading':
      return questionState(s.qIndex, now)
    case 'question':
      // UNTIMED, like `rules`. The reveal carries the verdict, then the standings on a second
      // press; a clock that took the screen away mid-explanation was the host fighting the room.
      return untimed('reveal', s.qIndex, now)
    /* NO ACT CARD. A summary closed every third question and the team cut it: the reveal already
       explains the case it belongs to, and a fourth screen between one question and the next was
       three more stops in a game the room is meant to move through. The lesson lands on the reveal
       and again on the closing tally. */
    case 'reveal': {
      const next = s.qIndex + 1
      if (next >= QUESTION_COUNT) return untimed('tally', s.qIndex, now)
      return readingState(next, now)
    }
    case 'tally':
      return untimed('podium', s.qIndex, now)
    case 'podium':
      return s
  }
}

/** Reading and question are the only phases with a clock now; everything else is a host press. */
export function remainingMs(s: GameState, now: number): number {
  if (s.phase !== 'reading' && s.phase !== 'question') return 0
  return Math.max(0, s.phaseStartedAt + s.phaseDurationMs - now)
}

/**
 * `activeCount` and `answeredCount` are still taken, and are deliberately unused.
 *
 * A QUESTION NOW RUNS ITS FULL WINDOW — the "everyone has answered, move on" early exit was
 * removed. It rewarded the fastest thumbs in the room with a shorter question for everyone else:
 * a player still weighing the duck's answer would have the screen pulled out from under them
 * because ninety-nine people had already tapped, and the reading beat right before it exists to
 * buy exactly that thinking time. The clock is now the only thing that ends a question, so every
 * player gets the same window whatever the room does around them.
 *
 * The host keeps the escape hatch: `next` closes a question immediately from the projector, which
 * is also how `scripts/check-projector-fit.mjs` walks the game without waiting out real clocks.
 * The two arguments stay in the signature because the store already has both counts to hand and
 * removing them would churn every call site for a behaviour that has been reverted once already.
 */
export function shouldExpire(s: GameState, now: number, _activeCount: number, _answeredCount: number): boolean {
  // Reading ends on its clock and only on its clock. There is nothing to answer, so an
  // "everyone has answered" early exit would fire immediately on a room that answered the
  // PREVIOUS question — `answeredCount` is not reset between phases.
  if (s.phase === 'reading') return now >= s.phaseStartedAt + s.phaseDurationMs
  if (s.phase === 'question') return now >= s.phaseStartedAt + s.phaseDurationMs
  // No reveal branch: the reveal is untimed and leaves only on a host press, so nothing here can
  // take it away while the host is still talking over it.
  return false
}

export function currentQuestion(s: GameState): Question | null {
  if (s.phase !== 'reading' && s.phase !== 'question' && s.phase !== 'reveal') return null
  return QUESTIONS_IN_ORDER[s.qIndex] ?? null
}


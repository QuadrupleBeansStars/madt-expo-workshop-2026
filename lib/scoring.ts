import type { Answer, Question } from './types'
import { QUESTION_COUNT, QUESTION_MS } from './game'

/**
 * Every question is worth the same. v2 had per-case difficulty tiers; v3 carries difficulty in the
 * ACT structure instead, and a second difficulty axis on top of that buys nothing but bookkeeping.
 */
export const BASE_POINTS = 100

/**
 * Speed is a TIEBREAKER ONLY.
 *
 * INVARIANT (enforced by test): QUESTION_COUNT * MAX_SPEED_BONUS < BASE_POINTS.
 * 9 * 10 = 90 < 100 — so even a perfect speed run cannot out-score one extra correct answer.
 * A workshop that teaches people not to trust snap judgments must not reward snap judgments.
 */
export const MAX_SPEED_BONUS = 10

/**
 * The anti-guess mechanic. Two buttons means a coin-flipper is right half the time; points alone
 * cannot tell thinking from flipping, and a run of correct answers can.
 *
 * A BONUS, NOT A MULTIPLIER. This was `BASE_POINTS * min(streak, 3)` — 100 / 200 / 300 — so one
 * lucky run was worth triple and could carry a whole board by itself. Measured against the current
 * answer key, dropping the multiplier costs almost nothing: a player tapping ตีกลับ nine times
 * takes 70% of a perfect game under this scheme against 67% under the multiplier. The separation
 * never came from the steepness — it comes from the KEY (content/questions.ts, whose two จริง cases
 * are what a guesser trips on) — and paying triple for it only made a single streak louder than the
 * nine decisions around it.
 *
 * A streak is now worth at most DOUBLE a plain correct answer: three tiers a rules screen can
 * state and a room can hold in its head. A third จริง case remains the real fix for the guessing
 * floor; the arithmetic is on the always-reject test in `scoring.test.ts`.
 */
export const STREAK_STEP = 50
export const MAX_STREAK_BONUS = 100

/** @param streak consecutive correct answers INCLUDING the one being scored. 0 for the first. */
export function streakBonus(streak: number): number {
  if (streak < 2) return 0
  return Math.min((streak - 1) * STREAK_STEP, MAX_STREAK_BONUS)
}

/**
 * Soft target: answering slower than one full question window earns no bonus, and is never
 * punished. Pinned to QUESTION_MS rather than written as a literal — a retune of the question
 * window must move this with it, or the bonus range silently collapses.
 */
const SPEED_TARGET_MS = QUESTION_MS

export function speedBonus(elapsedMs: number): number {
  // elapsedMs is derived from server state, but clamp anyway: the invariant depends on the range.
  const clamped = Math.max(0, elapsedMs)
  const remaining = SPEED_TARGET_MS - clamped
  if (remaining <= 0) return 0
  return Math.round(MAX_SPEED_BONUS * (remaining / SPEED_TARGET_MS))
}

/** Three additive parts — base, streak, speed. Nothing multiplies anything. */
export function scoreAnswer(correct: boolean, streakAfter: number, elapsedMs: number): number {
  if (!correct) return 0
  return BASE_POINTS + streakBonus(streakAfter) + speedBonus(elapsedMs)
}

export type PlayerScore = {
  total: number
  /** Approved an answer that should have been rejected. The room tally sums these (spec §4e). */
  wrongPass: number
  correct: number
  /** The streak standing at the end of the walk — what the phone shows live. */
  streak: number
  /**
   * Per-question outcome, keyed by questionId — ADDITIVE to the walk above, not a second one.
   * A questionId is present only if the player actually answered it: absence is how a caller
   * distinguishes "never answered" (spectator, or the window closed before they tapped) from
   * "answered and was wrong" ({correct:false, points:0}), which is exactly the 3-way distinction
   * PublicGameState.you.lastCorrect/lastPoints needs (spec §5b) — the phone's reveal has to
   * survive a reload, and "wrong" must not collapse into the same UI branch as "timed out".
   */
  perQuestion: Record<string, { correct: boolean; points: number }>
}

/**
 * One player's whole game, in one pass.
 *
 * MUST walk `questionsInOrder`, not the answer array: the streak is a property of the play
 * sequence, and a missing answer has to break the streak exactly like a wrong one does. Iterating
 * the answers instead would silently carry a streak across a question the player never answered.
 *
 * Precondition: all answers belong to one player. Callers filter first.
 */
export function scorePlayer(answers: Answer[], questionsInOrder: Question[]): PlayerScore {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]))
  let total = 0
  let streak = 0
  let wrongPass = 0
  let correctCount = 0
  const perQuestion: PlayerScore['perQuestion'] = {}

  for (const q of questionsInOrder) {
    const a = byQuestion.get(q.id)
    if (!a) {
      streak = 0
      continue // no perQuestion entry — see the field's doc comment
    }
    if (q.verdict === 'reject' && a.verdict === 'pass') wrongPass++
    const correct = a.verdict === q.verdict
    if (!correct) {
      streak = 0
      perQuestion[q.id] = { correct: false, points: 0 }
      continue
    }
    streak++
    correctCount++
    const points = scoreAnswer(true, streak, a.elapsedMs)
    total += points
    perQuestion[q.id] = { correct: true, points }
  }

  return { total, wrongPass, correct: correctCount, streak, perQuestion }
}

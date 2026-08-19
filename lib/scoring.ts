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
 * cannot tell thinking from flipping. Streaks can: P(3 correct in a row by guessing) is 12.5%,
 * and the answer key is arranged so an always-reject player never gets three in a row at all
 * (content/questions.test.ts).
 */
export const MAX_STREAK_MULTIPLIER = 3

/** @param streak consecutive correct answers INCLUDING the one being scored. */
export function streakMultiplier(streak: number): number {
  if (streak < 1) return 1
  return Math.min(streak, MAX_STREAK_MULTIPLIER)
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

/** The speed bonus is added AFTER the multiplier, never multiplied by it. See MAX_SPEED_BONUS. */
export function scoreAnswer(correct: boolean, streakAfter: number, elapsedMs: number): number {
  if (!correct) return 0
  return BASE_POINTS * streakMultiplier(streakAfter) + speedBonus(elapsedMs)
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

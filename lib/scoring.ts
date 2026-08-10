import type { Answer, Difficulty } from './types'
import { MAX_ROUND_DURATION_MS } from './game'
import { getCase } from '@/content/cases'

/** Harder cases are worth more. The smallest value here bounds MAX_SPEED_BONUS — see below. */
export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 150,
  hard: 200,
  expert: 250,
  final: 300,
}

/**
 * Speed is a TIEBREAKER ONLY.
 *
 * Invariant (enforced by test): 5 * MAX_SPEED_BONUS < min(BASE_POINTS).
 * 5 * 15 = 75 < 100. So even a perfectly fast player can never out-score a
 * slower player who got one more case right. A workshop that teaches people
 * not to trust snap judgments must not reward snap judgments.
 *
 * To make the leaderboard more aggressive, raise this — but keep the invariant.
 */
export const MAX_SPEED_BONUS = 15

/**
 * Soft target per case. Answering slower than this simply earns no bonus — it is never punished.
 *
 * Pinned to the longest round rather than written as a literal. It was a standalone 90_000, which
 * silently stopped matching anything when the rounds were shortened to the 45-60s band: with the
 * longest question at 60s, no answer could ever be slow enough to score zero, so the bonus range
 * collapsed from [0,15] to [5,15] and the tiebreaker lost a third of its resolution.
 */
const SPEED_TARGET_MS = MAX_ROUND_DURATION_MS

export function speedBonus(elapsedMs: number): number {
  // elapsedMs is client-reported (untrusted): clock skew, replays, and tampering
  // can all send negative values. Clamp the input so the bonus is always
  // within [0, MAX_SPEED_BONUS], which THE INVARIANT depends on.
  const clampedElapsedMs = Math.max(0, elapsedMs)
  const remaining = SPEED_TARGET_MS - clampedElapsedMs
  if (remaining <= 0) return 0
  return Math.round(MAX_SPEED_BONUS * (remaining / SPEED_TARGET_MS))
}

export function scoreAnswer(difficulty: Difficulty, correct: boolean, elapsedMs: number): number {
  if (!correct) return 0
  return BASE_POINTS[difficulty] + speedBonus(elapsedMs)
}

/** Keep only the last answer per caseId (last-write-wins, matching the store's playerId:caseId keying). */
function dedupeByCase(answers: Answer[]): Answer[] {
  const lastByCaseId = new Map<string, Answer>()
  for (const a of answers) lastByCaseId.set(a.caseId, a)
  return [...lastByCaseId.values()]
}

/**
 * Total score for ONE player's answers.
 *
 * Precondition: every answer belongs to the same player — caseId is deduped
 * without regard to playerId, so a mixed-player array would silently collapse
 * different players' answers to the same case. Callers must filter by player first.
 *
 * @throws Error if answers contain more than one distinct playerId
 */
export function totalScore(answers: Answer[]): number {
  // Validate precondition: all answers must belong to the same player
  const playerIds = new Set(answers.map((a) => a.playerId))
  if (playerIds.size > 1) {
    throw new Error(`totalScore requires all answers to belong to a single player, but got ${playerIds.size} distinct players`)
  }

  return dedupeByCase(answers).reduce((sum, a) => {
    const c = getCase(a.caseId)
    if (!c) return sum
    const correct = c.options.some((o) => o.id === a.optionId && o.correct)
    return sum + scoreAnswer(c.difficulty, correct, a.elapsedMs)
  }, 0)
}

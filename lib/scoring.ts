import type { Answer, Difficulty } from './types'
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

/** Soft target per case. Answering slower than this simply earns no bonus — it is never punished. */
const SPEED_TARGET_MS = 90_000

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

export function totalScore(answers: Answer[]): number {
  return dedupeByCase(answers).reduce((sum, a) => {
    const c = getCase(a.caseId)
    if (!c) return sum
    const correct = c.options.some((o) => o.id === a.optionId && o.correct)
    return sum + scoreAnswer(c.difficulty, correct, a.elapsedMs)
  }, 0)
}

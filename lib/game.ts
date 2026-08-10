import type { Difficulty, DetectiveCase, GameState } from './types'
import { CASES } from '@/content/cases'

/** The rounds in play order (cases sorted by `order`). Round index is an index into this. */
export const ROUNDS: DetectiveCase[] = [...CASES].sort((a, b) => a.order - b.order)
export const ROUND_COUNT = ROUNDS.length

/**
 * The thinking window per case.
 *
 * Was 75s/90s, built on "generous, never a race" (spec §4). The 3 Aug run-through overturned
 * that: the room finished the easy cases well inside a minute and then sat watching a clock, so
 * the generous window bought dead air, not thought. The team's number is 45-60s and these are it.
 *
 * Two things make the shorter window safe, and both must stay true:
 *   - `shouldExpire` already flips early once every active player has answered, so a fast room
 *     never waits out the clock anyway. This ceiling only binds on a slow one.
 *   - The host can now end a question by hand (`revealNow`), so a room that visibly needs longer
 *     is a judgement call rather than a constant.
 *
 * `hard`/`expert`/`final` keep the top of the band: those cases carry more evidence to read.
 */
const DURATION_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 45_000,
  medium: 50_000,
  hard: 60_000,
  expert: 60_000,
  final: 60_000,
}
export function roundDurationMs(difficulty: Difficulty): number {
  return DURATION_BY_DIFFICULTY[difficulty]
}

/**
 * The longest any single question can run. Exported because `lib/scoring.ts` scales the speed
 * bonus over it: a target longer than the round would mean the bonus never decays to zero before
 * the question closes, so every answer collects some of it and the tiebreaker stops discriminating.
 * Derived, not written down twice — retuning the durations above must move this with them.
 */
export const MAX_ROUND_DURATION_MS = Math.max(...Object.values(DURATION_BY_DIFFICULTY))

export const LOBBY_STATE: GameState = { phase: 'lobby', roundIndex: 0, phaseStartedAt: 0, phaseDurationMs: 0 }

/** Server-authoritative time left; 0 outside investigate. Never derived on a client. */
export function remainingMs(s: GameState, now: number): number {
  if (s.phase !== 'investigate') return 0
  return Math.max(0, s.phaseStartedAt + s.phaseDurationMs - now)
}

export function startedState(now: number): GameState {
  return { phase: 'investigate', roundIndex: 0, phaseStartedAt: now, phaseDurationMs: roundDurationMs(ROUNDS[0].difficulty) }
}

export function revealState(s: GameState, now: number): GameState {
  return { phase: 'reveal', roundIndex: s.roundIndex, phaseStartedAt: now, phaseDurationMs: 0 }
}

export function nextState(s: GameState, now: number): GameState {
  const next = s.roundIndex + 1
  if (next >= ROUND_COUNT) {
    return { phase: 'final', roundIndex: s.roundIndex, phaseStartedAt: now, phaseDurationMs: 0 }
  }
  return { phase: 'investigate', roundIndex: next, phaseStartedAt: now, phaseDurationMs: roundDurationMs(ROUNDS[next].difficulty) }
}

/** Whether the current investigate phase should flip to reveal now. */
export function shouldExpire(s: GameState, now: number, activeCount: number, answeredCount: number): boolean {
  if (s.phase !== 'investigate') return false
  if (now >= s.phaseStartedAt + s.phaseDurationMs) return true
  if (activeCount > 0 && answeredCount >= activeCount) return true
  return false
}

export function currentCaseId(s: GameState): string | null {
  if (s.phase === 'investigate' || s.phase === 'reveal') return ROUNDS[s.roundIndex]?.id ?? null
  return null
}

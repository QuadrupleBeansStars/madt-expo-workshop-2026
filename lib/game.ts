import type { Difficulty, DetectiveCase, GameState } from './types'
import { CASES } from '@/content/cases'

/** The rounds in play order (cases sorted by `order`). Round index is an index into this. */
export const ROUNDS: DetectiveCase[] = [...CASES].sort((a, b) => a.order - b.order)
export const ROUND_COUNT = ROUNDS.length

/** Generous "read the evidence and think" windows — never a race. See spec §4. */
const DURATION_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 75_000,
  medium: 75_000,
  hard: 90_000,
  expert: 90_000,
  final: 90_000,
}
export function roundDurationMs(difficulty: Difficulty): number {
  return DURATION_BY_DIFFICULTY[difficulty]
}

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

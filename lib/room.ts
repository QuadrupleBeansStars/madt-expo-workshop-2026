// Café Persona — the host-driven stage machine. lobby → (ask → reveal) × N → done(result).
// Pure functions only: no I/O, no Math.random(), `now` always passed in. The store is the only
// caller that touches Date.now().

import { QUESTIONS } from '@/content/persona'
import type { Question } from './room-types'

export type SeqStage = { kind: 'ask' | 'reveal'; questionIndex: number }

export const SEQUENCE: SeqStage[] = QUESTIONS.flatMap((_, i) => [
  { kind: 'ask' as const, questionIndex: i },
  { kind: 'reveal' as const, questionIndex: i },
])
export const STAGE_COUNT = SEQUENCE.length

/**
 * How long a decision stays open.
 *
 * FORTY-FIVE SECONDS, up from thirty. Thirty was set while this countdown was purely decorative — the
 * spec called it a soft nudge and voting closed only when the host advanced — so running out cost
 * nobody anything. It is not decorative any more: `app/biz/page.tsx` closes the vote and moves the
 * room to the reveal when this reaches zero, and at thirty seconds a table still reading the
 * chart when the clock started was answering a question it had not finished.
 *
 * IT IS THE WHOLE OF THE ROOM'S FORCED CLOCK. Eight decisions at forty-five seconds each is 6:00,
 * and every other screen in this workshop waits for the host — so this constant is the one number
 * that decides how much of a session the room spends deciding rather than listening. Changing it
 * moves the run sheet by EIGHT TIMES whatever you change it by: the thirty-second version cost
 * 4:00, the sixty-second one 8:00.
 *
 * The store does NOT enforce it: `askOpen()` stays true past this and the server accepts a vote
 * right up to the moment the stage actually advances, so a phone that was mid-tap when the clock
 * hit zero is not punished for a round trip.
 */
export const ASK_MS = 45_000

export interface RoomState {
  /** `'done'` IS the result screen — the 2×2 map / persona cards. */
  phase: 'lobby' | 'stage' | 'done'
  stageIndex: number
  stageStartedAt: number
  /** Kept for snapshot-shape compatibility; always null in this game (no early close). */
  votingClosedAt: number | null
}

export const LOBBY_STATE: RoomState = {
  phase: 'lobby', stageIndex: 0, stageStartedAt: 0, votingClosedAt: null,
}

export function currentStage(state: RoomState): SeqStage | null {
  if (state.phase !== 'stage') return null
  return SEQUENCE[state.stageIndex] ?? null
}

export function currentQuestion(state: RoomState): Question | null {
  const stage = currentStage(state)
  if (!stage) return null
  return QUESTIONS[stage.questionIndex] ?? null
}

/** Votes are accepted exactly while the current stage is an `ask` — regardless of the clock. */
export function askOpen(state: RoomState): boolean {
  return currentStage(state)?.kind === 'ask'
}

/** Display only. 0 on reveal/lobby/done; never negative. The server owns the clock. */
export function remainingMs(state: RoomState, now: number): number {
  const stage = currentStage(state)
  if (!stage || stage.kind !== 'ask') return 0
  return Math.max(0, state.stageStartedAt + ASK_MS - now)
}

/** The host's forward lever. lobby → stage 0; last stage → done; done is terminal. */
export function advance(state: RoomState, now: number): RoomState {
  if (state.phase === 'done') return state
  if (state.phase === 'lobby') {
    return { phase: 'stage', stageIndex: 0, stageStartedAt: now, votingClosedAt: null }
  }
  const next = state.stageIndex + 1
  if (next >= STAGE_COUNT) {
    return { phase: 'done', stageIndex: state.stageIndex, stageStartedAt: now, votingClosedAt: null }
  }
  return { phase: 'stage', stageIndex: next, stageStartedAt: now, votingClosedAt: null }
}

/**
 * The host's rescue lever (a mis-tap in front of a room). done → last stage; stage 0 → lobby;
 * lobby stays. Restarts the stage clock — a re-entered ask gets its full soft countdown.
 * Safe with votes: answers key by question id and are never erased by navigation.
 */
export function back(state: RoomState, now: number): RoomState {
  if (state.phase === 'lobby') return state
  if (state.phase === 'done') {
    return { phase: 'stage', stageIndex: STAGE_COUNT - 1, stageStartedAt: now, votingClosedAt: null }
  }
  if (state.stageIndex === 0) return { ...LOBBY_STATE }
  return { phase: 'stage', stageIndex: state.stageIndex - 1, stageStartedAt: now, votingClosedAt: null }
}

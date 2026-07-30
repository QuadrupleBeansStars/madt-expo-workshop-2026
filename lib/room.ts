// The Decision Room — the host-driven stage machine.
//
// One host-driven sequence of typed stages (spec §2, lib/room-types.ts). This module is the pure
// state machine behind it: which stage is current, how much time is left, whether phones may
// vote. It is deliberately modelled on lib/deck.ts's host-advance and clock logic, adapted to the
// Stage union built in content/room.ts — see that file's header for why this workshop has no
// language toggle and no auto-advance.
//
// Pure functions only: no I/O, no persistence, no Math.random(), and `now` is always passed in —
// never read from the wall clock in here. The store (Task 6) is the only caller that touches
// Date.now().

import { STAGES } from '@/content/room'
import type { DecideStage, Stage } from './room-types'

export const STAGE_COUNT = STAGES.length

export interface RoomState {
  phase: 'lobby' | 'stage' | 'done'
  stageIndex: number
  stageStartedAt: number
  /** Set by an explicit early host close. Shuts voting immediately, regardless of the timer. */
  votingClosedAt: number | null
}

export const LOBBY_STATE: RoomState = {
  phase: 'lobby', stageIndex: 0, stageStartedAt: 0, votingClosedAt: null,
}

export function currentStage(state: RoomState): Stage | null {
  if (state.phase !== 'stage') return null
  return STAGES[state.stageIndex] ?? null
}

/**
 * The stage union has no shared `options` field, so this MUST be a type predicate rather than a
 * boolean — a boolean return fails to narrow and breaks every call site that reads
 * `stage.options` after checking it. This exact mistake cost a full review cycle on the previous
 * build (lib/deck.ts's equivalent).
 */
export function acceptsVotes(stage: Stage): stage is DecideStage {
  return stage.kind === 'decide'
}

function durationOf(stage: Stage): number {
  return acceptsVotes(stage) ? stage.durationMs : 0
}

/**
 * Voting is open while the current stage accepts votes, the host has not closed it early, and the
 * stage's own timer has not elapsed. The timer closes voting only — it never advances the stage.
 * Advancing is always an explicit host action via `advance`. The boundary is exclusive: at exactly
 * `stageStartedAt + durationMs`, voting is closed.
 */
export function votingOpen(state: RoomState, now: number): boolean {
  const stage = currentStage(state)
  if (!stage || !acceptsVotes(stage)) return false
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return false
  return now < state.stageStartedAt + durationOf(stage)
}

/**
 * The server owns the clock: this derives from `stageStartedAt + durationMs` and is never
 * computed on a client. Returns 0 for any stage kind that has no timer, and 0 once voting has
 * closed (early or by timer) — never negative.
 */
export function remainingMs(state: RoomState, now: number): number {
  const stage = currentStage(state)
  if (!stage || !acceptsVotes(stage)) return 0
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return 0
  return Math.max(0, state.stageStartedAt + durationOf(stage) - now)
}

/**
 * The only way the stage index moves. From lobby it starts the sequence at stage 0; from the last
 * stage it moves to `done`; from `done` it is a no-op. Never called by a timer — only the host's
 * key press reaches this function (spec design rule #2).
 */
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

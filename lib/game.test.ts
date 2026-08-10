import { describe, expect, it } from 'vitest'
import {
  ROUNDS, ROUND_COUNT, roundDurationMs, LOBBY_STATE,
  remainingMs, startedState, revealState, nextState, shouldExpire, currentCaseId,
} from './game'
import type { GameState } from './types'

describe('game logic', () => {
  it('ROUNDS is the 5 cases sorted by order', () => {
    expect(ROUND_COUNT).toBe(5)
    expect(ROUNDS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  // The team's requirement after the 3 Aug run-through is a BAND (45-60s per question), not five
  // specific numbers — so that is what this asserts. Retuning inside the band is a free change;
  // drifting back out of it, in either direction, fails here.
  it('every round runs inside the 45-60s band the room asked for', () => {
    for (const d of ['easy', 'medium', 'hard', 'expert', 'final'] as const) {
      expect(roundDurationMs(d)).toBeGreaterThanOrEqual(45_000)
      expect(roundDurationMs(d)).toBeLessThanOrEqual(60_000)
    }
  })

  it('harder cases are never given less time than easier ones', () => {
    const order = ['easy', 'medium', 'hard', 'expert', 'final'] as const
    const durations = order.map(roundDurationMs)
    expect([...durations].sort((a, b) => a - b)).toEqual(durations)
  })

  it('remainingMs counts down only during investigate and never goes negative', () => {
    const s: GameState = { phase: 'investigate', roundIndex: 0, phaseStartedAt: 1000, phaseDurationMs: 75_000 }
    expect(remainingMs(s, 1000)).toBe(75_000)
    expect(remainingMs(s, 31_000)).toBe(45_000)
    expect(remainingMs(s, 999_999)).toBe(0)
    expect(remainingMs(LOBBY_STATE, 5)).toBe(0)
    expect(remainingMs(revealState(s, 2000), 9999)).toBe(0)
  })

  it('startedState opens round 0 in investigate with the round-0 duration', () => {
    const s = startedState(5000)
    expect(s.phase).toBe('investigate')
    expect(s.roundIndex).toBe(0)
    expect(s.phaseStartedAt).toBe(5000)
    expect(s.phaseDurationMs).toBe(roundDurationMs(ROUNDS[0].difficulty))
  })

  it('nextState advances reveal → next investigate, then → final after the last round', () => {
    let s: GameState = revealState(startedState(0), 100)
    for (let i = 1; i < ROUND_COUNT; i++) {
      s = nextState(s, 200)
      expect(s.phase).toBe('investigate')
      expect(s.roundIndex).toBe(i)
    }
    s = nextState(s, 300) // from reveal of last round conceptually
    expect(s.phase).toBe('final')
  })

  it('shouldExpire fires on timeout OR when all active players answered', () => {
    const s: GameState = { phase: 'investigate', roundIndex: 0, phaseStartedAt: 0, phaseDurationMs: 75_000 }
    expect(shouldExpire(s, 10_000, 20, 5)).toBe(false)   // time left, not all answered
    expect(shouldExpire(s, 80_000, 20, 5)).toBe(true)    // timed out
    expect(shouldExpire(s, 10_000, 20, 20)).toBe(true)   // everyone answered early
    expect(shouldExpire(s, 10_000, 0, 0)).toBe(false)    // nobody active → don't auto-close
    expect(shouldExpire(revealState(s, 0), 999_999, 20, 20)).toBe(false) // only investigate expires
  })

  it('currentCaseId is the round case in investigate/reveal, null otherwise', () => {
    expect(currentCaseId(LOBBY_STATE)).toBeNull()
    expect(currentCaseId(startedState(0))).toBe(ROUNDS[0].id)
    expect(currentCaseId({ phase: 'final', roundIndex: 4, phaseStartedAt: 0, phaseDurationMs: 0 })).toBeNull()
  })
})

import { describe, it, expect } from 'vitest'
import { BASE_POINTS, MAX_SPEED_BONUS, speedBonus, scoreAnswer, totalScore } from './scoring'
import type { Answer } from './types'

describe('speedBonus', () => {
  it('awards the max bonus for an instant answer', () => {
    expect(speedBonus(0)).toBe(MAX_SPEED_BONUS)
  })
  it('awards zero once the soft target has elapsed', () => {
    expect(speedBonus(90_000)).toBe(0)
    expect(speedBonus(500_000)).toBe(0)
  })
  it('never returns a negative bonus', () => {
    expect(speedBonus(10_000_000)).toBeGreaterThanOrEqual(0)
  })
  it('clamps a large negative elapsedMs (clock skew / tampering) to exactly MAX_SPEED_BONUS', () => {
    expect(speedBonus(-900_000)).toBe(MAX_SPEED_BONUS)
  })
  it('is always within [0, MAX_SPEED_BONUS] across a spread of inputs', () => {
    const inputs = [-10_000_000, -900_000, -1, 0, 1, 45_000, 89_999, 90_000, 90_001, 500_000, 10_000_000]
    for (const ms of inputs) {
      const bonus = speedBonus(ms)
      expect(bonus).toBeGreaterThanOrEqual(0)
      expect(bonus).toBeLessThanOrEqual(MAX_SPEED_BONUS)
    }
  })
})

describe('scoreAnswer', () => {
  it('awards nothing at all for a wrong answer, no matter how fast', () => {
    expect(scoreAnswer('final', false, 0)).toBe(0)
  })
  it('awards base + bonus for a correct answer', () => {
    expect(scoreAnswer('easy', true, 0)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })
  it('awards harder cases more base points, strictly increasing easy < medium < hard < expert < final', () => {
    expect(BASE_POINTS.easy).toBeLessThan(BASE_POINTS.medium)
    expect(BASE_POINTS.medium).toBeLessThan(BASE_POINTS.hard)
    expect(BASE_POINTS.hard).toBeLessThan(BASE_POINTS.expert)
    expect(BASE_POINTS.expert).toBeLessThan(BASE_POINTS.final)
  })
})

describe('THE INVARIANT: speed can only ever break a tie', () => {
  it('the maximum total speed bonus is strictly less than the smallest base score', () => {
    const maxTotalBonus = 5 * MAX_SPEED_BONUS
    const minBase = Math.min(...Object.values(BASE_POINTS))
    expect(maxTotalBonus).toBeLessThan(minBase)
  })

  it('a slow player with one more correct answer always beats a fast player with fewer', () => {
    // Fast player: 4 correct, instantly, on the HARDEST cases.
    const fast = ['medium', 'hard', 'expert', 'final'] as const
    const fastScore = fast.reduce((s, d) => s + scoreAnswer(d, true, 0), 0)

    // Slow player: those same 4, maximally slow, PLUS the easiest case.
    const slowScore =
      fast.reduce((s, d) => s + scoreAnswer(d, true, 999_999), 0) +
      scoreAnswer('easy', true, 999_999)

    expect(slowScore).toBeGreaterThan(fastScore)
  })
})

describe('totalScore', () => {
  it('sums scored answers, ignoring answers to unknown cases', () => {
    const answers: Answer[] = [
      { playerId: 'p1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct
      { playerId: 'p1', caseId: 'olympics', optionId: 'ai-correct', elapsedMs: 0 }, // wrong
      { playerId: 'p1', caseId: 'ghost', optionId: 'x', elapsedMs: 0 },             // unknown case
    ]
    expect(totalScore(answers)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })

  it('scores a case only once even if answered twice, and the LAST answer wins', () => {
    const first: Answer[] = [
      { playerId: 'p1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 }, // correct
      { playerId: 'p1', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // wrong, overwrites
    ]
    expect(totalScore(first)).toBe(0)

    const second: Answer[] = [
      { playerId: 'p1', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // wrong
      { playerId: 'p1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 }, // correct, overwrites
    ]
    expect(totalScore(second)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })
})

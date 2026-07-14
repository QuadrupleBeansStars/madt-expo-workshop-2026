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
})

describe('scoreAnswer', () => {
  it('awards nothing at all for a wrong answer, no matter how fast', () => {
    expect(scoreAnswer('final', false, 0)).toBe(0)
  })
  it('awards base + bonus for a correct answer', () => {
    expect(scoreAnswer('easy', true, 0)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })
  it('awards harder cases more base points', () => {
    expect(BASE_POINTS.final).toBeGreaterThan(BASE_POINTS.easy)
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
})

import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'
import type { Player, Answer } from './types'

const p = (id: string, codename: string): Player => ({ id, codename, joinedAt: 0 })

describe('computeStats', () => {
  it('counts detectives', () => {
    const stats = computeStats([p('1', 'A'), p('2', 'B')], [])
    expect(stats.detectives).toBe(2)
  })

  it('counts a player as finished only when all 5 cases are answered', () => {
    const answers: Answer[] = ['artemis', 'olympics', 'citation', 'novabrew'].map((caseId) => ({
      playerId: '1', caseId, optionId: 'x', elapsedMs: 0,
    }))
    expect(computeStats([p('1', 'A')], answers).finished).toBe(0)

    answers.push({ playerId: '1', caseId: 'goblinshark', optionId: 'ai-correct', elapsedMs: 0 })
    expect(computeStats([p('1', 'A')], answers).finished).toBe(1)
  })

  it('computes % fooled per case — a wrong pick counts as fooled', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct
      { playerId: '2', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // fooled
    ]
    const stat = computeStats([p('1', 'A'), p('2', 'B')], answers).caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(2)
    expect(stat.fooled).toBe(1)
    expect(stat.fooledPct).toBe(50)
  })

  it('reports 0% fooled for a case nobody has answered (never NaN)', () => {
    const stat = computeStats([], []).caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(0)
    expect(stat.fooledPct).toBe(0)
  })

  it('returns all 5 cases in play order', () => {
    expect(computeStats([], []).caseStats.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('ranks the leaderboard by score, highest first', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },       // A: correct (easy)
      { playerId: '2', caseId: 'goblinshark', optionId: 'ai-correct', elapsedMs: 0 }, // B: correct (final, worth more)
    ]
    const board = computeStats([p('1', 'A'), p('2', 'B')], answers).leaderboard
    expect(board[0].codename).toBe('B')
    expect(board[0].correct).toBe(1)
    expect(board[1].codename).toBe('A')
    expect(board[0].score).toBeGreaterThan(board[1].score)
  })
})

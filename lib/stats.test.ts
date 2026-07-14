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

  it('does not count a player as finished from 5 duplicate answers to the same case', () => {
    const answers: Answer[] = Array.from({ length: 5 }, (_, i) => ({
      playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: i,
    }))
    expect(computeStats([p('1', 'A')], answers).finished).toBe(0)
  })

  it('counts a player as finished once they have answered 5 distinct cases, even with a duplicate', () => {
    const answers: Answer[] = ['artemis', 'artemis', 'olympics', 'citation', 'novabrew', 'goblinshark'].map((caseId, i) => ({
      playerId: '1', caseId, optionId: caseId === 'goblinshark' ? 'ai-correct' : 'x', elapsedMs: i,
    }))
    expect(computeStats([p('1', 'A')], answers).finished).toBe(1)
  })

  it('counts a double-submitted case once in answered, and does not inflate fooledPct', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct, first write
      { playerId: '1', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 1 }, // fooled, last write wins
    ]
    const stat = computeStats([p('1', 'A')], answers).caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(1)
    expect(stat.fooled).toBe(1)
    expect(stat.fooledPct).toBe(100)
  })

  it('leaderboard correct count agrees with score when a duplicate correct submission is present (last-write-wins, not double-counted)', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 }, // correct, first write
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 1 }, // correct, identical resubmission
    ]
    const row = computeStats([p('1', 'A')], answers).leaderboard[0]
    expect(row.correct).toBe(1)
    expect(row.score).toBeGreaterThan(0)
  })

  it('drops answers with an unknown caseId from finished and caseStats', () => {
    const answers: Answer[] = ['artemis', 'olympics', 'citation', 'novabrew'].map((caseId, i) => ({
      playerId: '1', caseId, optionId: 'x', elapsedMs: i,
    }))
    answers.push({ playerId: '1', caseId: 'not-a-real-case', optionId: 'x', elapsedMs: 0 })
    const stats = computeStats([p('1', 'A')], answers)
    expect(stats.finished).toBe(0)
    expect(stats.caseStats.some((c) => c.caseId === 'not-a-real-case')).toBe(false)
    const totalAnswered = stats.caseStats.reduce((sum, c) => sum + c.answered, 0)
    expect(totalAnswered).toBe(4)
  })

  it('does not throw on a stale-player answer and it affects no leaderboard row', () => {
    const answers: Answer[] = [
      { playerId: 'ghost', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },
    ]
    expect(() => computeStats([p('1', 'A')], answers)).not.toThrow()
    const stats = computeStats([p('1', 'A')], answers)
    expect(stats.leaderboard).toHaveLength(1)
    expect(stats.leaderboard[0].correct).toBe(0)
    expect(stats.leaderboard[0].score).toBe(0)
  })

  it('drops a stale-player (ghost) answer from caseStats so it does not contradict the leaderboard', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },     // real player, correct
      { playerId: 'ghost', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // stale player
    ]
    const stats = computeStats([p('1', 'A')], answers)
    expect(stats.detectives).toBe(1)
    const stat = stats.caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(1)
    expect(stat.fooled).toBe(0)
    expect(stat.fooledPct).toBe(0)
  })

  it('reports a sane integer fooledPct for a non-clean ratio (1 of 3)', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct
      { playerId: '2', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // fooled
      { playerId: '3', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // fooled
    ]
    const stat = computeStats(
      [p('1', 'A'), p('2', 'B'), p('3', 'C')],
      answers,
    ).caseStats.find((c) => c.caseId === 'artemis')!
    expect(Number.isInteger(stat.fooledPct)).toBe(true)
    expect(Number.isNaN(stat.fooledPct)).toBe(false)
    expect(stat.fooledPct).toBe(67)
  })
})

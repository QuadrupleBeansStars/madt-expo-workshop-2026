import type { Answer, Player } from './types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from './scoring'

export type CaseStat = {
  caseId: string
  order: number
  answered: number
  fooled: number
  fooledPct: number
}

export type LeaderboardRow = { codename: string; score: number; correct: number }

export type RoomStats = {
  detectives: number
  finished: number
  caseStats: CaseStat[]
  leaderboard: LeaderboardRow[]
}

function isCorrect(a: Answer): boolean {
  const c = getCase(a.caseId)
  return !!c && c.options.some((o) => o.id === a.optionId && o.correct)
}

export function computeStats(players: Player[], answers: Answer[]): RoomStats {
  const caseStats: CaseStat[] = [...CASES]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const forCase = answers.filter((a) => a.caseId === c.id)
      const fooled = forCase.filter((a) => !isCorrect(a)).length
      return {
        caseId: c.id,
        order: c.order,
        answered: forCase.length,
        fooled,
        fooledPct: forCase.length === 0 ? 0 : Math.round((fooled / forCase.length) * 100),
      }
    })

  const leaderboard: LeaderboardRow[] = players
    .map((p) => {
      const mine = answers.filter((a) => a.playerId === p.id)
      return {
        codename: p.codename,
        score: totalScore(mine),
        correct: mine.filter(isCorrect).length,
      }
    })
    .sort((a, b) => b.score - a.score)

  const finished = players.filter(
    (p) => answers.filter((a) => a.playerId === p.id).length >= CASES.length,
  ).length

  return { detectives: players.length, finished, caseStats, leaderboard }
}

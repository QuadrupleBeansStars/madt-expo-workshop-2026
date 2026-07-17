import type { Answer, Player } from './types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from './scoring'

export type CaseStat = {
  caseId: string
  order: number
  answered: number
  fooled: number
  fooledPct: number
  believedAi: number
  believedAiPct: number
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

/** "Believed the AI" = chose the option whose id is 'ai-correct'. Exactly one per case. */
export function isBelieveAiOption(caseId: string, optionId: string): boolean {
  const c = getCase(caseId)
  return !!c && optionId === 'ai-correct' && c.options.some((o) => o.id === 'ai-correct')
}

/**
 * Dedupe by `playerId:caseId` (last-write-wins), drop answers for unknown cases,
 * unknown players, and SPECTATORS (who never score). Every downstream number is
 * derived from this single validated set.
 */
function dedupeAndValidate(players: Player[], answers: Answer[]): Answer[] {
  const knownCaseIds = new Set(CASES.map((c) => c.id))
  const activePlayerIds = new Set(players.filter((p) => !p.spectator).map((p) => p.id))
  const lastByKey = new Map<string, Answer>()
  for (const a of answers) {
    if (!knownCaseIds.has(a.caseId)) continue
    if (!activePlayerIds.has(a.playerId)) continue
    lastByKey.set(`${a.playerId}:${a.caseId}`, a)
  }
  return [...lastByKey.values()]
}

export function computeStats(players: Player[], answers: Answer[]): RoomStats {
  const active = players.filter((p) => !p.spectator)
  const clean = dedupeAndValidate(players, answers)

  const caseStats: CaseStat[] = [...CASES]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const forCase = clean.filter((a) => a.caseId === c.id)
      const fooled = forCase.filter((a) => !isCorrect(a)).length
      const believedAi = forCase.filter((a) => isBelieveAiOption(a.caseId, a.optionId)).length
      return {
        caseId: c.id,
        order: c.order,
        answered: forCase.length,
        fooled,
        fooledPct: forCase.length === 0 ? 0 : Math.round((fooled / forCase.length) * 100),
        believedAi,
        believedAiPct: forCase.length === 0 ? 0 : Math.round((believedAi / forCase.length) * 100),
      }
    })

  const leaderboard: LeaderboardRow[] = active
    .map((p) => {
      const mine = clean.filter((a) => a.playerId === p.id)
      return { codename: p.codename, score: totalScore(mine), correct: mine.filter(isCorrect).length }
    })
    .sort((a, b) => b.score - a.score)

  const finished = active.filter(
    (p) => clean.filter((a) => a.playerId === p.id).length >= CASES.length,
  ).length

  return { detectives: active.length, finished, caseStats, leaderboard }
}

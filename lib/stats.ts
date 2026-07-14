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

/**
 * Dedupe answers by `playerId:caseId` (last-write-wins, mirroring the store's
 * keying and `dedupeByCase` in lib/scoring.ts), drop answers referencing a
 * caseId that isn't a known case, and drop answers whose playerId matches no
 * known Player (a stale client posting after a room reset). Every downstream
 * number — caseStats, finished, leaderboard.correct, and score — is derived
 * from this single deduped, validated set so counts never disagree with each
 * other.
 */
function dedupeAndValidate(players: Player[], answers: Answer[]): Answer[] {
  const knownCaseIds = new Set(CASES.map((c) => c.id))
  const knownPlayerIds = new Set(players.map((p) => p.id))
  const lastByKey = new Map<string, Answer>()
  for (const a of answers) {
    if (!knownCaseIds.has(a.caseId)) continue
    if (!knownPlayerIds.has(a.playerId)) continue
    lastByKey.set(`${a.playerId}:${a.caseId}`, a)
  }
  return [...lastByKey.values()]
}

export function computeStats(players: Player[], answers: Answer[]): RoomStats {
  const clean = dedupeAndValidate(players, answers)

  const caseStats: CaseStat[] = [...CASES]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const forCase = clean.filter((a) => a.caseId === c.id)
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
      const mine = clean.filter((a) => a.playerId === p.id)
      return {
        codename: p.codename,
        score: totalScore(mine),
        correct: mine.filter(isCorrect).length,
      }
    })
    .sort((a, b) => b.score - a.score)

  const finished = players.filter(
    (p) => clean.filter((a) => a.playerId === p.id).length >= CASES.length,
  ).length

  return { detectives: players.length, finished, caseStats, leaderboard }
}

// The Decision Room — the only mutable state in the workshop.
//
// Sixty phones poll this over a venue LAN roughly twenty times a second while one host advances
// stages, so every read is cheap and every write bumps `seq`. Phones discard any frame whose
// `seq` is older than the one they already hold.
//
// The mechanical difference from the AI Detective store (`lib/store.ts`) and the superseded deck
// store (`lib/deck-store.ts`) is that this one does not tally a room: **every player carries their
// own cafe**, and its KPI accumulates across all three rounds. A round is applied to a shop once,
// when the host advances off the decide stage.
//
// Determinism: `now` is always passed in — this module never reads the wall clock and never calls
// Math.random() in scoring or resolution. Two players who choose alike always rank alike.
//
// NOTE ON DUPLICATION: `persist()` / `load()` deliberately mirror `lib/store.ts`'s equivalents
// rather than sharing a helper. The project owner has decided that duplication is accepted.

import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { AUDIENCE } from '@/content/audience'
import { STAGES } from '@/content/room'
import {
  LOBBY_STATE, STAGE_COUNT, acceptsVotes, advance, currentStage, remainingMs, votingOpen,
} from './room'
import type { RoomState } from './room'
import { KpiSchema, SHOP_VALUE_WEIGHTS } from './room-types'
import type { DecideStage, Kpi, StageKind } from './room-types'
import { simulateStaffing } from './sim'

/** A shop that has not traded yet. */
export const ZERO_KPI: Kpi = { revenue: 0, profit: 0, satisfaction: 0, waste: 0 }

export type RoomPlayer = {
  id: string
  name: string
  /** Carried across every round — this is the player's cafe, not one round's result. */
  kpi: Kpi
  /** stageId → optionId. One entry per decide stage the player voted on. */
  choices: Record<string, string>
  joinedAt: number
}

/** Kept deliberately small: Task 7's vote route switches over this exhaustively. */
export type VoteResult = 'ok' | 'unknown' | 'closed'

export type Tally = { optionId: string; count: number }

export type LeaderboardEntry = {
  playerId: string
  name: string
  kpi: Kpi
  score: number
  /** 1-based. Equal scores share a rank (competition ranking). */
  rank: number
}

export type PublicRoomState = {
  seq: number
  phase: RoomState['phase']
  stageIndex: number
  stageId: string | null
  stageKind: StageKind | null
  votingOpen: boolean
  remainingMs: number
  playerCount: number
  /** Votes cast on the current stage. */
  voteCount: number
  tallies: Tally[]
  /** Present only when the request carried a playerId that the store knows. */
  you?: {
    kpi: Kpi
    score: number
    rank: number
    /** optionId on the current stage, or null if they have not voted on it. */
    votedOptionId: string | null
  }
}

export interface DecisionRoomStore {
  join(name: string, now: number, playerId?: string): RoomPlayer
  vote(input: { playerId: string; stageId: string; optionId: string }, now: number): VoteResult
  advance(now: number): void
  reset(): void
  getPlayers(): RoomPlayer[]
  getRoomState(): RoomState
  getSeq(): number
  getPublicState(now: number, playerId?: string): PublicRoomState
  getLeaderboard(): LeaderboardEntry[]
}

/**
 * The leaderboard score. MUST use `SHOP_VALUE_WEIGHTS` and nothing else: round 3's fixed outcomes
 * are tuned against those exact weights so that the *recurring* option (the grinder) beats the
 * flashier one-off campaign. Reweighting here silently flips the workshop's closing lesson.
 *
 * `waste` is **inverted** — it subtracts. The inversion lives here, not in the weight (the weight
 * is a positive magnitude), because a shop that pushes every bar upward must be able to lose.
 */
export function shopValue(kpi: Kpi): number {
  return (
    SHOP_VALUE_WEIGHTS.revenue * kpi.revenue +
    SHOP_VALUE_WEIGHTS.profit * kpi.profit +
    SHOP_VALUE_WEIGHTS.satisfaction * kpi.satisfaction -
    SHOP_VALUE_WEIGHTS.waste * kpi.waste
  )
}

type Snapshot = {
  players: RoomPlayer[]
  room: RoomState
  /** Rounds already applied to every shop. Persisted so a restart cannot double-apply a round. */
  resolvedStageIds: string[]
  seq: number
}

function isDecideStage(stageId: string): DecideStage | null {
  const stage = STAGES.find((s) => s.id === stageId)
  if (!stage || !acceptsVotes(stage)) return null
  return stage
}

/**
 * Every field, not just `phase`. A file with `stageIndex: 'x'` would otherwise pass a phase-only
 * check and load as-is: `currentStage()` returns null while `phase` still says `'stage'`, and
 * `advance` produces `'x1'`, `'x11'`, `'x111'` — a room the host can never advance out of without
 * a reset. That is the wedge this constraint exists to prevent.
 */
function isValidRoomState(v: unknown): v is RoomState {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<RoomState>
  if (s.phase !== 'lobby' && s.phase !== 'stage' && s.phase !== 'done') return false
  if (!Number.isInteger(s.stageIndex) || (s.stageIndex as number) < 0 || (s.stageIndex as number) >= STAGE_COUNT) return false
  if (typeof s.stageStartedAt !== 'number' || !Number.isFinite(s.stageStartedAt)) return false
  if (s.votingClosedAt !== null && (typeof s.votingClosedAt !== 'number' || !Number.isFinite(s.votingClosedAt))) return false
  return true
}

export class MemoryDecisionRoomStore implements DecisionRoomStore {
  private players: RoomPlayer[] = []
  private room: RoomState = LOBBY_STATE
  private resolved = new Set<string>()
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  /**
   * A phone that reloads mid-session sends the id it already holds: that is a rejoin, not a second
   * cafe. Idempotent per player id — an id we do not know falls through to a fresh player, so a
   * stale id from a previous session can never lock someone out of the room.
   */
  join(name: string, now: number, playerId?: string): RoomPlayer {
    if (playerId) {
      const existing = this.players.find((p) => p.id === playerId)
      if (existing) return { ...existing, kpi: { ...existing.kpi }, choices: { ...existing.choices } }
    }
    const player: RoomPlayer = {
      id: randomUUID(),
      name,
      kpi: { ...ZERO_KPI },
      choices: {},
      joinedAt: now,
    }
    this.players.push(player)
    this.seq++
    this.persist()
    return { ...player, kpi: { ...player.kpi }, choices: {} }
  }

  /** Last-write-wins: changing your mind replaces your choice, it never adds a second one. */
  vote(input: { playerId: string; stageId: string; optionId: string }, now: number): VoteResult {
    const player = this.players.find((p) => p.id === input.playerId)
    if (!player) return 'unknown'
    const stage = currentStage(this.room)
    if (!stage || stage.id !== input.stageId) return 'closed'
    if (!acceptsVotes(stage)) return 'closed'
    if (!votingOpen(this.room, now)) return 'closed'
    if (!stage.options.some((o) => o.id === input.optionId)) return 'closed'
    player.choices[input.stageId] = input.optionId
    this.seq++
    this.persist()
    return 'ok'
  }

  /**
   * The host's only lever. Leaving a decide stage is what closes the round: every shop is resolved
   * at that moment, voters and non-voters alike, before the index moves on to the outcome stage
   * that narrates it.
   */
  advance(now: number): void {
    const leaving = currentStage(this.room)
    if (leaving && acceptsVotes(leaving)) this.resolveStage(leaving)
    this.room = advance(this.room, now)
    this.seq++
    this.persist()
  }

  reset(): void {
    this.players = []
    this.room = LOBBY_STATE
    this.resolved.clear()
    // seq is monotonic for the life of the process: a reset must not hand phones a frame that
    // looks older than the one they are already showing.
    this.seq++
    this.persist()
  }

  getPlayers(): RoomPlayer[] {
    return this.players.map((p) => ({ ...p, kpi: { ...p.kpi }, choices: { ...p.choices } }))
  }

  getRoomState(): RoomState { return { ...this.room } }
  getSeq(): number { return this.seq }

  getPublicState(now: number, playerId?: string): PublicRoomState {
    const stage = currentStage(this.room)
    const decide = stage && acceptsVotes(stage) ? stage : null
    const tallies: Tally[] = decide
      ? decide.options.map((o) => ({
        optionId: o.id,
        count: this.players.filter((p) => p.choices[decide.id] === o.id).length,
      }))
      : []

    const pub: PublicRoomState = {
      seq: this.seq,
      phase: this.room.phase,
      stageIndex: this.room.stageIndex,
      stageId: stage?.id ?? null,
      stageKind: stage?.kind ?? null,
      votingOpen: votingOpen(this.room, now),
      remainingMs: remainingMs(this.room, now),
      playerCount: this.players.length,
      voteCount: tallies.reduce((n, t) => n + t.count, 0),
      tallies,
    }

    if (playerId !== undefined) {
      const me = this.players.find((p) => p.id === playerId)
      if (me) {
        const entry = this.getLeaderboard().find((e) => e.playerId === me.id)!
        pub.you = {
          kpi: { ...me.kpi },
          score: entry.score,
          rank: entry.rank,
          votedOptionId: decide ? (me.choices[decide.id] ?? null) : null,
        }
      }
    }
    return pub
  }

  /**
   * Best shop first. Ties are broken by join order then id so the board is stable frame to frame —
   * a leaderboard that reshuffles under a projector reads as a bug to the room.
   */
  getLeaderboard(): LeaderboardEntry[] {
    const scored = this.players
      .map((p) => ({ playerId: p.id, name: p.name, kpi: { ...p.kpi }, score: shopValue(p.kpi), joinedAt: p.joinedAt }))
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt || a.playerId.localeCompare(b.playerId))

    const board: LeaderboardEntry[] = []
    scored.forEach((s, i) => {
      const rank = i > 0 && s.score === scored[i - 1].score ? board[i - 1].rank : i + 1
      board.push({ playerId: s.playerId, name: s.name, kpi: s.kpi, score: s.score, rank })
    })
    return board
  }

  /**
   * Apply one round to every shop, exactly once. A player who did not vote takes the **first**
   * option's outcome, so the leaderboard never has holes and nobody is silently absent from the
   * board. Deltas are added, never assigned — the cafe accumulates.
   *
   * Accumulated `satisfaction` is deliberately NOT clamped to 0-100: clamping would be an invented
   * rule, and it would distort the weighting that round 3 was balanced against.
   */
  private resolveStage(stage: DecideStage): void {
    if (this.resolved.has(stage.id)) return
    for (const player of this.players) {
      const chosen = player.choices[stage.id]
      if (stage.resolve === 'simulate-staffing') {
        const option = stage.options.find((o) => o.id === chosen) ?? stage.options[0]
        const sim = simulateStaffing(option.baristas, AUDIENCE)
        player.kpi = {
          revenue: player.kpi.revenue + sim.revenue,
          profit: player.kpi.profit + sim.profit,
          satisfaction: player.kpi.satisfaction + sim.satisfaction,
          waste: player.kpi.waste + sim.waste,
        }
      } else {
        const option = stage.options.find((o) => o.id === chosen) ?? stage.options[0]
        const fx = option.fx
        player.kpi = {
          revenue: player.kpi.revenue + (fx.revenue ?? 0),
          profit: player.kpi.profit + (fx.profit ?? 0),
          satisfaction: player.kpi.satisfaction + (fx.satisfaction ?? 0),
          waste: player.kpi.waste + (fx.waste ?? 0),
        }
      }
    }
    this.resolved.add(stage.id)
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = {
      players: this.players,
      room: this.room,
      resolvedStageIds: [...this.resolved],
      seq: this.seq,
    }
    try {
      // Temp file then rename: a crash mid-write leaves the previous good file intact, never a
      // half-written one. The uuid keeps two concurrent writers off each other's temp file.
      const tmpPath = `${this.persistPath}.${randomUUID()}.tmp`
      writeFileSync(tmpPath, JSON.stringify(snap), 'utf8')
      renameSync(tmpPath, this.persistPath)
    } catch (err) {
      console.error('[room-store] persist() failed — room state may not survive a restart:', err)
    }
  }

  /**
   * Any unreadable, malformed or wrong-shaped file falls back to a clean lobby. It must never
   * throw out of the constructor: a wedged store at the venue is unrecoverable without a deploy,
   * whereas a lost lobby costs one re-scan of the QR code.
   */
  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Partial<Snapshot>
      if (!Array.isArray(snap.players)) throw new Error('persisted room snapshot has an unexpected shape')

      this.players = snap.players
        .filter((p): p is RoomPlayer => !!p && typeof p === 'object' && typeof p.id === 'string')
        .map((p) => {
          const kpi = KpiSchema.safeParse(p.kpi)
          const choices: Record<string, string> = {}
          if (p.choices && typeof p.choices === 'object') {
            for (const [stageId, optionId] of Object.entries(p.choices)) {
              if (typeof optionId === 'string' && isDecideStage(stageId)) choices[stageId] = optionId
            }
          }
          return {
            id: p.id,
            name: typeof p.name === 'string' ? p.name : '',
            kpi: kpi.success ? kpi.data : { ...ZERO_KPI },
            choices,
            joinedAt: typeof p.joinedAt === 'number' && Number.isFinite(p.joinedAt) ? p.joinedAt : 0,
          }
        })

      this.room = isValidRoomState(snap.room) ? { ...snap.room } : LOBBY_STATE
      this.resolved = new Set(
        Array.isArray(snap.resolvedStageIds)
          ? snap.resolvedStageIds.filter((id) => typeof id === 'string' && isDecideStage(id))
          : [],
      )
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.room = LOBBY_STATE
      this.resolved.clear()
      this.seq = 0
    }
  }
}

// A distinct global key and a distinct file from `lib/store.ts`'s `__roomStore` /
// `.room-state.json`: both apps run in one Next process, and sharing either would mean each store
// clobbering the other's state.
const globalForRoom = globalThis as unknown as { __decisionRoomStore?: DecisionRoomStore }
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
export function getRoomStore(): DecisionRoomStore {
  if (!globalForRoom.__decisionRoomStore) {
    globalForRoom.__decisionRoomStore = isTestEnv
      ? new MemoryDecisionRoomStore()
      : new MemoryDecisionRoomStore('.decision-room-state.json')
  }
  return globalForRoom.__decisionRoomStore
}

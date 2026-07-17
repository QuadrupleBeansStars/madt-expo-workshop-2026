import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { Answer, GameState, Player, PublicGameState } from './types'
import {
  LOBBY_STATE, ROUNDS, currentCaseId, nextState, remainingMs, revealState, shouldExpire, startedState,
} from './game'

export interface RoomStore {
  join(codename: string, now: number): Player
  recordAnswer(input: { playerId: string; caseId: string; optionId: string }, now: number): AnswerResult
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
  getGameState(): GameState
  getSeq(): number
  tick(now: number): boolean
  startGame(now: number): void
  nextRound(now: number): void
  getPublicState(now: number, playerId?: string): PublicGameState
}

export type AnswerResult = 'ok' | 'duplicate' | 'unknown' | 'spectator' | 'closed'

type Snapshot = { players: Player[]; answers: Answer[]; game: GameState; seq: number }

export class MemoryRoomStore implements RoomStore {
  private players: Player[] = []
  /** Keyed `${playerId}:${caseId}`. First-wins: we never overwrite an existing key. */
  private answers = new Map<string, Answer>()
  private game: GameState = LOBBY_STATE
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  private activePlayers(): Player[] {
    return this.players.filter((p) => !p.spectator)
  }

  private answeredCountFor(caseId: string | null): number {
    if (!caseId) return 0
    const active = new Set(this.activePlayers().map((p) => p.id))
    let n = 0
    for (const a of this.answers.values()) {
      if (a.caseId === caseId && active.has(a.playerId)) n++
    }
    return n
  }

  join(codename: string, now: number): Player {
    const player: Player = { id: randomUUID(), codename, joinedAt: now, spectator: this.game.phase !== 'lobby' }
    this.players.push(player)
    this.seq++
    this.persist()
    return player
  }

  recordAnswer(input: { playerId: string; caseId: string; optionId: string }, now: number): AnswerResult {
    const player = this.players.find((p) => p.id === input.playerId)
    if (!player) return 'unknown'
    if (player.spectator) return 'spectator'
    if (this.game.phase !== 'investigate') return 'closed'
    if (input.caseId !== currentCaseId(this.game)) return 'closed'
    const key = `${input.playerId}:${input.caseId}`
    if (this.answers.has(key)) return 'duplicate' // first-wins, idempotent no-op
    const elapsedMs = now - this.game.phaseStartedAt
    this.answers.set(key, { playerId: input.playerId, caseId: input.caseId, optionId: input.optionId, elapsedMs })
    this.seq++
    this.persist()
    return 'ok'
  }

  getPlayers(): Player[] { return this.players.map((p) => ({ ...p })) }
  getAnswers(): Answer[] { return [...this.answers.values()].map((a) => ({ ...a })) }
  getGameState(): GameState { return { ...this.game } }
  getSeq(): number { return this.seq }

  reset(): void {
    this.players = []
    this.answers.clear()
    this.game = LOBBY_STATE
    this.seq++
    this.persist()
  }

  /**
   * Lazily flip investigate→reveal. Runs on every /api/state read (~21×/sec).
   * The read-of-phase → write-of-flip below has NO await between the checks and
   * the assignment, so Node's single thread makes it atomic (no double-flip race).
   * Persists ONLY when it actually flips — a no-op read must not fsync.
   */
  tick(now: number): boolean {
    if (this.game.phase !== 'investigate') return false
    const active = this.activePlayers().length
    const answered = this.answeredCountFor(currentCaseId(this.game))
    if (!shouldExpire(this.game, now, active, answered)) return false
    this.game = revealState(this.game, now)
    this.seq++
    this.persist()
    return true
  }

  startGame(now: number): void {
    if (this.game.phase !== 'lobby') return
    this.game = startedState(now)
    this.seq++
    this.persist()
  }

  nextRound(now: number): void {
    if (this.game.phase !== 'reveal') return
    this.game = nextState(this.game, now)
    this.seq++
    this.persist()
  }

  getPublicState(now: number, playerId?: string): PublicGameState {
    const caseId = currentCaseId(this.game)
    const pub: PublicGameState = {
      seq: this.seq,
      phase: this.game.phase,
      roundIndex: this.game.roundIndex,
      caseId,
      remainingMs: remainingMs(this.game, now),
      answeredCount: this.answeredCountFor(caseId),
      playerCount: this.activePlayers().length,
    }
    if (playerId !== undefined) {
      pub.youAnswered = caseId != null && this.answers.has(`${playerId}:${caseId}`)
    }
    return pub
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, answers: this.getAnswers(), game: this.game, seq: this.seq }
    try {
      const tmpPath = `${this.persistPath}.${randomUUID()}.tmp`
      writeFileSync(tmpPath, JSON.stringify(snap), 'utf8')
      renameSync(tmpPath, this.persistPath)
    } catch (err) {
      console.error('[store] persist() failed — room state may not survive a restart:', err)
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Partial<Snapshot>
      if (!Array.isArray(snap.players) || !Array.isArray(snap.answers)) {
        throw new Error('persisted snapshot has an unexpected shape')
      }
      this.players = snap.players.map((p) => ({ ...p, spectator: !!p.spectator }))
      for (const a of snap.answers) {
        if (!a || typeof a !== 'object' || !a.playerId || !a.caseId) continue
        this.answers.set(`${a.playerId}:${a.caseId}`, a)
      }
      const validPhases = new Set(['lobby', 'investigate', 'reveal', 'final'])
      this.game = snap.game && validPhases.has(snap.game.phase as string) ? (snap.game as GameState) : LOBBY_STATE
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.answers.clear()
      this.game = LOBBY_STATE
      this.seq = 0
    }
  }
}

const globalForStore = globalThis as unknown as { __roomStore?: RoomStore }
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
export function getStore(): RoomStore {
  if (!globalForStore.__roomStore) {
    globalForStore.__roomStore = isTestEnv ? new MemoryRoomStore() : new MemoryRoomStore('.room-state.json')
  }
  return globalForStore.__roomStore
}

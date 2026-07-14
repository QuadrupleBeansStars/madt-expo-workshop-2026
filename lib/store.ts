import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Answer, Player } from './types'

export interface RoomStore {
  join(codename: string): Player
  recordAnswer(a: Answer): void
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
}

type Snapshot = { players: Player[]; answers: Answer[] }

export class MemoryRoomStore implements RoomStore {
  private players: Player[] = []
  /** Keyed `${playerId}:${caseId}` so a re-answer overwrites rather than duplicates. */
  private answers = new Map<string, Answer>()

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  join(codename: string): Player {
    const player: Player = { id: randomUUID(), codename, joinedAt: Date.now() }
    this.players.push(player)
    this.persist()
    return player
  }

  recordAnswer(a: Answer): void {
    this.answers.set(`${a.playerId}:${a.caseId}`, a)
    this.persist()
  }

  getPlayers(): Player[] { return [...this.players] }
  getAnswers(): Answer[] { return [...this.answers.values()] }

  reset(): void {
    this.players = []
    this.answers.clear()
    this.persist()
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, answers: this.getAnswers() }
    try {
      writeFileSync(this.persistPath, JSON.stringify(snap), 'utf8')
    } catch {
      // Persistence is a safety net, not a requirement. Never take the room down over it.
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Snapshot
      this.players = snap.players ?? []
      for (const a of snap.answers ?? []) this.answers.set(`${a.playerId}:${a.caseId}`, a)
    } catch {
      // No prior state (first run) — start empty.
    }
  }
}

/**
 * Process-wide singleton. Next dev-mode hot reload re-evaluates modules, so we
 * stash it on globalThis to keep the room alive across reloads.
 */
const globalForStore = globalThis as unknown as { __roomStore?: RoomStore }
export function getStore(): RoomStore {
  if (!globalForStore.__roomStore) {
    globalForStore.__roomStore = new MemoryRoomStore('.room-state.json')
  }
  return globalForStore.__roomStore
}

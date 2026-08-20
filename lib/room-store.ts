// Café Persona — the only mutable state in the workshop.
//
// Sixty phones poll this over a venue LAN roughly twenty times a second while one host advances
// stages, so every read is cheap and every write bumps `seq`. Phones discard any frame whose
// `seq` is older than the one they already hold.
//
// There is no score and no leaderboard: each player's answers accumulate silently toward a
// persona (lib/persona.ts), revealed only at `done`. The tally is DERIVED on demand from
// `answers` — nothing is resolved or applied when the host advances, which is why `back` is safe.
//
// Determinism: `now` is always passed in — this module never reads the wall clock and never calls
// Math.random() in scoring. Two players who answer alike always type alike.
//
// NOTE ON DUPLICATION: `persist()` / `load()` deliberately mirror `lib/store.ts`'s equivalents
// rather than sharing a helper. The project owner has decided that duplication is accepted.

import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { QUESTIONS } from '@/content/persona'
import { finalPersona } from './persona'
import {
  LOBBY_STATE, STAGE_COUNT, advance, askOpen, back, currentQuestion, currentStage, remainingMs,
} from './room'
import type { RoomState } from './room'
import { PERSONA_IDS } from './room-types'
import type { PersonaId } from './room-types'

export type RoomPlayer = {
  id: string
  name: string
  /** questionId → choiceIndex (0–3). Never erased by host navigation. */
  answers: Record<string, number>
  joinedAt: number
}

/** Kept deliberately small: the vote route switches over this exhaustively. */
export type VoteResult = 'ok' | 'unknown' | 'closed'

export type Split = { choiceIndex: number; count: number }[]

export type PublicRoomState = {
  seq: number
  phase: RoomState['phase']
  stageIndex: number
  stageKind: 'ask' | 'reveal' | null
  questionId: string | null
  questionIndex: number | null
  votingOpen: boolean
  remainingMs: number
  playerCount: number
  /** Votes on the current question (ask AND reveal stages). */
  voteCount: number
  /** Present ONLY on reveal stages — phones must not see the split forming during ask. */
  split?: Split
  /**
   * Present ONLY when phase === 'done'. `dots` is sorted by PERSONA_IDS order and anonymous —
   * it can never be correlated with join order or names.
   */
  result?: { counts: Record<PersonaId, number>; dots: PersonaId[] }
  /** Present only when the request carried a playerId that the store knows. */
  you?: {
    answeredCount: number
    /** This player's pick on the current question, or null. */
    pickedChoiceIndex: number | null
    /** null until phase === 'done' (no mid-game spoilers), and null for a zero-answer player. */
    persona: PersonaId | null
  }
}

export interface DecisionRoomStore {
  join(name: string, now: number, playerId?: string): RoomPlayer
  vote(input: { playerId: string; questionId: string; choiceIndex: number }, now: number): VoteResult
  advance(now: number): void
  back(now: number): void
  reset(): void
  getPlayers(): RoomPlayer[]
  getRoomState(): RoomState
  getSeq(): number
  getPublicState(now: number, playerId?: string): PublicRoomState
}

type Snapshot = {
  players: RoomPlayer[]
  room: RoomState
  seq: number
}

const QUESTION_IDS = new Set(QUESTIONS.map((q) => q.id))

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
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  /**
   * A phone that reloads mid-session sends the id it already holds: that is a rejoin, not a second
   * player. Idempotent per player id — an id we do not know falls through to a fresh player, so a
   * stale id from a previous session can never lock someone out of the room.
   */
  join(name: string, now: number, playerId?: string): RoomPlayer {
    if (playerId) {
      const existing = this.players.find((p) => p.id === playerId)
      if (existing) return { ...existing, answers: { ...existing.answers } }
    }
    const player: RoomPlayer = {
      id: randomUUID(),
      name,
      answers: {},
      joinedAt: now,
    }
    this.players.push(player)
    this.seq++
    this.persist()
    return { ...player, answers: {} }
  }

  /** Last-write-wins: changing your mind replaces your answer, it never adds a second one. */
  vote(input: { playerId: string; questionId: string; choiceIndex: number }, now: number): VoteResult {
    void now // votes are gated by stage kind, not by the display-only clock
    const player = this.players.find((p) => p.id === input.playerId)
    if (!player) return 'unknown'
    const q = currentQuestion(this.room)
    if (!q || q.id !== input.questionId) return 'closed'
    if (!askOpen(this.room)) return 'closed'
    if (!Number.isInteger(input.choiceIndex) || input.choiceIndex < 0 || input.choiceIndex > 3) return 'closed'
    player.answers[input.questionId] = input.choiceIndex
    this.seq++
    this.persist()
    return 'ok'
  }

  advance(now: number): void {
    this.room = advance(this.room, now)
    this.seq++
    this.persist()
  }

  back(now: number): void {
    this.room = back(this.room, now)
    this.seq++
    this.persist()
  }

  reset(): void {
    this.players = []
    this.room = LOBBY_STATE
    // seq is monotonic for the life of the process: a reset must not hand phones a frame that
    // looks older than the one they are already showing.
    this.seq++
    this.persist()
  }

  getPlayers(): RoomPlayer[] {
    return this.players.map((p) => ({ ...p, answers: { ...p.answers } }))
  }

  getRoomState(): RoomState { return { ...this.room } }
  getSeq(): number { return this.seq }

  /** This player's answers as PersonaIds, in question order, skipping unanswered questions. */
  private personaOf(p: RoomPlayer): PersonaId | null {
    const answers = QUESTIONS
      .map((q) => (q.id in p.answers ? q.choices[p.answers[q.id]]?.persona : undefined))
      .filter((x): x is PersonaId => !!x)
    return finalPersona(answers)
  }

  getPublicState(now: number, playerId?: string): PublicRoomState {
    const stage = currentStage(this.room)
    const q = currentQuestion(this.room)
    const votesOnQ = q ? this.players.filter((p) => q.id in p.answers) : []

    const pub: PublicRoomState = {
      seq: this.seq,
      phase: this.room.phase,
      stageIndex: this.room.stageIndex,
      stageKind: stage?.kind ?? null,
      questionId: q?.id ?? null,
      questionIndex: stage?.questionIndex ?? null,
      votingOpen: askOpen(this.room),
      remainingMs: remainingMs(this.room, now),
      playerCount: this.players.length,
      voteCount: votesOnQ.length,
    }

    if (stage?.kind === 'reveal' && q) {
      pub.split = [0, 1, 2, 3].map((i) => ({
        choiceIndex: i,
        count: votesOnQ.filter((p) => p.answers[q.id] === i).length,
      }))
    }

    if (this.room.phase === 'done') {
      const counts: Record<PersonaId, number> = { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 }
      for (const p of this.players) {
        const id = this.personaOf(p)
        if (id) counts[id]++
      }
      // Sorted by PERSONA_IDS order: dots must not be correlatable with join order or names.
      pub.result = {
        counts,
        dots: PERSONA_IDS.flatMap((id) => Array<PersonaId>(counts[id]).fill(id)),
      }
    }

    if (playerId !== undefined) {
      const me = this.players.find((p) => p.id === playerId)
      if (me) {
        pub.you = {
          answeredCount: Object.keys(me.answers).length,
          pickedChoiceIndex: q ? (me.answers[q.id] ?? null) : null,
          persona: this.room.phase === 'done' ? this.personaOf(me) : null,
        }
      }
    }
    return pub
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = {
      players: this.players,
      room: this.room,
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
          const answers: Record<string, number> = {}
          if (p.answers && typeof p.answers === 'object') {
            for (const [qid, idx] of Object.entries(p.answers)) {
              if (QUESTION_IDS.has(qid) && Number.isInteger(idx) && (idx as number) >= 0 && (idx as number) <= 3) {
                answers[qid] = idx as number
              }
            }
          }
          return {
            id: p.id,
            name: typeof p.name === 'string' ? p.name : '',
            answers,
            joinedAt: typeof p.joinedAt === 'number' && Number.isFinite(p.joinedAt) ? p.joinedAt : 0,
          }
        })

      this.room = isValidRoomState(snap.room) ? { ...snap.room } : LOBBY_STATE
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.room = LOBBY_STATE
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

import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DeckPlayer, DeckState, DeckVote, PublicDeckState } from './deck-types'
import {
  LOBBY_DECK_STATE, backSlideState, closeVotingState, currentSlide, nextSlideState,
  remainingMs, startedDeckState, tally, votingOpen,
} from './deck'

export type VoteResult = 'ok' | 'unknown' | 'closed'

export interface DeckStore {
  join(now: number): DeckPlayer
  recordVote(input: { playerId: string; slideId: string; optionId: string }, now: number): VoteResult
  getPlayers(): DeckPlayer[]
  getVotes(): DeckVote[]
  getDeckState(): DeckState
  getSeq(): number
  start(now: number): void
  next(now: number): void
  back(now: number): void
  closeVoting(now: number): void
  reset(): void
  getPublicState(now: number, playerId?: string): PublicDeckState
}

type Snapshot = { players: DeckPlayer[]; votes: DeckVote[]; deck: DeckState; seq: number }

export class MemoryDeckStore implements DeckStore {
  private players: DeckPlayer[] = []
  /** Keyed `${playerId}:${slideId}`. Last-write-wins: changing your mind is harmless here. */
  private votes = new Map<string, DeckVote>()
  private deck: DeckState = LOBBY_DECK_STATE
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  join(now: number): DeckPlayer {
    // No spectator concept: with no scoring, a late joiner just votes on the current slide.
    const player: DeckPlayer = { id: randomUUID(), joinedAt: now }
    this.players.push(player)
    this.seq++
    this.persist()
    return player
  }

  recordVote(input: { playerId: string; slideId: string; optionId: string }, now: number): VoteResult {
    if (!this.players.some((p) => p.id === input.playerId)) return 'unknown'
    const slide = currentSlide(this.deck)
    if (!slide || slide.id !== input.slideId) return 'closed'
    if (!votingOpen(this.deck, now)) return 'closed'
    if (slide.kind !== 'poll' && slide.kind !== 'vote') return 'closed'
    if (!slide.options.some((o) => o.id === input.optionId)) return 'closed'
    this.votes.set(`${input.playerId}:${input.slideId}`, {
      playerId: input.playerId, slideId: input.slideId, optionId: input.optionId,
    })
    this.seq++
    this.persist()
    return 'ok'
  }

  getPlayers(): DeckPlayer[] { return this.players.map((p) => ({ ...p })) }
  getVotes(): DeckVote[] { return [...this.votes.values()].map((v) => ({ ...v })) }
  getDeckState(): DeckState { return { ...this.deck } }
  getSeq(): number { return this.seq }

  start(now: number): void {
    if (this.deck.phase !== 'lobby') return
    this.deck = startedDeckState(now)
    this.seq++
    this.persist()
  }

  next(now: number): void {
    if (this.deck.phase === 'lobby') return
    this.deck = nextSlideState(this.deck, now)
    this.seq++
    this.persist()
  }

  back(now: number): void {
    if (this.deck.phase === 'lobby') return
    this.deck = backSlideState(this.deck, now)
    this.seq++
    this.persist()
  }

  closeVoting(now: number): void {
    if (this.deck.phase !== 'slide') return
    this.deck = closeVotingState(this.deck, now)
    this.seq++
    this.persist()
  }

  reset(): void {
    this.players = []
    this.votes.clear()
    this.deck = LOBBY_DECK_STATE
    this.seq++
    this.persist()
  }

  getPublicState(now: number, playerId?: string): PublicDeckState {
    const slide = currentSlide(this.deck)
    const votes = this.getVotes()
    const tallies = slide ? tally(votes, slide.id, slide) : []
    const pub: PublicDeckState = {
      seq: this.seq,
      phase: this.deck.phase,
      slideIndex: this.deck.slideIndex,
      slideId: slide?.id ?? null,
      votingOpen: votingOpen(this.deck, now),
      remainingMs: remainingMs(this.deck, now),
      playerCount: this.players.length,
      voteCount: tallies.reduce((n, t) => n + t.count, 0),
      tallies,
    }
    if (playerId !== undefined) {
      pub.youVoted = slide ? (this.votes.get(`${playerId}:${slide.id}`)?.optionId ?? null) : null
    }
    return pub
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, votes: this.getVotes(), deck: this.deck, seq: this.seq }
    try {
      const tmpPath = `${this.persistPath}.${randomUUID()}.tmp`
      writeFileSync(tmpPath, JSON.stringify(snap), 'utf8')
      renameSync(tmpPath, this.persistPath)
    } catch (err) {
      console.error('[deck-store] persist() failed — deck state may not survive a restart:', err)
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Partial<Snapshot>
      if (!Array.isArray(snap.players) || !Array.isArray(snap.votes)) {
        throw new Error('persisted deck snapshot has an unexpected shape')
      }
      this.players = snap.players.filter((p) => p && typeof p.id === 'string')
      for (const v of snap.votes) {
        if (!v || typeof v !== 'object' || !v.playerId || !v.slideId || !v.optionId) continue
        this.votes.set(`${v.playerId}:${v.slideId}`, v)
      }
      const validPhases = new Set(['lobby', 'slide', 'done'])
      this.deck = snap.deck && validPhases.has(snap.deck.phase as string)
        ? (snap.deck as DeckState) : LOBBY_DECK_STATE
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.votes.clear()
      this.deck = LOBBY_DECK_STATE
      this.seq = 0
    }
  }
}

const globalForDeck = globalThis as unknown as { __deckStore?: DeckStore }
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
export function getDeckStore(): DeckStore {
  if (!globalForDeck.__deckStore) {
    globalForDeck.__deckStore = isTestEnv ? new MemoryDeckStore() : new MemoryDeckStore('.deck-state.json')
  }
  return globalForDeck.__deckStore
}

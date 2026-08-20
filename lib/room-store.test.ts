import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { QUESTIONS } from '@/content/persona'
import { MemoryDecisionRoomStore } from '@/lib/room-store'
import type { PersonaId } from '@/lib/room-types'

const T = 1_000_000

let store: MemoryDecisionRoomStore
beforeEach(() => { store = new MemoryDecisionRoomStore() })

/** The choice index that maps to `persona` on question `qi` — never hard-code the shuffled order. */
function choiceOf(qi: number, persona: PersonaId): number {
  return QUESTIONS[qi].choices.findIndex((c) => c.persona === persona)
}

/** Host-advance from lobby to the ask stage of question index `qi`. */
function toAsk(s: MemoryDecisionRoomStore, qi: number) {
  s.advance(T)                                    // lobby → q0 ask
  for (let i = 0; i < qi * 2; i++) s.advance(T + i)
}

/** Host-advance all the way to done. Call from a fresh lobby. */
function toDone(s: MemoryDecisionRoomStore) {
  for (let i = 0; i <= QUESTIONS.length * 2; i++) s.advance(T + i)
}

describe('vote gating', () => {
  it('accepts a vote only on the matching ask stage', () => {
    const p = store.join('A', T)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 0 }, T)).toBe('closed') // lobby
    toAsk(store, 0)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 0 }, T)).toBe('ok')
    expect(store.vote({ playerId: p.id, questionId: 'q2', choiceIndex: 0 }, T)).toBe('closed') // wrong q
    store.advance(T)                               // reveal
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 1 }, T)).toBe('closed')
  })

  it('rejects unknown player / out-of-range choiceIndex', () => {
    toAsk(store, 0)
    expect(store.vote({ playerId: 'ghost', questionId: 'q1', choiceIndex: 0 }, T)).toBe('unknown')
    const p = store.join('A', T)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 4 }, T)).toBe('closed')
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: -1 }, T)).toBe('closed')
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 1.5 }, T)).toBe('closed')
  })

  it('re-vote replaces, never adds (last write wins)', () => {
    const p = store.join('A', T)
    toAsk(store, 0)
    store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 0 }, T)
    store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 2 }, T)
    store.advance(T)                               // reveal
    const split = store.getPublicState(T).split!
    expect(split.find((s) => s.choiceIndex === 0)?.count).toBe(0)
    expect(split.find((s) => s.choiceIndex === 2)?.count).toBe(1)
    expect(split.reduce((n, s) => n + s.count, 0)).toBe(1)
  })

  it('votes survive host back/forward navigation', () => {
    const p = store.join('A', T)
    toAsk(store, 0)
    store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 3 }, T)
    store.back(T)                                  // back to lobby
    store.advance(T)                               // forward to q1 ask again
    expect(store.getPublicState(T, p.id).you?.pickedChoiceIndex).toBe(3)
  })
})

describe('split visibility', () => {
  it('split is absent during lobby and ask, present on reveal', () => {
    store.join('A', T)
    expect('split' in store.getPublicState(T)).toBe(false)          // lobby
    toAsk(store, 0)
    expect('split' in store.getPublicState(T)).toBe(false)          // ask
    store.advance(T)
    expect(store.getPublicState(T).split).toBeDefined()             // reveal
  })

  it('split counts every choice index including zeros, in order 0..3', () => {
    const a = store.join('A', T)
    const b = store.join('B', T)
    const c = store.join('C', T)
    toAsk(store, 0)
    store.vote({ playerId: a.id, questionId: 'q1', choiceIndex: 0 }, T)
    store.vote({ playerId: b.id, questionId: 'q1', choiceIndex: 0 }, T)
    store.vote({ playerId: c.id, questionId: 'q1', choiceIndex: 2 }, T)
    store.advance(T)
    expect(store.getPublicState(T).split).toEqual([
      { choiceIndex: 0, count: 2 },
      { choiceIndex: 1, count: 0 },
      { choiceIndex: 2, count: 1 },
      { choiceIndex: 3, count: 0 },
    ])
  })
})

describe('result', () => {
  it('absent before done; present at done with counts + sorted anonymous dots', () => {
    const a = store.join('A', T)
    const b = store.join('B', T)
    // B is deliberately typed FIRST-joined-last-in-dots order: dots must sort by persona, not join.
    for (let qi = 0; qi < QUESTIONS.length; qi++) {
      toAskNext(store, qi)
      store.vote({ playerId: a.id, questionId: QUESTIONS[qi].id, choiceIndex: choiceOf(qi, 'analyst') }, T)
      store.vote({ playerId: b.id, questionId: QUESTIONS[qi].id, choiceIndex: choiceOf(qi, 'pioneer') }, T)
      store.advance(T)                             // to reveal
    }
    expect('result' in store.getPublicState(T)).toBe(false)         // last reveal, not done yet
    store.advance(T)                               // done
    const result = store.getPublicState(T).result!
    expect(result.counts).toEqual({ pioneer: 1, sprinter: 0, analyst: 1, guardian: 0 })
    // PERSONA_IDS order — pioneer before analyst — even though the analyst (A) joined first.
    expect(result.dots).toEqual(['pioneer', 'analyst'])
  })

  it('you.persona is null mid-game, set at done, null for a zero-answer player', () => {
    const a = store.join('A', T)
    const late = store.join('Late', T)
    toAsk(store, 0)
    store.vote({ playerId: a.id, questionId: 'q1', choiceIndex: choiceOf(0, 'guardian') }, T)
    expect(store.getPublicState(T, a.id).you?.persona).toBeNull()
    toDone(store)
    expect(store.getPublicState(T, a.id).you?.persona).toBe('guardian')
    expect(store.getPublicState(T, late.id).you?.persona).toBeNull()
    expect(store.getPublicState(T, late.id).you?.answeredCount).toBe(0)
  })

  it('a phone frame never pairs another player with a persona', () => {
    const a = store.join('Alice', T)
    const b = store.join('Bob', T)
    toAsk(store, 0)
    store.vote({ playerId: b.id, questionId: 'q1', choiceIndex: 0 }, T)
    toDone(store)
    const json = JSON.stringify(store.getPublicState(T, a.id))
    expect(json).not.toContain(b.id)
    expect(json).not.toContain('Bob')
  })
})

/** Advance to question qi's ask, assuming we are on the previous question's reveal (or lobby). */
function toAskNext(s: MemoryDecisionRoomStore, qi: number) {
  if (qi === 0) s.advance(T)                      // lobby → q0 ask
  else s.advance(T)                                // reveal(qi-1) → ask(qi)
}

describe('lifecycle', () => {
  it('join is idempotent per playerId (rejoin, not a second player)', () => {
    const p = store.join('A', T)
    const again = store.join('A', T + 5, p.id)
    expect(again.id).toBe(p.id)
    expect(store.getPlayers()).toHaveLength(1)
    // An id the store does not know falls through to a fresh player.
    const fresh = store.join('B', T + 6, 'stale-id-from-last-session')
    expect(fresh.id).not.toBe('stale-id-from-last-session')
    expect(store.getPlayers()).toHaveLength(2)
  })

  it('reset clears players and returns to lobby; seq stays monotonic', () => {
    store.join('A', T)
    toAsk(store, 0)
    const seqBefore = store.getSeq()
    store.reset()
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getRoomState().phase).toBe('lobby')
    expect(store.getSeq()).toBeGreaterThan(seqBefore)
  })
})

describe('persistence', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = mkdtempSync(joinPath(tmpdir(), 'persona-store-'))
    file = joinPath(dir, 'state.json')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('persists and reloads mid-game, including answers', () => {
    const a = new MemoryDecisionRoomStore(file)
    const p = a.join('A', T)
    toAsk(a, 0)
    a.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 2 }, T)
    const b = new MemoryDecisionRoomStore(file)
    expect(b.getRoomState()).toEqual(a.getRoomState())
    expect(b.getPublicState(T, p.id).you?.pickedChoiceIndex).toBe(2)
    expect(b.getSeq()).toBe(a.getSeq())
  })

  it('a corrupt snapshot file falls back to a clean lobby, never throws', () => {
    writeFileSync(file, '{not json', 'utf8')
    const s = new MemoryDecisionRoomStore(file)
    expect(s.getRoomState().phase).toBe('lobby')
    expect(s.getPlayers()).toHaveLength(0)
  })

  it('reload drops answers whose questionId no longer exists in QUESTIONS', () => {
    writeFileSync(file, JSON.stringify({
      players: [{
        id: 'p1', name: 'A', joinedAt: T,
        answers: { q1: 2, zzz: 1, q2: 9, q3: 'x' },
      }],
      room: { phase: 'lobby', stageIndex: 0, stageStartedAt: 0, votingClosedAt: null },
      seq: 7,
    }), 'utf8')
    const s = new MemoryDecisionRoomStore(file)
    const player = s.getPlayers()[0]
    // q1 kept; zzz (unknown id), q2 (out of range) and q3 (not an integer) dropped.
    expect(player.answers).toEqual({ q1: 2 })
    expect(s.getSeq()).toBe(7)
  })
})

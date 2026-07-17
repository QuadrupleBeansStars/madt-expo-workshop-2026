import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryRoomStore } from './store'
import { ROUNDS } from './game'

const round0 = ROUNDS[0].id
const opt0 = ROUNDS[0].options[0].id
const opt1 = ROUNDS[0].options[1].id

describe('MemoryRoomStore', () => {
  let store: MemoryRoomStore
  beforeEach(() => { store = new MemoryRoomStore() })

  it('joins a player and assigns a unique id', () => {
    const a = store.join('Detective Ramen', 0)
    const b = store.join('นักสืบกาแฟ', 0)
    expect(a.codename).toBe('Detective Ramen')
    expect(a.id).not.toBe(b.id)
    expect(store.getPlayers()).toHaveLength(2)
  })

  it('records an answer', () => {
    const p = store.join('D', 0)
    store.startGame(1000)
    expect(store.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 1500)).toBe('ok')
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('is first-wins — re-answering the same case is ignored, never overwrites', () => {
    const p = store.join('D', 0)
    store.startGame(1000)
    expect(store.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 1500)).toBe('ok')
    expect(store.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt1 }, 2000)).toBe('duplicate')
    const answers = store.getAnswers()
    expect(answers).toHaveLength(1)
    expect(answers[0].optionId).toBe(opt0)
  })

  it('keeps different players\' answers to the same case separate', () => {
    const p1 = store.join('A', 0)
    const p2 = store.join('B', 0)
    store.startGame(1000)
    store.recordAnswer({ playerId: p1.id, caseId: round0, optionId: opt0 }, 1500)
    store.recordAnswer({ playerId: p2.id, caseId: round0, optionId: opt0 }, 1500)
    expect(store.getAnswers()).toHaveLength(2)
  })

  it('resets', () => {
    store.join('D', 0)
    store.reset()
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
  })

  it('mutating a returned player does not affect subsequent getPlayers() calls', () => {
    store.join('Detective Ramen', 0)
    const players = store.getPlayers()
    players[0].codename = 'Hacked'
    expect(store.getPlayers()[0].codename).toBe('Detective Ramen')
  })

  it('mutating a returned answer does not affect subsequent getAnswers() calls', () => {
    const p = store.join('D', 0)
    store.startGame(1000)
    store.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 1500)
    const answers = store.getAnswers()
    answers[0].optionId = 'hacked'
    expect(store.getAnswers()[0].optionId).toBe(opt0)
  })
})

describe('store game state', () => {
  it('starts in lobby; a lobby joiner is not a spectator', () => {
    const s = new MemoryRoomStore()
    expect(s.getGameState().phase).toBe('lobby')
    const p = s.join('Alice', 1000)
    expect(p.spectator).toBe(false)
    expect(s.getSeq()).toBeGreaterThan(0)
  })

  it('startGame opens round 0 in investigate; a post-start joiner is a spectator', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 1000)
    s.startGame(2000)
    expect(s.getGameState().phase).toBe('investigate')
    const late = s.join('Bob', 3000)
    expect(late.spectator).toBe(true)
  })

  it('recordAnswer server-stamps elapsedMs and is first-wins', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    s.startGame(1000)
    expect(s.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 4000)).toBe('ok')
    const a = s.getAnswers()[0]
    expect(a.elapsedMs).toBe(3000) // 4000 − phaseStartedAt(1000)
    // second answer for same case is ignored (first-wins), returns 'duplicate'
    expect(s.recordAnswer({ playerId: p.id, caseId: round0, optionId: ROUNDS[0].options[1].id }, 5000)).toBe('duplicate')
    expect(s.getAnswers()).toHaveLength(1)
    expect(s.getAnswers()[0].optionId).toBe(opt0)
  })

  it('recordAnswer rejects unknown player, spectator, and wrong/closed round', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    s.startGame(1000)
    expect(s.recordAnswer({ playerId: 'nope', caseId: round0, optionId: opt0 }, 2000)).toBe('unknown')
    const spec = s.join('Late', 1500)
    expect(s.recordAnswer({ playerId: spec.id, caseId: round0, optionId: opt0 }, 2000)).toBe('spectator')
    // wrong case id (not the current round) → closed
    expect(s.recordAnswer({ playerId: p.id, caseId: ROUNDS[1].id, optionId: ROUNDS[1].options[0].id }, 2000)).toBe('closed')
  })

  it('tick flips investigate→reveal on timeout and persists only then', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    s.startGame(1000)
    expect(s.tick(2000)).toBe(false)               // still time left
    expect(s.getGameState().phase).toBe('investigate')
    expect(s.tick(1000 + 75_000 + 1)).toBe(true)   // timed out → flip
    expect(s.getGameState().phase).toBe('reveal')
    expect(s.tick(999_999)).toBe(false)            // already reveal, no more flips
  })

  it('tick flips early when all active players answered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    const b = s.join('Bob', 0)
    s.startGame(1000)
    s.recordAnswer({ playerId: a.id, caseId: round0, optionId: opt0 }, 1100)
    expect(s.tick(1200)).toBe(false)               // Bob hasn't answered
    s.recordAnswer({ playerId: b.id, caseId: round0, optionId: opt0 }, 1300)
    expect(s.tick(1400)).toBe(true)                // all active answered → flip
    expect(s.getGameState().phase).toBe('reveal')
  })

  it('getPublicState reports counts, remaining, and youAnswered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    s.join('Bob', 0)
    s.startGame(1000)
    s.recordAnswer({ playerId: a.id, caseId: round0, optionId: opt0 }, 1500)
    const pub = s.getPublicState(2000, a.id)
    expect(pub.phase).toBe('investigate')
    expect(pub.caseId).toBe(round0)
    expect(pub.playerCount).toBe(2)
    expect(pub.answeredCount).toBe(1)
    expect(pub.remainingMs).toBe(1000 + 75_000 - 2000)
    expect(pub.youAnswered).toBe(true)
    expect(s.getPublicState(2000, 'nobody').youAnswered).toBe(false)
    expect(s.getPublicState(2000).youAnswered).toBeUndefined()
  })

  it('reset returns to lobby and clears players/answers', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    s.startGame(1000)
    s.reset()
    expect(s.getGameState().phase).toBe('lobby')
    expect(s.getPlayers()).toHaveLength(0)
    expect(s.getAnswers()).toHaveLength(0)
  })
})

describe('MemoryRoomStore persistence', () => {
  let dir: string
  let persistPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'room-store-test-'))
    persistPath = join(dir, '.room-state.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('starts empty and stays usable when the file has valid JSON of the wrong shape', () => {
    writeFileSync(persistPath, JSON.stringify({ players: 'oops', answers: null }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
    expect(store.getGameState().phase).toBe('lobby')
    expect(store.getSeq()).toBe(0)
    // Must not throw — the wedged-singleton bug.
    const p = store.join('Detective Ramen', 0)
    expect(store.getPlayers()).toHaveLength(1)
    expect(p.codename).toBe('Detective Ramen')
  })

  it('starts empty when the file is malformed JSON', () => {
    writeFileSync(persistPath, '{not json', 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
    expect(() => store.join('D', 0)).not.toThrow()
  })

  it('skips answer entries missing playerId/caseId instead of crashing', () => {
    writeFileSync(persistPath, JSON.stringify({
      players: [{ id: '1', codename: 'A', joinedAt: 1, spectator: false }],
      answers: [
        { playerId: '1', caseId: round0, optionId: opt0, elapsedMs: 1 },
        { caseId: round0, optionId: opt0, elapsedMs: 1 },
        { playerId: '1', optionId: opt0, elapsedMs: 1 },
      ],
    }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(1)
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('round-trips a valid snapshot: persist, then a new store from the same path recovers it', () => {
    const store1 = new MemoryRoomStore(persistPath)
    const p = store1.join('Detective Ramen', 0)
    store1.startGame(1000)
    store1.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 1500)

    const store2 = new MemoryRoomStore(persistPath)
    expect(store2.getPlayers()).toHaveLength(1)
    expect(store2.getPlayers()[0].codename).toBe('Detective Ramen')
    expect(store2.getAnswers()).toHaveLength(1)
    expect(store2.getAnswers()[0].optionId).toBe(opt0)
    expect(store2.getGameState().phase).toBe('investigate')
    expect(store2.getSeq()).toBe(store1.getSeq())
  })

  it('writes atomically: no leftover temp file after a successful persist', () => {
    const store = new MemoryRoomStore(persistPath)
    store.join('D', 0)
    expect(existsSync(persistPath)).toBe(true)
    const contents = JSON.parse(readFileSync(persistPath, 'utf8'))
    expect(contents.players).toHaveLength(1)
    const leftovers = readdirSync(dir).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

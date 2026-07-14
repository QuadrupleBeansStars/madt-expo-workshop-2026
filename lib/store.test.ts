import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryRoomStore } from './store'

describe('MemoryRoomStore', () => {
  let store: MemoryRoomStore
  beforeEach(() => { store = new MemoryRoomStore() })

  it('joins a player and assigns a unique id', () => {
    const a = store.join('Detective Ramen')
    const b = store.join('นักสืบกาแฟ')
    expect(a.codename).toBe('Detective Ramen')
    expect(a.id).not.toBe(b.id)
    expect(store.getPlayers()).toHaveLength(2)
  })

  it('records an answer', () => {
    const p = store.join('D')
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('is idempotent — re-answering the same case overwrites, never duplicates', () => {
    const p = store.join('D')
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 2000 })
    const answers = store.getAnswers()
    expect(answers).toHaveLength(1)
    expect(answers[0].optionId).toBe('ai-correct')
  })

  it('keeps different players\' answers to the same case separate', () => {
    const p1 = store.join('A')
    const p2 = store.join('B')
    store.recordAnswer({ playerId: p1.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1 })
    store.recordAnswer({ playerId: p2.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1 })
    expect(store.getAnswers()).toHaveLength(2)
  })

  it('resets', () => {
    store.join('D')
    store.reset()
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
  })

  it('mutating a returned player does not affect subsequent getPlayers() calls', () => {
    store.join('Detective Ramen')
    const players = store.getPlayers()
    players[0].codename = 'Hacked'
    expect(store.getPlayers()[0].codename).toBe('Detective Ramen')
  })

  it('mutating a returned answer does not affect subsequent getAnswers() calls', () => {
    const p = store.join('D')
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })
    const answers = store.getAnswers()
    answers[0].optionId = 'hacked'
    expect(store.getAnswers()[0].optionId).toBe('stale')
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
    // Must not throw — the wedged-singleton bug.
    const p = store.join('Detective Ramen')
    expect(store.getPlayers()).toHaveLength(1)
    expect(p.codename).toBe('Detective Ramen')
  })

  it('starts empty when the file is malformed JSON', () => {
    writeFileSync(persistPath, '{not json', 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
    expect(() => store.join('D')).not.toThrow()
  })

  it('skips answer entries missing playerId/caseId instead of crashing', () => {
    writeFileSync(persistPath, JSON.stringify({
      players: [{ id: '1', codename: 'A', joinedAt: 1 }],
      answers: [
        { playerId: '1', caseId: 'artemis', optionId: 'x', elapsedMs: 1 },
        { caseId: 'artemis', optionId: 'x', elapsedMs: 1 },
        { playerId: '1', optionId: 'x', elapsedMs: 1 },
      ],
    }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(1)
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('round-trips a valid snapshot: persist, then a new store from the same path recovers it', () => {
    const store1 = new MemoryRoomStore(persistPath)
    const p = store1.join('Detective Ramen')
    store1.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })

    const store2 = new MemoryRoomStore(persistPath)
    expect(store2.getPlayers()).toHaveLength(1)
    expect(store2.getPlayers()[0].codename).toBe('Detective Ramen')
    expect(store2.getAnswers()).toHaveLength(1)
    expect(store2.getAnswers()[0].optionId).toBe('stale')
  })

  it('writes atomically: no leftover temp file after a successful persist', () => {
    const store = new MemoryRoomStore(persistPath)
    store.join('D')
    expect(existsSync(persistPath)).toBe(true)
    const contents = JSON.parse(readFileSync(persistPath, 'utf8'))
    expect(contents.players).toHaveLength(1)
    const leftovers = readdirSync(dir).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

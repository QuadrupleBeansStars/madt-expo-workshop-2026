import { describe, it, expect, beforeEach } from 'vitest'
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
})

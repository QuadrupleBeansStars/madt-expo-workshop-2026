import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryDeckStore } from './deck-store'
import { SLIDES, SLIDE_COUNT } from './deck'

const T0 = 1_000_000

describe('deck store', () => {
  let store: MemoryDeckStore
  beforeEach(() => { store = new MemoryDeckStore() })

  it('starts in lobby with nobody', () => {
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(s.slideId).toBeNull()
    expect(s.tallies).toEqual([])
  })

  it('join is anonymous and returns a stable id', () => {
    const a = store.join(T0)
    const b = store.join(T0)
    expect(a.id).not.toBe(b.id)
    expect(store.getPublicState(T0).playerCount).toBe(2)
  })

  it('late joiners are full participants, not spectators', () => {
    store.start(T0)
    const late = store.join(T0 + 500)
    const r = store.recordVote({ playerId: late.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 600)
    expect(r).toBe('ok')
  })

  it('rejects votes from unknown players', () => {
    store.start(T0)
    expect(store.recordVote({ playerId: 'nope', slideId: SLIDES[0].id, optionId: 'walk' }, T0)).toBe('unknown')
  })

  it('rejects votes for a slide that is not current', () => {
    const p = store.join(T0)
    store.start(T0)
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[1].id, optionId: '6to8' }, T0)).toBe('closed')
  })

  it('rejects votes once voting has closed', () => {
    const p = store.join(T0)
    store.start(T0)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + dur)).toBe('closed')
  })

  it('is last-write-wins: changing your mind replaces your vote', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'train' }, T0 + 20)
    const s = store.getPublicState(T0 + 30, p.id)
    expect(s.voteCount).toBe(1)
    expect(s.youVoted).toBe('train')
    expect(s.tallies.find((t) => t.optionId === 'train')!.count).toBe(1)
    expect(s.tallies.find((t) => t.optionId === 'walk')!.count).toBe(0)
  })

  it('youVoted is null before voting and absent without a playerId', () => {
    const p = store.join(T0)
    store.start(T0)
    expect(store.getPublicState(T0, p.id).youVoted).toBeNull()
    expect(store.getPublicState(T0).youVoted).toBeUndefined()
  })

  it('host can close voting early', () => {
    const p = store.join(T0)
    store.start(T0)
    store.closeVoting(T0 + 5)
    expect(store.getPublicState(T0 + 6).votingOpen).toBe(false)
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 7)).toBe('closed')
  })

  it('next and back move the deck and are reflected publicly', () => {
    store.start(T0)
    store.next(T0 + 100)
    expect(store.getPublicState(T0 + 100).slideIndex).toBe(1)
    store.back(T0 + 200)
    expect(store.getPublicState(T0 + 200).slideIndex).toBe(0)
  })

  it('votes survive going back to an earlier slide', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.next(T0 + 100)
    store.back(T0 + 200)
    expect(store.getPublicState(T0 + 200, p.id).youVoted).toBe('walk')
  })

  it('reaches done after the last slide', () => {
    store.start(T0)
    for (let i = 0; i < SLIDE_COUNT; i++) store.next(T0 + 100 + i)
    expect(store.getPublicState(T0 + 999).phase).toBe('done')
  })

  it('start is a no-op unless in lobby', () => {
    store.start(T0)
    store.next(T0 + 10)
    store.start(T0 + 20)
    expect(store.getPublicState(T0 + 20).slideIndex).toBe(1)
  })

  it('reset clears players, votes and returns to lobby', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.reset()
    const s = store.getPublicState(T0 + 20)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(store.getVotes()).toEqual([])
  })

  it('seq increases monotonically on every mutation', () => {
    const seqs = [store.getSeq()]
    store.join(T0); seqs.push(store.getSeq())
    store.start(T0); seqs.push(store.getSeq())
    store.next(T0 + 1); seqs.push(store.getSeq())
    store.reset(); seqs.push(store.getSeq())
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
  })
})

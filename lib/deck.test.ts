import { describe, expect, it } from 'vitest'
import {
  SLIDES, SLIDE_COUNT, LOBBY_DECK_STATE, currentSlide, slideAt, acceptsVotes,
  votingOpen, remainingMs, startedDeckState, nextSlideState, backSlideState,
  closeVotingState, tally, MIN_N_FOR_PERCENT, showPercentages,
} from './deck'
import type { DeckState, DeckVote } from './deck-types'

const at = (index: number, startedAt = 1000, closedAt: number | null = null): DeckState =>
  ({ phase: 'slide', slideIndex: index, slideStartedAt: startedAt, votingClosedAt: closedAt })

describe('deck machine', () => {
  it('SLIDES is the deck in order', () => {
    expect(SLIDE_COUNT).toBe(10)
    expect(SLIDES[0].id).toBe('hook-transport')
    expect(SLIDES[SLIDE_COUNT - 1].id).toBe('close')
  })

  it('lobby has no current slide', () => {
    expect(currentSlide(LOBBY_DECK_STATE)).toBeNull()
  })

  it('slideAt returns null out of range', () => {
    expect(slideAt(-1)).toBeNull()
    expect(slideAt(SLIDE_COUNT)).toBeNull()
    expect(slideAt(0)?.id).toBe('hook-transport')
  })

  it('only poll and vote slides accept votes', () => {
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'poll')!)).toBe(true)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'vote')!)).toBe(true)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'reveal')!)).toBe(false)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'content')!)).toBe(false)
  })

  it('start moves lobby to slide 0', () => {
    const s = startedDeckState(5000)
    expect(s.phase).toBe('slide')
    expect(s.slideIndex).toBe(0)
    expect(s.slideStartedAt).toBe(5000)
    expect(s.votingClosedAt).toBeNull()
  })

  it('voting is open on a poll until its duration elapses', () => {
    const s = at(0, 1000)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(votingOpen(s, 1000)).toBe(true)
    expect(votingOpen(s, 1000 + dur - 1)).toBe(true)
    expect(votingOpen(s, 1000 + dur)).toBe(false)
  })

  it('voting is never open on reveal or content slides', () => {
    const revealIndex = SLIDES.findIndex((s) => s.kind === 'reveal')
    expect(votingOpen(at(revealIndex), 1000)).toBe(false)
    const contentIndex = SLIDES.findIndex((s) => s.kind === 'content')
    expect(votingOpen(at(contentIndex), 1000)).toBe(false)
  })

  it('host closing voting shuts it immediately', () => {
    const s = closeVotingState(at(0, 1000), 1200)
    expect(s.votingClosedAt).toBe(1200)
    expect(votingOpen(s, 1201)).toBe(false)
  })

  it('remainingMs is 0 once voting closes and never negative', () => {
    const s = at(0, 1000)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(remainingMs(s, 1000)).toBe(dur)
    expect(remainingMs(s, 1000 + dur + 9999)).toBe(0)
    expect(remainingMs(at(SLIDES.findIndex((x) => x.kind === 'content')), 1000)).toBe(0)
  })

  it('next advances and resets the voting clock', () => {
    const s = nextSlideState(at(0, 1000, 1200), 9000)
    expect(s.slideIndex).toBe(1)
    expect(s.slideStartedAt).toBe(9000)
    expect(s.votingClosedAt).toBeNull()
  })

  it('next past the last slide goes to done and stays there', () => {
    const last = at(SLIDE_COUNT - 1)
    const done = nextSlideState(last, 9000)
    expect(done.phase).toBe('done')
    expect(nextSlideState(done, 9500).phase).toBe('done')
  })

  it('back steps one slide and does not go below zero', () => {
    expect(backSlideState(at(2), 9000).slideIndex).toBe(1)
    expect(backSlideState(at(0), 9000).slideIndex).toBe(0)
  })

  it('back from done returns to the last slide', () => {
    const done = nextSlideState(at(SLIDE_COUNT - 1), 9000)
    const back = backSlideState(done, 9500)
    expect(back.phase).toBe('slide')
    expect(back.slideIndex).toBe(SLIDE_COUNT - 1)
  })

  it('tally counts votes for the slide only, in option order, including zeros', () => {
    const slide = SLIDES[0]
    const votes: DeckVote[] = [
      { playerId: 'a', slideId: 'hook-transport', optionId: 'train' },
      { playerId: 'b', slideId: 'hook-transport', optionId: 'train' },
      { playerId: 'c', slideId: 'hook-transport', optionId: 'walk' },
      { playerId: 'd', slideId: 'hook-wake', optionId: '6to8' },
    ]
    expect(tally(votes, 'hook-transport', slide)).toEqual([
      { optionId: 'walk', count: 1 },
      { optionId: 'train', count: 2 },
      { optionId: 'car', count: 0 },
      { optionId: 'moto', count: 0 },
    ])
  })

  it('tally of a non-voting slide is empty', () => {
    const content = SLIDES.find((s) => s.kind === 'content')!
    expect(tally([], 'close', content)).toEqual([])
  })

  it('percentages are suppressed below the n=5 floor', () => {
    expect(MIN_N_FOR_PERCENT).toBe(5)
    expect(showPercentages(0)).toBe(false)
    expect(showPercentages(4)).toBe(false)
    expect(showPercentages(5)).toBe(true)
  })
})

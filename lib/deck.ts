import { DECK } from '@/content/deck'
import type { DeckState, DeckVote, PollSlide, Slide, Tally, VoteSlide } from './deck-types'

export const SLIDES: Slide[] = DECK
export const SLIDE_COUNT = SLIDES.length

/**
 * Small rooms are the expo norm. Below this many votes we show raw counts only —
 * "67%" from three people reads as a real statistic and is not one. Spec §4.
 */
export const MIN_N_FOR_PERCENT = 5
export function showPercentages(total: number): boolean {
  return total >= MIN_N_FOR_PERCENT
}

export const LOBBY_DECK_STATE: DeckState = {
  phase: 'lobby', slideIndex: 0, slideStartedAt: 0, votingClosedAt: null,
}

export function slideAt(index: number): Slide | null {
  return SLIDES[index] ?? null
}

export function currentSlide(state: DeckState): Slide | null {
  if (state.phase !== 'slide') return null
  return slideAt(state.slideIndex)
}

export function acceptsVotes(slide: Slide): slide is PollSlide | VoteSlide {
  return slide.kind === 'poll' || slide.kind === 'vote'
}

function durationOf(slide: Slide): number {
  return slide.kind === 'poll' || slide.kind === 'vote' ? slide.durationMs : 0
}

/**
 * Voting is open while the slide accepts votes, the host has not closed it,
 * and the per-slide timer has not elapsed. The timer closes VOTING only — it
 * never advances the deck. Advancing is always the host's action. Spec §3.3.
 */
export function votingOpen(state: DeckState, now: number): boolean {
  const slide = currentSlide(state)
  if (!slide || !acceptsVotes(slide)) return false
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return false
  return now < state.slideStartedAt + durationOf(slide)
}

export function remainingMs(state: DeckState, now: number): number {
  const slide = currentSlide(state)
  if (!slide || !acceptsVotes(slide)) return 0
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return 0
  return Math.max(0, state.slideStartedAt + durationOf(slide) - now)
}

export function startedDeckState(now: number): DeckState {
  return { phase: 'slide', slideIndex: 0, slideStartedAt: now, votingClosedAt: null }
}

export function closeVotingState(state: DeckState, now: number): DeckState {
  return { ...state, votingClosedAt: now }
}

export function nextSlideState(state: DeckState, now: number): DeckState {
  if (state.phase === 'done') return state
  const next = state.slideIndex + 1
  if (next >= SLIDE_COUNT) {
    return { phase: 'done', slideIndex: state.slideIndex, slideStartedAt: now, votingClosedAt: null }
  }
  return { phase: 'slide', slideIndex: next, slideStartedAt: now, votingClosedAt: null }
}

export function backSlideState(state: DeckState, now: number): DeckState {
  if (state.phase === 'done') {
    return { phase: 'slide', slideIndex: SLIDE_COUNT - 1, slideStartedAt: now, votingClosedAt: null }
  }
  const prev = Math.max(0, state.slideIndex - 1)
  return { phase: 'slide', slideIndex: prev, slideStartedAt: now, votingClosedAt: null }
}

/** Counts in the slide's own option order, zeros included so bars never reflow. */
export function tally(votes: DeckVote[], slideId: string, slide: Slide): Tally[] {
  if (!acceptsVotes(slide)) return []
  const counts = new Map<string, number>(slide.options.map((o) => [o.id, 0]))
  for (const v of votes) {
    if (v.slideId !== slideId) continue
    const n = counts.get(v.optionId)
    if (n !== undefined) counts.set(v.optionId, n + 1)
  }
  return slide.options.map((o) => ({ optionId: o.id, count: counts.get(o.id)! }))
}

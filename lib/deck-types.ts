import { z } from 'zod'
import { LocalizedTextSchema } from './types'

export const DeckOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
})
export type DeckOption = z.infer<typeof DeckOptionSchema>

/** Hook question. No correct answer — the point is the aggregate. */
export const PollSlideSchema = z.object({
  kind: z.literal('poll'),
  id: z.string().min(1),
  prompt: LocalizedTextSchema,
  options: z.array(DeckOptionSchema).min(3).max(4),
  durationMs: z.number().int().positive(),
})
export type PollSlide = z.infer<typeof PollSlideSchema>

/** Beat question. `bestOptionId` structures the reveal; it is NOT scored. */
export const VoteSlideSchema = z.object({
  kind: z.literal('vote'),
  id: z.string().min(1),
  prompt: LocalizedTextSchema,
  options: z.array(DeckOptionSchema).min(3).max(4),
  durationMs: z.number().int().positive(),
  bestOptionId: z.string().min(1),
})
export type VoteSlide = z.infer<typeof VoteSlideSchema>

export const RevealSlideSchema = z.object({
  kind: z.literal('reveal'),
  id: z.string().min(1),
  /** id of the poll/vote slide whose results this reveals. */
  forSlideId: z.string().min(1),
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
  lesson: LocalizedTextSchema,
})
export type RevealSlide = z.infer<typeof RevealSlideSchema>

export const ContentSlideSchema = z.object({
  kind: z.literal('content'),
  id: z.string().min(1),
  headline: LocalizedTextSchema,
  bullets: z.array(LocalizedTextSchema).min(1),
})
export type ContentSlide = z.infer<typeof ContentSlideSchema>

export const SlideSchema = z.discriminatedUnion('kind', [
  PollSlideSchema, VoteSlideSchema, RevealSlideSchema, ContentSlideSchema,
])
export type Slide = z.infer<typeof SlideSchema>

export type DeckPhase = 'lobby' | 'slide' | 'done'

/** Server-authoritative. `slideStartedAt` + the slide's durationMs are the ONLY clock. */
export type DeckState = {
  phase: DeckPhase
  slideIndex: number
  slideStartedAt: number
  /** Set when the host closes voting early; null while the timer governs. */
  votingClosedAt: number | null
}

export type DeckPlayer = { id: string; joinedAt: number }
export type DeckVote = { playerId: string; slideId: string; optionId: string }

export type Tally = { optionId: string; count: number }

export type PublicDeckState = {
  seq: number
  phase: DeckPhase
  slideIndex: number
  slideId: string | null
  votingOpen: boolean
  remainingMs: number
  playerCount: number
  /** Votes cast on the current slide. */
  voteCount: number
  tallies: Tally[]
  /** Present only when the request carried a playerId. optionId, or null if not yet voted. */
  youVoted?: string | null
}

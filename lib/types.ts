import { z } from 'zod'

export type Lang = 'th' | 'en'

export const LocalizedTextSchema = z.object({ th: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof LocalizedTextSchema>

export const DifficultySchema = z.enum(['easy', 'medium', 'hard', 'expert', 'final'])
export type Difficulty = z.infer<typeof DifficultySchema>

/** A document in the Case File knowledge base. `found: false` is the retrieval gap. */
export const CaseDocSchema = z.object({
  filename: z.string().min(1),
  kind: z.enum(['headline', 'chart', 'screenshot', 'excerpt', 'table']),
  found: z.boolean(),
  title: LocalizedTextSchema,
  body: LocalizedTextSchema.optional(),
  sourceUrl: z.string().url().optional(),
  /** True for openly in-world/fictional evidence (Case 4). Rendered with a FICTIONAL badge. */
  fictional: z.boolean().default(false),
})
export type CaseDoc = z.infer<typeof CaseDocSchema>

export const CaseOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  correct: z.boolean(),
})
export type CaseOption = z.infer<typeof CaseOptionSchema>

export const DetectiveCaseSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1).max(5),
  difficulty: DifficultySchema,
  question: LocalizedTextSchema,
  aiAnswer: LocalizedTextSchema,
  docs: z.array(CaseDocSchema),
  options: z.array(CaseOptionSchema).length(4),
  reveal: LocalizedTextSchema,
  failureMode: LocalizedTextSchema,
}).refine(
  (c) => c.options.filter((o) => o.correct).length === 1,
  { message: 'a case must have exactly one correct option' },
)
export type DetectiveCase = z.infer<typeof DetectiveCaseSchema>

export type Player = { id: string; codename: string; joinedAt: number; spectator: boolean }
export type Answer = { playerId: string; caseId: string; optionId: string; elapsedMs: number }

export type Phase = 'lobby' | 'investigate' | 'reveal' | 'final'

/** Server-authoritative game state. `phaseStartedAt`/`phaseDurationMs` are the ONLY clock. */
export type GameState = {
  phase: Phase
  /** 0-based index into game ROUNDS (cases sorted by order). Meaningful in investigate/reveal. */
  roundIndex: number
  /** Server epoch ms when the current phase began. */
  phaseStartedAt: number
  /** Duration of the current phase in ms; 0 for untimed phases (lobby, reveal, final). */
  phaseDurationMs: number
}

/** What clients receive from /api/state. `remainingMs` is server-computed; clients never derive it. */
export type PublicGameState = {
  seq: number
  phase: Phase
  roundIndex: number
  caseId: string | null
  remainingMs: number
  answeredCount: number
  playerCount: number
  youAnswered?: boolean
  /**
   * Present only when the request carried a playerId that the store still knows — the same
   * contract as The Decision Room's `you` (lib/room-store.ts). Its ABSENCE is the signal: a
   * 200 for the id we sent, with no `you`, means the host reset the room and this phone's
   * identity is gone. `youAnswered` cannot carry that signal, because it is already `false`
   * for an unknown player and `false` is also the honest answer for a known one who has not
   * answered yet.
   */
  you?: {
    codename: string
    /** Spectators are real players who never score. They must NOT be ejected. */
    spectator: boolean
  }
}

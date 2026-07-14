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

export type Player = { id: string; codename: string; joinedAt: number }
export type Answer = { playerId: string; caseId: string; optionId: string; elapsedMs: number }

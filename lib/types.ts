import { z } from 'zod'

export type Lang = 'th' | 'en'

export const LocalizedTextSchema = z.object({ th: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof LocalizedTextSchema>

/**
 * One frame of a storyboard — the team's note after the 3 Aug run-through, for BOTH workshops:
 * *โจทย์อาจจะเป็นฟีล storyboard เป็นตัวการ์ตูนคุยกัน*. A wall of text is what a bilingual question
 * becomes on a projector at the back of a hall; two or three captioned frames are not.
 *
 * Shared by AI Detective's cases and The Decision Room's stages deliberately, so the two workshops
 * cannot drift into two different notions of what a panel is.
 *
 * `art` is the upgrade path. Ships empty: `emoji` renders as the character today, so the panels
 * work with no illustration at all and nothing is blocked on a designer. Point `art` at an image
 * in /public later and the renderer prefers it — no code change, no content restructuring. It is
 * a plain path rather than an import so art can be dropped in without a rebuild of this file.
 */
export const StoryPanelSchema = z.object({
  /** The character or object in frame. Rendered large; this is the panel's whole visual today. */
  emoji: z.string().min(1),
  /** One short line. Long enough for a sentence, never a paragraph — it is a comic caption. */
  caption: LocalizedTextSchema,
  /** Optional path under /public, e.g. `/story/barista-01.png`. Replaces `emoji` when present. */
  art: z.string().min(1).optional(),
})
export type StoryPanel = z.infer<typeof StoryPanelSchema>

/**
 * A storyboard: two to four frames. The cap is a layout constraint, not a style preference — four
 * frames is what fits across a 1366x768 projector beside a question and its answer buttons, and
 * `npm run check:projector` is what enforces it in practice.
 */
export const StoryboardSchema = z.array(StoryPanelSchema).min(2).max(4)

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
  /**
   * Optional storyboard, shown above the question. Optional rather than required so cases can be
   * converted one at a time — an un-panelled case still renders exactly as it does today.
   */
  storyboard: StoryboardSchema.optional(),
  aiAnswer: LocalizedTextSchema,
  docs: z.array(CaseDocSchema),
  options: z.array(CaseOptionSchema).length(4),
  reveal: LocalizedTextSchema,
  failureMode: LocalizedTextSchema,
  /**
   * The teaching beat, and the only part of a case that is meant to LEAVE the room.
   *
   * REQUIRED, unlike `storyboard`. `reveal` says what happened in this particular case; this says
   * what to do about it next Tuesday, in front of a different question. A sixth case that ships
   * without one would be a quiz question with no lesson attached, which is the failure this whole
   * workshop exists to avoid — so the schema refuses it rather than rendering an empty panel.
   *
   * Write it as an INSTRUCTION, not a summary. If it cannot be written without restating `reveal`,
   * the case does not need this field — it needs `failureMode`, which is right above.
   *
   * Case 5 is the shape test: the AI is RIGHT there, so the check is about not treating suspicion
   * as a substitute for verification. Anything phrased as "here is the trick" breaks on it.
   */
  checkNextTime: LocalizedTextSchema,
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

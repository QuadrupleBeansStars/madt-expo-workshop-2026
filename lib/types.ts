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

/** What the player is supposed to DO with this answer — not "is the duck right". */
export const VerdictSchema = z.enum(['pass', 'reject'])
export type Verdict = z.infer<typeof VerdictSchema>

/**
 * One question. Length caps are the projector budget, not style: `ask` renders at one size on a
 * 1366x768 screen and `duckSays` sits in a speech bubble beside a large duck. Exceeding them does
 * not wrap gracefully, it pushes the host's own controls off the bottom of the screen.
 */
export const QuestionSchema = z.object({
  id: z.string().min(1),
  /* The cap is the SET's size, and it moves with the set: it was 9, and the third จริง case
     (`coffee-sleep-source`, content/questions.ts) took the game to ten. It is not a projector budget like
     the string caps below — it is the guard that stops a typo'd `order: 40` from silently sorting
     a case to the end of the game. `content/questions.test.ts` asserts the real sequence. */
  order: z.number().int().min(1).max(10),
  ask: z.string().min(1).max(80),
  duckSays: z.string().min(1).max(140),
  /** Exact substring of `duckSays`, marked on the reveal. The lie, or the load-bearing claim. */
  highlight: z.string().min(1),
  verdict: VerdictSchema,
  truth: z.string().min(1).max(220),
  tell: z.string().min(1).max(160),
  /** Facilitator note. NEVER rendered — it exists so the check list travels with the content. */
  needsCheck: z.string().optional(),
}).refine((q) => q.duckSays.includes(q.highlight), {
  message: 'highlight must be an exact substring of duckSays',
})
export type Question = z.infer<typeof QuestionSchema>

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

export type Player = { id: string; codename: string; joinedAt: number; spectator: boolean; avatar: string }
export type Answer = { playerId: string; questionId: string; verdict: Verdict; elapsedMs: number }

/**
 * `rules` sits between `lobby` and the FIRST `reading` and is never entered again — question 2
 * onward goes straight from `reveal` back to `reading` (see `lib/game.ts#nextState`).
 * It is host-advanced with no countdown: `reading` and `question` have clocks because the room
 * has to move together; a hundred people read a rules screen at a hundred speeds, and it is the
 * one screen where spending an extra ten seconds costs the run nothing.
 */
export type Phase = 'lobby' | 'rules' | 'reading' | 'question' | 'reveal' | 'tally' | 'podium'

/** Server-authoritative. `phaseStartedAt`/`phaseDurationMs` are the ONLY clock. */
export type GameState = {
  phase: Phase
  /** 0-based index into QUESTIONS_IN_ORDER. */
  qIndex: number
  phaseStartedAt: number
  /** 0 for the host-advanced phases: lobby, rules, reveal, tally, podium. */
  phaseDurationMs: number
  /** @deprecated The reveal is untimed and nothing freezes it. Kept so a persisted v3.1
   *  snapshot still parses; no code reads it. */
  holding: boolean
}

export type PublicGameState = {
  seq: number
  phase: Phase
  qIndex: number
  questionId: string | null
  remainingMs: number
  answeredCount: number
  playerCount: number
  holding: boolean
  youAnswered?: boolean
  you?: {
    codename: string
    avatar: string
    spectator: boolean
    score: number
    rank: number
    streak: number
    wrongPass: number
    /**
     * The player's own result on the CURRENT question (`qIndex`), from their actual recorded
     * answer — not ephemeral client state. `null` means they never answered it (spectator, or the
     * window closed before they tapped); `false` means they answered and were wrong. Spec §5b:
     * the phone's reveal has to show ถูก/ผิด + points + rank and survive a reload, so these two
     * cannot live only in the phone's own React state the way v3 originally shipped them.
     */
    lastCorrect: boolean | null
    lastPoints: number | null
    /**
     * Points between this player and the one immediately above them on the leaderboard — Kahoot's
     * move, and the number that keeps someone playing: "85 behind 3rd" says the next question can
     * change it, which a bare total cannot.
     *
     * ABSENT — not `0` — for rank 1, and absent for anyone off the board (a spectator, whose
     * `rank` is the existing `0` sentinel). This is the same "absence is meaningful" contract
     * `lastCorrect` documents above, and here it is load-bearing rather than tidy: ranks are
     * POSITIONAL (see `lib/store.ts#getLeaderboard`), so two players on the same score sit at
     * ranks n and n+1 and the lower one's REAL gap is `0`. If the leader were also sent `0` the
     * phone could not tell "you lead" from "you are level with the person above you", which are
     * opposite messages. Optional here, so the two cases cannot collapse.
     *
     * Derived from `getLeaderboard()` on every read; nothing new is stored. It is the player's
     * own standing only — no other player's score or name is exposed by it.
     */
    gapToNext?: number
    /**
     * The share of the room, as a whole percent, that got the CURRENT question wrong.
     *
     * The phone shows it under the player's own result so a person can see they were not the only
     * one fooled — which is what lets them accept it rather than quietly conclude they are bad at
     * this. It is the workshop's whole argument in one number, on the screen they are already
     * looking at.
     *
     * It has to come from the server. The pass/reject split is public, but WHICH SIDE IS WRONG is
     * the answer key, and `app/page.tsx` is a client component: importing `content/questions`
     * there would ship all nine verdicts into every player's bundle, readable in devtools. The
     * server does the comparison and sends only the percentage.
     *
     * REVEAL-ONLY, like `lastCorrect`/`lastPoints` — during `question` it would tell an early
     * answerer how the room is leaning.
     *
     * ABSENT — not `0` — when nobody answered. "Nobody got it wrong" and "nobody answered at all"
     * are different facts, and 0 would render as the first while meaning the second.
     */
    roomWrongPct?: number
  }
}

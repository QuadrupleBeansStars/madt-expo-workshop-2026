// The Decision Room — stage content model.
//
// One host-driven sequence of typed stages on one route (spec §2). There are exactly five stage
// kinds; teaching does not get its own kind, because the `outcome` stage IS the teaching.
//
// Every user-facing string is `LocalizedText` and both languages render at once. There is no
// language toggle anywhere in this workshop and no type here takes a `lang` prop (spec §7).

import { z } from 'zod'
import { LocalizedTextSchema } from './types'

/**
 * A player's shop, carried across all three rounds (spec §5.1).
 *
 * `revenue`, `profit` and `satisfaction` improve as they rise. `waste` (unsold stock, ฿) is
 * **inverted** — lower is better. Inverting one metric is deliberate: a player who pushes every
 * bar upward loses, which is the workshop's argument compressed into a scoreboard.
 */
export const KpiSchema = z.object({
  revenue: z.number(),
  profit: z.number(),
  satisfaction: z.number(),
  waste: z.number(),
})
export type Kpi = z.infer<typeof KpiSchema>

/** What one option does to a shop. Absent keys mean "unchanged". */
export const KpiDeltaSchema = KpiSchema.partial()
export type KpiDelta = z.infer<typeof KpiDeltaSchema>

/**
 * Weights for the leaderboard score. `shopValue(kpi)` (Task 6) MUST use these and nothing else —
 * they are exported here rather than living inside the store because the round 3 options are
 * balanced against them, and `content/room.test.ts` asserts that balance holds.
 *
 * `revenue` is deliberately the smallest: it is already largely counted inside `profit`, so
 * weighting it near 1 would double-count turnover and hand the round to the option that simply
 * sells the most. `waste` **subtracts** — see KpiSchema.
 *
 * `satisfaction` is a 0-100 score rather than baht, so its weight converts points to roughly
 * baht-scale before they are added.
 */
export const SHOP_VALUE_WEIGHTS = {
  revenue: 0.2,
  profit: 1,
  satisfaction: 20,
  waste: 1,
} as const

const StageIdSchema = z.string().min(1)

/** Title, QR, player count. Phones are joining. */
export const IntroStageSchema = z.object({
  kind: z.literal('intro'),
  id: StageIdSchema,
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
})
export type IntroStage = z.infer<typeof IntroStageSchema>

/** A dashboard of the audience's own registration data. Phones hold. */
export const DataStageSchema = z.object({
  kind: z.literal('data'),
  id: StageIdSchema,
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
  /** The two or three figures the host reads out loud before the decision that uses them. */
  points: z.array(LocalizedTextSchema).min(1).max(4),
})
export type DataStage = z.infer<typeof DataStageSchema>

/**
 * An option in the one simulated round. It carries the staffing level it stands for and NOTHING
 * else: the result is computed from the audience's own registration answers by
 * `simulateStaffing`, so writing an outcome here by hand would be exactly the dishonesty this
 * workshop argues against (spec §4).
 */
export const SimulatedOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  /** Baristas on the bar at 07:00 — the simulator's only input from the player. */
  baristas: z.number().int().min(0),
})
export type SimulatedOption = z.infer<typeof SimulatedOptionSchema>

/** An option in a fixed round. `fx` is applied straight to the player's Kpi when voting closes. */
export const FixedOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  fx: KpiDeltaSchema,
})
export type FixedOption = z.infer<typeof FixedOptionSchema>

/**
 * The registration questions a decide stage can put on screen beside its question.
 *
 * A closed enum rather than `string`, so a mistyped key is a compile error here and not a blank
 * chart in front of 200 people. These are exactly the non-`respondents` fields of
 * `AudienceAggregate` (`content/audience.ts`); `content/room.test.ts` asserts that correspondence
 * at runtime, because this file must not import from `content/` (the dependency runs content→lib).
 */
export const EvidenceKeySchema = z.enum([
  'arrivalMode',
  'wakeTime',
  'firstDrink',
  'buyTime',
  'queuePatience',
])
export type EvidenceKey = z.infer<typeof EvidenceKeySchema>

const decideBase = {
  kind: z.literal('decide'),
  id: StageIdSchema,
  prompt: LocalizedTextSchema,
  /** The data that bears on the decision, shown beside it. */
  context: LocalizedTextSchema,
  /**
   * Which audience distributions bear on THIS decision — spec §2: a decide stage shows "the
   * question, the data that bears on it, a live timer". The projector renders one chart per entry
   * beside the question and the phone renders the same figures as text, so nobody is asked to
   * decide from memory of a screen two stages ago.
   *
   * Optional: rounds that reach past the registration data (price, capital) have nothing honest
   * to show, and an empty list says so rather than dressing the screen with an unrelated chart.
   */
  evidence: z.array(EvidenceKeySchema).optional(),
  /**
   * The voting window only — NOT the stage's share of the fifteen minutes. The gap between this
   * and spec §5.2's clock times is the host talking around the vote; `ALLOWANCE_MS` in
   * `content/room.ts` is where that time is budgeted.
   */
  durationMs: z.number().int().positive(),
}

/** Round 1. Resolved by playing the audience's own answers forward. */
export const SimulatedDecideStageSchema = z.object({
  ...decideBase,
  resolve: z.literal('simulate-staffing'),
  options: z.array(SimulatedOptionSchema).min(2).max(4),
})
export type SimulatedDecideStage = z.infer<typeof SimulatedDecideStageSchema>

/** Rounds 2 and 3. Fixed KPI deltas — price sensitivity and capital allocation are not in the
 * five registration questions, so there is nothing honest to simulate them from (spec §4). */
export const FixedDecideStageSchema = z.object({
  ...decideBase,
  resolve: z.literal('fixed'),
  options: z.array(FixedOptionSchema).min(2).max(4),
})
export type FixedDecideStage = z.infer<typeof FixedDecideStageSchema>

/**
 * Resolution is itself a discriminated union, so a stage structurally cannot claim both: an
 * option in the simulated round has no `fx` field to write, and an option in a fixed round has no
 * staffing level. This is enforced by the type system, not by a convention.
 */
export const DecideStageSchema = z.discriminatedUnion('resolve', [
  SimulatedDecideStageSchema,
  FixedDecideStageSchema,
])
export type DecideStage = z.infer<typeof DecideStageSchema>

/** What each choice did, why, and the leaderboard. **This stage is the teaching** (spec §2). */
export const OutcomeStageSchema = z.object({
  kind: z.literal('outcome'),
  id: StageIdSchema,
  /** id of the decide stage whose result this resolves. */
  forStageId: StageIdSchema,
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
  /** The teaching beat — the whole reason this stage kind exists. */
  lesson: LocalizedTextSchema,
})
export type OutcomeStage = z.infer<typeof OutcomeStageSchema>

/** Final board, archetypes, three takeaways. */
export const CloseStageSchema = z.object({
  kind: z.literal('close'),
  id: StageIdSchema,
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
  takeaways: z.array(LocalizedTextSchema).min(1).max(4),
})
export type CloseStage = z.infer<typeof CloseStageSchema>

export const StageSchema = z.discriminatedUnion('kind', [
  IntroStageSchema,
  DataStageSchema,
  DecideStageSchema,
  OutcomeStageSchema,
  CloseStageSchema,
])
export type Stage = z.infer<typeof StageSchema>

export type StageKind = Stage['kind']

/**
 * A player's strongest KPI becomes their archetype on the close screen (spec §5.4). Keyed by KPI
 * so the mapping is total: every player has a strongest bar, so every player gets a name.
 */
export const ArchetypeSchema = z.object({
  name: LocalizedTextSchema,
  /** Flattery with a sting: the failure mode of the strategy that earned the name. */
  sting: LocalizedTextSchema,
})
export type Archetype = z.infer<typeof ArchetypeSchema>

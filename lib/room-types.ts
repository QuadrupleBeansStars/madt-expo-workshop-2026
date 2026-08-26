// Café Persona — framework types. Four decision-maker personas on two axes; a question offers
// exactly one choice per persona. There is deliberately NO `correct` field anywhere in this file:
// the game's argument is that there is no 0 or 1 in deciding with data, and the type system is
// where that argument is enforced.

import { z } from 'zod'

export const PERSONA_IDS = ['pioneer', 'sprinter', 'analyst', 'guardian'] as const
export const PersonaIdSchema = z.enum(PERSONA_IDS)
export type PersonaId = z.infer<typeof PersonaIdSchema>

/**
 * The two axes, as framework data rather than copy. Lives here (not content) because scoring's
 * tie-break (lib/persona.ts) needs it and must not import content.
 */
export const AXIS: Record<PersonaId, { pace: 'fast' | 'slow'; trust: 'gut' | 'data' }> = {
  pioneer:  { pace: 'fast', trust: 'gut' },
  sprinter: { pace: 'fast', trust: 'data' },
  analyst:  { pace: 'slow', trust: 'data' },
  guardian: { pace: 'slow', trust: 'gut' },
}

/** English axis labels — shown verbatim on the result map (spec: framework language is English). */
export const AXIS_LABELS = {
  pace: { fast: 'MOVE FAST', slow: 'WAIT & SEE' },
  trust: { gut: 'GUT', data: 'DATA' },
} as const

export const PersonaSchema = z.object({
  id: PersonaIdSchema,
  /** English, uppercase — "THE ANALYST". */
  label: z.string().min(1),
  /** Thai coffee name — "โคลด์บริว". */
  coffee: z.string().min(1),
  /** Thai archetype — "นักวิเคราะห์". */
  archetype: z.string().min(1),
  /**
   * The MAD+ mascot this persona is, and the finale's only face.
   *
   * MAPPED FROM THE OFFICIAL PROFILES (2026 MADT EXPO), not from the artwork. An earlier pass read
   * the colours and the objects in each character's hands and got all four wrong — what a mascot
   * HOLDS is its job in the AI pipeline, not its temperament. The evidence that settles it is the
   * last page: Techie deploys, measures and hands the feedback back to BeeDee, which is exactly
   * the SPRINTER↔GUARDIAN complement `partner` already asserts below.
   *
   * `art` is a path under /public — the Dockerfile copies that folder into the standalone image.
   * `quote` is the character's own line from the same document, shown once, on the phone card.
   */
  mascot: z.object({
    name: z.string().min(1),
    art: z.string().min(1),
    quote: z.string().min(1),
  }),
  /** Who you are: 2–3 warm second-person Thai sentences (MBTI register). */
  description: z.string().min(1),
  strength: z.string().min(1),
  /** The loving flaw. */
  caution: z.string().min(1),
  /** MUST be the diagonal opposite — asserted in content/persona.test.ts. */
  partner: PersonaIdSchema,
})
export type Persona = z.infer<typeof PersonaSchema>

export const ChoiceSchema = z.object({
  /** Thai. The on-screen order of the tuple IS the A–D order — authored shuffled per question. */
  label: z.string().min(1),
  persona: PersonaIdSchema,
})
export type Choice = z.infer<typeof ChoiceSchema>

export const AUDIENCE_FIELDS = [
  'arrivalMode', 'wakeTime', 'firstDrink', 'firstBuy', 'buyTime', 'queuePatience', 'spend',
  'mainFactor',
] as const

export const QuestionSchema = z.object({
  id: z.string().min(1),
  /**
   * The ask stage PLOTS this field's full distribution from AUDIENCE — the projector renders a
   * chart, never a lone figure. `highlight` names the bucket(s) the scenario turns on; every key
   * must exist in that field (content/persona.test.ts checks). `caption` is the "so what" line
   * under the chart — compute any number in it from AUDIENCE, never hand-type one.
   */
  dataHook: z.object({
    field: z.enum(AUDIENCE_FIELDS),
    highlight: z.array(z.string().min(1)).min(1),
    caption: z.string().min(1),
  }),
  scenario: z.string().min(1),
  choices: z.tuple([ChoiceSchema, ChoiceSchema, ChoiceSchema, ChoiceSchema]),
  /** The reveal beat: one Thai paragraph honoring at least two paths. */
  smallTalk: z.string().min(1),
})
export type Question = z.infer<typeof QuestionSchema>

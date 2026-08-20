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
  emoji: z.string().min(1),
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

export const QuestionSchema = z.object({
  id: z.string().min(1),
  /** figure is COMPUTED from AUDIENCE, never hand-typed — content/persona.test.ts re-derives it. */
  dataHook: z.object({ figure: z.string().min(1), caption: z.string().min(1) }),
  scenario: z.string().min(1),
  choices: z.tuple([ChoiceSchema, ChoiceSchema, ChoiceSchema, ChoiceSchema]),
  /** The reveal beat: one Thai paragraph honoring at least two paths. */
  smallTalk: z.string().min(1),
})
export type Question = z.infer<typeof QuestionSchema>

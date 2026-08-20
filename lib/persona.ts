// Café Persona — pure scoring. No I/O, no clock, no randomness, no content import: two players
// who answer alike ALWAYS type alike, and the tie-break is explainable on stage in one sentence.

import { AXIS, PERSONA_IDS } from './room-types'
import type { PersonaId } from './room-types'

/**
 * Fixed last-resort tie order. Documented, deterministic, and rare at 8 questions — it exists so
 * a perfectly balanced player still gets ONE card instead of a coin flip.
 */
export const PRECEDENCE: readonly PersonaId[] = ['analyst', 'sprinter', 'guardian', 'pioneer']

export function tally(answers: PersonaId[]): Record<PersonaId, number> {
  const t: Record<PersonaId, number> = { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 }
  for (const a of answers) t[a]++
  return t
}

/** fast → pace +1, slow → −1; data → trust +1, gut → −1. */
export function axisLean(answers: PersonaId[]): { pace: number; trust: number } {
  let pace = 0
  let trust = 0
  for (const a of answers) {
    pace += AXIS[a].pace === 'fast' ? 1 : -1
    trust += AXIS[a].trust === 'data' ? 1 : -1
  }
  return { pace, trust }
}

/**
 * Highest tally wins. Ties break by the player's STRONGER axis lean (the tied persona matching
 * that lean's direction); if the axes tie too, or the lean cannot split the tied set, the fixed
 * PRECEDENCE order decides. Empty answers → null: a late joiner gets a graceful no-card state,
 * never an invented type.
 */
export function finalPersona(answers: PersonaId[]): PersonaId | null {
  if (answers.length === 0) return null
  const t = tally(answers)
  const max = Math.max(...PERSONA_IDS.map((id) => t[id]))
  let tied = PERSONA_IDS.filter((id) => t[id] === max)
  if (tied.length === 1) return tied[0]

  const lean = axisLean(answers)
  const axis: 'pace' | 'trust' | null =
    Math.abs(lean.pace) > Math.abs(lean.trust) ? 'pace'
    : Math.abs(lean.trust) > Math.abs(lean.pace) ? 'trust'
    : null
  if (axis) {
    const want = axis === 'pace' ? (lean.pace > 0 ? 'fast' : 'slow') : (lean.trust > 0 ? 'data' : 'gut')
    const split = tied.filter((id) => AXIS[id][axis] === want)
    if (split.length >= 1) tied = split
  }
  return PRECEDENCE.find((id) => tied.includes(id))!
}

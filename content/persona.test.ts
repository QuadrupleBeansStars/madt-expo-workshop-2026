import { describe, expect, it } from 'vitest'
import { AUDIENCE, bucketTotal } from '@/content/audience'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { AXIS, PERSONA_IDS, PersonaSchema, QuestionSchema } from '@/lib/room-types'

describe('personas', () => {
  it('has all four, valid, keyed by their own id', () => {
    for (const id of PERSONA_IDS) {
      const p = PERSONAS[id]
      expect(PersonaSchema.parse(p).id).toBe(id)
    }
  })

  it('partner is always the diagonal opposite', () => {
    for (const id of PERSONA_IDS) {
      const me = AXIS[id]
      const partner = AXIS[PERSONAS[id].partner]
      expect(partner.pace).not.toBe(me.pace)
      expect(partner.trust).not.toBe(me.trust)
    }
  })

  it('labels are English-uppercase framework names', () => {
    for (const id of PERSONA_IDS) expect(PERSONAS[id].label).toMatch(/^THE [A-Z]+$/)
  })
})

describe('questions', () => {
  it('there are eight, unique ids, all valid', () => {
    expect(QUESTIONS).toHaveLength(8)
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(8)
    for (const q of QUESTIONS) QuestionSchema.parse(q)
  })

  it('every question offers each persona exactly once', () => {
    for (const q of QUESTIONS) {
      expect(new Set(q.choices.map((c) => c.persona)).size).toBe(4)
    }
  })

  it('choice order varies across questions (no fixed persona→letter mapping)', () => {
    const orders = new Set(QUESTIONS.map((q) => q.choices.map((c) => c.persona).join(',')))
    expect(orders.size).toBeGreaterThan(1)
  })

  // The honesty rule: figures are re-derived from AUDIENCE, so a survey re-import updates them.
  it('data-hook figures derive from AUDIENCE', () => {
    const n = AUDIENCE.respondents
    expect(n).toBe(bucketTotal(AUDIENCE.queuePatience))
    const expected: Record<string, string> = {
      q1: `${AUDIENCE.mainFactor.taste}/${n}`,
      q2: `${AUDIENCE.queuePatience.under5 + AUDIENCE.queuePatience.under10}/${n}`,
      q3: `${AUDIENCE.spend['50to100']}/${n}`,
      q4: `${AUDIENCE.firstDrink.water}/${n}`,
      q5: `${AUDIENCE.arrivalMode.car}/${n}`,
      q6: `${AUDIENCE.buyTime['7to9']}/${n}`,
      q7: `${AUDIENCE.mainFactor.price}/${n}`,
      q8: `${AUDIENCE.wakeTime.before6}/${n}`,
    }
    for (const q of QUESTIONS) expect(q.dataHook.figure).toBe(expected[q.id])
  })
})

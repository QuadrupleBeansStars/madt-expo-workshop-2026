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

  // The honesty rule: every chart plots a real AUDIENCE field and highlights real buckets, so a
  // survey re-import updates every chart and caption automatically.
  it('data-hook charts point at real AUDIENCE fields and buckets', () => {
    expect(AUDIENCE.respondents).toBe(bucketTotal(AUDIENCE.queuePatience))
    for (const q of QUESTIONS) {
      const dist = AUDIENCE[q.dataHook.field] as Record<string, number>
      expect(dist).toBeTypeOf('object')
      for (const key of q.dataHook.highlight) {
        expect(dist, `${q.id} highlights unknown bucket "${key}"`).toHaveProperty(key)
      }
    }
  })

  it('captions quote figures that exist in the highlighted distribution', () => {
    // Every number in a caption must be derivable from AUDIENCE — a hand-typed figure would
    // survive a survey re-import and lie on the projector. Weak but real guard: each caption's
    // standalone numbers must all appear among the field's counts, their sums, or N.
    for (const q of QUESTIONS) {
      const dist = AUDIENCE[q.dataHook.field] as Record<string, number>
      const counts = Object.values(dist)
      const legal = new Set<number>([...counts, AUDIENCE.respondents,
        q.dataHook.highlight.reduce((sum, k) => sum + (dist[k] ?? 0), 0)])
      // Only numbers that read as PEOPLE-counts: "<n> คน" or "<n> จาก <m>". Clock words
      // ("10 นาที", "7–9 โมง") and prices ("฿50–100") are copy, not data claims.
      const numbers = [
        ...[...q.dataHook.caption.matchAll(/(\d+)\s*(?:จาก\s*\d+\s*)?คน/g)].map((m) => Number(m[1])),
        ...[...q.dataHook.caption.matchAll(/(\d+)\s*จาก\s*(\d+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]),
      ]
      for (const v of numbers) {
        expect(legal.has(v), `${q.id} caption quotes ${v}, not derivable from ${q.dataHook.field}`).toBe(true)
      }
    }
  })
})

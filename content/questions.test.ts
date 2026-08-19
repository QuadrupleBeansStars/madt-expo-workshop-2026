import { describe, it, expect } from 'vitest'
import { QUESTIONS, ACTS, getQuestion } from './questions'
import { QuestionSchema, ActSchema } from '@/lib/types'

describe('QUESTIONS', () => {
  it('has exactly 9 questions ordered 1..9 with unique ids', () => {
    expect(QUESTIONS).toHaveLength(9)
    expect([...QUESTIONS].map((q) => q.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(9)
  })

  it('every question is schema-valid (implies highlight is inside duckSays)', () => {
    for (const q of QUESTIONS) {
      const r = QuestionSchema.safeParse(q)
      expect(r.success, `${q.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
  })

  it('has three acts of three, and act numbers follow play order', () => {
    expect(ACTS).toHaveLength(3)
    for (const a of ACTS) {
      const r = ActSchema.safeParse(a)
      expect(r.success, `act ${a.n}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
    const byOrder = [...QUESTIONS].sort((x, y) => x.order - y.order)
    expect(byOrder.map((q) => q.act)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
  })

  it('has exactly three pass questions, at orders 2, 5 and 8', () => {
    const passes = QUESTIONS.filter((q) => q.verdict === 'pass').map((q) => q.order).sort((a, b) => a - b)
    expect(passes).toEqual([2, 5, 8])
  })

  // THE ANTI-GUESS INVARIANT (spec §4d). Computed from content — never hardcode the runs.
  it('never has three consecutive reject questions', () => {
    const byOrder = [...QUESTIONS].sort((x, y) => x.order - y.order)
    let run = 0
    let longest = 0
    for (const q of byOrder) {
      run = q.verdict === 'reject' ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    expect(longest, 'a player tapping ตีกลับ every time would reach the ×3 multiplier').toBeLessThanOrEqual(2)
  })

  it('getQuestion finds by id and returns undefined otherwise', () => {
    expect(getQuestion(QUESTIONS[0].id)?.id).toBe(QUESTIONS[0].id)
    expect(getQuestion('nope')).toBeUndefined()
  })
})

describe('the opener', () => {
  it('opens on the question the room is most likely to get wrong', () => {
    const first = [...QUESTIONS].sort((a, b) => a.order - b.order)[0]
    expect(first.id).toBe('most-populous')
    // The point of opening here: the duck is not lying, it is answering with something that
    // was true until 2023. A room that approves it has been fooled by staleness in round one.
    expect(first.verdict).toBe('reject')
    expect(first.act).toBe(1)
  })

  it("keeps act 1's chips in the order its questions are now asked", () => {
    const act1 = [...QUESTIONS].filter((q) => q.act === 1).sort((a, b) => a.order - b.order)
    expect(act1.map((q) => q.id)).toEqual(['most-populous', 'banana-berry', 'coffee-cups'])
    expect(ACTS[0].chips).toEqual(['ความจริงที่หมดอายุ', 'นิยามที่ไม่เคยเปลี่ยน', 'ตัวเลขที่ไม่มีคนนับ'])
  })
})

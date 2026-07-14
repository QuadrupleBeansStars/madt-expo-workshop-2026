import { describe, it, expect } from 'vitest'
import { CASES, getCase } from './cases'
import { DetectiveCaseSchema } from '@/lib/types'

describe('CASES', () => {
  it('has exactly 5 cases ordered 1..5', () => {
    expect(CASES).toHaveLength(5)
    expect(CASES.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('every case is schema-valid (implies exactly one correct option, 4 options)', () => {
    for (const c of CASES) {
      const result = DetectiveCaseSchema.safeParse(c)
      expect(result.success, `case ${c.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('every case is fully bilingual — no empty th or en strings', () => {
    const walk = (v: unknown): void => {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        if (typeof o.th === 'string' || typeof o.en === 'string') {
          expect(o.th, 'missing th').toBeTruthy()
          expect(o.en, 'missing en').toBeTruthy()
        }
        Object.values(o).forEach(walk)
      }
    }
    CASES.forEach(walk)
  })

  it('cases 1-3 each have exactly one missing document (the retrieval gap)', () => {
    for (const c of CASES.filter((c) => c.order <= 3)) {
      expect(c.docs.filter((d) => !d.found)).toHaveLength(1)
    }
  })

  it('cases 4 and 5 retrieve cleanly — no missing documents', () => {
    for (const c of CASES.filter((c) => c.order >= 4)) {
      expect(c.docs.filter((d) => !d.found)).toHaveLength(0)
    }
  })

  it('case 5: the correct answer is that the AI is correct', () => {
    const c5 = CASES.find((c) => c.order === 5)!
    expect(c5.options.find((o) => o.correct)!.id).toBe('ai-correct')
  })

  it('every real (non-fictional) found document cites a source URL', () => {
    for (const c of CASES) {
      for (const d of c.docs.filter((d) => d.found && !d.fictional)) {
        expect(d.sourceUrl, `${c.id}/${d.filename}`).toBeTruthy()
      }
    }
  })

  it('getCase finds by id', () => {
    expect(getCase(CASES[0].id)!.order).toBe(1)
    expect(getCase('nope')).toBeUndefined()
  })
})

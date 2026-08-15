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

  /*
   * The teaching beat is what the room takes home, so it gets the same scrutiny as the puzzle.
   *
   * The schema already forces `checkNextTime` to EXIST and to carry both scripts. What it cannot
   * enforce is that the field says something USEFUL — the failure mode here is a line that just
   * restates `reveal` in fewer words, which reads fine in review and teaches nothing. These two
   * assertions are cheap proxies for that: it has to be long enough to be an instruction, and it
   * must not be a copy-paste of the reveal paragraph.
   */
  it('every case carries a take-home check, and it is not a trimmed copy of the reveal', () => {
    for (const c of CASES) {
      expect(c.checkNextTime.th.length, `${c.id} th`).toBeGreaterThan(40)
      expect(c.checkNextTime.en.length, `${c.id} en`).toBeGreaterThan(40)
      expect(c.reveal.th.includes(c.checkNextTime.th), `${c.id} duplicates the reveal`).toBe(false)
    }
  })

  it('the take-home check on case 5 does not assume the AI got it wrong', () => {
    // Case 5 is the one where the AI is RIGHT, and it is the case every "spot the trick" framing
    // breaks on. A player who learned "distrust the AI" fails it exactly as badly as one who
    // believed everything, so its lesson has to be about verifying rather than about suspecting.
    const last = CASES.find((c) => c.order === 5)!
    expect(last.docs.every((d) => d.found)).toBe(true)
    expect(last.checkNextTime.th).toMatch(/ตรวจสอบ|แหล่ง/)
    expect(last.checkNextTime.en.toLowerCase()).toMatch(/verif|check the source/)
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

  it('every case has exactly one option with id "ai-correct" (the "believe the AI" option)', () => {
    for (const c of CASES) {
      const believeAi = c.options.filter((o) => o.id === 'ai-correct')
      expect(believeAi, `case ${c.id}`).toHaveLength(1)
    }
  })
})

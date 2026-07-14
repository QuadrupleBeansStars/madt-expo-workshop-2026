import { describe, it, expect } from 'vitest'
import { DetectiveCaseSchema } from './types'

/**
 * Each fixture below has exactly FOUR options, so `.length(4)` always passes and the
 * `.refine` (exactly-one-correct) is genuinely the rule under test. A 2-option fixture
 * would fail on length and the refine would never be exercised — a test passing for the
 * wrong reason.
 */
const caseWith = (corrections: boolean[]) => ({
  id: 'c1', order: 1, difficulty: 'easy',
  question: { th: 'ถาม', en: 'q' },
  aiAnswer: { th: 'ตอบ', en: 'a' },
  docs: [],
  options: corrections.map((correct, i) => ({
    id: `o${i}`, label: { th: `ตัวเลือก${i}`, en: `option ${i}` }, correct,
  })),
  reveal: { th: 'เฉลย', en: 'r' },
  failureMode: { th: 'โหมด', en: 'mode' },
})

describe('DetectiveCaseSchema', () => {
  it('accepts a case with exactly four options and exactly one correct', () => {
    const ok = caseWith([true, false, false, false])
    expect(DetectiveCaseSchema.safeParse(ok).success).toBe(true)
  })

  it('rejects a case whose four options contain no correct answer', () => {
    const bad = caseWith([false, false, false, false])
    const result = DetectiveCaseSchema.safeParse(bad)
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error!.issues)).toMatch(/exactly one correct option/)
  })

  it('rejects a case whose four options contain more than one correct answer', () => {
    const bad = caseWith([true, true, false, false])
    const result = DetectiveCaseSchema.safeParse(bad)
    expect(result.success).toBe(false)
    expect(JSON.stringify(result.error!.issues)).toMatch(/exactly one correct option/)
  })

  it('rejects a case that does not have exactly four options', () => {
    const bad = caseWith([true, false, false])
    expect(DetectiveCaseSchema.safeParse(bad).success).toBe(false)
  })
})

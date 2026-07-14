import { describe, it, expect } from 'vitest'
import { getAIAnswer } from './ai-answer'
import { CASES } from '@/content/cases'

describe('getAIAnswer (the swap seam)', () => {
  it('returns the pre-written answer in the requested language', async () => {
    const c = CASES[0]
    expect(await getAIAnswer(c.id, 'en')).toBe(c.aiAnswer.en)
    expect(await getAIAnswer(c.id, 'th')).toBe(c.aiAnswer.th)
  })
  it('throws on an unknown case rather than returning something plausible', async () => {
    await expect(getAIAnswer('nope', 'en')).rejects.toThrow(/unknown case/i)
  })
})

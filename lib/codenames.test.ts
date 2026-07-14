import { describe, it, expect } from 'vitest'
import { randomCodename } from './codenames'

describe('randomCodename', () => {
  it('produces a Thai codename prefixed นักสืบ', () => {
    expect(randomCodename('th')).toMatch(/^นักสืบ/)
  })
  it('produces an English codename prefixed Detective', () => {
    expect(randomCodename('en')).toMatch(/^Detective /)
  })
  it('varies across many draws', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomCodename('en')))
    expect(seen.size).toBeGreaterThan(1)
  })
})

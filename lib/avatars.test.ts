import { describe, it, expect } from 'vitest'
import { AVATARS, avatarFor } from './avatars'

describe('avatarFor', () => {
  it('is deterministic — the same player always gets the same face', () => {
    expect(avatarFor('abc-123')).toBe(avatarFor('abc-123'))
  })
  it('always returns one of the known avatars', () => {
    for (let i = 0; i < 200; i++) expect(AVATARS).toContain(avatarFor(`player-${i}`))
  })
  it('spreads across the set rather than collapsing to one', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => avatarFor(`player-${i}`)))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('handles an empty id without throwing', () => {
    expect(AVATARS).toContain(avatarFor(''))
  })
})

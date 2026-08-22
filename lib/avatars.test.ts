import { describe, it, expect } from 'vitest'
import { AVATARS, avatarFor } from './avatars'
import { CODENAMES } from './codenames'

/*
 * REWRITTEN FOR THE NAME-DERIVED FACE. The old suite asserted `avatarFor('abc-123')` was stable
 * and that every result was a member of `AVATARS` — the second is no longer true and must not
 * come back: a name from the pool now returns its OWN emoji, and 144 of those 150 are not in the
 * ten-prop fallback set at all. An assertion that everything lands in `AVATARS` would pass only
 * by the lookup being broken.
 */
describe('avatarFor', () => {
  it('gives a pool name its own emoji', () => {
    expect(avatarFor('นักสืบราเมง')).toBe('🍜')
    expect(avatarFor('Detective Ramen')).toBe('🍜')
  })

  it('gives every name in the pool the emoji that belongs to it', () => {
    for (const [th, en, emoji] of CODENAMES) {
      expect(avatarFor(`นักสืบ${th}`), th).toBe(emoji)
      expect(avatarFor(`Detective ${en}`), en).toBe(emoji)
    }
  })

  it('gives the store’s suffixed form the SAME face as its base', () => {
    /* `MemoryRoomStore#uniqueCodename` turns a second `นักสืบราเมง` into `นักสืบราเมง 2`. Matching
     * on the exact string would hand the first a ramen bowl and the second a hashed prop — two
     * rows reading as the same detective, wearing different faces, on the same leaderboard. */
    expect(avatarFor('นักสืบราเมง 2')).toBe(avatarFor('นักสืบราเมง'))
    expect(avatarFor('นักสืบราเมง 3')).toBe('🍜')
    expect(avatarFor('Detective Ramen 2')).toBe('🍜')
  })

  it('gives a typed name a stable face from the fallback set', () => {
    // The common case: most players type their own name, which cannot be matched to an emoji —
    // see the comment on AVATARS. Stable per NAME (not per playerId), so it survives a restart,
    // a rejoin and a different machine.
    expect(AVATARS).toContain(avatarFor('เป็ดทอง'))
    expect(avatarFor('เป็ดทอง')).toBe(avatarFor('เป็ดทอง'))
    expect(AVATARS).toContain(avatarFor('Somchai'))
  })

  it('gives a typed name’s suffixed form the same face too', () => {
    expect(avatarFor('เป็ดทอง 2')).toBe(avatarFor('เป็ดทอง'))
  })

  it('spreads typed names across the fallback set rather than collapsing to one', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => avatarFor(`ผู้เล่น-${i}-x`)))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('handles an empty codename without throwing', () => {
    expect(AVATARS).toContain(avatarFor(''))
  })

  it('ships fallback faces that are a single codepoint, or a codepoint plus VS16', () => {
    // The same rule the 150-name pool is held to — see lib/codenames.ts's header, and the pixel
    // duck note in app/tv/page.tsx. These ten ride on every typed name, which is most of the room.
    const offenders = AVATARS.filter((e) => {
      const cps = [...e]
      return !(cps.length === 1 || (cps.length === 2 && cps[1].codePointAt(0) === 0xfe0f))
    })
    expect(offenders).toEqual([])
  })
})

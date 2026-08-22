import { describe, it, expect } from 'vitest'
import { CODENAMES, CODENAME_GROUPS, codenamePool, emojiFor, randomCodename } from './codenames'

/** The duplicated values in a list, so a failure names what collided instead of just a count. */
const dupes = (values: string[]): string[] => {
  const seen = new Set<string>()
  const twice = new Set<string>()
  for (const v of values) (seen.has(v) ? twice : seen).add(v)
  return [...twice]
}

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

/*
 * THE POOL'S INVARIANTS. These are here so a later "just add one more name" commit cannot break
 * them silently — every one of these failures is invisible in code review and visible on the
 * projector in front of a hundred people.
 */
describe('the codename pool', () => {
  it('is 150 names, in ten groups of fifteen', () => {
    expect(CODENAME_GROUPS).toHaveLength(10)
    for (const g of CODENAME_GROUPS) expect(g.items, g.th).toHaveLength(15)
    expect(CODENAMES).toHaveLength(150)
  })

  it('repeats no Thai name, no English name and no emoji', () => {
    // The emoji column matters most: two names sharing a face puts two identical avatars on one
    // leaderboard, which is the exact confusion the matching-emoji work exists to remove.
    expect(dupes(CODENAMES.map(([th]) => th))).toEqual([])
    expect(dupes(CODENAMES.map(([, en]) => en))).toEqual([])
    expect(dupes(CODENAMES.map(([, , emoji]) => emoji))).toEqual([])
  })

  it('gives every name one emoji that is a single codepoint, or a codepoint plus VS16', () => {
    /* No ZWJ sequences, no flags, no skin-tone modifiers — see the file header, and the pixel duck
     * note in app/tv/page.tsx. A joined sequence renders as one glyph where the font has it and
     * falls apart into two unrelated ones where it does not, which is not a thing a name tag can
     * do differently on a player's phone and on the venue's projector. */
    const offenders = CODENAMES.filter(([, , emoji]) => {
      const cps = [...emoji]
      return !(cps.length === 1 || (cps.length === 2 && cps[1].codePointAt(0) === 0xfe0f))
    })
    expect(offenders.map(([th, , emoji]) => `${th} ${emoji}`)).toEqual([])
  })

  it('still carries the fifteen names the game shipped with', () => {
    // Continuity, not nostalgia: these are the names in every screenshot, in the README, and in
    // the runs the owner has demoed. ดาวหาง is here as ดาวตก — same entry, renamed.
    const th = new Set(CODENAMES.map(([t]) => t))
    for (const name of ['ราเมง', 'กาแฟ', 'มะม่วง', 'นีออน', 'เที่ยงคืน', 'กล้วยไม้', 'เหยี่ยว', 'พิกเซล',
      'ตุ๊กตุ๊ก', 'มรสุม', 'มะลิ', 'งูเห่า', 'โคมไฟ', 'ดาวตก', 'ทุเรียน']) {
      expect(th, name).toContain(name)
    }
  })
})

describe('codenamePool', () => {
  it('returns all 150, prefixed, in the language asked for', () => {
    const th = codenamePool('th')
    const en = codenamePool('en')
    expect(th).toHaveLength(150)
    expect(en).toHaveLength(150)
    expect(th.every((c) => c.startsWith('นักสืบ'))).toBe(true)
    expect(en.every((c) => c.startsWith('Detective '))).toBe(true)
    expect(new Set(th).size).toBe(150)
  })

  it('hands back a fresh array the caller can filter without damaging the pool', () => {
    const first = codenamePool('th')
    first.length = 0
    expect(codenamePool('th')).toHaveLength(150)
  })
})

describe('emojiFor', () => {
  it('answers with the emoji that belongs to the name, prefix or no prefix, either language', () => {
    expect(emojiFor('นักสืบราเมง')).toBe('🍜')
    expect(emojiFor('ราเมง')).toBe('🍜')
    expect(emojiFor('Detective Ramen')).toBe('🍜')
    expect(emojiFor('Ramen')).toBe('🍜')
  })

  it('answers undefined for a name that is not in the pool', () => {
    expect(emojiFor('นักสืบเป็ดทอง')).toBeUndefined()
    expect(emojiFor('')).toBeUndefined()
  })

  it('answers undefined for a suffixed name — the suffix belongs to the store, not to this file', () => {
    // lib/avatars.ts is where the two are married; see `baseCodename` there.
    expect(emojiFor('นักสืบราเมง 2')).toBeUndefined()
  })
})

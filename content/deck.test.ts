import { describe, expect, it } from 'vitest'
import { DECK } from './deck'
import { SlideSchema } from '@/lib/deck-types'

describe('deck content', () => {
  it('is ten slides: 3 polls, 3 votes, 3 reveals, 1 content', () => {
    expect(DECK).toHaveLength(10)
    const count = (k: string) => DECK.filter((s) => s.kind === k).length
    expect(count('poll')).toBe(3)
    expect(count('vote')).toBe(3)
    expect(count('reveal')).toBe(3)
    expect(count('content')).toBe(1)
  })

  it('every slide passes its schema', () => {
    for (const slide of DECK) {
      expect(() => SlideSchema.parse(slide)).not.toThrow()
    }
  })

  it('slide ids are unique', () => {
    const ids = DECK.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every reveal points at a real earlier slide that accepts votes', () => {
    for (const [i, slide] of DECK.entries()) {
      if (slide.kind !== 'reveal') continue
      const target = DECK.findIndex((s) => s.id === slide.forSlideId)
      expect(target, `${slide.id} -> ${slide.forSlideId}`).toBeGreaterThanOrEqual(0)
      expect(target).toBeLessThan(i)
      expect(['poll', 'vote']).toContain(DECK[target].kind)
    }
  })

  it('every vote slide has a bestOptionId matching one of its options', () => {
    for (const slide of DECK) {
      if (slide.kind !== 'vote') continue
      expect(slide.options.map((o) => o.id)).toContain(slide.bestOptionId)
    }
  })

  it('option ids are unique within a slide', () => {
    for (const slide of DECK) {
      if (slide.kind !== 'poll' && slide.kind !== 'vote') continue
      const ids = slide.options.map((o) => o.id)
      expect(new Set(ids).size, slide.id).toBe(ids.length)
    }
  })

  it('every localized string is non-empty in both languages', () => {
    const check = (t: { th: string; en: string }, where: string) => {
      expect(t.th.trim(), `${where}.th`).not.toBe('')
      expect(t.en.trim(), `${where}.en`).not.toBe('')
    }
    for (const slide of DECK) {
      if (slide.kind === 'poll' || slide.kind === 'vote') {
        check(slide.prompt, `${slide.id}.prompt`)
        slide.options.forEach((o) => check(o.label, `${slide.id}.${o.id}`))
      } else if (slide.kind === 'reveal') {
        check(slide.headline, `${slide.id}.headline`)
        check(slide.body, `${slide.id}.body`)
        check(slide.lesson, `${slide.id}.lesson`)
      } else {
        check(slide.headline, `${slide.id}.headline`)
        slide.bullets.forEach((b, i) => check(b, `${slide.id}.bullet${i}`))
      }
    }
  })
})

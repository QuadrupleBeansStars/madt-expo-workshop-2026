import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

/*
 * THE SOURCE-LEVEL GUARD, and the defect class this whole pass exists to remove (spec §10.7).
 *
 * Every size on `/tv` used to be written `clamp(<px>, <n>vh, <px>)`, and all eighteen tiers hit
 * their pixel CEILING between 944px and 1067px of screen height. A 1080p projector is already past
 * every one of them, so the design got relatively SMALLER as the screen got bigger — on a 4K panel
 * the smallest text was 1/120 of the screen against an 8H minimum of 1/50.
 *
 * No unit test can catch that, because jsdom performs no layout and the numbers themselves are
 * still being tuned; asserting a size here would fail for reasons that are not defects. What CAN
 * be asserted is the SHAPE of the declaration: a `vh` value with a pixel ceiling stops scaling,
 * and a bare Tailwind `text-sm` never started. Both are checked in the source.
 *
 * `min(<n>vh, <n>px)` is included because it is the same defect wearing a different name: it is
 * exactly the upper half of the clamp, and this file's own tree carried sixteen of them. So are
 * the bare Tailwind steps (`text-xs` … `text-3xl`), which are strictly worse — a fixed pixel size
 * with no vh component at all.
 */

const ROOT = resolve(__dirname, '..', '..')

/** Every source file the guard covers: the projector page and the game components it renders.
 *  Test files are excluded — a fixture may legitimately name a pixel size. */
function guardedFiles(): string[] {
  const gameDir = join(ROOT, 'components', 'game')
  const components = readdirSync(gameDir)
    .filter((f) => (f.endsWith('.tsx') || f.endsWith('.ts')) && !f.includes('.test.'))
    .map((f) => join(gameDir, f))
  return [join(ROOT, 'app', 'tv', 'page.tsx'), ...components]
}

/** Comments are stripped first: several of these files EXPLAIN the defect in prose, and a guard
 *  that trips on its own documentation would be uncheckable. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

type Offence = { rule: string; text: string }

/**
 * The detector, exported from the test on purpose: {@link it} 'the detector itself can fail'
 * below feeds it known-bad samples, so a regex that silently stopped matching cannot leave every
 * other assertion in this file passing vacuously.
 */
export function findFixedSizes(source: string): Offence[] {
  const code = stripComments(source)
  const rules: [string, RegExp][] = [
    // A vh value with a pixel ceiling, in either spelling.
    ['clamp() with a px bound', /clamp\([^)]*\d+px[^)]*\)/g],
    // `Math.min`/`Math.max` are arithmetic, not CSS — the negative lookbehind is what keeps
    // components/game/Patrol.tsx's canvas maths out of this.
    ['min()/max() with a px bound', /(?<!Math\.)\b(?:min|max)\([^)]*\d+px[^)]*\)/g],
    // Tailwind's fixed steps: a pixel size with no vh component at all.
    ['a fixed Tailwind text step', /\btext-(?:xs|sm|base|lg|xl|[2-9]xl)\b/g],
    // An arbitrary Tailwind text size in pixels.
    ['a px Tailwind text size', /\btext-\[[^\]]*\d+px[^\]]*\]/g],
    // An inline font-size in pixels.
    ['an inline px font-size', /fontSize:\s*['"`][^'"`]*\d+px/g],
  ]
  const found: Offence[] = []
  for (const [rule, re] of rules) {
    for (const m of code.matchAll(re)) found.push({ rule, text: m[0] })
  }
  return found
}

describe('the /tv type scale', () => {
  const files = guardedFiles()

  // Without this, a broken glob or a moved directory would leave every assertion below iterating
  // an empty list and passing.
  it('covers the projector page and the game components', () => {
    expect(files.length).toBeGreaterThan(5)
    expect(files.some((f) => f.endsWith('page.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('Standings.tsx'))).toBe(true)
    expect(files.some((f) => f.endsWith('Podium.tsx'))).toBe(true)
  })

  // The detector's own guard. Every rule is exercised against a sample that must trip it, so a
  // regex that stops matching turns THIS red rather than silently clearing the whole tree.
  it('the detector itself can fail', () => {
    const samples = [
      'font-size: clamp(11px, 1.9vh, 18px)',
      "style={{ fontSize: 'min(5vh,50px)' }}",
      'className="text-sm"',
      'className="text-[14px]"',
      "style={{ fontSize: '13px' }}",
    ]
    for (const sample of samples) {
      expect(findFixedSizes(sample), sample).not.toHaveLength(0)
    }
    // …and does NOT trip on the things it must leave alone.
    expect(findFixedSizes('Math.min(Math.max(x, 4), vw - 12)')).toHaveLength(0)
    expect(findFixedSizes("style={{ fontSize: '3.1vh' }}")).toHaveLength(0)
    expect(findFixedSizes('/* it used to be clamp(11px, 1.9vh, 18px) */')).toHaveLength(0)
  })

  it.each(guardedFiles())('%s carries no px-ceilinged or fixed-pixel type', (file) => {
    const offences = findFixedSizes(readFileSync(file, 'utf8'))
    expect(
      offences.map((o) => `${o.rule}: ${o.text}`),
      `${file} still sizes type in a way that stops scaling with the screen`,
    ).toEqual([])
  })
})

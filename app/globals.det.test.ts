import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('app/globals.css', 'utf8')
const playerPage = readFileSync('app/page.tsx', 'utf8')
const tvPage = readFileSync('app/tv/page.tsx', 'utf8')

// The outermost `<main ...>` opening tag — the element that carries `det`. Grabbing up to the
// first `>` after `<main` is safe here: nothing in a plain className string or a `style={{...}}`
// of CSS custom-property strings contains a literal `>`.
function outerMainTag(src: string): string {
  const start = src.indexOf('<main')
  const end = src.indexOf('>', start)
  return src.slice(start, end + 1)
}

describe('the premium treatments survive', () => {
  it('keeps the title double shadow — hard offset plus glow', () => {
    expect(css).toContain('6px 6px 0px #705400')
    expect(css).toContain('0 0 25px rgba(255, 215, 0, 0.55)')
  })
  it('keeps the CRT overlay at both background sizes', () => {
    // The pre-existing, unscoped `.crt::after` carries the byte-identical string — slicing to
    // `.det::after` is what makes this assertion actually about THIS rule, not that one. Proven
    // by deleting `.det::after` below and watching this fail (see the fix report).
    const detAfter = css.slice(css.indexOf('.det::after'))
    expect(detAfter).toContain('background-size: 100% 4px, 6px 100%')
  })
  it("keeps the button's left-offset shadow, not a bottom one", () => {
    // .pixel-btn/.verdict-btn write the same shadow without the "0px" unit ("0 #000", not
    // "0px #000") — that is an accident of formatting, not a deliberate scope, and a formatter
    // pass could erase the difference. Slicing to .det-btn's own block is the real scope.
    const detBtn = css.slice(css.indexOf('.det-btn {'))
    expect(detBtn).toContain('box-shadow: -4px 4px 0px #000')
  })
  it('keeps the framed screen', () => {
    expect(css).toContain('border: 6px solid #141724')
    expect(css).toContain('inset 0 0 50px rgba(0, 0, 0, 0.85)')
  })
  it("keeps the gold button's real colours, not an invented set", () => {
    // These values were invented wrong twice across earlier plan drafts before landing correct.
    // .pixel-btn.gold (the pre-existing, unscoped rule they were checked against) shares the same
    // `border-color: #ffeb80` — an unscoped assertion would still pass with .det-btn-gold deleted
    // entirely. Slicing to .det-btn.det-btn-gold's own block is what makes this a real pin.
    const detGold = css.slice(css.indexOf('.det-btn.det-btn-gold'))
    expect(detGold).toContain('background-color: #b08200')
    expect(detGold).toContain('border-color: #ffeb80')
    expect(detGold).toContain('background-color: #cca400')
  })
  it('scopes everything under .det so the Decision Room is untouched', () => {
    const det = css.slice(css.indexOf('.det {'))
    expect(det).not.toMatch(/^\s*(body|:root|html)\s*\{/m)
  })
})

// An inline `style` attribute beats every class rule on specificity alone — a `background`/
// `color` set inline on the element carrying `det` would silently keep the OLD theme's colours,
// no matter how correct `.det`'s own declarations are. jsdom doesn't run the cascade, so this has
// to be a source check, not a rendered one.
describe('the premium background actually reaches the wrapper', () => {
  it('app/page.tsx: the element carrying det sets no inline background/color', () => {
    const tag = outerMainTag(playerPage)
    expect(tag).toContain('det')
    expect(tag).not.toMatch(/style=\{\{[^}]*\b(background|color)\s*:/)
  })
  it('app/tv/page.tsx: the element carrying det sets no inline background/color', () => {
    const tag = outerMainTag(tvPage)
    expect(tag).toContain('det')
    expect(tag).not.toMatch(/style=\{\{[^}]*\b(background|color)\s*:/)
  })
})

// The legibility audit measured every text node on every /tv phase in a real browser at 1366x768
// against the 8H rule (smallest projected text >= 1/50 of screen height). The two findings below
// were the ones a person could not have talked themselves out of, so they get source-level guards:
// jsdom does not run the cascade or resolve vh, and the projector check cannot see a colour pair.
describe('the legibility rulings hold', () => {
  // `.det-btn` sets `color: #fff`. Without its own `color`, the gold variant inherits it and lands
  // at 3.5:1 on #b08200 — measured, on the lobby's Start button. Dark ink is 8.9:1.
  it('the gold button carries its own dark ink, not the purple variant white', () => {
    const gold = css.slice(css.indexOf('.det-btn.det-btn-gold {'))
    const rule = gold.slice(0, gold.indexOf('}'))
    expect(rule).toContain('#241c00')
  })

  // The literal that used to sit here rendered the most important pre-game control at 13px.
  it('the button size is a custom property the projector can raise, not a hard-coded literal', () => {
    const btn = css.slice(css.indexOf('.det-btn {'))
    const rule = btn.slice(0, btn.indexOf('}'))
    expect(rule).toMatch(/font-size:\s*var\(--det-btn-size/)
    expect(rule).not.toMatch(/font-size:\s*\d+px/)
  })

  // A ceiling in px is the defect the whole v3.2 pass exists to remove: every tier froze between
  // 944px and 1067px of screen height, so the design shrank relative to any monitor past 1080p.
  it('no size in the det theme is capped by a pixel ceiling', () => {
    const det = css.slice(css.indexOf('.det {'))
    expect(det).not.toMatch(/clamp\([^)]*,\s*[\d.]+px\s*\)/)
  })
})

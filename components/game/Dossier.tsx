import type { CSSProperties, ReactNode } from 'react'

/**
 * The case file itself: a sheet of paper lying on the desk, under a folder tab.
 *
 * The team's v3.1 note was *"ให้เป็นฉากเป็นเหมือนกระดานคดีกับเคส"* — a scene, a case board with a
 * case file on it. Before this, the duck's answer sat in a small cream pill floating on a black
 * field. The reference (`ai_detective_premium_edition-3.html`) makes it a physical document, and
 * the three things that do that work are all in `.det-dossier` (app/globals.css): the hard 6px
 * offset shadow (a blurred one reads as a web card), the square TOP-LEFT corner, and the rotated
 * CLASSIFIED DOSSIER rubber stamp in the opposite corner.
 *
 * THE TAB IS LOAD-BEARING, not decoration. `border-radius: 0 10px 10px 10px` only reads as
 * intentional when something sits above that square corner; without the tab it reads as a
 * rounding bug. It is one static tab, never the reference's ten-case switcher — the projector
 * navigates nothing, the host advances the room.
 *
 * `tab` is Latin/numerals ONLY. The tab is set in VT323 (`--font-retro`), which carries no Thai
 * glyphs at all; a Thai label there loses its vowel marks. Everything ON the paper is Thai and
 * uses `--font-thai`, and nothing on it may use the screen palette — cyan and neon green are
 * invisible on cream (see `.det-dossier-head` / `.det-dossier-label` for the paper's own inks).
 */
export function Dossier({
  tab, children, className, bodyClassName, bodyStyle,
}: {
  /** The folder tab's label. Latin and numerals only — VT323 has no Thai.
   *  OMIT IT for a plain sheet: the approved artifact's case board is a sheet with no tab at all,
   *  and the square top-left corner goes with it (`.det-dossier-plain`) — that corner only reads
   *  as intentional when something sits above it. */
  tab?: string
  children: ReactNode
  /** On the wrapper, for the column the folder occupies. */
  className?: string
  /** On the paper itself, for how its contents are laid out inside the sheet. */
  bodyClassName?: string
  /**
   * Inline styles on the paper. THIS EXISTS BECAUSE `bodyClassName` CANNOT SET PADDING.
   *
   * `.det-dossier` (app/globals.css) declares its own `padding` and is deliberately UNLAYERED —
   * that file says so in as many words — while Tailwind's utilities live in `@layer utilities`.
   * At equal specificity an unlayered rule beats a layered one, so every `pt-[Nvh]` ever put on
   * this element was dead and the sheet rendered with a flat 16px regardless. Two callers spent
   * a long time believing they had a clearance they did not have, and nothing errored.
   *
   * An inline declaration outranks both, so padding overrides come through here. Everything that
   * does NOT collide with `.det-dossier` — display, flex, gap — still belongs in `bodyClassName`.
   */
  bodyStyle?: CSSProperties
}) {
  return (
    <div className={`flex min-h-0 flex-col ${className ?? ''}`}>
      {/* `self-start`: the wrapper is a flex COLUMN, whose default `align-items: stretch`
          would pull a tab meant to be the width of its own label out to the width of the whole
          sheet — which reads as a second header bar, not as a folder tab. */}
      {/* `fontSize` inline, not in the class: `.det-dossier-tab` (app/globals.css) pins the tab at
          a flat 18px, which is below the 3.1vh floor on every projector at or above 1080p, and
          that file is out of bounds for this pass. An inline declaration outranks it. */}
      {tab ? <div className="det-dossier-tab self-start" style={{ fontSize: '3.1vh' }}>📁 {tab}</div> : null}
      <div className={`det-dossier ${tab ? '' : 'det-dossier-plain'} ${bodyClassName ?? ''}`} style={bodyStyle}>{children}</div>
    </div>
  )
}

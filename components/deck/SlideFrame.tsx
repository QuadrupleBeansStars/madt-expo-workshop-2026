'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { LocalizedText } from '@/lib/types'
import { Bilingual } from './Bilingual'

type SlideFrameProps = {
  chapter: LocalizedText      // eyebrow text
  chapterNumber: string       // ghost numeral, e.g. '01'
  accent: string              // CSS colour value for --deck-clr
  slideNumber: number         // 1-based
  slideTotal: number
  children: ReactNode
}

/**
 * Nudge the deck one slide in either direction.
 *
 * SlideFrame takes no navigation handlers — the projector view (task 9) owns the
 * keyboard. The on-screen prev/next buttons are a pointer alias for the arrow keys
 * the hint advertises, so they re-emit exactly that keydown rather than inventing a
 * second, parallel navigation contract.
 */
function nudge(key: 'ArrowLeft' | 'ArrowRight') {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

/**
 * The chrome every slide is built inside: accent rail, ghost chapter numeral,
 * eyebrow, stage, and the bottom counter/nav.
 *
 * `accent` lands as the inline custom property `--deck-clr`, which everything in
 * `app/biz/deck.css` reads from. Pass a theme-aware token — `var(--deck-accent-demand)`
 * — rather than a raw hex, so the accent re-tunes itself for light and dark.
 */
export function SlideFrame({
  chapter, chapterNumber, accent, slideNumber, slideTotal, children,
}: SlideFrameProps) {
  const progress = slideTotal > 0 ? Math.min(1, Math.max(0, slideNumber / slideTotal)) : 0

  return (
    <section
      className="deck-slide"
      data-testid="slide-frame"
      style={{ '--deck-clr': accent, '--deck-progress': progress } as CSSProperties}
    >
      <div className="deck-rail" aria-hidden="true">
        <span className="deck-rail__fill" />
      </div>

      <p className="deck-hint" aria-hidden="true">use ← / →</p>

      <span className="deck-ghost" data-testid="ghost-numeral" aria-hidden="true">
        {chapterNumber}
      </span>

      <div className="deck-stage">
        <Bilingual text={chapter} as="label" className="deck-eyebrow" />
        <div className="deck-body">{children}</div>
      </div>

      <footer className="deck-chrome">
        <p className="deck-counter" data-testid="slide-counter">
          <span className="deck-counter__now">{slideNumber}</span>
          <span className="deck-counter__slash"> / </span>
          <span className="deck-counter__all">{slideTotal}</span>
        </p>

        <nav className="deck-nav">
          <button type="button" className="deck-nav__btn" onClick={() => nudge('ArrowLeft')} aria-label="Previous slide">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" /></svg>
          </button>
          <button type="button" className="deck-nav__btn" onClick={() => nudge('ArrowRight')} aria-label="Next slide">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </nav>
      </footer>
    </section>
  )
}

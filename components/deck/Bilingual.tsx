import type { LocalizedText } from '@/lib/types'

type BilingualProps = {
  text: LocalizedText
  /** 'hero' = oversized slide headline; 'body' = paragraph; 'label' = eyebrow/small. */
  as?: 'hero' | 'body' | 'label'
  className?: string
}

/**
 * The deck's type object. THAI ONLY — this workshop is delivered in Thai.
 *
 * It used to render both scripts at once, English leading at full weight with Thai beneath it
 * smaller and muted (spec §2a, no language toggle). The room is Thai-speaking, so the English
 * line was spending the scarcest resource on this deck — vertical space on a short projector —
 * on something nobody in the room was reading.
 *
 * `LocalizedText` still carries both strings and every label file still defines `en`. Nothing was
 * deleted from the content; only the rendering changed. That keeps the door open for an English
 * run without re-translating anything, and keeps the copy tests that compare the two honest.
 *
 * The name stays `Bilingual` because the DATA is. If that reads oddly, the fix is a rename, not
 * re-adding the line.
 *
 * The span carries `lang="th"` so the browser font-matches with a Thai-capable face rather than
 * falling back mid-line.
 */
export function Bilingual({ text, as = 'body', className }: BilingualProps) {
  const cls = ['deck-bi', `deck-bi--${as}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      <span className="deck-bi__th" lang="th">{text.th}</span>
    </span>
  )
}

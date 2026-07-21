import type { LocalizedText } from '@/lib/types'

type BilingualProps = {
  text: LocalizedText
  /** 'hero' = oversized slide headline; 'body' = paragraph; 'label' = eyebrow/small. */
  as?: 'hero' | 'body' | 'label'
  className?: string
}

/**
 * The deck's signature type object: one string, both scripts, always at once.
 *
 * English leads at full weight; Thai sits directly beneath it, smaller and muted.
 * There is no language toggle anywhere in this deck (spec §2a) — a mixed room reads
 * whichever line it wants without anyone touching a control.
 *
 * Each script is wrapped in its own element carrying `lang`, so the browser shapes
 * and font-matches Thai with a Thai-capable face instead of falling back mid-line.
 */
export function Bilingual({ text, as = 'body', className }: BilingualProps) {
  const cls = ['deck-bi', `deck-bi--${as}`, className].filter(Boolean).join(' ')
  return (
    <span className={cls}>
      <span className="deck-bi__en" lang="en">{text.en}</span>
      <span className="deck-bi__th" lang="th">{text.th}</span>
    </span>
  )
}

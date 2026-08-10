import type { Lang, StoryPanel } from '@/lib/types'

/**
 * AI Detective's storyboard strip — the team's note after the 3 Aug run-through, that a case reads
 * better as a few captioned frames than as a paragraph of question plus a paragraph of AI answer.
 *
 * Deliberately NOT shared with The Decision Room's `Storyboard` in components/room/Stages.tsx,
 * even though both render `StoryPanel[]`. The two workshops have different visual languages and,
 * more to the point, different rules: The Decision Room renders both languages at once and has no
 * toggle (spec §7), while AI Detective is single-language with a `lang` prop. One component would
 * have to take an optional `lang` and branch on it, which is how the two start rendering each
 * other's typography. The TYPE is shared; the rendering is not.
 *
 * `art` is the upgrade path: the emoji is the character today, so this ships with no illustration
 * and nothing waits on a designer. Point `art` at a file in /public and it takes over.
 */
export function Storyboard({
  panels, lang, compact = false,
}: {
  panels?: StoryPanel[]
  lang: Lang
  /** The phone. One column instead of a row — see below. */
  compact?: boolean
}) {
  if (!panels?.length) return null

  return (
    <ol
      data-testid="story"
      className={compact ? 'flex flex-col gap-2' : 'grid gap-3'}
      style={compact ? undefined : { gridTemplateColumns: `repeat(${panels.length}, minmax(0, 1fr))` }}
    >
      {panels.map((panel) => (
        <li
          key={panel.caption.en}
          className="flex items-center gap-3 rounded-lg px-3 py-2"
          style={{ background: 'var(--rt-panel)', border: '1px solid var(--rt-border)' }}
        >
          <span aria-hidden="true" className="shrink-0">
            {panel.art
              ? <img src={panel.art} alt="" className="block h-auto" style={{ width: compact ? 28 : 40 }} />
              : <span style={{ fontSize: compact ? 24 : 'min(3.4vh, 34px)', lineHeight: 1 }}>{panel.emoji}</span>}
          </span>
          <span
            className="min-w-0"
            style={{
              fontFamily: 'var(--font-thai), sans-serif',
              // Capped by viewport HEIGHT on the projector: a wide, short projector is the case
              // that binds, and this strip sits above a question that already filled the screen.
              fontSize: compact ? 13 : 'min(1.9vh, 19px)',
              lineHeight: 1.25,
            }}
          >
            {panel.caption[lang]}
          </span>
        </li>
      ))}
    </ol>
  )
}

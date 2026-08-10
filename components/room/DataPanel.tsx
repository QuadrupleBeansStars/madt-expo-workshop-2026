import type { LocalizedText } from '@/lib/types'
import { UI } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import { Bars, type BarRow } from './Bars'
import { PlaceholderBadge } from './PlaceholderBadge'
import './room.css'

type DataPanelProps = {
  /** The registration question this panel answers, e.g. "How do you get to work?" */
  question: LocalizedText
  /** One count per bucket — pass an AUDIENCE field straight through,
   *  e.g. AUDIENCE.arrivalMode. */
  data: Record<string, number>
  /** Bilingual label for each bucket key in `data`. */
  labels: Record<string, LocalizedText>
  /** Optional accent override; otherwise inherits the ambient --deck-clr
   *  (e.g. from an enclosing SlideFrame). */
  accent?: string
  /**
   * Set when one respondent could tick several buckets, so the bars sum to more than the number
   * of people. Renders a one-line note under the chart.
   *
   * NOT cosmetic, and not optional in spirit: `mainFactor` shows 18 out of 18 respondents naming
   * taste. Beside a stated sample of 18, an unlabelled bar at 18 reads as "everyone, and only
   * taste" — which is a claim the data does not make. This workshop argues for data honesty on
   * the same screen, so the caveat travels with the chart rather than living in one stage's prose.
   */
  multiSelect?: boolean
}

/**
 * One question's distribution, built from the audience's own registration
 * answers: bilingual question title, the PLACEHOLDER guard, and the bar rows.
 * No `lang` prop — both scripts always render together.
 */
export function DataPanel({ question, data, labels, accent, multiSelect }: DataPanelProps) {
  const rows: BarRow[] = Object.entries(data).map(([key, value]) => ({
    key,
    label: labels[key] ?? { en: key, th: key },
    value,
  }))

  return (
    <div className="room-data-panel">
      <PlaceholderBadge />
      <Bilingual text={question} as="label" className="room-data-panel__title" />
      <Bars rows={rows} accent={accent} />
      {multiSelect ? (
        <p className="room-data-panel__note" data-testid="multi-select-note">
          <Bilingual text={UI.multiSelectNote} as="label" />
        </p>
      ) : null}
    </div>
  )
}

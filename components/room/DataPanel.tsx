import type { LocalizedText } from '@/lib/types'
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
}

/**
 * One question's distribution, built from the audience's own registration
 * answers: bilingual question title, the PLACEHOLDER guard, and the bar rows.
 * No `lang` prop — both scripts always render together.
 */
export function DataPanel({ question, data, labels, accent }: DataPanelProps) {
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
    </div>
  )
}

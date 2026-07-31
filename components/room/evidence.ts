// The Decision Room — turning a stage's `evidence` list into something a screen can render.
//
// One module, two readings of the SAME list, so the projector and the two hundred phones in front
// of it can never quote different numbers at each other:
//
//   - `evidencePanels()` — the full distribution per key, for the projector's charts.
//   - `evidenceFigures()` — the two or three headline counts, for the phone's text strip.
//
// Both read `AUDIENCE` directly and neither takes a `lang` prop: every label returned is
// `LocalizedText` and both scripts render at once (spec §7).

import { AUDIENCE } from '@/content/audience'
import { BUCKET_LABELS, QUESTIONS } from '@/content/room-labels'
import type { EvidenceKey } from '@/lib/room-types'
import type { LocalizedText } from '@/lib/types'

export type EvidencePanel = {
  key: EvidenceKey
  /** The registration question, verbatim from the form. */
  question: LocalizedText
  /** One count per bucket — passed straight to `DataPanel`. */
  data: Record<string, number>
  labels: Record<string, LocalizedText>
}

export type EvidenceFigure = {
  key: string
  /** The count itself: the thing a player reads in the two seconds before they tap. */
  value: number
  /** The bucket this count belongs to, e.g. "07:00–09:00" / "Under 3 minutes". */
  label: LocalizedText
}

/** The charts a decide (or data) stage puts on the projector, in the order the stage names them. */
export function evidencePanels(evidence: readonly EvidenceKey[] | undefined): EvidencePanel[] {
  return (evidence ?? []).map((key) => ({
    key,
    question: QUESTIONS[key],
    data: AUDIENCE[key] as Record<string, number>,
    labels: BUCKET_LABELS[key],
  }))
}

/** Buckets of one distribution, largest first. Ties keep the order the audience data declares. */
function bucketsBySize(key: EvidenceKey): EvidenceFigure[] {
  const labels = BUCKET_LABELS[key]
  return Object.entries(AUDIENCE[key] as Record<string, number>)
    .map(([bucket, value]) => ({
      key: `${key}-${bucket}`,
      value,
      label: labels[bucket] ?? { en: bucket, th: bucket },
    }))
    .sort((a, b) => b.value - a.value)
}

/**
 * The same evidence, compressed to what fits on a 390px screen above the vote buttons.
 *
 * One rule, deliberately: **the largest bucket of each named distribution**, and if the stage
 * names only one distribution, that distribution's two largest. Nothing here is hand-picked per
 * stage — a per-stage override is how the phone and the projector start disagreeing in front of
 * the room, and the phone's figures must always be a subset of the charts behind it.
 */
export function evidenceFigures(evidence: readonly EvidenceKey[] | undefined): EvidenceFigure[] {
  const keys = evidence ?? []
  if (keys.length === 0) return []
  if (keys.length === 1) return bucketsBySize(keys[0]).slice(0, 2)
  return keys.map((key) => bucketsBySize(key)[0])
}

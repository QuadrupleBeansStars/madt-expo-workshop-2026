import type { CSSProperties } from 'react'
import type { LocalizedText } from '@/lib/types'
import { Bilingual } from '@/components/deck/Bilingual'
import './room.css'

export type BarRow = {
  key: string
  label: LocalizedText
  value: number
}

type BarsProps = {
  rows: BarRow[]
  /** CSS colour value for the fill. Defaults to the ambient --deck-clr so a Bars
   *  block dropped inside a SlideFrame picks up that slide's accent automatically. */
  accent?: string
}

/**
 * A horizontal bar chart, pure SVG-free CSS — no charting library. Widths are
 * proportional to the largest bucket in the set (not to a fixed scale), so the
 * biggest bar always spans the full track and reads instantly from the back of
 * a 200-person room. Every row carries English and Thai at once (there is no
 * language toggle in this workshop) and the count is rendered in tabular
 * numerals so digits line up column-to-column down the stack.
 */
export function Bars({ rows, accent }: BarsProps) {
  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <div className="room-bars" style={accent ? ({ '--deck-clr': accent } as CSSProperties) : undefined}>
      {rows.map((row) => {
        const pct = (row.value / max) * 100
        return (
          <div className="room-bars__row" key={row.key}>
            <Bilingual text={row.label} as="label" className="room-bars__label" />
            <div className="room-bars__track">
              <div
                className="room-bars__fill"
                data-testid={`bar-fill-${row.key}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="room-bars__value">{row.value}</span>
          </div>
        )
      })}
    </div>
  )
}

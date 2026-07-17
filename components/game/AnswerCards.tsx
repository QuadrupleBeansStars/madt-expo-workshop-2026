'use client'
import type { CaseOption, Lang } from '@/lib/types'

const LETTERS = ['A', 'B', 'C', 'D']

export function AnswerCards({
  options, lang, disabled = false, selectedId, correctId, onPick,
}: {
  options: CaseOption[]
  lang: Lang
  disabled?: boolean
  selectedId?: string
  correctId?: string
  onPick: (id: string) => void
}) {
  const revealed = correctId !== undefined
  return (
    <div className="grid gap-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      {options.map((o, i) => {
        let stateClass = ''
        if (revealed) {
          if (o.id === correctId) stateClass = 'selected-correct'
          else if (o.id === selectedId) stateClass = 'selected-incorrect'
        } else if (o.id === selectedId) {
          stateClass = 'selected-correct'
        }
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o.id)}
            className={`answer-card flex items-center gap-3 p-3 text-left font-bold ${stateClass}`}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-white"
              style={{ background: '#0f172a', color: 'var(--rt-gold)', fontFamily: 'var(--font-pixel), monospace', fontSize: 11 }}
            >
              {LETTERS[i]}
            </span>
            <span>{o.label[lang]}</span>
          </button>
        )
      })}
    </div>
  )
}

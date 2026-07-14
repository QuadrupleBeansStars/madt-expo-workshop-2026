'use client'
import type { Answer, Lang } from '@/lib/types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from '@/lib/scoring'
import { t } from '@/lib/i18n'

export function ResultScreen({ answers, lang }: { answers: Answer[]; lang: Lang }) {
  const score = totalScore(answers)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="text-3xl font-bold text-amber-300">{t('finished', lang)}</h2>
      <p className="mt-6 text-6xl font-bold text-amber-100">{score}</p>
      <p className="text-sm uppercase tracking-widest text-neutral-500">{t('yourScore', lang)}</p>

      <ul className="mt-10 space-y-2 text-left">
        {CASES.map((c) => {
          const mine = answers.find((a) => a.caseId === c.id)
          const correct = !!mine && getCase(c.id)!.options.some((o) => o.id === mine.optionId && o.correct)
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-md border border-neutral-800 p-3">
              <span>{correct ? '✅' : '❌'}</span>
              <span className="text-neutral-300">Case {c.order}</span>
            </li>
          )
        })}
      </ul>

      <p className="mt-10 text-neutral-400">{t('waitReveal', lang)}</p>
    </div>
  )
}

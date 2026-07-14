'use client'
import type { Answer, Lang } from '@/lib/types'
import { totalScore } from '@/lib/scoring'
import { t } from '@/lib/i18n'

export function ResultScreen({
  answers,
  lang,
  onNewDetective,
}: {
  answers: Answer[]
  lang: Lang
  onNewDetective: () => void
}) {
  const score = totalScore(answers)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="text-3xl font-bold text-brand-navy">{t('finished', lang)}</h2>
      <p className="mt-6 text-6xl font-bold text-brand-orange">{score}</p>
      <p className="text-sm uppercase tracking-widest text-text-dim">{t('yourScore', lang)}</p>

      <p className="mt-10 text-text-dim">{t('waitReveal', lang)}</p>

      <button
        onClick={onNewDetective}
        className="mt-10 rounded-md border border-line px-4 py-3 text-sm text-text-dim hover:bg-brand-navy-soft"
      >
        {t('newDetective', lang)}
      </button>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import type { DetectiveCase, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { Retrieval } from './Retrieval'
import { CaseFileDoc } from './CaseFileDoc'
import { getAIAnswer } from '@/lib/ai-answer'

const DIFFICULTY_DOT: Record<string, string> = {
  easy: '🟢', medium: '🟡', hard: '🟠', expert: '🔴', final: '⚫',
}

export function CaseScreen({
  detectiveCase, lang, onCommit, onRestart,
}: {
  detectiveCase: DetectiveCase
  lang: Lang
  onCommit: (optionId: string, elapsedMs: number) => void
  onRestart: () => void
}) {
  const [phase, setPhase] = useState<'retrieving' | 'deciding'>('retrieving')
  const [aiAnswer, setAIAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [shownAt, setShownAt] = useState(0)
  const [confirmingRestart, setConfirmingRestart] = useState(false)

  // Reset every time we move to a new case.
  useEffect(() => {
    setPhase('retrieving')
    setSelected(null)
    setAIAnswer('')
    setShownAt(0)
    setConfirmingRestart(false)
  }, [detectiveCase.id])

  useEffect(() => {
    getAIAnswer(detectiveCase.id, lang).then(setAIAnswer)
  }, [detectiveCase.id, lang])

  const onRetrievalComplete = () => {
    setPhase('deciding')
    setShownAt(Date.now())
  }

  // shownAt may still be 0 if the commit button is somehow reachable before
  // the retrieval finished — guard so elapsedMs is never NaN/negative-nonsense
  // (the API rejects non-finite elapsedMs with a 400).
  const commit = () => {
    if (!selected) return
    const elapsedMs = shownAt > 0 ? Date.now() - shownAt : 0
    onCommit(selected, elapsedMs)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-sm uppercase tracking-widest text-brand-navy">
        {DIFFICULTY_DOT[detectiveCase.difficulty]} {t('caseLabel', lang)} {detectiveCase.order} / 5
      </div>
      <h2 className="mb-6 text-2xl font-semibold text-text">{detectiveCase.question[lang]}</h2>

      <Retrieval key={detectiveCase.id} docs={detectiveCase.docs} lang={lang} onComplete={onRetrievalComplete} />

      {phase === 'deciding' && (
        <>
          <section className="mt-6 rounded-lg border border-brand-navy bg-brand-navy-soft p-4">
            <div className="mb-2 text-sm font-semibold text-brand-navy">{t('aiAnswer', lang)}</div>
            <p className="leading-relaxed text-text">{aiAnswer}</p>
          </section>

          <section className="mt-6">
            <div className="mb-3 text-sm font-semibold text-brand-orange-deep">{t('caseFile', lang)}</div>
            <div className="grid gap-3">
              {detectiveCase.docs.map((d) => (
                <CaseFileDoc key={d.filename} doc={d} lang={lang} />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 text-sm font-semibold text-brand-navy">{t('yourVerdict', lang)}</div>
            <div className="grid gap-2">
              {detectiveCase.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={`rounded-md border p-4 text-left transition ${
                    selected === o.id
                      ? 'border-brand-orange bg-brand-orange-soft text-brand-orange-deep font-semibold'
                      : 'border-line bg-surface text-text hover:border-brand-navy'
                  }`}
                >
                  {o.label[lang]}
                </button>
              ))}
            </div>

            <button
              disabled={!selected}
              onClick={commit}
              className="mt-6 w-full rounded-md bg-brand-orange px-4 py-3 font-semibold text-white hover:bg-brand-orange-deep disabled:opacity-40"
            >
              {t('submit', lang)}
            </button>
          </section>
        </>
      )}

      {/* Discreet restart control, available throughout the case (not just at
          the end). Two-step confirm so a mis-click never destroys a run. */}
      <div className="mt-12 text-center">
        {!confirmingRestart ? (
          <button
            onClick={() => setConfirmingRestart(true)}
            className="text-xs text-text-dim underline decoration-dotted hover:text-brand-navy"
          >
            {t('restart', lang)}
          </button>
        ) : (
          <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-md border border-line bg-surface px-4 py-2 text-xs">
            <span className="text-text-dim">{t('restartConfirm', lang)}</span>
            <button onClick={onRestart} className="font-semibold text-alert hover:underline">
              {t('restartConfirmYes', lang)}
            </button>
            <button
              onClick={() => setConfirmingRestart(false)}
              className="text-text-dim hover:text-text"
            >
              {t('restartCancel', lang)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
  detectiveCase, lang, onCommit,
}: {
  detectiveCase: DetectiveCase
  lang: Lang
  onCommit: (optionId: string, elapsedMs: number) => void
}) {
  const [phase, setPhase] = useState<'retrieving' | 'deciding'>('retrieving')
  const [aiAnswer, setAIAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [shownAt, setShownAt] = useState(0)

  // Reset every time we move to a new case.
  useEffect(() => {
    setPhase('retrieving')
    setSelected(null)
    setAIAnswer('')
    setShownAt(0)
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
      <div className="mb-2 text-sm uppercase tracking-widest text-amber-500">
        {DIFFICULTY_DOT[detectiveCase.difficulty]} Case {detectiveCase.order} / 5
      </div>
      <h2 className="mb-6 text-2xl font-semibold text-neutral-100">{detectiveCase.question[lang]}</h2>

      <Retrieval key={detectiveCase.id} docs={detectiveCase.docs} lang={lang} onComplete={onRetrievalComplete} />

      {phase === 'deciding' && (
        <>
          <section className="mt-6 rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-4">
            <div className="mb-2 text-sm text-cyan-400">{t('aiAnswer', lang)}</div>
            <p className="leading-relaxed text-neutral-100">{aiAnswer}</p>
          </section>

          <section className="mt-6">
            <div className="mb-3 text-sm text-amber-400">{t('caseFile', lang)}</div>
            <div className="grid gap-3">
              {detectiveCase.docs.map((d) => (
                <CaseFileDoc key={d.filename} doc={d} lang={lang} />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 text-sm text-amber-400">{t('yourVerdict', lang)}</div>
            <div className="grid gap-2">
              {detectiveCase.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={`rounded-md border p-4 text-left transition ${
                    selected === o.id
                      ? 'border-amber-500 bg-amber-900/30 text-amber-100'
                      : 'border-neutral-700 bg-neutral-900/50 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {o.label[lang]}
                </button>
              ))}
            </div>

            <button
              disabled={!selected}
              onClick={commit}
              className="mt-6 w-full rounded-md bg-amber-600 px-4 py-3 font-semibold text-black disabled:opacity-40"
            >
              {t('submit', lang)}
            </button>
          </section>
        </>
      )}
    </div>
  )
}

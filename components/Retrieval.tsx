'use client'

import { useEffect, useRef, useState } from 'react'
import type { CaseDoc, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

const STEP_MS = 600

/**
 * IMPORTANT — CALLER CONTRACT: mount this with `key={caseId}` (or an
 * equivalent key that changes per case). `revealed` is intentionally NOT
 * reset when `docs` changes — adding an internal reset effect would misfire
 * whenever a parent passes a fresh array literal on every render. Without a
 * fresh `key` per case, the reveal animation for a new case will be
 * truncated or skipped entirely, using stale `revealed` state from the
 * previous case.
 */
export function Retrieval({
  docs, lang, onComplete,
}: { docs: CaseDoc[]; lang: Lang; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(0)

  // Keep the latest onComplete in a ref so the effect below never needs it
  // in its dependency array. onComplete is very likely to be passed as a
  // fresh inline arrow by the parent on every render (e.g. the player
  // screen); including it as a dependency would clear and reschedule the
  // pending timer on every parent re-render, stalling the reveal forever,
  // and could also cause onComplete to double-fire after completion.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    if (revealed >= docs.length) {
      const done = setTimeout(() => onCompleteRef.current(), STEP_MS)
      return () => clearTimeout(done)
    }
    const timer = setTimeout(() => setRevealed((n) => n + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [revealed, docs.length])

  return (
    <div className="font-mono text-sm bg-black/60 border border-amber-900/40 rounded-lg p-4">
      <div className="text-amber-400 mb-3">🔍 {t('retrieving', lang)}</div>
      <ul className="space-y-1">
        {docs.slice(0, revealed).map((doc) => (
          <li key={doc.filename} className="flex items-center justify-between gap-4">
            <span className="text-neutral-300">{doc.filename}</span>
            {doc.found ? (
              <span className="text-emerald-400">✓ {t('retrieved', lang)}</span>
            ) : (
              <span className="text-red-500 font-bold animate-pulse">✗ {t('notFound', lang)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

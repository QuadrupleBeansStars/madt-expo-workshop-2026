'use client'

import { useEffect, useState } from 'react'
import type { CaseDoc, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

const STEP_MS = 600

export function Retrieval({
  docs, lang, onComplete,
}: { docs: CaseDoc[]; lang: Lang; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (revealed >= docs.length) {
      const done = setTimeout(onComplete, STEP_MS)
      return () => clearTimeout(done)
    }
    const timer = setTimeout(() => setRevealed((n) => n + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [revealed, docs.length, onComplete])

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

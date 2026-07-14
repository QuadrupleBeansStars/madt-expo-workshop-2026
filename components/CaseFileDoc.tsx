import type { CaseDoc, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

export function CaseFileDoc({ doc, lang }: { doc: CaseDoc; lang: Lang }) {
  if (!doc.found) return null

  return (
    <article className="bg-amber-50 text-neutral-900 rounded-md p-4 shadow-lg border-l-4 border-amber-700">
      <header className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold leading-snug">{doc.title[lang]}</h3>
        {doc.fictional && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide bg-neutral-800 text-amber-200 px-2 py-0.5 rounded">
            {t('fictional', lang)}
          </span>
        )}
      </header>
      {doc.body && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700">{doc.body[lang]}</pre>
      )}
      {doc.sourceUrl && (
        <a
          href={doc.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-blue-700 underline break-all"
        >
          {doc.sourceUrl}
        </a>
      )}
    </article>
  )
}

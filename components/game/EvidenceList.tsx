import type { DetectiveCase, Lang } from '@/lib/types'
import { CaseFileDoc } from '@/components/CaseFileDoc'
import { t } from '@/lib/i18n'

export function EvidenceList({ detectiveCase, lang }: { detectiveCase: DetectiveCase; lang: Lang }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="dossier p-3" style={{ fontFamily: 'var(--font-retro), monospace' }}>
        <div className="mb-1 text-sm font-bold">{t('retrieving', lang)}</div>
        <ul className="text-sm leading-relaxed">
          {detectiveCase.docs.map((d) => (
            <li key={d.filename} className="flex justify-between gap-2">
              <span className="truncate">{d.filename}</span>
              <span style={{ color: d.found ? '#15803d' : 'var(--alert)', fontWeight: 700 }}>
                {d.found ? `✓ ${t('retrieved', lang)}` : `✗ ${t('notFound', lang)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {detectiveCase.docs.filter((d) => d.found).map((d) => (
        <CaseFileDoc key={d.filename} doc={d} lang={lang} />
      ))}
    </div>
  )
}

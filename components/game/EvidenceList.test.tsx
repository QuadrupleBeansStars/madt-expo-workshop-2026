import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EvidenceList } from './EvidenceList'
import { ROUNDS } from '@/lib/game'
import { t } from '@/lib/i18n'

describe('EvidenceList', () => {
  it('shows a NOT FOUND line for a missing doc (the retrieval gap)', () => {
    const artemis = ROUNDS.find((c) => c.id === 'artemis')!
    const { getAllByText } = render(<EvidenceList detectiveCase={artemis} lang="en" />)
    // Case 1 has exactly one found:false doc.
    expect(getAllByText(new RegExp(t('notFound', 'en'), 'i')).length).toBeGreaterThanOrEqual(1)
  })
})

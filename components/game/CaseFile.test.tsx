import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CaseFile, sourceLabel } from './CaseFile'
import { ROUNDS } from '@/lib/game'
import { t } from '@/lib/i18n'

const artemis = ROUNDS.find((c) => c.id === 'artemis')!
const goblinshark = ROUNDS.find((c) => c.id === 'goblinshark')!

describe('CaseFile', () => {
  it('shows a NOT FOUND line for a missing doc (the retrieval gap)', () => {
    const { getAllByText } = render(<CaseFile detectiveCase={artemis} lang="en" />)
    // Case 1 has exactly one found:false doc, and it is the whole point of the case.
    expect(getAllByText(new RegExp(t('notFound', 'en'), 'i')).length).toBeGreaterThanOrEqual(1)
  })

  it('lists every document in the manifest, found or not', () => {
    const { getByText } = render(<CaseFile detectiveCase={artemis} lang="en" />)
    for (const doc of artemis.docs) expect(getByText(doc.filename)).toBeTruthy()
  })

  it('renders the body of a found document but not of a missing one', () => {
    const { queryByText } = render(<CaseFile detectiveCase={artemis} lang="en" />)
    const gap = artemis.docs.find((d) => !d.found)!
    // The missing document's title must not appear as a readable document — only as a manifest
    // row. Rendering it would hand the room the very fact the AI could not retrieve.
    expect(queryByText(gap.title.en)).toBeNull()
    const kept = artemis.docs.find((d) => d.found && d.body)!
    expect(queryByText(kept.title.en)).toBeTruthy()
  })

  it('shows the source as a domain, not a full URL', () => {
    // A wrapped `https://www.nasa.gov/mission/apollo-17/` costs ~40px of a budget measured in tens,
    // and the projector is not a device anyone clicks. If this ever renders the raw href again,
    // the layout regresses silently — height is the constraint that never shows up in a unit test.
    const { queryByText, queryAllByText } = render(<CaseFile detectiveCase={artemis} lang="en" />)
    const doc = artemis.docs.find((d) => d.sourceUrl)!
    expect(queryByText(doc.sourceUrl!)).toBeNull()
    // Case 1's two found documents are both nasa.gov, so this legitimately matches more than once.
    expect(queryAllByText(sourceLabel(doc.sourceUrl!)).length).toBeGreaterThan(0)
  })

  it('renders in Thai when asked', () => {
    const { getByText } = render(<CaseFile detectiveCase={artemis} lang="th" />)
    const kept = artemis.docs.find((d) => d.found)!
    expect(getByText(kept.title.th)).toBeTruthy()
  })

  it('handles a case with no retrieval gap at all', () => {
    // Case 5 is the one where the AI is RIGHT: every document is found. A component that assumed
    // there is always a NOT FOUND row would break exactly here.
    expect(goblinshark.docs.every((d) => d.found)).toBe(true)
    const { queryByText } = render(<CaseFile detectiveCase={goblinshark} lang="en" />)
    expect(queryByText(new RegExp(t('notFound', 'en'), 'i'))).toBeNull()
  })
})

describe('sourceLabel', () => {
  it('strips scheme, www and path', () => {
    expect(sourceLabel('https://www.nasa.gov/mission/apollo-17/')).toBe('nasa.gov')
    expect(sourceLabel('https://nydailyrecord.com/2026/06/26/x/')).toBe('nydailyrecord.com')
  })

  it('falls back to the raw string rather than throwing on junk', () => {
    expect(sourceLabel('not a url')).toBe('not a url')
  })
})

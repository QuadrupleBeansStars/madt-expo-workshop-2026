import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CaseFileDoc } from './CaseFileDoc'
import { t } from '@/lib/i18n'
import type { CaseDoc } from '@/lib/types'

const baseDoc: CaseDoc = {
  filename: 'evidence.pdf',
  kind: 'excerpt',
  found: true,
  fictional: false,
  title: { th: 'หัวข้อ', en: 'Headline' },
  body: { th: 'เนื้อหา', en: 'Body text' },
}

describe('CaseFileDoc', () => {
  it('renders a visible FICTIONAL badge when fictional is true', () => {
    const doc: CaseDoc = { ...baseDoc, fictional: true }
    render(<CaseFileDoc doc={doc} lang="en" />)
    expect(screen.getByText(t('fictional', 'en'))).toBeInTheDocument()
  })

  it('renders no FICTIONAL badge when fictional is false', () => {
    const doc: CaseDoc = { ...baseDoc, fictional: false }
    render(<CaseFileDoc doc={doc} lang="en" />)
    expect(screen.queryByText(t('fictional', 'en'))).not.toBeInTheDocument()
  })

  it('renders nothing at all when found is false', () => {
    const doc: CaseDoc = { ...baseDoc, found: false, fictional: true }
    const { container } = render(<CaseFileDoc doc={doc} lang="en" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders sourceUrl as a link with target=_blank and rel=noopener noreferrer', () => {
    const doc: CaseDoc = { ...baseDoc, sourceUrl: 'https://example.com/evidence' }
    render(<CaseFileDoc doc={doc} lang="en" />)
    const link = screen.getByRole('link', { name: doc.sourceUrl })
    expect(link).toHaveAttribute('href', doc.sourceUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not render a link when sourceUrl is absent', () => {
    render(<CaseFileDoc doc={baseDoc} lang="en" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders title and body text in Thai when lang is th', () => {
    render(<CaseFileDoc doc={baseDoc} lang="th" />)
    expect(screen.getByText(baseDoc.title.th)).toBeInTheDocument()
    expect(screen.getByText(baseDoc.body!.th)).toBeInTheDocument()
    expect(screen.queryByText(baseDoc.title.en)).not.toBeInTheDocument()
  })

  it('renders title and body text in English when lang is en', () => {
    render(<CaseFileDoc doc={baseDoc} lang="en" />)
    expect(screen.getByText(baseDoc.title.en)).toBeInTheDocument()
    expect(screen.getByText(baseDoc.body!.en)).toBeInTheDocument()
    expect(screen.queryByText(baseDoc.title.th)).not.toBeInTheDocument()
  })

  it('renders the fictional badge text localized for Thai', () => {
    const doc: CaseDoc = { ...baseDoc, fictional: true }
    render(<CaseFileDoc doc={doc} lang="th" />)
    expect(screen.getByText(t('fictional', 'th'))).toBeInTheDocument()
  })
})

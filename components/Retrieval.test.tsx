import { describe, it, expect, vi } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Retrieval } from './Retrieval'
import type { CaseDoc } from '@/lib/types'

const docs: CaseDoc[] = [
  { filename: 'found.pdf', kind: 'excerpt', found: true, fictional: false,
    title: { th: 'พบ', en: 'Found doc' } },
  { filename: 'missing.pdf', kind: 'excerpt', found: false, fictional: false,
    title: { th: 'หาย', en: 'Missing doc' } },
]

describe('Retrieval', () => {
  it('eventually lists every document filename', async () => {
    render(<Retrieval docs={docs} lang="en" onComplete={() => {}} />)
    await waitFor(() => expect(screen.getByText('found.pdf')).toBeInTheDocument(), { timeout: 4000 })
    await waitFor(() => expect(screen.getByText('missing.pdf')).toBeInTheDocument(), { timeout: 4000 })
  })

  it('marks the missing document NOT FOUND', async () => {
    render(<Retrieval docs={docs} lang="en" onComplete={() => {}} />)
    await waitFor(() => expect(screen.getByText(/NOT FOUND/i)).toBeInTheDocument(), { timeout: 4000 })
  })

  it('calls onComplete once every document has resolved', async () => {
    const onComplete = vi.fn()
    render(<Retrieval docs={docs} lang="en" onComplete={onComplete} />)
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 6000 })
  })

  it('calls onComplete for an empty docs array without hanging', async () => {
    const onComplete = vi.fn()
    render(<Retrieval docs={[]} lang="en" onComplete={onComplete} />)
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 4000 })
  })

  it('completes and calls onComplete exactly once even when the parent re-renders rapidly with a fresh inline onComplete', async () => {
    // NOTE: needs a generous per-test timeout; see the final argument below.
    const onComplete = vi.fn()

    // Simulates a real player-screen parent: re-renders on an interval and
    // passes a brand-new inline arrow as onComplete every time.
    function Harness() {
      const [, setTick] = useState(0)
      useEffect(() => {
        const id = setInterval(() => setTick((n) => n + 1), 300)
        return () => clearInterval(id)
      }, [])
      return <Retrieval docs={docs} lang="en" onComplete={() => onComplete()} />
    }

    render(<Harness />)

    await waitFor(() => expect(screen.getByText(/NOT FOUND/i)).toBeInTheDocument(), { timeout: 6000 })
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 6000 })

    // Give the harness plenty more re-renders after completion; onComplete
    // must not fire again.
    await new Promise((resolve) => setTimeout(resolve, 2000))
    expect(onComplete).toHaveBeenCalledTimes(1)
  }, 15000)
})

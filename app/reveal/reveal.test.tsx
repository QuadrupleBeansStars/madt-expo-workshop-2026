import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import RevealPage from './page'
import { CASES } from '@/content/cases'

const STATS = {
  detectives: 10, finished: 10,
  caseStats: CASES.map((c) => ({ caseId: c.id, order: c.order, answered: 10, fooled: 6, fooledPct: 60 })),
  leaderboard: [],
}

describe('RevealPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => STATS })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts on case 1 and shows its failure mode', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
  })

  it('shows the live % fooled for the current case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument())
  })

  it('advances to case 2 on ArrowRight', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText(CASES[1].failureMode.th)).toBeInTheDocument())
  })

  it('does not advance past the final case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
    for (let i = 0; i < 10; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText(CASES[4].failureMode.th)).toBeInTheDocument())
  })
})

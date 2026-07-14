import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DashboardPage from './page'

const STATS = {
  detectives: 12,
  finished: 5,
  caseStats: [
    { caseId: 'artemis', order: 1, answered: 10, fooled: 7, fooledPct: 70 },
    { caseId: 'olympics', order: 2, answered: 8, fooled: 4, fooledPct: 50 },
  ],
  leaderboard: [
    { codename: 'Detective Ramen', score: 450, correct: 3 },
    { codename: 'นักสืบกาแฟ', score: 300, correct: 2 },
  ],
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => STATS })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the detective count on the stats wall', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
  })

  it('shows the % fooled per case', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('70%')).toBeInTheDocument())
  })

  it('switches to the leaderboard when L is pressed', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'l' })
    await waitFor(() => expect(screen.getByText('Detective Ramen')).toBeInTheDocument())
  })

  it('keeps showing the last good frame if a poll fails (flaky venue LAN)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => STATS })
      .mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    render(<DashboardPage />)
    await vi.waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())

    await vi.advanceTimersByTimeAsync(2500)

    // still showing the last good frame, not blank, not an error screen
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

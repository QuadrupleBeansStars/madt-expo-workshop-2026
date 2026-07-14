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

  it('shows an em dash instead of "0%" for a case nobody has answered yet', async () => {
    const statsWithUnanswered = {
      ...STATS,
      caseStats: [
        ...STATS.caseStats,
        { caseId: 'goblinshark', order: 5, answered: 0, fooled: 0, fooledPct: 0 },
      ],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => statsWithUnanswered })))
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
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

  it('ignores an out-of-order stale poll response (numbers never go backwards)', async () => {
    vi.useFakeTimers()
    const STALE = {
      detectives: 3,
      finished: 1,
      caseStats: [{ caseId: 'artemis', order: 1, answered: 2, fooled: 1, fooledPct: 20 }],
      leaderboard: [{ codename: 'Old Detective', score: 10, correct: 1 }],
    }
    const FRESH = {
      detectives: 20,
      finished: 9,
      caseStats: [{ caseId: 'artemis', order: 1, answered: 10, fooled: 9, fooledPct: 90 }],
      leaderboard: [{ codename: 'New Detective', score: 900, correct: 5 }],
    }

    // First poll (issued at t=0) resolves LAST with stale data.
    // Second poll (issued at t=2500) resolves FIRST with fresh data.
    let resolveFirst: (v: unknown) => void = () => {}
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve
    })
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(async () => ({ ok: true, json: async () => FRESH }))
    vi.stubGlobal('fetch', fetchMock)

    render(<DashboardPage />)

    // let the second poll fire and resolve before the first one resolves
    await vi.advanceTimersByTimeAsync(2500)
    await vi.waitFor(() => expect(screen.getByText('20')).toBeInTheDocument())

    // now the stale first poll resolves
    resolveFirst({ ok: true, json: async () => STALE })
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }

    // must still show the fresh, newer data — not the stale one
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('renders the title and a waiting message before the first successful poll (never blank)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<DashboardPage />)
    expect(screen.getByText('🕵️ นักสืบ AI')).toBeInTheDocument()
    expect(screen.getByText('รอนักสืบเข้าร่วม…')).toBeInTheDocument()
  })

  it('keeps the last good frame if a 200 response has a malformed body', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => STATS })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ oops: 'not the right shape' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<DashboardPage />)
    await vi.waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())

    await vi.advanceTimersByTimeAsync(2500)
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }

    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

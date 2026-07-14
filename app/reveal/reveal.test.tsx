import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import RevealPage from './page'
import { CASES } from '@/content/cases'

const FOOLED_PCTS = [60, 25, 88, 42, 5]

const STATS = {
  detectives: 10, finished: 10,
  caseStats: CASES.map((c, idx) => ({
    caseId: c.id,
    order: c.order,
    answered: 10,
    fooled: Math.round((FOOLED_PCTS[idx] / 100) * 10),
    fooledPct: FOOLED_PCTS[idx],
  })),
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
    await waitFor(() => expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument())
  })

  it('shows the % fooled for the case navigated to, not the first case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText(CASES[1].failureMode.th)).toBeInTheDocument())
    expect(screen.getByText(`${FOOLED_PCTS[1]}%`)).toBeInTheDocument()
    expect(screen.queryByText(`${FOOLED_PCTS[0]}%`)).not.toBeInTheDocument()
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

  it('does not go before the first case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
    for (let i = 0; i < 5; i++) fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
  })

  it('omits the % fooled figure entirely when nobody has answered yet', async () => {
    const ZERO_STATS = {
      detectives: 10, finished: 0,
      caseStats: CASES.map((c) => ({ caseId: c.id, order: c.order, answered: 0, fooled: 0, fooledPct: 0 })),
      leaderboard: [],
    }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ZERO_STATS })))

    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())

    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByText('NaN%')).not.toBeInTheDocument()
    expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument()
  })

  it('keeps showing the last good frame if a poll fails (flaky venue LAN)', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => STATS })
      .mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    render(<RevealPage />)
    await vi.waitFor(() => expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument())

    await vi.advanceTimersByTimeAsync(2500)

    // still showing the last good frame, not blank, not an error screen
    expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('ignores an out-of-order stale poll response (numbers never go backwards)', async () => {
    vi.useFakeTimers()
    const STALE = {
      detectives: 3, finished: 1,
      caseStats: [{ caseId: CASES[0].id, order: 1, answered: 2, fooled: 1, fooledPct: 20 }],
      leaderboard: [],
    }
    const FRESH = {
      detectives: 20, finished: 9,
      caseStats: [{ caseId: CASES[0].id, order: 1, answered: 10, fooled: 9, fooledPct: 90 }],
      leaderboard: [],
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

    render(<RevealPage />)

    // let the second poll fire and resolve before the first one resolves
    await vi.advanceTimersByTimeAsync(2500)
    await vi.waitFor(() => expect(screen.getByText('90%')).toBeInTheDocument())

    // now the stale first poll resolves
    resolveFirst({ ok: true, json: async () => STALE })
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }

    // must still show the fresh, newer data — not the stale one
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.queryByText('20%')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('keeps the last good frame if a 200 response has a malformed body', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => STATS })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ oops: 'not the right shape' }) })
    vi.stubGlobal('fetch', fetchMock)

    render(<RevealPage />)
    await vi.waitFor(() => expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument())

    await vi.advanceTimersByTimeAsync(2500)
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(0)
    }

    expect(screen.getByText(`${FOOLED_PCTS[0]}%`)).toBeInTheDocument()

    vi.useRealTimers()
  })
})

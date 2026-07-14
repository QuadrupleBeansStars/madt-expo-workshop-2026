import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import PlayerPage from './page'
import { CASES } from '@/content/cases'
import type { Answer } from '@/lib/types'

// The retrieval animation is already covered by Retrieval.test.tsx and
// CaseScreen.test.tsx (real timers, ~seconds). Mock it here so page-level
// orchestration tests stay fast and focused on join/commit/lang/offline-queue
// behaviour rather than re-testing the reveal animation.
vi.mock('@/components/Retrieval', () => ({
  Retrieval: ({ onComplete }: { onComplete: () => void }) => {
    // Defer to a real async tick so this never fires during React's render phase.
    setTimeout(() => onComplete(), 0)
    return null
  },
}))

const artemis = CASES[0]
const olympics = CASES[1]

function mockFetchImpl(overrides: {
  onAnswer?: (body: Answer) => Response | Promise<Response>
} = {}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/join') {
      return new Response(JSON.stringify({ player: { id: 'p1', codename: 'Detective Test' } }), { status: 200 })
    }
    if (url === '/api/answer') {
      const body = JSON.parse((init!.body as string)) as Answer
      if (overrides.onAnswer) return overrides.onAnswer(body)
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
}

async function joinAndReachCase() {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Detective Test' } })
  fireEvent.click(screen.getByRole('button', { name: 'เริ่มภารกิจ' }))
  await waitFor(() => expect(screen.getByText(artemis.aiAnswer.th)).toBeInTheDocument())
}

describe('PlayerPage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('joining then committing an answer advances to the next case', async () => {
    global.fetch = mockFetchImpl() as unknown as typeof fetch
    render(<PlayerPage />)

    await joinAndReachCase()

    fireEvent.click(screen.getByText(artemis.options[1].label.th))
    fireEvent.click(screen.getByText('ยืนยันคำตัดสิน'))

    // Case 2's AI answer should now be reachable (after its own retrieval mock resolves).
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())

    const answerCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/api/answer')
    expect(answerCall).toBeTruthy()
    const sentBody = JSON.parse(answerCall![1].body as string) as Answer
    expect(sentBody.caseId).toBe(artemis.id)
    expect(sentBody.optionId).toBe(artemis.options[1].id)
    expect(Number.isFinite(sentBody.elapsedMs)).toBe(true)
  }, 15000)

  it('the language toggle flips text mid-case without resetting progress', async () => {
    global.fetch = mockFetchImpl() as unknown as typeof fetch
    render(<PlayerPage />)

    await joinAndReachCase()

    // Select an option before toggling language.
    fireEvent.click(screen.getByText(artemis.options[2].label.th))

    fireEvent.click(screen.getByRole('button', { name: 'Toggle language' }))

    // Still on the same case, now in English, and the earlier selection survived
    // (the commit button is enabled, proving `selected` state wasn't reset).
    await waitFor(() => expect(screen.getByText(artemis.aiAnswer.en)).toBeInTheDocument())
    expect(screen.getByText(artemis.options[2].label.en)).toBeInTheDocument()
    expect(screen.getByText('Commit to your verdict')).not.toBeDisabled()
  }, 15000)

  it('buffers a failed answer POST in localStorage and retries it instead of losing it', async () => {
    let answerAttempts = 0
    global.fetch = mockFetchImpl({
      onAnswer: () => {
        answerAttempts += 1
        if (answerAttempts === 1) throw new Error('simulated wifi blip')
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    }) as unknown as typeof fetch

    render(<PlayerPage />)
    await joinAndReachCase()

    fireEvent.click(screen.getByText(artemis.options[0].label.th))
    fireEvent.click(screen.getByText('ยืนยันคำตัดสิน'))

    // The player is NEVER blocked: they advance to case 2 immediately regardless of the network.
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())

    // The failed answer was queued, then retried and cleared once the network recovered.
    await waitFor(() => {
      const pending = JSON.parse(localStorage.getItem('aidet.pending') ?? '[]')
      expect(pending).toEqual([])
    })
    expect(answerAttempts).toBeGreaterThanOrEqual(2)
  }, 15000)

  it('retries a previously-queued answer on mount', async () => {
    const queued: Answer = { playerId: 'p1', caseId: 'artemis', optionId: 'stale', elapsedMs: 1234 }
    localStorage.setItem('aidet.pending', JSON.stringify([queued]))

    const seen: Answer[] = []
    global.fetch = mockFetchImpl({
      onAnswer: (body) => {
        seen.push(body)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    }) as unknown as typeof fetch

    render(<PlayerPage />)

    await waitFor(() => expect(seen).toContainEqual(queued))
    await waitFor(() => {
      const pending = JSON.parse(localStorage.getItem('aidet.pending') ?? '[]')
      expect(pending).toEqual([])
    })
  }, 15000)

  // ── Finding 1: a reload must resume the same player, never join twice ──────

  it('resumes on the next case after a reload, without re-joining or losing earlier answers', async () => {
    global.fetch = mockFetchImpl() as unknown as typeof fetch
    const { unmount } = render(<PlayerPage />)

    await joinAndReachCase()
    fireEvent.click(screen.getByText(artemis.options[1].label.th))
    fireEvent.click(screen.getByText('ยืนยันคำตัดสิน'))
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())

    const joinCallsBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '/api/join').length
    expect(joinCallsBefore).toBe(1)

    // Case 1's answer must already be durably persisted before the "reload".
    const runBefore = JSON.parse(localStorage.getItem('aidet.run') ?? 'null')
    expect(runBefore?.answers).toEqual([
      expect.objectContaining({ caseId: artemis.id, optionId: artemis.options[1].id }),
    ])

    // Simulate a reload: unmount (React state is gone) but localStorage survives.
    unmount()
    render(<PlayerPage />)

    // Resumes directly on case 2 — the codename screen never reappears.
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    // No second join.
    const joinCallsAfter = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[0] === '/api/join').length
    expect(joinCallsAfter).toBe(1)

    // Case 1's answer is still there after the reload.
    const runAfter = JSON.parse(localStorage.getItem('aidet.run') ?? 'null')
    expect(runAfter?.answers).toEqual([
      expect.objectContaining({ caseId: artemis.id, optionId: artemis.options[1].id }),
    ])
  }, 20000)

  it('falls back to a fresh start when the stored run is malformed JSON, without crashing', async () => {
    localStorage.setItem('aidet.run', 'not json{{{')
    global.fetch = mockFetchImpl() as unknown as typeof fetch

    expect(() => render(<PlayerPage />)).not.toThrow()
    expect(screen.getByRole('textbox')).toBeInTheDocument()

    await joinAndReachCase()
    expect(screen.getByText(artemis.aiAnswer.th)).toBeInTheDocument()
  }, 15000)

  it('falls back to a fresh start when the stored run has an invalid shape', async () => {
    localStorage.setItem(
      'aidet.run',
      JSON.stringify({ playerId: 'p1', answers: 'not-an-array', index: 99 }),
    )
    global.fetch = mockFetchImpl() as unknown as typeof fetch

    expect(() => render(<PlayerPage />)).not.toThrow()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  }, 15000)

  // ── Finding 2: hanging fetch must time out; concurrent flushes must not drop work ──

  it('a hanging fetch does not block the player and the answer ends up queued', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/join') {
        return Promise.resolve(
          new Response(JSON.stringify({ player: { id: 'p1', codename: 'Detective Test' } }), { status: 200 }),
        )
      }
      if (url === '/api/answer') {
        // Simulates a venue AP that accepts the connection and then hangs forever.
        return new Promise<Response>(() => {})
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<PlayerPage />)
    await joinAndReachCase()

    fireEvent.click(screen.getByText(artemis.options[0].label.th))
    fireEvent.click(screen.getByText('ยืนยันคำตัดสิน'))

    // The player advances immediately, regardless of the hung request.
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())

    // Once the timeout fires, the answer is queued rather than lost forever.
    await waitFor(
      () => {
        const pending = JSON.parse(localStorage.getItem('aidet.pending') ?? '[]')
        expect(pending).toEqual([
          expect.objectContaining({ playerId: 'p1', caseId: artemis.id, optionId: artemis.options[0].id }),
        ])
      },
      { timeout: 9000 },
    )
  }, 12000)

  it('serialises concurrent flushes so an in-flight retry is not clobbered and nothing is dropped', async () => {
    let releaseStale: (() => void) | undefined
    const staleGate = new Promise<void>((resolve) => { releaseStale = resolve })
    let staleAttempts = 0

    // A run already sitting on case 2, with a stale answer left over from a previous
    // flush attempt (e.g. the tab closed mid-retry).
    localStorage.setItem(
      'aidet.run',
      JSON.stringify({
        playerId: 'p1',
        codename: 'Detective Test',
        answers: [{ playerId: 'p1', caseId: artemis.id, optionId: artemis.options[1].id, elapsedMs: 500 }],
        index: 1,
      }),
    )
    localStorage.setItem(
      'aidet.pending',
      JSON.stringify([{ playerId: 'p1', caseId: artemis.id, optionId: 'stale', elapsedMs: 999 }]),
    )

    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/answer') {
        const body = JSON.parse(init!.body as string) as Answer
        if (body.optionId === 'stale') {
          staleAttempts += 1
          await staleGate
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
      throw new Error(`unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    render(<PlayerPage />)

    // Restored straight to case 2 — the mount-time flush of the stale answer is in
    // flight (gated) but must never block the player.
    await waitFor(() => expect(screen.getByText(olympics.aiAnswer.th)).toBeInTheDocument())

    // Commit case 2 while the stale flush (call A) is still gated. Because commit()
    // retries on every commit (success or failure), this fires a second, overlapping
    // flushPending() (call B).
    fireEvent.click(screen.getByText(olympics.options[1].label.th))
    fireEvent.click(screen.getByText('ยืนยันคำตัดสิน'))

    await waitFor(() => expect(staleAttempts).toBeGreaterThanOrEqual(1))

    // Now let the gated (call A) flush resolve.
    releaseStale!()

    // Nothing was dropped: the queue ends up empty and the stale item was not
    // resent by an overlapping call B racing ahead of call A.
    await waitFor(() => {
      const pending = JSON.parse(localStorage.getItem('aidet.pending') ?? '[]')
      expect(pending).toEqual([])
    })
    expect(staleAttempts).toBe(1)
  }, 20000)
})

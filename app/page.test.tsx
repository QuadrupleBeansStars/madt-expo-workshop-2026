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
})

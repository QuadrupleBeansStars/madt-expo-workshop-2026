import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import TvPage from './page'
import { ROUNDS } from '@/lib/game'
import type { PublicGameState } from '@/lib/types'

function mockFetch(state: Partial<PublicGameState>, stats: unknown = { detectives: 2, finished: 0, caseStats: [], leaderboard: [] }) {
  const body: PublicGameState = { seq: 1, phase: 'lobby', roundIndex: 0, caseId: null, remainingMs: 0, answeredCount: 0, playerCount: 2, ...state }
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('/api/state')) return { ok: true, status: 200, json: async () => body } as Response
    if (u.includes('/api/stats')) return { ok: true, status: 200, json: async () => stats } as Response
    return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response
  })
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('TV stage', () => {
  it('lobby shows the join prompt and a Start control', async () => {
    mockFetch({ phase: 'lobby' })
    render(<TvPage />)
    await waitFor(() => expect(screen.getByText(/join on your phone|เข้าร่วมด้วยมือถือ/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /start|เริ่มเกม/i })).toBeInTheDocument()
  })

  it('investigate shows the question and the answered count', async () => {
    const r0 = ROUNDS[0]
    mockFetch({ phase: 'investigate', roundIndex: 0, caseId: r0.id, remainingMs: 40_000, answeredCount: 3, playerCount: 5 })
    render(<TvPage />)
    await waitFor(() => expect(screen.getByText(r0.question.th)).toBeInTheDocument())
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})

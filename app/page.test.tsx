import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import PlayerPage from './page'
import { ROUNDS } from '@/lib/game'
import type { PublicGameState } from '@/lib/types'

function stateResponse(partial: Partial<PublicGameState>): Response {
  const body: PublicGameState = {
    seq: 1, phase: 'lobby', roundIndex: 0, caseId: null, remainingMs: 0,
    answeredCount: 0, playerCount: 1, ...partial,
  }
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('phone flow', () => {
  it('after joining, shows the lobby waiting screen', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/api/join')) return { ok: true, status: 200, json: async () => ({ player: { id: 'p1', codename: 'Alice', spectator: false } }) } as Response
      if (u.includes('/api/state')) return stateResponse({ phase: 'lobby' })
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /begin|เริ่ม/i }))
    await waitFor(() => expect(screen.getByText(/waiting for the host|รอผู้ดำเนินรายการ/i)).toBeInTheDocument())
  })

  it('during investigate, shows answer cards and submits the pick', async () => {
    const round0 = ROUNDS[0]
    const posted: string[] = []
    localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'Alice' }))
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url)
      if (u.includes('/api/state')) return stateResponse({ phase: 'investigate', roundIndex: 0, caseId: round0.id, remainingMs: 60_000, youAnswered: false })
      if (u.includes('/api/answer')) { posted.push(String((init as RequestInit).body)); return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)
    await waitFor(() => expect(screen.getByText(round0.options[0].label.th)).toBeInTheDocument())
    fireEvent.click(screen.getByText(round0.options[0].label.th))
    await waitFor(() => expect(posted.some((b) => b.includes(round0.options[0].id))).toBe(true))
  })
})

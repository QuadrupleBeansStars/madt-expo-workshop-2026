import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import PlayerPage from './page'
import { ROUNDS } from '@/lib/game'
import type { PublicGameState } from '@/lib/types'

function stateResponse(partial: Partial<PublicGameState>): Response {
  const body: PublicGameState = {
    seq: 1, phase: 'lobby', roundIndex: 0, caseId: null, remainingMs: 0,
    answeredCount: 0, playerCount: 1,
    // The server sends `you` for every player it knows, so the default fixture has it. Omitting
    // it means "the host reset the room and forgot this phone" — see the ejection test below.
    you: { codename: 'Alice', spectator: false },
    ...partial,
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

  /*
   * The phone is for TAPPING. The storyboard and the case file are things the room reads together
   * off the projector while the host talks, and both were removed from this screen because a
   * player who has to scroll past them inside a 45-second window loses the round to the scroll.
   *
   * This is asserted here, on the phone, rather than left to `components/game/CaseFile.test.tsx`
   * — that file renders the projector component directly and stays green no matter what this page
   * does. Without this test, someone re-adding the evidence to the phone breaks nothing.
   */
  it('does not put the storyboard or the case file on the phone', async () => {
    const round0 = ROUNDS[0]
    localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'Alice' }))
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/api/state')) return stateResponse({ phase: 'investigate', roundIndex: 0, caseId: round0.id, remainingMs: 60_000, youAnswered: false })
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)
    await waitFor(() => expect(screen.getByText(round0.options[0].label.th)).toBeInTheDocument())

    expect(screen.queryByTestId('story')).toBeNull()
    expect(screen.queryByTestId('case-file')).toBeNull()
    // The filenames are the cheapest proof the retrieval manifest is not here either.
    for (const doc of round0.docs) expect(screen.queryByText(doc.filename)).toBeNull()
  })

  /*
   * The twin of PhoneBody.test.tsx's "an unknown player is ejected from the poll, not from a
   * vote". Before this, the phone learned it had been ejected only when the player tapped an
   * answer and got a 400 — so it sat on the waiting screen looking healthy and then threw them
   * out mid-round, costing them that round. The poll has to notice first.
   */
  it('a reset ejects the phone from the poll, without waiting for a tap', async () => {
    const round0 = ROUNDS[0]
    localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'Alice' }))
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      // 200 for the id we sent, and no `you`: the host reset the room since this phone joined.
      if (u.includes('/api/state')) {
        return stateResponse({ phase: 'investigate', caseId: round0.id, remainingMs: 60_000, you: undefined })
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)

    // Back on the join screen, with no tap having happened...
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
    // ...and the stale identity cleared, so a reload does not walk straight back into it.
    expect(localStorage.getItem('aidet.run')).toBeNull()
  })
})

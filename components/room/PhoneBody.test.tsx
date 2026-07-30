// The Decision Room — the phone.
//
// Two layers are tested here, because the phone is two things:
//   1. `PhoneBody` — the pure renderer. No network, no timers, no storage.
//   2. `app/play/page.tsx` — identity, the poll loop, the vote queue. Tested through a mocked
//      `fetch`, because every bug this file exists to prevent is a network bug.
//
// The test that matters most is "an unknown player is ejected from the poll, not from a vote":
// AI Detective's phone only discovers a room reset when a vote fails with 400, which strands the
// player on a dead screen and then ejects them mid-round. That must not happen here.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Kpi } from '@/lib/room-types'
import { PhoneBody, type PhoneFrame } from './PhoneBody'
import PlayPage from '@/app/play/page'

const ZERO: Kpi = { revenue: 0, profit: 0, satisfaction: 0, waste: 0 }

function frame(over: Partial<PhoneFrame> = {}): PhoneFrame {
  return {
    seq: 1,
    phase: 'stage',
    stageIndex: 0,
    stageId: 'intro-join',
    stageKind: 'intro',
    votingOpen: false,
    remainingMs: 0,
    playerCount: 12,
    voteCount: 0,
    tallies: [],
    ...over,
  }
}

const YOU = { kpi: { ...ZERO, profit: 1700, satisfaction: 40, waste: 200 }, score: 2300, rank: 3, votedOptionId: null }

function decideFrame(over: Partial<PhoneFrame> = {}): PhoneFrame {
  return frame({
    stageId: 'decide-staffing',
    stageKind: 'decide',
    stageIndex: 2,
    votingOpen: true,
    remainingMs: 30_000,
    you: YOU,
    ...over,
  })
}

// ── the pure renderer ───────────────────────────────────────────────────────

describe('PhoneBody', () => {
  it('never blanks the screen when no frame has arrived yet', () => {
    render(<PhoneBody name="Ada" frame={null} picked={null} onVote={() => {}} />)
    expect(screen.getByTestId('phone-holding')).toBeInTheDocument()
  })

  it('shows the player their own KPI, score and rank between decisions', () => {
    render(
      <PhoneBody
        name="Ada"
        frame={frame({ stageId: 'data-you', stageKind: 'data', you: YOU })}
        picked={null}
        onVote={() => {}}
      />,
    )
    const shop = screen.getByTestId('your-shop')
    expect(shop).toBeInTheDocument()
    expect(screen.getByTestId('you-score')).toHaveTextContent('2,300')
    expect(screen.getByTestId('you-rank')).toHaveTextContent('3')
    expect(screen.getByTestId('kpi-profit')).toHaveTextContent('1,700')
    expect(screen.getByTestId('kpi-waste')).toHaveTextContent('200')
    // The holding screen points at the big screen; it never tries to be the projector.
    expect(screen.getByTestId('phone-holding')).toBeInTheDocument()
  })

  it('renders one large button per option on a decide stage, in both languages', () => {
    render(<PhoneBody name="Ada" frame={decideFrame()} picked={null} onVote={() => {}} />)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      expect(screen.getByTestId(`option-${id}`)).toBeInTheDocument()
    }
    expect(screen.getByText('3 baristas')).toBeInTheDocument()
    expect(screen.getByText('บาริสต้า 3 คน')).toBeInTheDocument()
  })

  it('calls onVote exactly once with the stage and option tapped', () => {
    const onVote = vi.fn()
    render(<PhoneBody name="Ada" frame={decideFrame()} picked={null} onVote={onVote} />)
    fireEvent.click(screen.getByTestId('option-b3'))
    expect(onVote).toHaveBeenCalledTimes(1)
    expect(onVote).toHaveBeenCalledWith('decide-staffing', 'b3')
  })

  it('disables every option once the timer has expired, even while the frame still says open', () => {
    render(
      <PhoneBody name="Ada" frame={decideFrame()} remainingMs={0} picked={null} onVote={() => {}} />,
    )
    for (const id of ['b1', 'b2', 'b3', 'b4']) {
      expect(screen.getByTestId(`option-${id}`)).toBeDisabled()
    }
  })

  it('does not fire onVote after the timer has expired', () => {
    const onVote = vi.fn()
    render(<PhoneBody name="Ada" frame={decideFrame()} remainingMs={0} picked={null} onVote={onVote} />)
    fireEvent.click(screen.getByTestId('option-b2'))
    expect(onVote).not.toHaveBeenCalled()
  })

  it('disables every option when voting is closed', () => {
    render(
      <PhoneBody name="Ada" frame={decideFrame({ votingOpen: false })} picked={null} onVote={() => {}} />,
    )
    expect(screen.getByTestId('option-b1')).toBeDisabled()
  })

  it('shows the player what they picked, from the server answer', () => {
    render(
      <PhoneBody
        name="Ada"
        frame={decideFrame({ you: { ...YOU, votedOptionId: 'b3' } })}
        picked={null}
        onVote={() => {}}
      />,
    )
    expect(screen.getByTestId('your-pick')).toHaveTextContent('3 baristas')
    expect(screen.getByTestId('option-b3')).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to the local pick while the vote is still in flight', () => {
    render(<PhoneBody name="Ada" frame={decideFrame()} picked="b1" onVote={() => {}} />)
    expect(screen.getByTestId('your-pick')).toBeInTheDocument()
    expect(screen.getByTestId('option-b1')).toHaveAttribute('aria-pressed', 'true')
  })

  it('holds in the lobby and closes on the final phase', () => {
    const { rerender } = render(
      <PhoneBody name="Ada" frame={frame({ phase: 'lobby', stageId: null, stageKind: null })} picked={null} onVote={() => {}} />,
    )
    expect(screen.getByTestId('phone-holding')).toBeInTheDocument()

    rerender(
      <PhoneBody name="Ada" frame={frame({ phase: 'done', stageId: null, stageKind: null, you: YOU })} picked={null} onVote={() => {}} />,
    )
    expect(screen.getByTestId('phone-final')).toBeInTheDocument()
    expect(screen.getByTestId('you-rank')).toHaveTextContent('3')
  })

  it('never uses the pixel font — it carries no Thai glyphs', () => {
    const { container } = render(<PhoneBody name="Ada" frame={decideFrame()} picked={null} onVote={() => {}} />)
    expect(container.innerHTML).not.toContain('Press Start 2P')
    expect(container.innerHTML).not.toContain('--font-pixel')
  })

  it('never calls the round 1 simulation anything cleverer than it is', () => {
    const { container } = render(<PhoneBody name="Ada" frame={decideFrame()} picked={null} onVote={() => {}} />)
    const html = container.innerHTML.toLowerCase()
    for (const word of ['machine learning', ' ai ', 'a model', 'ปัญญาประดิษฐ์']) {
      expect(html).not.toContain(word)
    }
  })
})

// ── the page: identity, poll loop, vote queue ───────────────────────────────

const PLAYER_KEY = 'decisionroom.player'
const PENDING_KEY = 'decisionroom.pending'

type Call = { url: string; init?: RequestInit }

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

/** What the mocked server will answer with next, per route. */
let stateBody: unknown
let stateStatus = 200
let stateThrows = false
let joinBody: unknown
let voteStatus = 200
let voteThrows = false
let calls: Call[] = []

function installFetch() {
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.startsWith('/api/room/state')) {
      if (stateThrows) throw new Error('network down')
      return jsonResponse(stateBody, stateStatus)
    }
    if (url.startsWith('/api/room/join')) return jsonResponse(joinBody, 200)
    if (url.startsWith('/api/room/vote')) {
      if (voteThrows) throw new Error('network down')
      return jsonResponse(voteStatus === 200 ? { ok: true } : { error: 'nope' }, voteStatus)
    }
    throw new Error(`unexpected fetch: ${url}`)
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

const votes = () => calls.filter((c) => c.url.startsWith('/api/room/vote'))
const stateCalls = () => calls.filter((c) => c.url.startsWith('/api/room/state'))
const bodyOf = (c: Call) => JSON.parse(String(c.init?.body))

/** Let the poll interval fire and every promise it chains settle. */
async function tick(ms = 1200) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('the phone (app/play)', () => {
  beforeEach(() => {
    localStorage.clear()
    calls = []
    // The default server answer knows this player — `you` present. Its ABSENCE is the reset
    // signal, so it must never be missing by accident in a test that is not about a reset.
    stateBody = frame({ you: YOU })
    stateStatus = 200
    stateThrows = false
    joinBody = { player: { id: 'p-1', name: 'Ada' } }
    voteStatus = 200
    voteThrows = false
    installFetch()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('joins with a display name and remembers who you are', async () => {
    render(<PlayPage />)
    await tick(0)

    expect(screen.getByTestId('phone-join')).toBeInTheDocument()
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Ada' } })
    fireEvent.click(screen.getByTestId('join-button'))
    await tick(0)

    const join = calls.find((c) => c.url.startsWith('/api/room/join'))!
    expect(join).toBeDefined()
    expect(bodyOf(join).name).toBe('Ada')

    expect(JSON.parse(localStorage.getItem(PLAYER_KEY)!)).toMatchObject({ playerId: 'p-1', name: 'Ada' })
    expect(screen.queryByTestId('phone-join')).not.toBeInTheDocument()
  })

  it('rejoins itself from storage when the phone wakes up, and polls with its player id', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)

    expect(screen.queryByTestId('phone-join')).not.toBeInTheDocument()
    expect(stateCalls()[0].url).toContain('playerId=p-9')
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()
  })

  it('posts a vote exactly once when an option is tapped', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)

    fireEvent.click(screen.getByTestId('option-b3'))
    await tick(0)
    expect(votes()).toHaveLength(1)
    expect(bodyOf(votes()[0])).toEqual({ playerId: 'p-9', stageId: 'decide-staffing', optionId: 'b3' })

    // Several polls later it is still one vote — nothing re-posts a vote the server accepted.
    await tick(5000)
    expect(votes()).toHaveLength(1)
  })

  it('returns to the join screen the moment a poll comes back without a player — no failed vote needed', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()

    // The host reset the room: the server no longer knows this id, so `you` is absent.
    stateBody = frame({ seq: 9, phase: 'lobby', stageId: null, stageKind: null, playerCount: 0 })
    await tick(1200)

    expect(screen.getByTestId('phone-join')).toBeInTheDocument()
    expect(screen.getByTestId('phone-notice')).toBeInTheDocument()
    expect(localStorage.getItem(PLAYER_KEY)).toBeNull()
    // The bug being guarded against: this must NOT have taken a failed vote to discover.
    expect(votes()).toHaveLength(0)
  })

  it('never re-queues a vote the server rejected with 409', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)

    voteStatus = 409
    fireEvent.click(screen.getByTestId('option-b2'))
    await tick(0)
    expect(votes()).toHaveLength(1)

    await tick(6000)
    expect(votes()).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')).toHaveLength(0)
  })

  it('drops the "too late" notice when the room moves to the next stage', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)

    voteStatus = 409
    fireEvent.click(screen.getByTestId('option-b2'))
    await tick(0)
    expect(screen.getByTestId('phone-notice')).toBeInTheDocument()

    stateBody = frame({ seq: 30, stageId: 'outcome-staffing', stageKind: 'outcome', you: YOU })
    await tick(1200)
    expect(screen.queryByTestId('phone-notice')).not.toBeInTheDocument()
  })

  it('queues a vote the network dropped and retries it', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)

    voteThrows = true
    fireEvent.click(screen.getByTestId('option-b2'))
    await tick(0)
    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toHaveLength(1)

    voteThrows = false
    await tick(1200)
    expect(votes().length).toBeGreaterThan(1)
    expect(JSON.parse(localStorage.getItem(PENDING_KEY)!)).toHaveLength(0)
  })

  it('keeps the last good frame when a poll fails, and never blanks', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame()
    render(<PlayPage />)
    await tick(0)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()

    stateThrows = true
    await tick(2500)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()
    expect(screen.queryByTestId('phone-join')).not.toBeInTheDocument()
    expect(localStorage.getItem(PLAYER_KEY)).not.toBeNull()
  })

  it('discards a frame older than the one already on screen', async () => {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ playerId: 'p-9', name: 'Bee' }))
    stateBody = decideFrame({ seq: 20 })
    render(<PlayPage />)
    await tick(0)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()

    // A replayed, older frame from a different stage must not move the phone backwards.
    stateBody = frame({ seq: 4, stageId: 'data-you', stageKind: 'data', you: YOU })
    await tick(1200)
    expect(screen.getByTestId('phone-decide')).toBeInTheDocument()
  })
})

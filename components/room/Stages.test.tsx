import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AUDIENCE, IS_PLACEHOLDER } from '@/content/audience'
import { STAGES } from '@/content/room'
import { NARRATED_BARISTAS } from '@/content/room-labels'
import { simulateStaffing } from '@/lib/sim'
import type { LeaderboardEntry } from '@/lib/room-store'
import { Stages, type RoomFrame } from './Stages'
import { Leaderboard } from './Leaderboard'
import RoomPage from '@/app/biz/page'

const board: LeaderboardEntry[] = [
  { playerId: 'p1', name: 'Ploy', kpi: { revenue: 2170, profit: 1700, satisfaction: 61, waste: 0 }, score: 3354, rank: 1 },
  { playerId: 'p2', name: 'Nun', kpi: { revenue: 2170, profit: 610, satisfaction: 40, waste: 360 }, score: 1484, rank: 2 },
]

function frameFor(stageId: string, over: Partial<RoomFrame> = {}): RoomFrame {
  const index = STAGES.findIndex((s) => s.id === stageId)
  const stage = STAGES[index]
  return {
    seq: 1,
    phase: 'stage',
    stageIndex: index,
    stageId: stage.id,
    stageKind: stage.kind,
    votingOpen: stage.kind === 'decide',
    remainingMs: stage.kind === 'decide' ? stage.durationMs : 0,
    playerCount: 2,
    voteCount: 0,
    tallies: stage.kind === 'decide' ? stage.options.map((o) => ({ optionId: o.id, count: 0 })) : [],
    leaderboard: board,
    ...over,
  }
}

const lobbyFrame: RoomFrame = {
  seq: 0, phase: 'lobby', stageIndex: 0, stageId: null, stageKind: null,
  votingOpen: false, remainingMs: 0, playerCount: 7, voteCount: 0, tallies: [], leaderboard: [],
}

describe('Stages — intro', () => {
  it('renders the stage headline in both languages', () => {
    render(<Stages frame={frameFor('intro-join')} joinUrl="http://10.0.0.5:3000/play" />)
    expect(screen.getByText(/For the next fifteen minutes, you run a cafe\./)).toBeInTheDocument()
    expect(screen.getByText(/สิบห้านาทีต่อจากนี้ คุณคือเจ้าของร้านกาแฟ/)).toBeInTheDocument()
  })

  it('shows the join URL and a QR code once the client has hydrated', () => {
    render(<Stages frame={frameFor('intro-join')} joinUrl="http://10.0.0.5:3000/play" />)
    expect(screen.getByText('http://10.0.0.5:3000/play')).toBeInTheDocument()
    expect(screen.getByTestId('join-qr')).toBeInTheDocument()
  })

  it('renders no QR before hydration — its absence is the diagnostic tell', () => {
    render(<Stages frame={frameFor('intro-join')} joinUrl="" />)
    expect(screen.queryByTestId('join-qr')).not.toBeInTheDocument()
  })

  it('shows how many shops have joined', () => {
    render(<Stages frame={frameFor('intro-join', { playerCount: 42 })} joinUrl="" />)
    expect(screen.getByTestId('player-count')).toHaveTextContent('42')
  })
})

describe('Stages — lobby and done', () => {
  it('renders the join screen while the room is still in the lobby', () => {
    render(<Stages frame={lobbyFrame} joinUrl="http://10.0.0.5:3000/play" />)
    expect(screen.getByTestId('join-qr')).toBeInTheDocument()
    expect(screen.getByTestId('player-count')).toHaveTextContent('7')
  })

  it('renders the final board when the room is done — never a blank projector', () => {
    // `stageKind` is null on `done` just as it is in the lobby, and `stageIndex` still points at
    // the last stage. Branching on stageKind alone blanks the screen at the closing moment.
    const done: RoomFrame = { ...frameFor('close-takeaways'), phase: 'done', stageId: null, stageKind: null, seq: 9 }
    render(<Stages frame={done} joinUrl="" />)
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument()
    expect(screen.getByText('Ploy')).toBeInTheDocument()
  })
})

describe('Stages — data', () => {
  it('renders the headline, every scripted point, and charts of the room’s own answers', () => {
    render(<Stages frame={frameFor('data-you')} joinUrl="" />)
    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()
    expect(screen.getByText(/50 of you want coffee between 07:00 and 09:00/)).toBeInTheDocument()
    expect(screen.getByText(/70 of you said you walk away/)).toBeInTheDocument()
    // The two questions the copy reads out: when they buy, and how long they queue.
    expect(screen.getByTestId('bar-fill-7to9')).toBeInTheDocument()
    expect(screen.getByTestId('bar-fill-under3')).toBeInTheDocument()
  })

  it('labels every bucket bilingually rather than showing raw keys', () => {
    render(<Stages frame={frameFor('data-you')} joinUrl="" />)
    expect(screen.getByText('07:00–09:00')).toBeInTheDocument()
    expect(screen.getByText('7–9 โมง')).toBeInTheDocument()
    expect(screen.getByText('Under 3 minutes')).toBeInTheDocument()
    expect(screen.queryByText('under3')).not.toBeInTheDocument()
  })
})

describe('Stages — decide', () => {
  const frame = frameFor('decide-staffing', {
    remainingMs: 31_000,
    voteCount: 5,
    tallies: [
      { optionId: 'b1', count: 1 },
      { optionId: 'b2', count: 3 },
      { optionId: 'b3', count: 1 },
      { optionId: 'b4', count: 0 },
    ],
  })

  it('renders the prompt, the context and every option', () => {
    render(<Stages frame={frame} joinUrl="" />)
    expect(screen.getByText(/How many baristas do you put on the bar\?/)).toBeInTheDocument()
    expect(screen.getByText(/A barista costs ฿600 for the shift/)).toBeInTheDocument()
    expect(screen.getByText(/1 barista — keep the wage bill down/)).toBeInTheDocument()
    expect(screen.getByText(/4 baristas — no queue, whatever it costs/)).toBeInTheDocument()
  })

  it('shows the live tally and the seconds left', () => {
    render(<Stages frame={frame} joinUrl="" />)
    expect(screen.getByTestId('tally-b2')).toHaveTextContent('3')
    expect(screen.getByTestId('vote-count')).toHaveTextContent('5')
    expect(screen.getByTestId('countdown')).toHaveTextContent('31')
  })

  it('never shows a negative countdown', () => {
    render(<Stages frame={frameFor('decide-staffing', { remainingMs: 0, votingOpen: false })} joinUrl="" />)
    expect(screen.getByTestId('countdown')).toHaveTextContent('0')
  })
})

describe('Stages — the round 1 outcome (the teaching screen)', () => {
  const trace = simulateStaffing(NARRATED_BARISTAS, AUDIENCE).trace

  it('renders the causal chain the body copy narrates', () => {
    render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    expect(screen.getByTestId('trace-arrivals')).toHaveTextContent(String(trace.arrivals))
    expect(screen.getByTestId('trace-capacity')).toHaveTextContent(String(trace.capacity))
    expect(screen.getByTestId('trace-served')).toHaveTextContent(String(trace.served))
    expect(screen.getByTestId('trace-lostToQueue')).toHaveTextContent(String(trace.lostToQueue))
  })

  it('renders stillQueuing even when it is zero, so nobody visibly vanishes', () => {
    // served + lostToQueue + stillQueuing === arrivals is an invariant of the simulator; the
    // screen has to show all four or the room watches people disappear.
    expect(trace.served + trace.lostToQueue + trace.stillQueuing).toBe(trace.arrivals)
    render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    expect(screen.getByTestId('trace-stillQueuing')).toHaveTextContent(String(trace.stillQueuing))
  })

  it('shows the wait rounded exactly as the body copy quotes it', () => {
    render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    // The script says 3.7; the raw trace is 3.66. Two different numbers on one screen is a defect.
    expect(screen.getByTestId('trace-waitMinutes')).toHaveTextContent(trace.waitMinutes.toFixed(1))
    expect(screen.getByText(/3\.7 minutes and 19 people walked out/)).toBeInTheDocument()
  })

  it('never calls the queue wait the time it takes to make one drink', () => {
    const { container } = render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    expect(container.textContent).toMatch(/queue/i)
    expect(container.textContent).not.toMatch(/per drink|to make one drink|each drink takes/i)
  })

  it('flags the trace as placeholder data for exactly as long as it is placeholder data', () => {
    // The strongest data-honesty claim in the workshop is made on this screen, off figures that
    // are invented until the registration CSV lands. Asserted against the real IS_PLACEHOLDER so
    // this goes green on its own the day the flag flips, rather than red as a false alarm.
    render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    expect(!!screen.queryByTestId('placeholder-badge')).toBe(IS_PLACEHOLDER)
  })

  it('renders the lesson and the board beneath the numbers', () => {
    render(<Stages frame={frameFor('outcome-staffing')} joinUrl="" />)
    expect(screen.getByText('Data is a cost until it changes a decision.')).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument()
  })
})

describe('Stages — the fixed-round outcomes', () => {
  it('renders headline, lesson and each option’s effect', () => {
    render(<Stages frame={frameFor('outcome-defend')} joinUrl="" />)
    expect(screen.getByText('Quality won at noon. Speed won at seven.')).toBeInTheDocument()
    expect(screen.getByText(/Data depreciates\./)).toBeInTheDocument()
    expect(screen.getByTestId('fx-quality')).toBeInTheDocument()
    expect(screen.getByTestId('fx-price')).toBeInTheDocument()
  })

  it('renders a negative effect as a signed number, never a broken zero-width bar', () => {
    const { container } = render(<Stages frame={frameFor('outcome-defend')} joinUrl="" />)
    // `price.fx.profit` is -500. Feeding that to Bars would compute a negative CSS width.
    expect(screen.getByTestId('fx-price')).toHaveTextContent('-500')
    expect(container.innerHTML).not.toMatch(/width:\s*-/)
  })

  it('renders no simulator trace on a round that was not simulated', () => {
    render(<Stages frame={frameFor('outcome-invest')} joinUrl="" />)
    expect(screen.queryByTestId('trace-arrivals')).not.toBeInTheDocument()
  })
})

describe('Stages — close', () => {
  it('renders all three takeaways, the archetypes and the final board', () => {
    render(<Stages frame={frameFor('close-takeaways')} joinUrl="" />)
    expect(screen.getByText(/Data you never act on is an expense/)).toBeInTheDocument()
    expect(screen.getByText(/Every dataset has an expiry date/)).toBeInTheDocument()
    expect(screen.getByText(/The money is in the decision that repeats/)).toBeInTheDocument()
    expect(screen.getByText('The Operator')).toBeInTheDocument()
    expect(screen.getByText('The Efficient')).toBeInTheDocument()
    expect(screen.getByTestId('leaderboard')).toBeInTheDocument()
  })
})

describe('Stages — house rules', () => {
  it('never renders the AI Detective pixel font on any stage', () => {
    for (const stage of STAGES) {
      const { container, unmount } = render(<Stages frame={frameFor(stage.id)} joinUrl="" />)
      expect(container.innerHTML).not.toContain('Press Start 2P')
      unmount()
    }
  })

  it('never describes the simulation as AI or a model', () => {
    for (const stage of STAGES) {
      const { container, unmount } = render(<Stages frame={frameFor(stage.id)} joinUrl="" />)
      expect(container.textContent ?? '').not.toMatch(/\bAI\b|machine learning|\bML\b|\bmodel\b/i)
      unmount()
    }
  })

  it('renders both scripts on every stage — there is no language toggle', () => {
    for (const stage of STAGES) {
      const { container, unmount } = render(<Stages frame={frameFor(stage.id)} joinUrl="" />)
      expect(container.querySelector('[lang="en"]')).not.toBeNull()
      expect(container.querySelector('[lang="th"]')).not.toBeNull()
      expect(container.querySelector('button[aria-label*="language" i]')).toBeNull()
      unmount()
    }
  })
})

describe('Leaderboard', () => {
  it('ranks shops, shows the score, and shares a rank on a tie', () => {
    const tied: LeaderboardEntry[] = [
      { ...board[0], rank: 1 },
      { ...board[1], playerId: 'p3', name: 'Beam', score: board[0].score, rank: 1 },
    ]
    render(<Leaderboard entries={tied} />)
    expect(screen.getAllByTestId(/^board-rank-/)).toHaveLength(2)
    expect(screen.getByTestId('board-rank-p3')).toHaveTextContent('1')
  })

  it('says so plainly when no shop has traded yet', () => {
    render(<Leaderboard entries={[]} />)
    expect(screen.getByTestId('leaderboard')).toHaveTextContent(/No shops on the board yet/)
  })
})

// ── The projector page: polling discipline ──────────────────────────────────
//
// A blank screen mid-workshop is unrecoverable in front of 200 people, so these three behaviours
// are tested against the real page rather than a extracted helper.

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

describe('app/biz — polling discipline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('discards a frame whose seq is older than the one already on screen', async () => {
    const fresh = frameFor('data-you', { seq: 5 })
    const stale = frameFor('decide-staffing', { seq: 3 })
    const fetchMock = vi.fn(async () => jsonResponse(fresh))
    vi.stubGlobal('fetch', fetchMock)

    render(<RoomPage />)
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()

    fetchMock.mockImplementation(async () => jsonResponse(stale))
    await vi.advanceTimersByTimeAsync(2500)

    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()
    expect(screen.queryByText(/How many baristas do you put on the bar\?/)).not.toBeInTheDocument()
  })

  it('keeps the last good frame when a poll throws', async () => {
    const fresh = frameFor('data-you', { seq: 5 })
    const fetchMock = vi.fn(async () => jsonResponse(fresh))
    vi.stubGlobal('fetch', fetchMock)

    render(<RoomPage />)
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()

    fetchMock.mockImplementation(async () => { throw new Error('network went away') })
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()
  })

  it('keeps the last good frame when a poll returns a non-ok response', async () => {
    const fresh = frameFor('data-you', { seq: 5 })
    const fetchMock = vi.fn(async () => jsonResponse(fresh))
    vi.stubGlobal('fetch', fetchMock)

    render(<RoomPage />)
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()

    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) } as Response))
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByText(/You built this dataset weeks ago/)).toBeInTheDocument()
  })
})

describe('app/biz — host controls', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const setup = () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/room/control')) return jsonResponse({ ok: true })
      return jsonResponse(frameFor('data-you', { seq: 5 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<RoomPage />)
    return fetchMock
  }

  const controlCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.filter((c) => String(c[0]).includes('/api/room/control'))

  it('advances on the right arrow, carrying the facilitator token the host typed', async () => {
    const fetchMock = setup()
    await vi.advanceTimersByTimeAsync(300)

    fireEvent.change(screen.getByTestId('token-input'), { target: { value: 'madt2026' } })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await vi.advanceTimersByTimeAsync(10)

    const calls = controlCalls(fetchMock)
    expect(calls).toHaveLength(1)
    const init = calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['x-facilitator-token']).toBe('madt2026')
    expect(JSON.parse(String(init.body))).toEqual({ action: 'advance' })
  })

  it('does not advance when the host is typing the token — a space in a password is not a keypress', async () => {
    const fetchMock = setup()
    await vi.advanceTimersByTimeAsync(300)

    const input = screen.getByTestId('token-input')
    fireEvent.keyDown(input, { key: ' ' })
    fireEvent.keyDown(input, { key: 'ArrowRight' })
    await vi.advanceTimersByTimeAsync(10)

    expect(controlCalls(fetchMock)).toHaveLength(0)
  })

  it('advances exactly once when space is pressed with the Next button still focused', async () => {
    // Clicking Next with the mouse leaves focus on it. Without preventDefault, the browser would
    // also activate the focused button on space — two advances, one skipped stage, live.
    const fetchMock = setup()
    await vi.advanceTimersByTimeAsync(300)

    const next = screen.getByRole('button')
    next.focus()
    fireEvent.keyDown(next, { key: ' ' })
    await vi.advanceTimersByTimeAsync(10)

    expect(controlCalls(fetchMock)).toHaveLength(1)
  })

  it('tells the host when the token was rejected instead of failing silently', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/room/control')) {
        return { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) } as Response
      }
      return jsonResponse(frameFor('data-you', { seq: 5 }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<RoomPage />)
    await vi.advanceTimersByTimeAsync(300)

    fireEvent.change(screen.getByTestId('token-input'), { target: { value: 'wrong' } })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await vi.advanceTimersByTimeAsync(10)

    expect(screen.getByTestId('token-error')).toBeInTheDocument()
  })
})

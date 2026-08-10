import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AUDIENCE, IS_PLACEHOLDER } from '@/content/audience'
import { STAGES } from '@/content/room'
import { NARRATED_DISCOUNT_PRICE, NARRATED_HELD_PRICE } from '@/content/room-labels'
import { simulatePricing } from '@/lib/pricing'
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
    // Read from the script rather than pasted from it: a copy edit in content/room.ts should
    // change what this asserts, not break it.
    const stage = STAGES.find((st) => st.id === 'data-you')
    const points = stage && stage.kind === 'data' ? stage.points : []
    expect(points.length).toBeGreaterThan(0)
    for (const point of points) expect(screen.getByText(point.en)).toBeInTheDocument()
    // The two questions the copy reads out: what they pay, and what decides the purchase.
    expect(screen.getByTestId('bar-fill-50to100')).toBeInTheDocument()
    expect(screen.getByTestId('bar-fill-taste')).toBeInTheDocument()
  })

  it('labels every bucket bilingually rather than showing raw keys', () => {
    render(<Stages frame={frameFor('data-you')} joinUrl="" />)
    expect(screen.getByText('฿50–100')).toBeInTheDocument()
    expect(screen.getByText('50–100 บาท')).toBeInTheDocument()
    expect(screen.getByText('Promotion & discount')).toBeInTheDocument()
    // Raw aggregate keys must never reach a projector.
    expect(screen.queryByText('50to100')).not.toBeInTheDocument()
    expect(screen.queryByText('promotion')).not.toBeInTheDocument()
  })
})

describe('Stages — decide', () => {
  const frame = frameFor('decide-price', {
    remainingMs: 31_000,
    voteCount: 5,
    tallies: [
      { optionId: 'p45', count: 1 },
      { optionId: 'p65', count: 3 },
      { optionId: 'p85', count: 1 },
      { optionId: 'p120', count: 0 },
    ],
  })

  it('renders the prompt, the context and every option', () => {
    render(<Stages frame={frame} joinUrl="" />)
    // Derived from the script, so a copy edit changes what this asserts rather than breaking it.
    const stage = STAGES.find((st) => st.id === 'decide-price')
    if (!stage || stage.kind !== 'decide') throw new Error('decide-price must exist')
    expect(screen.getByText(stage.prompt.en)).toBeInTheDocument()
    expect(screen.getByText(stage.context.en)).toBeInTheDocument()
    // EVERY option, not a sample: an option that renders nowhere is one the room cannot vote for.
    expect(stage.options).toHaveLength(4)
    for (const o of stage.options) expect(screen.getByText(o.label.en)).toBeInTheDocument()
  })

  it('shows the live tally and the seconds left', () => {
    render(<Stages frame={frame} joinUrl="" />)
    expect(screen.getByTestId('tally-p65')).toHaveTextContent('3')
    expect(screen.getByTestId('vote-count')).toHaveTextContent('5')
    expect(screen.getByTestId('countdown')).toHaveTextContent('31')
  })

  it('never shows a negative countdown', () => {
    render(<Stages frame={frameFor('decide-price', { remainingMs: 0, votingOpen: false })} joinUrl="" />)
    expect(screen.getByTestId('countdown')).toHaveTextContent('0')
  })

  // Spec §2: the question, THE DATA THAT BEARS ON IT, and a live timer — on the same screen. The
  // room saw these distributions two stages ago and cannot be expected to hold them in memory
  // through a 45-second vote.
  it('renders one chart per evidence entry, beside the question', () => {
    render(<Stages frame={frame} joinUrl="" />)
    const stage = STAGES.find((s) => s.id === 'decide-price')
    const evidence = stage && stage.kind === 'decide' ? stage.evidence ?? [] : []
    expect(evidence.length).toBeGreaterThan(0)
    for (const key of evidence) expect(screen.getByTestId(`evidence-${key}`)).toBeInTheDocument()
    expect(screen.getByTestId('decide-evidence').querySelectorAll('.room-data-panel'))
      .toHaveLength(evidence.length)
  })

  it('draws the RIGHT distributions — the two a player derives the price from', () => {
    render(<Stages frame={frame} joinUrl="" />)
    // What the room pays, and what actually decides the purchase. Without both charts on screen
    // the round is unwinnable by reasoning, and reasoning is the whole point of it.
    expect(screen.getByTestId('bar-fill-50to100')).toBeInTheDocument()
    expect(screen.getByTestId('bar-fill-taste')).toBeInTheDocument()
    expect(screen.getAllByText(/฿50–100/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Taste/).length).toBeGreaterThan(0)
  })

  it('renders the storyboard the team asked for, above the question', () => {
    render(<Stages frame={frame} joinUrl="" />)
    const board = screen.getByTestId('storyboard')
    expect(board).toBeInTheDocument()
    // Two to four frames — the cap is a projector-width constraint, not a style preference.
    const count = Number(board.dataset.count)
    expect(count).toBeGreaterThanOrEqual(2)
    expect(count).toBeLessThanOrEqual(4)
  })

  it('keeps the PLACEHOLDER guard on every decide-stage chart', () => {
    render(<Stages frame={frame} joinUrl="" />)
    // The real CSV has been imported, so the badge is off. This assertion is kept, inverted,
    // rather than deleted: if a future import ever sets the flag back, the guard must still be
    // wired to every chart, and that is what would break silently.
    expect(IS_PLACEHOLDER).toBe(false)
    expect(screen.queryAllByTestId('placeholder-badge')).toHaveLength(0)
  })

  it('renders the later rounds with their own evidence and their vote intact', () => {
    render(<Stages frame={frameFor('decide-invest')} joinUrl="" />)
    expect(screen.getByTestId('evidence-buyTime')).toBeInTheDocument()
    expect(screen.getByTestId('decide-evidence').querySelectorAll('.room-data-panel')).toHaveLength(1)
    expect(screen.getByTestId('countdown')).toBeInTheDocument()
    expect(screen.getByTestId('tally-equipment')).toBeInTheDocument()
  })
})

describe('Stages — the round 1 outcome (the teaching screen)', () => {
  /*
   * The screen narrates the DISCOUNT, not the winner — the teaching is in the shop that did not
   * work. Every figure below is recomputed from the simulator here, so a re-import of a larger
   * survey fails this file rather than leaving a stale number on a projector.
   */
  const cut = simulatePricing(NARRATED_DISCOUNT_PRICE, AUDIENCE)
  const held = simulatePricing(NARRATED_HELD_PRICE, AUDIENCE)

  it('renders the causal chain the body copy narrates', () => {
    render(<Stages frame={frameFor('outcome-price')} joinUrl="" />)
    expect(screen.getByTestId('trace-footfall')).toHaveTextContent(String(cut.trace.footfall))
    expect(screen.getByTestId('trace-buyers')).toHaveTextContent(String(cut.trace.buyers))
    expect(screen.getByTestId('trace-pricedOut')).toHaveTextContent(String(cut.trace.pricedOut))
  })

  it('renders a zero figure rather than omitting it, so nobody visibly vanishes', () => {
    // buyers + pricedOut === footfall is an invariant of the simulator; the screen has to show
    // every term or the room watches people disappear between two numbers.
    expect(cut.trace.buyers + cut.trace.pricedOut).toBe(cut.trace.footfall)
    render(<Stages frame={frameFor('outcome-price')} joinUrl="" />)
    expect(screen.getByTestId('trace-unsold')).toHaveTextContent(String(cut.trace.unsold))
    expect(screen.getByTestId('trace-accounting')).toBeInTheDocument()
  })

  it('shows the two figures the whole screen exists to put side by side', () => {
    render(<Stages frame={frameFor('outcome-price')} joinUrl="" />)
    const extraCustomers = cut.trace.buyers - held.trace.buyers
    const profitGivenUp = held.profit - cut.profit
    expect(screen.getByTestId('trace-extraCustomers')).toHaveTextContent(String(extraCustomers))
    expect(screen.getByTestId('trace-profitGivenUp')).toHaveTextContent('4,219')
    // ...and the body copy must quote the same pair. Two renderings of one figure on a single
    // screen reads as a broken number, not as precision.
    expect(screen.getByText(/won 7 customers and cost ฿4,219/)).toBeInTheDocument()
    expect(profitGivenUp).toBe(4219)
    expect(extraCustomers).toBe(7)
  })

  it('renders the lesson and the board beneath the numbers', () => {
    render(<Stages frame={frameFor('outcome-price')} joinUrl="" />)
    const stage = STAGES.find((st) => st.id === 'outcome-price')
    expect(stage?.kind).toBe('outcome')
    if (stage?.kind === 'outcome') expect(screen.getByText(stage.lesson.en)).toBeInTheDocument()
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
    const stale = frameFor('decide-price', { seq: 3 })
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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// The rest of the suite imports this the same way (see app/layout.test.tsx, app/tv/tv.test.tsx) —
// there is no global setupFiles registering jest-dom matchers, so this import is required, not
// decorative. Every other *.test.tsx in the repo has it; the brief's snippet omits it only
// because it was written as a standalone illustration.
import '@testing-library/jest-dom/vitest'
import Page from './page'
import { QUESTIONS_IN_ORDER } from '@/lib/game'
import { t } from '@/lib/i18n'

const state = (over: Record<string, unknown> = {}) => ({
  seq: 1, phase: 'question', qIndex: 0, questionId: QUESTIONS_IN_ORDER[0].id,
  actIndex: null, remainingMs: 9000, answeredCount: 0, playerCount: 4, holding: false,
  you: { codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 0, rank: 1, streak: 0, wrongPass: 0 },
  ...over,
})

beforeEach(() => {
  // The real key, verified at app/page.tsx:12 — identity only, never game state.
  localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'เป็ดทอง' }))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(state()), {
    headers: { 'content-type': 'application/json' },
  })))
  // `reading` and `question` render <Patrol>, a canvas. jsdom has no canvas implementation, so
  // every `getContext` call writes a "Not implemented" block to stderr — enough noise across a
  // full run to bury a real error. Returning null is what jsdom does anyway; this only stops it
  // announcing. Patrol's own behaviour is covered in components/game/Patrol.test.tsx.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => vi.restoreAllMocks())

/*
 * The five-second reading beat (spec §2). The phone shows the two buttons it is ABOUT to give the
 * player, locked, so that when the window opens nothing appears from nowhere under their thumb.
 */
describe('the phone during the reading beat', () => {
  const readingState = () => new Response(
    JSON.stringify(state({ phase: 'reading', remainingMs: 5000 })),
    { headers: { 'content-type': 'application/json' } },
  )

  it('shows both buttons, locked, so nothing appears out of nowhere when the window opens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => readingState()))
    render(<Page />)
    expect(await screen.findByRole('button', { name: /ผ่าน/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeDisabled()
  })

  it('posts nothing if a locked button is somehow clicked', async () => {
    // `url` is declared so `f.mock.calls` types as a tuple the filter below can index into.
    const f = vi.fn(async (url: string) => { void url; return readingState() })
    vi.stubGlobal('fetch', f)
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ผ่าน/ }))
    expect(f.mock.calls.filter(([u]) => String(u).includes('/api/answer'))).toHaveLength(0)
  })

  // The timer bar means "you may answer now" and nothing else. Showing it while every answer will
  // be refused server-side teaches the room the wrong signal, so `reading` gets dots instead.
  it('shows no timer bar — that bar means the window is open, and it is not', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => readingState()))
    const { container } = render(<Page />)
    await screen.findByRole('button', { name: /ผ่าน/ })
    expect(container.querySelector('.timer-fill')).toBeNull()
  })

  // A spectator joined mid-session and has nothing to tap in either phase. Without this the beat
  // would hand them two locked buttons for five seconds and then take them away again.
  it('gives a spectator the spectating message, not two locked buttons', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({
        phase: 'reading',
        you: { codename: 'เป็ดทอง', avatar: '🕵️', spectator: true, score: 0, rank: 0, streak: 0, wrongPass: 0 },
      })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)
    expect(await screen.findByText(t('spectating', 'th'))).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('the phone during a question', () => {
  it('shows exactly two choices and nothing else to tap', async () => {
    render(<Page />)
    expect(await screen.findByRole('button', { name: /ผ่าน/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('posts the verdict, not an option id', async () => {
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ตีกลับ/ }))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .find(([url]) => String(url).includes('/api/answer'))
    expect(call, 'no POST to /api/answer').toBeTruthy()
    expect(JSON.parse(String(call![1].body))).toMatchObject({
      playerId: 'p1', questionId: QUESTIONS_IN_ORDER[0].id, verdict: 'reject',
    })
  })

  it('has no language toggle — the game is Thai only', async () => {
    render(<Page />)
    await screen.findByRole('button', { name: /ผ่าน/ })
    expect(screen.queryByRole('button', { name: /EN|TH/i })).toBeNull()
  })
})

// SPEC §5b: correctness on the reveal has to come from the SERVER (`you.lastCorrect`), not from
// ephemeral `picks` state — otherwise a reload mid-reveal, which loses `picks`, falls through to
// "หมดเวลา!" for a player who actually answered and was simply wrong. This is exactly that reload:
// the component mounts fresh (so `picks` is empty) straight into a `reveal` state that already
// carries the player's outcome.
describe('the phone on a reveal, reloaded mid-phase (picks is empty)', () => {
  it('renders the recorded result from the server, not the timeout message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({
        phase: 'reveal', questionId: QUESTIONS_IN_ORDER[0].id, youAnswered: true,
        you: {
          codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 150, rank: 2, streak: 1,
          wrongPass: 0, lastCorrect: true, lastPoints: 150,
        },
      })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)
    expect(await screen.findByText('✅ ถูกต้อง!')).toBeInTheDocument()
    expect(screen.queryByText('หมดเวลา!')).toBeNull()
    expect(screen.getByText(/150 คะแนน/)).toBeInTheDocument()
    expect(screen.getByText(/อันดับ 2/)).toBeInTheDocument()
  })

  it('a wrong answer is distinguishable from a timeout — both come back as "not right", but only one is a loss', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({
        phase: 'reveal', questionId: QUESTIONS_IN_ORDER[0].id, youAnswered: true,
        you: {
          codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 0, rank: 4, streak: 0,
          wrongPass: 1, lastCorrect: false, lastPoints: 0,
        },
      })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)
    expect(await screen.findByText('❌ ยังไม่ใช่')).toBeInTheDocument()
    expect(screen.queryByText('หมดเวลา!')).toBeNull()
    expect(screen.getByText(/0 คะแนน/)).toBeInTheDocument()
  })
})

describe('the phone on an act card', () => {
  it('gives the player nothing to read, so they look up at the projector', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({ phase: 'actcard', actIndex: 0, questionId: null })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)
    expect(await screen.findByText(/ดูจอใหญ่/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

// CRITICAL 3 (final whole-branch review): recovered from git history (the v2 file had this under
// the name "a reset ejects the phone from the poll, without waiting for a tap") — the v3 rewrite
// replaced this whole file with a sample block and the test vanished, even though app/page.tsx
// still implements the behaviour it protects (the seven-line comment at app/page.tsx:81-87).
// Restated against the v3 fixture: a state with no `you` at all (JSON.stringify drops an
// `undefined` property), not v2's `{codename, spectator}` shape.
describe('a host reset while a phone is mid-session', () => {
  it('ejects the phone from the poll, without waiting for a tap', async () => {
    // 200, for the id this phone sent, and no `you`: the host reset the room since this phone
    // joined. Before this behaviour existed the phone sat on "waiting for the host" looking
    // healthy and only learned it had been ejected when a tap got a 400 — costing that round.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({ you: undefined })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)

    // Back on the join screen, with no tap having happened...
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
    // ...and the stale identity cleared, so a reload does not walk straight back into it.
    expect(localStorage.getItem('aidet.run')).toBeNull()
  })
})

// CRITICAL 3 also flagged that CodenameScreen is never mounted by any test in this file: every
// other describe block's `beforeEach` seeds `localStorage['aidet.run']`, so the join path (the
// FIRST thing every real player does) had no coverage at all.
describe('the join screen', () => {
  it('starting from an empty session, typing a codename and submitting POSTs to /api/join', async () => {
    localStorage.clear() // undo beforeEach's identity seed — this test starts a real player cold
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).includes('/api/join')) {
        return new Response(
          JSON.stringify({ player: { id: 'p9', codename: 'สายลับใหม่' } }),
          { headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify(state()), { headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<Page />)
    const input = await screen.findByRole('textbox')
    await userEvent.type(input, 'สายลับใหม่')
    await userEvent.click(screen.getByRole('button', { name: /เริ่มภารกิจ/ }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/join'))
      expect(call, 'no POST to /api/join').toBeTruthy()
      expect(JSON.parse(String((call![1] as RequestInit).body))).toMatchObject({ codename: 'สายลับใหม่' })
    })
  })
})


/*
 * v3.2. Everything below is BEHAVIOURAL on purpose — no sizes, no colours, no easing, no
 * positions. Those are still being tuned and the screenshot plus `npm run check:projector` are
 * the gate for them; an assertion here would fail for reasons that are not defects.
 */

// SPEC §3: `rules` is a real phase between `lobby` and the first `reading`, and the phone's job on
// it is to hold. Same shape as `reading` — the stamps are visibly present and locked, so nothing
// appears from nowhere under the player's thumb when the window finally opens.
describe('the phone on the rules screen', () => {
  const rulesState = () => new Response(
    JSON.stringify(state({ phase: 'rules', questionId: null, remainingMs: 0 })),
    { headers: { 'content-type': 'application/json' } },
  )

  it('points at the projector and holds both stamps locked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => rulesState()))
    render(<Page />)
    expect(await screen.findByText('อ่านกติกาที่จอใหญ่')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ผ่าน/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeDisabled()
  })

  it('posts nothing if a locked stamp is somehow clicked', async () => {
    const f = vi.fn(async (url: string) => { void url; return rulesState() })
    vi.stubGlobal('fetch', f)
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ผ่าน/ }))
    expect(f.mock.calls.filter(([u]) => String(u).includes('/api/answer'))).toHaveLength(0)
  })
})

// The other half of the lock: during `question` the same two controls must be LIVE. Without this,
// "both stamps are disabled" passes just as happily on a screen that never enables them.
describe('the stamps during a question', () => {
  it('are live, not locked', async () => {
    render(<Page />)
    expect(await screen.findByRole('button', { name: /ผ่าน/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeEnabled()
  })

  it('marks the tapped stamp and dims the other one', async () => {
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ตีกลับ/ }))
    expect(screen.getByRole('button', { name: /ตีกลับ/ }).className).toContain('is-picked')
    expect(screen.getByRole('button', { name: /ผ่าน/ }).className).toContain('is-dimmed')
    // ...and the lock holds after the tap, which is the bug a plan snippet once dropped.
    expect(screen.getByRole('button', { name: /ผ่าน/ })).toBeDisabled()
  })
})

/*
 * SPEC §3: READING_MS is 10s. The countdown must say so.
 *
 * The old countdown was four dots going out one a second, which encoded five seconds in its own
 * length: at ten it sat fully lit for the first six and told the player nothing. These two cases
 * are what a duration-agnostic countdown looks like — the same code has to be right at both, so
 * nothing has to be revisited if the beat moves again.
 */
describe('the reading countdown', () => {
  const at = (remainingMs: number) => vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify(state({ phase: 'reading', remainingMs })),
    { headers: { 'content-type': 'application/json' } },
  )))

  it('shows ten seconds at the top of a ten-second beat', async () => {
    at(10_000)
    render(<Page />)
    expect(await screen.findByText('10')).toBeInTheDocument()
  })

  it('shows three with three seconds left', async () => {
    at(2_400)
    render(<Page />)
    expect(await screen.findByText('3')).toBeInTheDocument()
  })
})

/*
 * SPEC §7: the reveal shows the player's rank AND the gap to the person above them — the number
 * that says the next question can still change this.
 *
 * The rank-1 pair below is the load-bearing one. `gapToNext` is ABSENT for the leader and a real
 * `0` for anyone tied with the player above them (ranks are positional — lib/store.ts), so the
 * leader has to be detected by `rank === 1` and never by the gap being falsy. Both tests are here
 * because either one alone passes on a broken implementation: the first alone passes on
 * `gap ? gapLine : leadLine`, and the second alone passes on `gap !== undefined ? gapLine : ...`.
 */
describe('the reveal, on rank and the gap', () => {
  const reveal = (over: Record<string, unknown>) => vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify(state({
      phase: 'reveal', questionId: QUESTIONS_IN_ORDER[0].id, youAnswered: true,
      you: {
        codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 300, streak: 1, wrongPass: 0,
        lastCorrect: true, lastPoints: 300, ...over,
      },
    })),
    { headers: { 'content-type': 'application/json' } },
  )))

  it('names the rank above and the points to it', async () => {
    reveal({ rank: 3, gapToNext: 85 })
    render(<Page />)
    expect(await screen.findByText(/อันดับ 3/)).toBeInTheDocument()
    expect(screen.getByText(/ห่างอันดับ 2 อยู่ 85 แต้ม/)).toBeInTheDocument()
  })

  it('tells the leader they lead, and never that they are 0 behind', async () => {
    // `gapToNext: 0` is deliberately WRONG for rank 1 — the server never sends it (lib/types.ts).
    // It is here so the test fails if the leader is ever detected by the gap instead of the rank.
    reveal({ rank: 1, gapToNext: 0 })
    render(<Page />)
    expect(await screen.findByText(/คุณนำห้องอยู่/)).toBeInTheDocument()
    expect(screen.queryByText(/ห่างอันดับ/)).toBeNull()
    expect(screen.queryByText(/0 แต้ม/)).toBeNull()
  })

  it('a real tie one rank down is still a gap of 0, not a lead', async () => {
    reveal({ rank: 2, gapToNext: 0 })
    render(<Page />)
    expect(await screen.findByText(/ห่างอันดับ 1 อยู่ 0 แต้ม/)).toBeInTheDocument()
    expect(screen.queryByText(/คุณนำห้องอยู่/)).toBeNull()
  })

  it('says nothing about a gap when the server sent none', async () => {
    reveal({ rank: 4 })
    render(<Page />)
    expect(await screen.findByText(/อันดับ 4/)).toBeInTheDocument()
    expect(screen.queryByText(/ห่างอันดับ/)).toBeNull()
  })
})

/*
 * SPEC §7: the final screen has no replay control, and this is not tidiness. "🔄 เล่นอีกครั้ง"
 * cleared the identity and rejoined the phone as a second, scoreless player — while `playerCount`
 * and the closing tally went on counting them. The tally is the number the whole workshop walks
 * toward, and one bored thumb could move it.
 */
describe('the final screen', () => {
  const podium = (over: Record<string, unknown> = {}) => vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify(state({
      phase: 'podium', questionId: null,
      you: {
        codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 1200, rank: 3, streak: 0,
        wrongPass: 2, lastCorrect: null, lastPoints: null, ...over,
      },
    })),
    { headers: { 'content-type': 'application/json' } },
  )))

  it('offers nothing to press', async () => {
    podium()
    render(<Page />)
    await screen.findByText(/สรุปผลการไขคดี/)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('leaves the identity alone — there is no path back to the join screen from here', async () => {
    podium()
    render(<Page />)
    await screen.findByText(/สรุปผลการไขคดี/)
    expect(localStorage.getItem('aidet.run')).not.toBeNull()
  })

  it("ends on the player's own wrong-pass count and what it would mean at work", async () => {
    podium()
    render(<Page />)
    expect(await screen.findByText(/ให้ข้อมูลผิด 2 ครั้ง/)).toBeInTheDocument()
    expect(screen.getByText(/ถ้าเป็นงานจริง/)).toBeInTheDocument()
  })

  it('says a clean game out loud rather than printing "0 ครั้ง"', async () => {
    podium({ wrongPass: 0 })
    render(<Page />)
    expect(await screen.findByText(/ไม่เคยกด/)).toBeInTheDocument()
    expect(screen.queryByText(/0 ครั้ง/)).toBeNull()
  })
})

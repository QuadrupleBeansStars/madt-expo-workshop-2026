import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// No global setupFiles registers jest-dom matchers (see vitest.config.ts) — every *.test.tsx in
// the repo imports this explicitly (app/page.test.tsx, app/layout.test.tsx). The brief's snippet
// omits it only because it was written as a standalone illustration.
import '@testing-library/jest-dom/vitest'
import TV from './page'
import { QUESTIONS_IN_ORDER, QUESTION_MS, READING_MS } from '@/lib/game'
import { scoreAnswer } from '@/lib/scoring'
import { SplitBar } from '@/components/game/SplitBar'
import { t } from '@/lib/i18n'

// jsdom does not lay out. These tests prove the right CONTENT renders per phase; whether it FITS
// on a 1366x768 projector is checked by `npm run check:projector` (a real browser) and nowhere else.

const q0 = QUESTIONS_IN_ORDER[0]
const stats = { leaderboard: [{ playerId: 'a', codename: 'หมูกรอบ', avatar: '🕵️', score: 300, wrongPass: 0, rank: 1 }], recent: [{ codename: 'หมูกรอบ', avatar: '🕵️' }], split: { pass: 7, reject: 3 }, roomWrongPass: 12, roomAccuracy: { correct: 34, wrong: 6 }, playerCount: 10 }

function mockFetch(state: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
    JSON.stringify(String(url).includes('/api/stats') ? stats : state),
    { headers: { 'content-type': 'application/json' } },
  )))
}
const base = { seq: 1, qIndex: 0, questionId: q0.id, actIndex: null, remainingMs: 9000, answeredCount: 7, playerCount: 10, holding: false }

// Task 3 fronts every phase with a login gate (`describe('the token gate', ...)` below). None of
// the phase suites below are testing the gate — they're testing what renders once a host is past
// it — so each needs 'aidet.hostToken' already resolvable at mount. A real host unlocks once per
// tab; reseeding it here keeps that unlock out of every phase assertion's way. This is the one
// change outside the appended block: it's a `beforeEach`, not a rewrite, and every existing test
// name below is untouched.
beforeEach(() => localStorage.setItem('aidet.hostToken', 'dev-local-9f2c'))

// The lobby renders <Patrol>, a canvas. jsdom ships no canvas implementation, so every call to
// `getContext` writes a "Not implemented" block to stderr — a dozen of them per lobby render, which
// is enough noise to bury a real error message in a full run. Returning null explicitly is exactly
// what jsdom does anyway (Patrol then draws nothing and starts no loop, which is correct here);
// this only stops it announcing that. Patrol's own behaviour is tested in components/game with a
// real stubbed context — see Patrol.test.tsx.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => vi.restoreAllMocks())

describe('the projector', () => {
  beforeEach(() => vi.unstubAllGlobals())

  // SYSTEMATIC AUDIT (final whole-branch review): the wholesale rewrite that replaced this file
  // (a7f5d8d) dropped BOTH of v2's lobby tests. "lobby prompts for the host token when none is
  // entered" tested copy v3 deleted on purpose — a permanent labeled host-token field replaced the
  // empty-state "enter the host token" prompt, so that string no longer exists anywhere to assert.
  // This one — the join prompt and a Start control — names real, still-shipped v3 behaviour
  // (`Lobby`'s join-URL text; `HostControls`' Start button, gated on `canStart`) that had nothing
  // covering it anywhere in the suite. Restored.
  it('lobby carries an enabled Start and NO printed join address', async () => {
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    // The address line was cut on purpose: the middle of this screen is the QR and Start, and
    // dropping it is what let the QR grow to 41% of the screen height. Asserted as an absence so
    // it cannot creep back in the next time someone "helpfully" adds a fallback.
    expect(screen.queryByText(/เข้าร่วมด้วยมือถือ/)).toBeNull()
    // Enabled, not merely present. The assertion is unchanged from v3; what moved is where Start
    // lives — v3 rendered it in the corner panel on every phase, disabled outside the lobby, and
    // v3.1 renders it in the middle of the lobby and nowhere else (spec §4).
    expect(await screen.findByRole('button', { name: /เริ่มเกม/ })).toBeEnabled()
  })

  it('shows the question and the duck line during a question', async () => {
    mockFetch({ ...base, phase: 'question' })
    render(<TV />)
    expect(await screen.findByText(q0.ask)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(q0.highlight.slice(0, 10)))).toBeInTheDocument()
    expect(screen.getByText(/7/)).toBeInTheDocument() // answered count
  })

  /*
   * THE REVEAL IS TWO BEATS as of the v3.2 fidelity pass: the verdict, the room's split, the
   * evidence and the lesson — then, after `VERDICT_BEAT_MS`, the standings on a screen of their
   * own. The approved artifact's standings occupy a whole stage (a 9vh title over ten rows at an
   * 8.0vh pitch), which is what forced the split; the two used to compete for one screen.
   *
   * So this is two tests, and each has to be able to fail on its own: the first would pass on an
   * implementation that never advanced, the second on one that skipped the verdict entirely.
   */
  it('opens a reveal on the verdict, the room split and the truth — not the standings', async () => {
    mockFetch({ ...base, phase: 'reveal' })
    const { container } = render(<TV />)
    // The bare-word match on the verdict headline stays unique even though SplitBar's own labels
    // also contain ผ่าน/ตีกลับ: those read `✓ ผ่าน 70%` / `✗ ตีกลับ 30%`, never the bare two-word
    // string alone (see SplitBar's own doc comment on why).
    expect(await screen.findByText(q0.verdict === 'reject' ? 'ตีกลับ' : 'ผ่าน')).toBeInTheDocument()
    expect(screen.getByText(q0.truth)).toBeInTheDocument()
    expect(screen.queryByText('หมูกรอบ')).toBeNull()

    // SplitBar's percentage arithmetic. Fixture is pass:7, reject:3 of 10 -> 70%/30%. The labels
    // first, then the actual fill widths — the labels alone would pass on a bar drawn 50/50.
    expect(screen.getByText('✓ ผ่าน 70%')).toBeInTheDocument()
    expect(screen.getByText('✗ ตีกลับ 30%')).toBeInTheDocument()
    const passFill = container.querySelector('[data-share="pass"]')
    const rejectFill = container.querySelector('[data-share="reject"]')
    expect(passFill).toHaveStyle({ width: '70%' })
    expect(rejectFill).toHaveStyle({ width: '30%' })
  })

  // …and then the standings take the screen. The timeout is past VERDICT_BEAT_MS deliberately: at
  // findByText's 1s default this would go red for the feature working.
  /* The reveal opens on the verdict and STAYS there. It used to hand itself over to the standings
     after 8s, because the server auto-advanced the whole phase at 12s and a host who talked over
     it would otherwise lose the board. The reveal is untimed now, so nothing moves without a
     press — asserted by waiting well past the old fallback and finding the verdict still up. */
  it('holds the verdict beat indefinitely — no clock hands it over', async () => {
    mockFetch({ ...base, phase: 'reveal' })
    render(<TV />)
    expect(await screen.findByText(q0.truth)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 9000))
    expect(screen.getByText(q0.truth)).toBeInTheDocument()
    expect(screen.queryByText('หมูกรอบ')).toBeNull()
  }, 12000)

  // The number COUNTS UP over ~2s now (spec §9) — it is the one number the whole workshop walks
  // toward, and a number already sitting there when the screen appears has been read and dismissed
  // before the host has drawn breath. The timeout is raised past that climb deliberately: at
  // findByText's 1s default this would go red for the feature working.
  /* The tally is the room's MISS RATE now, not a raw count — the same green/pink bar the reveal
     has shown nine times, over the whole game. 6 wrong of 40 answered is 15%.
     The proportion comes from answers actually given (`roomAccuracy`), never from
     playerCount x QUESTION_COUNT: someone who ran out of time is not someone who was wrong, and
     the fixture's 40 deliberately differs from 10 x 9 so that substitution cannot pass. */
  it('shows the room miss rate as a percentage, over answers actually given', async () => {
    mockFetch({ ...base, phase: 'tally', questionId: null })
    render(<TV />)
    expect(await screen.findByText('15%', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByText(/จากทั้งหมด 40 คำตอบ/)).toBeInTheDocument()
  })

  // CRITICAL 1 (spec §5a/§2): the tally is the screen the host delivers the workshop's whole
  // closing sentence over — the number alone is not enough. `wrongPass` (12) is substituted into
  // the framed line as one text node, so this regex (not an exact match on '12') is what proves
  // the sentence itself renders without colliding with the bare-number assertion above.
  it('carries the framed closing-sentence line, with the room wrongPass count substituted in', async () => {
    mockFetch({ ...base, phase: 'tally', questionId: null })
    render(<TV />)
    expect(await screen.findByText(/ถ้านี่เป็นงานจริง.*ข้อมูลผิด 12 ชิ้น/)).toBeInTheDocument()
  })

  it('shows the podium at the end', async () => {
    mockFetch({ ...base, phase: 'podium', questionId: null })
    render(<TV />)
    expect(await screen.findByText('หมูกรอบ')).toBeInTheDocument()
  })

  // `needsCheck` is a facilitator note (lib/types.ts QuestionSchema) — "NEVER rendered". A reveal
  // is the phase most likely to accidentally grow a "notes for the host" panel that leaks one.
  //
  // The fixture is DERIVED, not pinned. This used to lean on `q0` happening to carry a note, and
  // Task 9's opener swap (coffee-cups, which has one, traded places with most-populous, which does
  // not) turned that into a red test with the feature working perfectly — the guard below is what
  // caught it. Deriving the question from the content means the next reordering cannot break it
  // either, and pinning a NEW id would only have moved the same trap one commit forward.
  const withNote = QUESTIONS_IN_ORDER.find((q) => q.needsCheck)!
  it('never renders the facilitator-only needsCheck note', async () => {
    mockFetch({ ...base, phase: 'reveal', questionId: withNote.id, qIndex: QUESTIONS_IN_ORDER.indexOf(withNote) })
    render(<TV />)
    await screen.findByText(withNote.truth)
    expect(withNote.needsCheck, 'fixture question must carry a needsCheck for this test to mean anything').toBeTruthy()
    expect(screen.queryByText(new RegExp(withNote.needsCheck!.slice(0, 10)))).toBeNull()
  })

  // The brief: "Hold renders pressed while state.holding is true." Its own toggle state, not just
  // enabled/disabled — the host needs to see at a glance whether the reveal clock is frozen.
})

// The v3 stage hazard: `next` is NOT idempotent (lib/store.ts#next just calls nextState — no
// no-op guard except on lobby/podium). Two quick presses during a reveal skip straight past the
// NEXT question's own reveal window, and nothing on screen says so until the leaderboard looks
// wrong later. The host control must absorb a double-tap.
describe('the host Next control', () => {
  beforeEach(() => vi.unstubAllGlobals())

  function mockFetchWithSpy(state: Record<string, unknown>) {
    const fn = vi.fn(async (url: string) => new Response(
      JSON.stringify(String(url).includes('/api/stats') ? stats : state),
      { headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fn)
    return fn
  }

  const controlPosts = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls.filter(([url, init]) => {
      if (!String(url).includes('/api/control')) return false
      const body = init && typeof init === 'object' ? (init as RequestInit).body : undefined
      return body !== undefined && JSON.parse(String(body)).action === 'next'
    })

  /* ON AN ACT CARD, not a reveal. A reveal's FIRST ถัดไป is the standings beat and deliberately
     posts nothing (see "the reveal is advanced by the host" below), so a double-tap guard measured
     there would be measuring the wrong control. Every other advanceable phase posts on the first
     press, and the act card is one. */
  it('ignores a second Next press until the first registers, then accepts the next one', async () => {
    const fetchSpy = mockFetchWithSpy({ ...base, phase: 'actcard', actIndex: 0, questionId: null })
    const user = userEvent.setup()
    render(<TV />)

    const nextBtn = await screen.findByRole('button', { name: /ถัดไป/ })
    await user.click(nextBtn)

    // Visible feedback the press registered, and the guard itself.
    expect(nextBtn).toBeDisabled()
    expect(controlPosts(fetchSpy)).toHaveLength(1)

    // A second tap while still guarded must not fire a second POST.
    await user.click(nextBtn)
    expect(controlPosts(fetchSpy)).toHaveLength(1)

    // Once the guard window lapses the host can advance again.
    await waitFor(() => expect(nextBtn).toBeEnabled(), { timeout: 2000 })
    await user.click(nextBtn)
    expect(controlPosts(fetchSpy)).toHaveLength(2)
  })

  // IMPORTANT 1: NEXT_GUARD_MS (700ms) is shorter than STATE_POLL_MS (1000ms) — a fixed re-enable
  // timer keyed only to when the CLICK's own POST resolves cannot reflect "the projector actually
  // repainted", because the repaint waits on the next poll. Simulated here as a `/api/control`
  // response that is slow to come BACK to this request specifically, while the server-visible
  // `seq` (read by an independent `/api/state` poll) has already moved — the poll must clear the
  // button the moment it observes that, without waiting for the click's own request to resolve.
  it('re-enables as soon as a poll observes the seq change, even before the Next POST itself resolves', async () => {
    let seq = 1
    const fn = vi.fn(async (url: string) => {
      const u = String(url)
      if (u.includes('/api/stats')) {
        return new Response(JSON.stringify(stats), { headers: { 'content-type': 'application/json' } })
      }
      if (u.includes('/api/control')) {
        setTimeout(() => { seq = 2 }, 50) // the server-visible advance lands almost immediately...
        await new Promise((resolve) => setTimeout(resolve, 1500)) // ...but THIS response is slow
        return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ...base, phase: 'actcard', actIndex: 0, questionId: null, seq }), { headers: { 'content-type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fn)
    const user = userEvent.setup()
    render(<TV />)

    const nextBtn = await screen.findByRole('button', { name: /ถัดไป/ })
    await user.click(nextBtn)
    expect(nextBtn).toBeDisabled()

    // The next /api/state poll (STATE_POLL_MS ≈ 1s) sees seq:2 and clears the button well before
    // the control POST's own 1500ms delay — and far short of a NEXT_GUARD_MS-after-resolution
    // re-enable, which would land closer to 1500 + 700 = 2200ms.
    await waitFor(() => expect(nextBtn).toBeEnabled(), { timeout: 1300 })
  })
})

/*
 * THE REVEAL IS ADVANCED BY THE HOST, not by a clock inside it.
 *
 * The standings used to appear on a 5.5s timer inside a 12s reveal window, which meant a host
 * reading a fast room pressed ถัดไป at four seconds and the scoreboard for that case was never
 * shown — silently. The user's report was "the scoreboard is gone". The first press now shows it
 * and posts nothing; the second advances the room.
 */
describe('the reveal is advanced by the host', () => {
  beforeEach(() => vi.unstubAllGlobals())

  const spy = (state: Record<string, unknown>) => {
    const fn = vi.fn(async (url: string) => new Response(
      JSON.stringify(String(url).includes('/api/stats') ? stats : state),
      { headers: { 'content-type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fn)
    return fn
  }
  const nextPosts = (fn: ReturnType<typeof vi.fn>) =>
    fn.mock.calls.filter(([url, init]) => {
      if (!String(url).includes('/api/control')) return false
      const body = init && typeof init === 'object' ? (init as RequestInit).body : undefined
      return body !== undefined && JSON.parse(String(body)).action === 'next'
    })

  it('shows the standings on the first press, and does not advance the room', async () => {
    const fetchSpy = spy({ ...base, phase: 'reveal' })
    const user = userEvent.setup()
    render(<TV />)
    await screen.findByText(q0.truth)

    await user.click(screen.getByRole('button', { name: /ถัดไป/ }))

    expect(await screen.findByText('หมูกรอบ')).toBeInTheDocument()
    // The room did NOT move: the press was spent on the beat, not on the phase.
    expect(nextPosts(fetchSpy)).toHaveLength(0)
  })

  /*
   * A DOUBLE TAP MUST NOT SKIP THEM, which is the same failure in a different disguise: the beat
   * press used to return before arming the guard, so the button stayed live and no window opened —
   * and the server's own NEXT_GUARD_MS could not cover it either, because this press posts `ping`,
   * not `next`. Two taps 200ms apart showed the standings for one frame and then advanced past
   * them. `fireEvent` twice with nothing awaited between is what a lagging projector produces;
   * `userEvent` awaits internally and would not reproduce it.
   */
  it('swallows a double tap instead of advancing straight past the standings', async () => {
    const fetchSpy = spy({ ...base, phase: 'reveal' })
    render(<TV />)
    await screen.findByText(q0.truth)

    const next = screen.getByRole('button', { name: /ถัดไป/ })
    fireEvent.click(next)
    fireEvent.click(next)

    expect(await screen.findByText('หมูกรอบ')).toBeInTheDocument()
    expect(nextPosts(fetchSpy)).toHaveLength(0)
  })

  /*
   * A `/tv` REFRESH LATE IN A REVEAL opens on the standings, not back on the verdict. The fallback
   * is armed from how far into the reveal the room already is (`remainingMs`), not from when this
   * tab mounted — otherwise a refresh at second ten of a twelve-second reveal would re-arm it for
   * second eighteen, four seconds after the server has advanced, and the room would see the
   * verdict twice and that case's standings never.
   */
  /* A refresh mid-reveal now opens on the VERDICT, whatever `remainingMs` says — the reveal has
     no clock to be late against, so there is no "already past the beat" to seed from. The cost is
     one extra press after a projector refresh; the thing it buys is that the beat is only ever
     moved by the host, which is what makes it impossible to miss. */
  it('opens on the verdict after a refresh, however long the reveal has been up', async () => {
    spy({ ...base, phase: 'reveal', remainingMs: 0 })
    render(<TV />)
    expect(await screen.findByText(q0.truth)).toBeInTheDocument()
    expect(screen.queryByText('หมูกรอบ')).toBeNull()
  })

  it('advances the room on the second press', async () => {
    const fetchSpy = spy({ ...base, phase: 'reveal' })
    const user = userEvent.setup()
    render(<TV />)
    await screen.findByText(q0.truth)

    const next = screen.getByRole('button', { name: /ถัดไป/ })
    await user.click(next)
    await screen.findByText('หมูกรอบ')
    // The beat press takes the same NEXT_GUARD_MS window a real advance takes — see the double-tap
    // test above — so the host's second press lands after it, not inside it.
    await waitFor(() => expect(next).toBeEnabled(), { timeout: 2000 })
    await user.click(next)

    expect(nextPosts(fetchSpy)).toHaveLength(1)
  })
})

describe('the reading branch and the split bar', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('shows the question and the duck line during reading, but no timer bar', async () => {
    mockFetch({ ...base, phase: 'reading' })
    const { container } = render(<TV />)
    expect(await screen.findByText(q0.ask)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(q0.highlight.slice(0, 10)))).toBeInTheDocument()
    // The bar means "you may answer now", and during the beat nobody can. Dots stand in for it.
    expect(container.querySelector('.timer-fill')).toBeNull()
  })

  // Nobody can have answered yet, and a row of zeroes on the projector reads as a fault rather
  // than a beat.
  it('shows no answered counter during reading', async () => {
    mockFetch({ ...base, phase: 'reading', answeredCount: 0 })
    render(<TV />)
    await screen.findByText(q0.ask)
    expect(screen.queryByText(new RegExp(t('answered', 'th')))).toBeNull()
  })

  /*
   * SPEC §7, and the reason this prop exists. v3 coloured this bar by ACTION, so a reveal where
   * most of the room approved a fabricated answer rendered as a wall of green — the colour of
   * "well done" — under a sentence saying they had just been fooled.
   *
   * Asserted through `data-share`/`data-correct` rather than class names, so it survives a
   * re-skin. The colour itself is checked as the inline VARIABLE the fill was given, never as a
   * computed value: jsdom resolves no custom properties, so `getComputedStyle(...).backgroundColor`
   * reports `rgba(0, 0, 0, 0)` for both fills and an assertion on it can only ever rot. Whether
   * that green is the right green is a real-browser question.
   *
   * q0's correct verdict is `reject`.
   */
  const shares = (verdict: 'pass' | 'reject') => {
    const { container } = render(<SplitBar split={{ pass: 7, reject: 3 }} verdict={verdict} />)
    return [...container.querySelectorAll('[data-share]')].map((el) => ({
      share: el.getAttribute('data-share'),
      correct: el.getAttribute('data-correct'),
      style: el.getAttribute('style') ?? '',
    }))
  }

  it('colours the split by which verdict was CORRECT, not by which button was pressed', () => {
    const [pass, reject] = shares('reject')
    // Order matters and is asserted: the reveal test above reads these two fills positionally.
    expect(pass.share).toBe('pass')
    expect(reject.share).toBe('reject')
    // The minority share — the 3 who pressed ตีกลับ — is the one marked correct and coloured green.
    expect(pass.correct).toBe('false')
    expect(reject.correct).toBe('true')
    expect(reject.style).toContain('det-green')
    expect(pass.style).toContain('det-pink')
  })

  /* Nobody voted. Both fills are 0% wide, and the labels live inside them, so the bar would be an
     empty outlined box — a broken widget rather than a fact. Found on a real reveal in a room that
     had not answered. */
  it('says so when nobody answered, instead of drawing an empty bar', () => {
    const { container } = render(<SplitBar split={{ pass: 0, reject: 0 }} verdict="reject" />)
    expect(container.querySelector('[data-share="pass"]')).toBeNull()
    expect(container.textContent).toContain('ยังไม่มีใครตอบข้อนี้')
  })

  // The other half of the same statement: identical split, identical shares, opposite verdict.
  // Colouring by action would render these two bars identically; colouring by correctness cannot.
  it('flips which share is green when the correct verdict is pass', () => {
    const [pass] = shares('pass')
    expect(pass.correct).toBe('true')
    expect(pass.style).toContain('det-green')
  })
})

describe('the lobby', () => {
  beforeEach(() => vi.unstubAllGlobals())

  // Spec §4: Start is the only pressable thing in the lobby. `Next` and `Hold` have nothing to act
  // on until a game is running, and a corner panel of dead buttons is three chances to mis-tap
  // during the one minute the room is looking at the QR code.
  it('offers Start and nothing else — Next and Hold appear only once the game runs', async () => {
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    expect(await screen.findByRole('button', { name: /เริ่มเกม/ })).toBeEnabled()
    expect(screen.queryByText(/ถัดไป/)).toBeNull()
    expect(screen.queryByText(/พัก/)).toBeNull()
    // The always-visible facilitator-token field is gone with them — it is the exact thing the
    // login gate exists to stop (spec §3), and leaving it here would make the gate decorative.
    expect(screen.queryByLabelText('รหัสผู้ดำเนินรายการ')).toBeNull()
  })

  it('brings the controls back the moment the game starts, and keeps Start out of them', async () => {
    mockFetch({ ...base, phase: 'reading' })
    render(<TV />)
    expect(await screen.findByRole('button', { name: /ถัดไป/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /รีเซ็ต/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /เริ่มเกม/ })).toBeNull()
    // Hold went with the reveal's clock. A control that cannot do anything is worse than none.
    expect(screen.queryByRole('button', { name: /พัก/ })).toBeNull()
  })

  // The cards come from `/api/stats`'s `recent` (join order), never from `leaderboard` — in a
  // lobby nobody has scored, so the leaderboard is sorted alphabetically and a late joiner low in
  // the alphabet would never see their own name. The authoritative size of the room is the number.
  it('pins the recent arrivals as cards and prints the true count as a number', async () => {
    // `playerCount: 17` is deliberately NOT `stats.playerCount` (10) and not the card count (1).
    // The room's size comes from the game state, and picking a number no other fixture field
    // carries is what makes this assertion able to fail: with 10 here it would pass just as well
    // if the lobby read the count off /api/stats, or off the length of the card list.
    mockFetch({ ...base, phase: 'lobby', playerCount: 17 })
    render(<TV />)
    expect(await screen.findByText(/หมูกรอบ/)).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
  })

  /*
   * THE BOARD NO LONGER CAPS, and the inversion is the point (spec §2). v3.1 showed the last
   * twelve arrivals and the projector threw the rest away; the board is now shelf-packed and
   * renders every name it is handed. This test used to assert `นักสืบ0` was ABSENT — the exact
   * assertion the new behaviour has to break.
   *
   * jsdom lays nothing out, so this cannot check where the cards landed; that is
   * `components/game/lobby-packer.test.ts`'s job, against the pure packer. What it CAN check is
   * that every card exists and that none of them is faded.
   */
  it('renders every arrival it is handed, at full opacity', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ codename: `นักสืบ${i}`, avatar: '🕵️' }))
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
      JSON.stringify(String(url).includes('/api/stats')
        ? { ...stats, recent: many, playerCount: 40 }
        // `playerCount` is read from the game state, not from stats — it is the room's own size.
        : { ...base, phase: 'lobby', playerCount: 40 }),
      { headers: { 'content-type': 'application/json' } },
    )))
    const { container } = render(<TV />)
    await screen.findByText('40')
    const cards = [...container.querySelectorAll('.det-pin')]
    expect(cards).toHaveLength(40)
    // The FIRST arrival is on the board too — under the old twelve-card cap it was not.
    expect(screen.getByText(/นักสืบ0$/)).toBeInTheDocument()
    expect(screen.getByText(/นักสืบ39/)).toBeInTheDocument()
    // Spec §2: the age- and coverage-based fading of earlier drafts is deleted outright. Nothing
    // is covered any more, so there is nothing for a fade to apologise for.
    for (const card of cards) {
      expect(card.getAttribute('style') ?? '').not.toMatch(/opacity/)
      expect((card.firstElementChild?.getAttribute('style') ?? '')).not.toMatch(/opacity/)
    }
  })

  // Storing 40 characters is fine; rendering 40 on the board lets one name eat a shelf (spec §2).
  it('truncates a long codename on the card, with an ellipsis', async () => {
    const long = 'นักสืบผู้ยิ่งใหญ่แห่งกรุงเทพมหานคร'
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
      JSON.stringify(String(url).includes('/api/stats')
        ? { ...stats, recent: [{ codename: long, avatar: '🕵️' }], playerCount: 1 }
        : { ...base, phase: 'lobby', playerCount: 1 }),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<TV />)
    expect(await screen.findByText(new RegExp(`${long.slice(0, 14)}…$`))).toBeInTheDocument()
    expect(screen.queryByText(new RegExp(long))).toBeNull()
  })

  /*
   * THE CORNER RESET. `ResetButton` used to render only on non-lobby phases, so a host wanting to
   * clear a rehearsal room had to START the game in order to reach the control that clears it.
   *
   * Start stays the only OTHER control here — asserted above — and the two-step arming that makes
   * a destructive control safe in a visible corner is `ResetButton`'s own; this only pins that the
   * lobby actually mounts it, armed-state intact.
   */
  it('offers a reset in the corner, still armed in two steps', async () => {
    mockFetch({ ...base, phase: 'lobby' })
    const user = userEvent.setup()
    render(<TV />)
    const reset = await screen.findByTestId('reset-button')
    expect(reset).toHaveAttribute('data-armed', 'false')
    await user.click(reset)
    expect(reset).toHaveAttribute('data-armed', 'true')
  })
})

/*
 * THE RULES SCREEN (spec §3). A real phase, not an overlay — the host advances it with the control
 * that already exists, every phone follows the projector automatically, and a refresh mid-screen
 * does not lose it.
 */
describe('the rules screen', () => {
  beforeEach(() => vi.unstubAllGlobals())

  /* THE CHIPS ARE CHECKED AGAINST THE SCORING FUNCTIONS, not against typed-in numbers.
   *
   * This screen is the room's only statement of how points work, and it is the one place a wrong
   * number is never noticed: nobody in the audience can check it, and nothing else on the
   * projector repeats it. It already shipped one — "ตัดสินใน 15 วิ" while the window was 8 —
   * caught only because another test happened to print the screen's text.
   *
   * So the expected strings are BUILT from `scoreAnswer`, at each streak length the chips claim.
   * Retune BASE_POINTS or MAX_STREAK_MULTIPLIER and this fails until the screen agrees. */
  it('states scoring the room can trust, derived from the scoring code itself', async () => {
    mockFetch({ ...base, phase: 'rules', questionId: null })
    render(<TV />)
    expect(await screen.findByText(/จอจะขึ้น/)).toBeInTheDocument()
    expect(screen.getByText(`อ่าน ${READING_MS / 1000} วิ แล้วตัดสินใน ${QUESTION_MS / 1000} วิ`)).toBeInTheDocument()
    expect(screen.getByText(/ตอบผิดหรือไม่ทัน โบนัสหายหมด/)).toBeInTheDocument()

    // `QUESTION_MS` elapsed = the slowest correct answer, so speedBonus is 0 and each figure is
    // the base times the multiplier alone — which is exactly what a chip promises.
    const at = (streak: number) => scoreAnswer(true, streak, QUESTION_MS)
    expect(screen.getByText(`ถูก +${at(1)}`)).toBeInTheDocument()
    expect(screen.getByText(`ติดกัน2 +${at(2)}`)).toBeInTheDocument()
    expect(screen.getByText(`ติดกัน3+ +${at(3)}`)).toBeInTheDocument()
    expect(screen.getByText('ผิด 0')).toBeInTheDocument()
    // The cap is real: a fourth in a row pays the same as the third, which is what "3+" claims.
    expect(at(4)).toBe(at(3))
  })

  // The same content must NOT leak onto the screen the room is judging a question on. A rules
  // panel that renders on every phase is the failure mode an overlay would have had.
  it('renders on no other phase', async () => {
    for (const phase of ['lobby', 'reading', 'question', 'reveal', 'tally', 'podium']) {
      vi.unstubAllGlobals()
      mockFetch({ ...base, phase, questionId: phase === 'tally' || phase === 'podium' ? null : q0.id })
      const { unmount } = render(<TV />)
      await waitFor(() => expect(screen.queryByText(/จอจะขึ้น/), phase).toBeNull())
      unmount()
    }
  })

  /*
   * IT MUST NOT MENTION THE SPEED BONUS (spec §3), and the omission is a design decision rather
   * than an oversight: telling a room of a hundred people that faster answers score more makes
   * them rush, which is the opposite of what this workshop teaches. The bonus stays a silent
   * tiebreaker, so nothing on this screen may name speed or time-based points.
   */
  /* The team reversed this. It used to assert the speed bonus was ABSENT, on the argument that
     telling a room faster scores more makes it rush — the opposite of what the workshop teaches.
     It is announced now, and what this guards instead is the PROPORTION: the line may not promise
     speed without saying being right matters more, because that is the thing that keeps the
     mechanic honest (MAX_SPEED_BONUS is 10 against BASE_POINTS of 100). */
  it('announces the speed bonus only alongside what outweighs it', async () => {
    mockFetch({ ...base, phase: 'rules', questionId: null })
    const { container } = render(<TV />)
    await screen.findByText(/จอจะขึ้น/)
    const text = container.textContent ?? ''
    expect(text).toMatch(/ไว|เร็ว/)
    expect(text, 'speed must never be offered without the thing that outweighs it').toMatch(/ตอบถูกสำคัญกว่า/)
  })

  // The clocks on this screen are derived from the constants. It once said "ตัดสินใน 15 วิ" while
  // the window was 8 — the screen that teaches the rules was stating the wrong one.
  it('states the real clocks, not typed-in ones', async () => {
    mockFetch({ ...base, phase: 'rules', questionId: null })
    const { container } = render(<TV />)
    await screen.findByText(/จอจะขึ้น/)
    expect(container.textContent).toContain(`อ่าน ${READING_MS / 1000} วิ แล้วตัดสินใน ${QUESTION_MS / 1000} วิ`)
  })

  /*
   * HOST-ADVANCED, WITH NO COUNTDOWN. `Next` is the only way off this screen, so the control panel
   * has to be here — the lobby's rule that host controls are absent stops at `lobby`. Without this
   * the room would sit on the rules screen with no way forward.
   */
  it('carries the host Next control, because nothing else advances it', async () => {
    mockFetch({ ...base, phase: 'rules', questionId: null })
    render(<TV />)
    expect(await screen.findByRole('button', { name: /ถัดไป/ })).toBeEnabled()
  })
})

describe('the token gate', () => {
  it('shows the gate and nothing player-facing when no token is held', async () => {
    localStorage.removeItem('aidet.hostToken')
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    // The brief's own snippet queried `getByRole('textbox')`, but a `type="password"` input has NO
    // accessible role at all per HTML-AAM (verified against this component: the query times out
    // even with an aria-label attached) — testing-library follows that mapping. Masking the field
    // is the point of a password input on a projector; downgrading it to `type="text"` to satisfy
    // a role query would be fixing the test by breaking the feature. Query by its label instead.
    expect(await screen.findByLabelText('รหัสผู้ดำเนินรายการ')).toBeInTheDocument()
    expect(screen.queryByText(/เริ่มเกม/)).toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('goes through to the lobby once a token is held', async () => {
    localStorage.setItem('aidet.hostToken', 'dev-local-9f2c')
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    expect(await screen.findByText(/เริ่มเกม/)).toBeInTheDocument()
  })

  /*
   * The SUBMIT path, which neither test above touches: both of those assert what renders for a
   * token that is already resolved one way or the other, never what happens when a host actually
   * types one. Both outcomes are covered, because a gate that waves a wrong token through is worse
   * than no gate at all — it teaches the host the room is protected when it is not.
   *
   * `/api/control` is answered separately from `/api/state` here so the gate's validation call can
   * be given a status independent of the polling loop's, which is the only way to drive the 403
   * branch at all.
   */
  function mockGateFetch(controlStatus: number) {
    // `init` is declared but unused by the handler itself — it is here so `fn.mock.calls` types as
    // a two-element tuple and the assertion on the POST body below type-checks.
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      void init
      const u = String(url)
      if (u.includes('/api/control')) {
        return new Response(
          JSON.stringify(controlStatus === 200 ? { ok: true } : { error: 'forbidden' }),
          { status: controlStatus, headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(
        JSON.stringify(u.includes('/api/stats') ? stats : { ...base, phase: 'lobby' }),
        { headers: { 'content-type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fn)
    return fn
  }

  it('a correct token typed at the gate opens the lobby and is persisted for the next reload', async () => {
    localStorage.removeItem('aidet.hostToken')
    const fetchSpy = mockGateFetch(200)
    const user = userEvent.setup()
    render(<TV />)

    await user.type(await screen.findByLabelText('รหัสผู้ดำเนินรายการ'), 'dev-local-9f2c')
    await user.click(screen.getByRole('button', { name: /เปิดห้อง/ }))

    expect(await screen.findByText(/เริ่มเกม/)).toBeInTheDocument()
    // Persisted, not merely held in state: a refresh mid-session must not throw the host back to
    // the gate — spec §3 calls that a stage failure, not a security improvement.
    expect(localStorage.getItem('aidet.hostToken')).toBe('dev-local-9f2c')

    // The validation call is `ping`, and asserting WHICH action is the whole point of this line.
    // `hold` would satisfy every other assertion in this test while silently freezing the room's
    // clock for a host who authenticates during a live reveal (see app/api/control/route.ts).
    const validation = fetchSpy.mock.calls.find(([u]) => String(u).includes('/api/control'))
    expect(validation, 'the gate never called /api/control').toBeTruthy()
    expect(JSON.parse(String(validation![1]!.body)).action).toBe('ping')
  })

  it('a wrong token leaves the gate up, says so, and persists nothing', async () => {
    localStorage.removeItem('aidet.hostToken')
    mockGateFetch(403)
    const user = userEvent.setup()
    render(<TV />)

    await user.type(await screen.findByLabelText('รหัสผู้ดำเนินรายการ'), 'not-the-token')
    await user.click(screen.getByRole('button', { name: /เปิดห้อง/ }))

    expect(await screen.findByText('รหัสไม่ถูกต้อง')).toBeInTheDocument()
    // Still the gate, and still nothing player-facing behind it.
    expect(screen.getByLabelText('รหัสผู้ดำเนินรายการ')).toBeInTheDocument()
    expect(screen.queryByText(/เริ่มเกม/)).toBeNull()
    expect(localStorage.getItem('aidet.hostToken')).toBeNull()
  })
})

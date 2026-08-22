import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST as join } from './join/route'
import { POST as answer } from './answer/route'
import { GET as stats } from './stats/route'
import { GET as codenameGET } from './codename/route'
import { POST as reset } from './reset/route'
import { GET as stateGET } from './state/route'
import { POST as controlPOST } from './control/route'
import { getStore } from '@/lib/store'
import { QUESTIONS_IN_ORDER } from '@/lib/game'
import { codenamePool } from '@/lib/codenames'

const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
const postRaw = (body: string) => new Request('http://x', { method: 'POST', body })

function req(url: string, body?: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const TEST_FACILITATOR_TOKEN = 'test-token-suite'
// Alias so the verbatim brief blocks below (which name the routes `answerPOST`/`TOKEN`) work
// without renaming every other test in this file that still calls `answer(...)`.
const answerPOST = answer
const TOKEN = TEST_FACILITATOR_TOKEN

const resetWithToken = (token: string) =>
  reset(
    new Request('http://localhost:3000/api/reset', {
      method: 'POST',
      headers: { 'x-facilitator-token': token },
    })
  )
// Isolates each test by resetting the room via the *authorized* path (matching
// header + FACILITATOR_TOKEN). A bare "localhost" request is no longer
// privileged -- see the "POST /api/reset protection" suite below.
const resetLocal = () => {
  process.env.FACILITATOR_TOKEN = TEST_FACILITATOR_TOKEN
  return resetWithToken(TEST_FACILITATOR_TOKEN)
}
// Store gates recordAnswer() on phase === 'question', so any test that needs an
// answer to actually record must open the round first.
//
// `start` (lib/store.ts) now opens the untimed `rules` screen, and one press past that is the
// 10-second `reading` beat — recordAnswer correctly refuses anything outside `question`. This
// helper's contract for the many tests below is "the round is open and answerable", not "the
// rules screen and the reading beat are exercised", so it clears both here rather than making
// every answer-focused test do it.
//
// The rules press goes through the STORE with a timestamp two seconds in the past, not through
// /api/control: the route stamps `Date.now()`, and `next`'s double-tap guard (NEXT_GUARD_MS)
// swallows a second press inside 700ms of the first, so two back-to-back route presses would
// leave the room on `reading` and every answer below would come back 'closed'. Dating it in the
// PAST rather than the future matters — `lastNextAt` ahead of the wall clock would make every
// later route press look like a double-tap, forever.
//
// The last advance stays on the route/`Date.now()` path so `question.phaseStartedAt` is still the
// instant this helper returns, and the speed-bonus expectations below are unchanged.
const startGame = async () => {
  const res = await controlPOST(
    new Request('http://localhost:3000/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TEST_FACILITATOR_TOKEN },
      body: JSON.stringify({ action: 'start' }),
    })
  )
  getStore().next(Date.now() - 2000) // rules -> reading
  await controlPOST(
    new Request('http://localhost:3000/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TEST_FACILITATOR_TOKEN },
      body: JSON.stringify({ action: 'next' }),
    })
  )
  return res
}

describe('API routes', () => {
  beforeEach(async () => { await resetLocal() })

  it('POST /api/join returns a player with an id', async () => {
    const res = await join(post({ codename: 'Detective Ramen' }))
    expect(res.status).toBe(200)
    const { player } = await res.json()
    expect(player.id).toBeTruthy()
    expect(player.codename).toBe('Detective Ramen')
  })

  it('POST /api/join rejects an empty codename', async () => {
    const res = await join(post({ codename: '   ' }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer records an answer that shows up in stats', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    const res = await answer(post({ playerId: player.id, questionId: q.id, verdict: q.verdict }))
    expect(res.status).toBe(200)

    const body = await (await stats()).json()
    expect(body.split).toEqual({ pass: q.verdict === 'pass' ? 1 : 0, reject: q.verdict === 'reject' ? 1 : 0 })
  })

  // The store no longer validates questionId against content -- it only checks the
  // questionId against the currently open question. A questionId for a question that isn't
  // open (or none is open at all) is a *closed round*, not a bad request.
  it('POST /api/answer returns 409 when questionId does not match the open question', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const res = await answer(post({ playerId: player.id, questionId: 'ghost', verdict: 'pass' }))
    expect(res.status).toBe(409)
  })

  it('POST /api/answer rejects an unknown player', async () => {
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    const res = await answer(post({ playerId: 'nobody', questionId: q.id, verdict: 'pass' }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer is idempotent: first answer wins, the replay does not duplicate or overwrite', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    await answer(post({ playerId: player.id, questionId: q.id, verdict: 'reject' }))
    await answer(post({ playerId: player.id, questionId: q.id, verdict: 'pass' }))

    const body = await (await stats()).json()
    // first-wins keeps the 'reject' answer; the replayed 'pass' must not overwrite or double-count it
    expect(body.split).toEqual({ pass: 0, reject: 1 })
  })

  it('GET /api/stats returns the new payload shape for an empty room', async () => {
    const body = await (await stats()).json()
    expect(body.playerCount).toBe(0)
    expect(body.leaderboard).toEqual([])
    expect(body.split).toBeNull()
    expect(body.roomWrongPass).toBe(0)
  })

  // "The projector shows top 5 only" (spec 5a) has to survive a regression that either drops the
  // slice or slices before sorting. Six players, distinct scores by construction: five answer
  // correctly (tied at the same score -- tie-break is codename ascending, per getLeaderboard) and
  // one answers wrong (scores 0, unambiguously last). 'Zed' joins FIRST and the five correct
  // answerers join in REVERSE alphabetical order, so "first five joined" and "top five by score"
  // disagree on every seat -- a slice-before-sort or a dropped-slice regression both fail this.
  it('GET /api/stats leaderboard is capped at 5, sorted by score (not join order)', async () => {
    const q0 = QUESTIONS_IN_ORDER[0]
    const wrongVerdict = q0.verdict === 'pass' ? 'reject' : 'pass'

    const zed = await (await join(post({ codename: 'Zed' }))).json()
    const erin = await (await join(post({ codename: 'Erin' }))).json()
    const dana = await (await join(post({ codename: 'Dana' }))).json()
    const cara = await (await join(post({ codename: 'Cara' }))).json()
    const bob = await (await join(post({ codename: 'Bob' }))).json()
    const alice = await (await join(post({ codename: 'Alice' }))).json()

    await startGame()
    await answer(post({ playerId: zed.player.id, questionId: q0.id, verdict: wrongVerdict }))
    for (const p of [erin, dana, cara, bob, alice]) {
      await answer(post({ playerId: p.player.id, questionId: q0.id, verdict: q0.verdict }))
    }

    const body = await (await stats()).json()
    /* Ten places, not five (v3.2 §5). Six players all fit, INCLUDING Zed on nought, which is the
     * half that would have gone unnoticed: under the old five-place cap Zed was pushed off the
     * board, and a test asserting his absence passed for the wrong reason. Order is by score, and
     * Zed last, so this still discriminates against a payload sorted by join order. */
    expect(body.leaderboard).toHaveLength(6)
    expect(body.leaderboard.map((r: { codename: string }) => r.codename))
      .toEqual(['Alice', 'Bob', 'Cara', 'Dana', 'Erin', 'Zed'])
    expect(body.leaderboard.at(-1).score).toBe(0)
  })

  // The lobby's name cards come from `recent`, NOT from `leaderboard`, and this test is the reason
  // that distinction has to hold. Nobody has scored in a lobby, so `getLeaderboard`'s tie-break
  // sorts by codename — a top-5 slice of it is the five alphabetically-first names in the room,
  // and a late joiner low in the alphabet would never see their own card. Names chosen so join
  // order and alphabetical order disagree on every seat (the same trick the top-5 test above uses
  // with Zed/Alice): anyone who later "simplifies" `recent` into a second read of the leaderboard
  // fails here.
  it('GET /api/stats reports the most recent arrivals in JOIN order, for the lobby cards', async () => {
    for (const codename of ['Zoe', 'Yuki', 'Xavi']) await join(post({ codename }))

    const body = await (await stats()).json()
    expect(body.recent.map((r: { codename: string }) => r.codename)).toEqual(['Zoe', 'Yuki', 'Xavi'])
    // Codename and avatar only — this is the same unauthenticated GET the leaderboard is on.
    for (const row of body.recent) expect(Object.keys(row).sort()).toEqual(['avatar', 'codename'])
  })

  // IMPORTANT 2 (final whole-branch review): /api/stats is an unauthenticated GET reachable by
  // any phone on the LAN, and /api/answer's first-wins semantics accept ANY playerId with no
  // ownership check -- publishing the top five's real ids here would let a phone read them off
  // this payload and lock a wrong answer in for one of them before they tap. Populated
  // deliberately: an empty-room payload passes this assertion vacuously (there is nothing to leak
  // yet), so this reuses the top-5 fixture above -- a real player, in the payload, with a score.
  it('GET /api/stats never publishes a playerId, even with players on the board', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    await answer(post({ playerId: player.id, questionId: q.id, verdict: q.verdict }))

    const body = await (await stats()).json()
    expect(body.leaderboard.length).toBeGreaterThan(0)
    for (const row of body.leaderboard) {
      expect(row).not.toHaveProperty('playerId')
    }
    expect(JSON.stringify(body)).not.toContain(player.id)
  })

  it('POST /api/join returns 400, not a crash, for a non-JSON body', async () => {
    const res = await join(postRaw('not json at all {{{'))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer returns 400, not a crash, for a non-JSON body', async () => {
    const res = await answer(postRaw('not json at all {{{'))
    expect(res.status).toBe(400)
  })

  it('POST /api/join returns 400 for a missing/empty body', async () => {
    const res = await join(postRaw(''))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer returns 400 for a missing/empty body', async () => {
    const res = await answer(postRaw(''))
    expect(res.status).toBe(400)
  })

  it.each([123, {}, [], true])('POST /api/join rejects non-string codename %j without crashing', async (codename) => {
    const res = await join(post({ codename }))
    expect(res.status).toBe(400)
  })

  it('POST /api/join rejects a null codename', async () => {
    const res = await join(post({ codename: null }))
    expect(res.status).toBe(400)
  })

  it.each(['not json', {}, 123])('POST /api/join rejects a non-object body (%j)', async (body) => {
    const res = await join(post(body))
    expect(res.status).toBe(400)
  })

  it('POST /api/join rejects a null body', async () => {
    const res = await join(post(null))
    expect(res.status).toBe(400)
  })

  // elapsedMs is server-stamped now; any client-supplied value -- sane, garbage, or absent --
  // must be ignored, never trusted or validated.
  it.each(['abc', NaN, Infinity, undefined])('POST /api/answer ignores a client-supplied elapsedMs (%j) and still succeeds', async (elapsedMs) => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    const body: Record<string, unknown> = { playerId: player.id, questionId: q.id, verdict: 'pass' }
    if (elapsedMs !== undefined) body.elapsedMs = elapsedMs
    const res = await answer(post(body))
    expect(res.status).toBe(200)
  })

  it('POST /api/answer rejects non-string playerId/questionId without crashing', async () => {
    const res = await answer(post({ playerId: 123, questionId: {}, verdict: 'pass' }))
    expect(res.status).toBe(400)
  })

  it.each(['not json', [], 123])('POST /api/answer rejects a non-object body (%j)', async (body) => {
    const res = await answer(post(body))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer rejects a null body', async () => {
    const res = await answer(post(null))
    expect(res.status).toBe(400)
  })

  it('regression: after a valid answer, GET /api/stats returns a numeric score, not null', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    await answer(post({ playerId: player.id, questionId: q.id, verdict: q.verdict }))
    const body = await (await stats()).json()
    const row = body.leaderboard.find((r: { codename: string }) => r.codename === 'D')
    expect(row.score).not.toBeNull()
    expect(typeof row.score).toBe('number')
    expect(Number.isFinite(row.score)).toBe(true)
  })
})

describe('POST /api/answer', () => {
  it('rejects a body without a verdict', async () => {
    const res = await answerPOST(new Request('http://localhost/api/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 'x', questionId: 'y' }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a verdict that is not pass or reject', async () => {
    const res = await answerPOST(new Request('http://localhost/api/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 'x', questionId: 'y', verdict: 'maybe' }),
    }))
    expect(res.status).toBe(400)
  })

  // The two tests above use playerId 'x', which is never a joined player -- recordAnswer would
  // 400 with "unknown player" regardless of verdict validation, so neither actually discriminates
  // a truthiness guard (`if (!verdict)`) from the required `!== 'pass' && !== 'reject'` check.
  // This test uses a REAL joined player in an open question, so a truthiness guard would let
  // 'maybe' through to the store, where it gets recorded and counted as a reject by getSplit's
  // else-branch (the exact hazard AGENTS.md names) -- proving the guard is load-bearing.
  it('does not record a bogus verdict for a real player in an open question', async () => {
    await resetLocal()
    const { player } = await (await join(post({ codename: 'V' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    const res = await answerPOST(post({ playerId: player.id, questionId: q.id, verdict: 'maybe' }))
    expect(res.status).toBe(400)
    const body = await (await stats()).json()
    expect(body.split).toEqual({ pass: 0, reject: 0 })
  })
})

describe('POST /api/control', () => {
  const originalToken = process.env.FACILITATOR_TOKEN
  beforeEach(() => { process.env.FACILITATOR_TOKEN = TOKEN })
  afterEach(() => {
    if (originalToken === undefined) delete process.env.FACILITATOR_TOKEN
    else process.env.FACILITATOR_TOKEN = originalToken
  })

  it('accepts start, next and ping — and rejects the removed hold', async () => {
    const send = (action: string) => controlPOST(new Request('http://localhost/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
      body: JSON.stringify({ action }),
    }))
    for (const action of ['start', 'next', 'ping']) {
      expect((await send(action)).status, action).toBe(200)
    }
    // `hold` froze the reveal's auto-advance. The reveal is untimed now, so the action had nothing
    // left to do and was removed rather than left as a live endpoint that silently does nothing.
    expect((await send('hold')).status, 'hold').toBe(400)
  })

  // `ping` is the token gate's own validation action (app/tv/page.tsx's TokenGate) — it must be
  // accepted (a real token gets a real 200) but must NEVER touch room state, unlike `hold`, which
  // would otherwise freeze a live reveal as a side effect of a host merely logging in. Proven
  // during an ACTUAL reveal, not just any phase: `toggleHold` (lib/game.ts) is already a no-op
  // outside `reveal`, so testing this off-reveal would pass whether or not `ping` were wired to
  // `hold` by mistake and prove nothing.
  //
  // Reads/writes the store directly (not via `/api/state`, which calls `store.tick(Date.now())`
  // on every GET) — the real wall clock is already far past any `phaseStartedAt`/`REVEAL_MS`
  // window a small, test-chosen `now` can express, so a tick in between would auto-expire the
  // reveal and make this test about phase expiry instead of about `ping`.
  it('ping never touches room state, even a live reveal', async () => {
    const store = getStore()
    store.reset() // this describe block never resets between tests; start from a known phase
    store.startGame(1000)
    store.next(1000) // rules -> reading
    store.next(2000) // reading -> question
    store.next(3000) // question -> reveal
    expect(store.getGameState().phase).toBe('reveal')
    const seqBefore = store.getSeq()
    const gameBefore = store.getGameState()

    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
      body: JSON.stringify({ action: 'ping' }),
    }))

    expect(res.status).toBe(200)
    expect(store.getSeq()).toBe(seqBefore)
    expect(store.getGameState()).toEqual(gameBefore)
  })

  it('ping still 403s a wrong token', async () => {
    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': 'not-the-token' },
      body: JSON.stringify({ action: 'ping' }),
    }))
    expect(res.status).toBe(403)
  })

  it('rejects the retired actions', async () => {
    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
      body: JSON.stringify({ action: 'reveal' }),
    }))
    expect(res.status).toBe(400)
  })

  it('still refuses without the token', async () => {
    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'next' }),
    }))
    expect(res.status).toBe(403)
  })
})

describe('POST /api/reset protection', () => {
  const FACILITATOR_TOKEN = 'test-token-abc'
  const originalToken = process.env.FACILITATOR_TOKEN

  // requests carry no reliable origin signal (req.url is always "localhost"
  // in route handlers), so every case here is exercised the same way: only
  // the x-facilitator-token header can authorize a reset.
  const noHeaderReq = () => new Request('http://localhost:3000/api/reset', { method: 'POST' })
  const withHeaderReq = (token: string) =>
    new Request('http://localhost:3000/api/reset', {
      method: 'POST',
      headers: { 'x-facilitator-token': token },
    })

  beforeEach(async () => {
    // Seed the room via the authorized path first, then set up the actual
    // scenario for the test (each test manages FACILITATOR_TOKEN itself).
    await resetLocal()
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const q = QUESTIONS_IN_ORDER[0]
    await answer(post({ playerId: player.id, questionId: q.id, verdict: q.verdict, elapsedMs: 500 }))
  })

  afterEach(() => {
    if (originalToken === undefined) delete process.env.FACILITATOR_TOKEN
    else process.env.FACILITATOR_TOKEN = originalToken
  })

  it('FACILITATOR_TOKEN unset -> 403, room is NOT cleared', async () => {
    delete process.env.FACILITATOR_TOKEN
    const res = await reset(withHeaderReq('anything'))
    expect(res.status).toBe(403)
    const body = await (await stats()).json()
    expect(body.playerCount).toBe(1)
  })

  it('FACILITATOR_TOKEN set, no header -> 403, room is NOT cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(noHeaderReq())
    expect(res.status).toBe(403)
    const body = await (await stats()).json()
    expect(body.playerCount).toBe(1)
  })

  it('FACILITATOR_TOKEN set, wrong header value -> 403, room is NOT cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(withHeaderReq('wrong-token'))
    expect(res.status).toBe(403)
    const body = await (await stats()).json()
    expect(body.playerCount).toBe(1)
  })

  it('FACILITATOR_TOKEN set, correct header -> 200, room IS cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(withHeaderReq(FACILITATOR_TOKEN))
    expect(res.status).toBe(200)
    const body = await (await stats()).json()
    expect(body.playerCount).toBe(0)
  })
})

describe('/api/state and /api/control', () => {
  it('GET /api/state returns the public game state', async () => {
    const res = await stateGET(req('http://localhost/api/state'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('phase')
    expect(body).toHaveProperty('remainingMs')
    expect(body).toHaveProperty('seq')
  })

  it('POST /api/control without a valid token is forbidden', async () => {
    const prev = process.env.FACILITATOR_TOKEN
    process.env.FACILITATOR_TOKEN = 'secret'
    const res = await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'wrong' }))
    expect(res.status).toBe(403)
    process.env.FACILITATOR_TOKEN = prev
  })

  it('POST /api/control start then next moves the room forward', async () => {
    const prev = process.env.FACILITATOR_TOKEN
    process.env.FACILITATOR_TOKEN = 'secret'
    const h = { 'x-facilitator-token': 'secret' }
    const start = await controlPOST(req('http://localhost/api/control', { action: 'start' }, h))
    expect(start.status).toBe(200)
    // START lands on the rules screen — the phone and the projector both follow the phase, so
    // this is the wire value that decides which screen a hundred devices show.
    const afterStart = await (await stateGET(req('http://localhost/api/state'))).json()
    expect(afterStart.phase).toBe('rules')
    expect(afterStart.remainingMs).toBe(0) // untimed: no countdown for the room to race
    // ...and the host's one forward control takes it to the first reading beat.
    const next = await controlPOST(req('http://localhost/api/control', { action: 'next' }, h))
    expect(next.status).toBe(200)
    const afterNext = await (await stateGET(req('http://localhost/api/state'))).json()
    expect(afterNext.phase).toBe('reading')
    const bad = await controlPOST(req('http://localhost/api/control', { action: 'bogus' }, h))
    expect(bad.status).toBe(400)
    process.env.FACILITATOR_TOKEN = prev
  })
})

describe('/api/answer status contract', () => {
  const originalToken = process.env.FACILITATOR_TOKEN
  afterEach(() => {
    if (originalToken === undefined) delete process.env.FACILITATOR_TOKEN
    else process.env.FACILITATOR_TOKEN = originalToken
  })

  it('answer during the open round returns 200; unknown player returns 400', async () => {
    process.env.FACILITATOR_TOKEN = 'secret'
    getStore().reset()
    const joined = await (await join(req('http://localhost/api/join', { codename: 'Alice' }))).json()
    await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'secret' }))
    // Rules -> reading through the store, dated in the past: two route presses in the same
    // millisecond would trip the double-tap guard and leave the room reading. See `startGame` above.
    getStore().next(Date.now() - 2000)
    await controlPOST(req('http://localhost/api/control', { action: 'next' }, { 'x-facilitator-token': 'secret' })) // past reading, so the question is open
    const q0 = QUESTIONS_IN_ORDER[0]
    const ok = await answer(req('http://localhost/api/answer', {
      playerId: joined.player.id, questionId: q0.id, verdict: q0.verdict,
    }))
    expect(ok.status).toBe(200)
    const unknown = await answer(req('http://localhost/api/answer', {
      playerId: 'ghost', questionId: q0.id, verdict: q0.verdict,
    }))
    expect(unknown.status).toBe(400)
  })

  it('answering the wrong/closed question returns 409', async () => {
    process.env.FACILITATOR_TOKEN = 'secret'
    getStore().reset()
    const joined = await (await join(req('http://localhost/api/join', { codename: 'Bob' }))).json()
    await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'secret' }))
    const q1 = QUESTIONS_IN_ORDER[1]
    const res = await answer(req('http://localhost/api/answer', {
      playerId: joined.player.id, questionId: q1.id, verdict: q1.verdict,
    }))
    expect(res.status).toBe(409)
  })
})

/*
 * GET /api/codename — the 🎲 button's server side. The whole reason it exists is that only the
 * room knows which names are already taken: 100 phones drawing independently from 150 names land
 * on ~73 distinct ones, and about 27 people would carry a numbered name on the projector.
 */
describe('GET /api/codename', () => {
  beforeEach(async () => { await resetLocal() })

  it('returns a codename from the pool', async () => {
    const body = await (await codenameGET()).json()
    expect(codenamePool('th')).toContain(body.codename)
  })

  it('returns NOTHING but the name', async () => {
    // An unauthenticated GET reachable by any phone on the LAN. `Object.keys` rather than a list
    // of `not.toHaveProperty` assertions on purpose: absence-of-what-I-thought-of passes for every
    // field a later commit adds without thinking. See the route's comment, and /api/stats's.
    await join(post({ codename: 'เป็ดทอง' }))
    const body = await (await codenameGET()).json()
    expect(Object.keys(body)).toEqual(['codename'])
  })

  it('does not deal a name the room already holds', async () => {
    // Ten players, each joining under the name they were dealt: ten different names, no suffixes.
    for (let i = 0; i < 10; i++) {
      const { codename } = await (await codenameGET()).json()
      await join(post({ codename }))
    }
    const names = getStore().getPlayers().map((p) => p.codename)
    expect(new Set(names).size).toBe(10)
    expect(names.filter((n) => / \d+$/.test(n))).toEqual([])
  })
})

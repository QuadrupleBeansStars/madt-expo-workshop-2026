import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { POST as join } from './join/route'
import { POST as answer } from './answer/route'
import { GET as stats } from './stats/route'
import { POST as reset } from './reset/route'
import { GET as stateGET } from './state/route'
import { POST as controlPOST } from './control/route'
import { getStore } from '@/lib/store'
import { ROUNDS } from '@/lib/game'

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
// Store now gates recordAnswer() on phase === 'investigate' (Tasks 1-2), so any
// test that needs an answer to actually record must open the round first.
const startGame = () =>
  controlPOST(
    new Request('http://localhost:3000/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TEST_FACILITATOR_TOKEN },
      body: JSON.stringify({ action: 'start' }),
    })
  )

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
    const res = await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale' }))
    expect(res.status).toBe(200)

    const body = await (await stats()).json()
    const artemis = body.caseStats.find((c: { caseId: string }) => c.caseId === 'artemis')
    expect(artemis.answered).toBe(1)
    expect(artemis.fooled).toBe(0) // 'stale' is the correct option
  })

  // The store no longer validates caseId against content -- it only checks the
  // caseId against the currently open round. A caseId for a round that isn't
  // open (or no round is open at all) is a *closed round*, not a bad request.
  it('POST /api/answer returns 409 when caseId does not match the open round', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const res = await answer(post({ playerId: player.id, caseId: 'ghost', optionId: 'x' }))
    expect(res.status).toBe(409)
  })

  it('POST /api/answer rejects an unknown player', async () => {
    await startGame()
    const res = await answer(post({ playerId: 'nobody', caseId: 'artemis', optionId: 'stale' }))
    expect(res.status).toBe(400)
  })

  // The store no longer validates optionId against content -- option validity
  // is a client/UI concern now; the server only cares that the round is open.
  it('POST /api/answer accepts any optionId for the open round (option validity is a client concern)', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const res = await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'nonsense' }))
    expect(res.status).toBe(200)
  })

  it('POST /api/answer is idempotent: first answer wins, the replay does not duplicate or overwrite', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'ai-correct' }))
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale' }))

    const body = await (await stats()).json()
    const artemis = body.caseStats.find((c: { caseId: string }) => c.caseId === 'artemis')
    expect(artemis.answered).toBe(1)
    expect(artemis.fooled).toBe(1) // first answer was 'ai-correct' (wrong); first-wins keeps it
  })

  it('GET /api/stats returns all five cases even with an empty room', async () => {
    const body = await (await stats()).json()
    expect(body.detectives).toBe(0)
    expect(body.caseStats).toHaveLength(5)
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

  // elapsedMs is server-stamped now (Task 5); any client-supplied value --
  // sane, garbage, or absent -- must be ignored, never trusted or validated.
  it.each(['abc', NaN, Infinity, undefined])('POST /api/answer ignores a client-supplied elapsedMs (%j) and still succeeds', async (elapsedMs) => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await startGame()
    const body: Record<string, unknown> = { playerId: player.id, caseId: 'artemis', optionId: 'stale' }
    if (elapsedMs !== undefined) body.elapsedMs = elapsedMs
    const res = await answer(post(body))
    expect(res.status).toBe(200)
  })

  it('POST /api/answer rejects non-string playerId/caseId/optionId without crashing', async () => {
    const res = await answer(post({ playerId: 123, caseId: {}, optionId: [] }))
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
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale' }))
    const body = await (await stats()).json()
    const row = body.leaderboard.find((r: { codename: string }) => r.codename === 'D')
    expect(row.score).not.toBeNull()
    expect(typeof row.score).toBe('number')
    expect(Number.isFinite(row.score)).toBe(true)
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
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 500 }))
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
    expect(body.detectives).toBe(1)
  })

  it('FACILITATOR_TOKEN set, no header -> 403, room is NOT cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(noHeaderReq())
    expect(res.status).toBe(403)
    const body = await (await stats()).json()
    expect(body.detectives).toBe(1)
  })

  it('FACILITATOR_TOKEN set, wrong header value -> 403, room is NOT cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(withHeaderReq('wrong-token'))
    expect(res.status).toBe(403)
    const body = await (await stats()).json()
    expect(body.detectives).toBe(1)
  })

  it('FACILITATOR_TOKEN set, correct header -> 200, room IS cleared', async () => {
    process.env.FACILITATOR_TOKEN = FACILITATOR_TOKEN
    const res = await reset(withHeaderReq(FACILITATOR_TOKEN))
    expect(res.status).toBe(200)
    const body = await (await stats()).json()
    expect(body.detectives).toBe(0)
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
    const after = await (await stateGET(req('http://localhost/api/state'))).json()
    expect(after.phase).toBe('investigate')
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
    const round0 = ROUNDS[0]
    const ok = await answer(req('http://localhost/api/answer', {
      playerId: joined.player.id, caseId: round0.id, optionId: round0.options[0].id,
    }))
    expect(ok.status).toBe(200)
    const unknown = await answer(req('http://localhost/api/answer', {
      playerId: 'ghost', caseId: round0.id, optionId: round0.options[0].id,
    }))
    expect(unknown.status).toBe(400)
  })

  it('answering the wrong/closed round returns 409', async () => {
    process.env.FACILITATOR_TOKEN = 'secret'
    getStore().reset()
    const joined = await (await join(req('http://localhost/api/join', { codename: 'Bob' }))).json()
    await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'secret' }))
    const wrong = ROUNDS[1]
    const res = await answer(req('http://localhost/api/answer', {
      playerId: joined.player.id, caseId: wrong.id, optionId: wrong.options[0].id,
    }))
    expect(res.status).toBe(409)
  })
})

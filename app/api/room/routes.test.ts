import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET as getState } from './state/route'
import { POST as postJoin } from './join/route'
import { POST as postVote } from './vote/route'
import { POST as postControl } from './control/route'
import { POST as postReset } from './reset/route'
import { getRoomStore } from '@/lib/room-store'

const TOKEN = 'test-token'
const req = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url, body === undefined
    ? { headers }
    : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })

const AUTH = { 'x-facilitator-token': TOKEN }

/** Advances the room past the two non-decide intro stages onto the first decide stage. */
async function advanceToFirstDecide() {
  await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH)) // -> stage 0 (intro)
  await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH)) // -> stage 1 (data)
  await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH)) // -> stage 2 (decide)
}

describe('room API', () => {
  beforeEach(() => {
    process.env.FACILITATOR_TOKEN = TOKEN
    getRoomStore().reset()
  })
  afterEach(() => {
    delete process.env.FACILITATOR_TOKEN
  })

  it('state returns lobby initially', async () => {
    const res = await getState(req('http://localhost/api/room/state'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.phase).toBe('lobby')
    expect(body.you).toBeUndefined()
  })

  it('join returns a player with an id', async () => {
    const res = await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.player.id).toBe('string')
    expect(body.player.name).toBe('Nat')
  })

  it('join supports rejoin with an existing playerId', async () => {
    const first = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    const res = await postJoin(req('http://localhost/api/room/join', { name: 'Nat', playerId: first.id }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.player.id).toBe(first.id)
  })

  it('join with a malformed body returns 400', async () => {
    const res = await postJoin(req('http://localhost/api/room/join', 'not json'))
    expect(res.status).toBe(400)
  })

  it('join with a missing name returns 400', async () => {
    const res = await postJoin(req('http://localhost/api/room/join', {}))
    expect(res.status).toBe(400)
  })

  it('state includes the leaderboard', async () => {
    await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))
    const body = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(Array.isArray(body.leaderboard)).toBe(true)
    expect(body.leaderboard.length).toBe(1)
  })

  it('vote succeeds while open and is reflected in state for that player', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstDecide()
    const stateBefore = await (await getState(req('http://localhost/api/room/state'))).json()
    const stageId = stateBefore.stageId as string

    const res = await postVote(req('http://localhost/api/room/vote', {
      playerId: player.id, stageId, optionId: 'b2',
    }))
    expect(res.status).toBe(200)

    const body = await (await getState(req(`http://localhost/api/room/state?playerId=${player.id}`))).json()
    expect(body.you.votedOptionId).toBe('b2')
    expect(body.voteCount).toBe(1)
  })

  it('vote from an unknown player returns 400', async () => {
    await advanceToFirstDecide()
    const stateBefore = await (await getState(req('http://localhost/api/room/state'))).json()
    const res = await postVote(req('http://localhost/api/room/vote', {
      playerId: 'ghost', stageId: stateBefore.stageId, optionId: 'b2',
    }))
    expect(res.status).toBe(400)
  })

  it('vote in the lobby (no open decide stage) returns 409', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    const res = await postVote(req('http://localhost/api/room/vote', {
      playerId: player.id, stageId: 'decide-staffing', optionId: 'b2',
    }))
    expect(res.status).toBe(409)
  })

  it('vote after the stage moves on returns 409', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstDecide()
    const stateBefore = await (await getState(req('http://localhost/api/room/state'))).json()
    const stageId = stateBefore.stageId as string
    await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH))
    const res = await postVote(req('http://localhost/api/room/vote', {
      playerId: player.id, stageId, optionId: 'b2',
    }))
    expect(res.status).toBe(409)
  })

  it('vote with a malformed JSON body returns 400', async () => {
    const res = await postVote(req('http://localhost/api/room/vote', 'not json'))
    expect(res.status).toBe(400)
  })

  it('vote with a missing field returns 400', async () => {
    const res = await postVote(req('http://localhost/api/room/vote', { playerId: 'x' }))
    expect(res.status).toBe(400)
  })

  it('control requires the facilitator token', async () => {
    const res = await postControl(req('http://localhost/api/room/control', { action: 'advance' }))
    expect(res.status).toBe(403)
  })

  it('control is disabled entirely when no token is configured', async () => {
    delete process.env.FACILITATOR_TOKEN
    const res = await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH))
    expect(res.status).toBe(403)
  })

  it('control rejects the wrong token', async () => {
    const res = await postControl(
      req('http://localhost/api/room/control', { action: 'advance' }, { 'x-facilitator-token': 'wrong' }),
    )
    expect(res.status).toBe(403)
  })

  it('control rejects an unknown action', async () => {
    const res = await postControl(req('http://localhost/api/room/control', { action: 'explode' }, AUTH))
    expect(res.status).toBe(400)
  })

  it('control advance moves the room out of the lobby', async () => {
    await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH))
    const body = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(body.phase).toBe('stage')
    expect(body.stageIndex).toBe(0)
  })

  it('reset requires the facilitator token', async () => {
    const res = await postReset(req('http://localhost/api/room/reset', {}))
    expect(res.status).toBe(403)
  })

  it('reset is disabled entirely when no token is configured', async () => {
    delete process.env.FACILITATOR_TOKEN
    const res = await postReset(req('http://localhost/api/room/reset', {}, AUTH))
    expect(res.status).toBe(403)
  })

  it('reset rejects the wrong token', async () => {
    const res = await postReset(req('http://localhost/api/room/reset', {}, { 'x-facilitator-token': 'wrong' }))
    expect(res.status).toBe(403)
  })

  it('reset returns the room to the lobby and clears players', async () => {
    await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))
    await postControl(req('http://localhost/api/room/control', { action: 'advance' }, AUTH))
    const res = await postReset(req('http://localhost/api/room/reset', {}, AUTH))
    expect(res.status).toBe(200)
    const body = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(body.phase).toBe('lobby')
    expect(body.playerCount).toBe(0)
  })

  it('state omits `you` for a playerId the store does not know (post-reset rejoin signal)', async () => {
    const body = await (await getState(req('http://localhost/api/room/state?playerId=ghost'))).json()
    expect(body.you).toBeUndefined()
  })
})

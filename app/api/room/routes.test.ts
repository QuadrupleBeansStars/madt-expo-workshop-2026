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

const control = (action: string) =>
  postControl(req('http://localhost/api/room/control', { action }, AUTH))

/** lobby → q1 ask. */
async function advanceToFirstAsk() {
  await control('advance')
}

describe('room API', () => {
  beforeEach(() => {
    process.env.FACILITATOR_TOKEN = TOKEN
    getRoomStore().reset()
  })
  afterEach(() => {
    delete process.env.FACILITATOR_TOKEN
  })

  it('state returns lobby initially, without leaderboard or split', async () => {
    const res = await getState(req('http://localhost/api/room/state'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.phase).toBe('lobby')
    expect(body.you).toBeUndefined()
    expect('leaderboard' in body).toBe(false)
    expect('split' in body).toBe(false)
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

  it('vote succeeds while an ask stage is open and is reflected in state for that player', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstAsk()
    const res = await postVote(req('http://localhost/api/room/vote',
      { playerId: player.id, questionId: 'q1', choiceIndex: 2 }))
    expect(res.status).toBe(200)
    const state = await (await getState(
      req(`http://localhost/api/room/state?playerId=${player.id}`))).json()
    expect(state.you.pickedChoiceIndex).toBe(2)
    expect(state.voteCount).toBe(1)
  })

  it('vote from an unknown player returns 400', async () => {
    await advanceToFirstAsk()
    const res = await postVote(req('http://localhost/api/room/vote',
      { playerId: 'ghost', questionId: 'q1', choiceIndex: 0 }))
    expect(res.status).toBe(400)
  })

  it('vote in the lobby returns 409', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    const res = await postVote(req('http://localhost/api/room/vote',
      { playerId: player.id, questionId: 'q1', choiceIndex: 0 }))
    expect(res.status).toBe(409)
  })

  it('vote on a reveal stage returns 409', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstAsk()
    await control('advance')   // → q1 reveal
    const res = await postVote(req('http://localhost/api/room/vote',
      { playerId: player.id, questionId: 'q1', choiceIndex: 0 }))
    expect(res.status).toBe(409)
  })

  it('vote with a non-integer choiceIndex reaches the store and returns 409', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstAsk()
    const res = await postVote(req('http://localhost/api/room/vote',
      { playerId: player.id, questionId: 'q1', choiceIndex: 1.5 }))
    expect(res.status).toBe(409)
  })

  it('vote with a malformed JSON body returns 400', async () => {
    const res = await postVote(req('http://localhost/api/room/vote', 'not json'))
    expect(res.status).toBe(400)
  })

  it('vote with a missing or wrong-typed field returns 400', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await advanceToFirstAsk()
    for (const bad of [
      { playerId: player.id, questionId: 'q1' },                       // missing choiceIndex
      { playerId: player.id, choiceIndex: 0 },                          // missing questionId
      { questionId: 'q1', choiceIndex: 0 },                             // missing playerId
      { playerId: player.id, questionId: 'q1', choiceIndex: '2' },      // string index
    ]) {
      const res = await postVote(req('http://localhost/api/room/vote', bad))
      expect(res.status).toBe(400)
    }
  })

  it('split appears only on the reveal stage', async () => {
    await advanceToFirstAsk()
    let state = await (await getState(req('http://localhost/api/room/state'))).json()
    expect('split' in state).toBe(false)
    await control('advance')   // → q1 reveal
    state = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(state.split).toHaveLength(4)
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
    const res = await postControl(req('http://localhost/api/room/control',
      { action: 'advance' }, { 'x-facilitator-token': 'nope' }))
    expect(res.status).toBe(403)
  })

  it('control rejects an unknown action', async () => {
    const res = await control('skip')
    expect(res.status).toBe(400)
  })

  it('control advance moves the room out of the lobby', async () => {
    await control('advance')
    const state = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(state.phase).toBe('stage')
    expect(state.stageKind).toBe('ask')
    expect(state.questionId).toBe('q1')
  })

  it('control back walks the room backwards', async () => {
    await control('advance')   // q1 ask
    await control('advance')   // q1 reveal
    await control('back')      // q1 ask again
    const state = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(state.stageKind).toBe('ask')
    expect(state.questionId).toBe('q1')
    await control('back')      // lobby
    const lobby = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(lobby.phase).toBe('lobby')
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
    const res = await postReset(req('http://localhost/api/room/reset', {}, { 'x-facilitator-token': 'nope' }))
    expect(res.status).toBe(403)
  })

  it('reset returns the room to the lobby and clears players', async () => {
    await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))
    await control('advance')
    const res = await postReset(req('http://localhost/api/room/reset', {}, AUTH))
    expect(res.status).toBe(200)
    const state = await (await getState(req('http://localhost/api/room/state'))).json()
    expect(state.phase).toBe('lobby')
    expect(state.playerCount).toBe(0)
  })

  it('state omits `you` for a playerId the store does not know (post-reset rejoin signal)', async () => {
    const player = (await (await postJoin(req('http://localhost/api/room/join', { name: 'Nat' }))).json()).player
    await postReset(req('http://localhost/api/room/reset', {}, AUTH))
    const state = await (await getState(
      req(`http://localhost/api/room/state?playerId=${player.id}`))).json()
    expect(state.you).toBeUndefined()
  })
})

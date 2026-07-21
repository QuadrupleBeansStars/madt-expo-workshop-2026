import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getState } from './state/route'
import { POST as postJoin } from './join/route'
import { POST as postVote } from './vote/route'
import { POST as postControl } from './control/route'
import { POST as postReset } from './reset/route'
import { getDeckStore } from '@/lib/deck-store'
import { SLIDES } from '@/lib/deck'

const TOKEN = 'test-token'
const req = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url, body === undefined
    ? { headers }
    : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })

describe('deck API', () => {
  beforeEach(() => {
    process.env.FACILITATOR_TOKEN = TOKEN
    getDeckStore().reset()
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('state returns lobby initially', async () => {
    const res = await getState(req('http://localhost/api/deck/state'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.phase).toBe('lobby')
  })

  it('join returns a player id', async () => {
    const res = await postJoin(req('http://localhost/api/deck/join', {}))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.player.id).toBe('string')
  })

  it('control requires the facilitator token', async () => {
    const res = await postControl(req('http://localhost/api/deck/control', { action: 'start' }))
    expect(res.status).toBe(403)
  })

  it('control rejects an unknown action', async () => {
    const res = await postControl(
      req('http://localhost/api/deck/control', { action: 'explode' }, { 'x-facilitator-token': TOKEN }),
    )
    expect(res.status).toBe(400)
  })

  it('control start then next advances the deck', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'next' }, h))
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.slideIndex).toBe(1)
  })

  it('control back steps the deck backwards', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'next' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'back' }, h))
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.slideIndex).toBe(0)
  })

  it('vote succeeds while open and appears in tallies', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    const player = (await (await postJoin(req('http://localhost/api/deck/join', {}))).json()).player
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: player.id, slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(200)
    const body = await (await getState(req(`http://localhost/api/deck/state?playerId=${player.id}`))).json()
    expect(body.youVoted).toBe('walk')
    expect(body.voteCount).toBe(1)
  })

  it('vote after closeVoting returns 409', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    const player = (await (await postJoin(req('http://localhost/api/deck/join', {}))).json()).player
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'closeVoting' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: player.id, slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(409)
  })

  it('vote with a missing field returns 400', async () => {
    const res = await postVote(req('http://localhost/api/deck/vote', { playerId: 'x' }))
    expect(res.status).toBe(400)
  })

  it('vote with malformed JSON returns 400', async () => {
    const res = await postVote(req('http://localhost/api/deck/vote', 'not json'))
    expect(res.status).toBe(400)
  })

  it('vote from an unknown player returns 400', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: 'ghost', slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(400)
  })

  it('reset requires the token and returns to lobby', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    expect((await postReset(req('http://localhost/api/deck/reset', {}))).status).toBe(403)
    expect((await postReset(req('http://localhost/api/deck/reset', {}, h))).status).toBe(200)
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.phase).toBe('lobby')
  })

  it('control is disabled entirely when no token is configured', async () => {
    delete process.env.FACILITATOR_TOKEN
    const res = await postControl(req('http://localhost/api/deck/control', { action: 'start' }))
    expect(res.status).toBe(403)
  })
})

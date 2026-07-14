import { describe, it, expect, beforeEach } from 'vitest'
import { POST as join } from './join/route'
import { POST as answer } from './answer/route'
import { GET as stats } from './stats/route'
import { POST as reset } from './reset/route'

const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })
const postRaw = (body: string) => new Request('http://x', { method: 'POST', body })

describe('API routes', () => {
  beforeEach(async () => { await reset() })

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
    const res = await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 500 }))
    expect(res.status).toBe(200)

    const body = await (await stats()).json()
    const artemis = body.caseStats.find((c: { caseId: string }) => c.caseId === 'artemis')
    expect(artemis.answered).toBe(1)
    expect(artemis.fooled).toBe(0) // 'stale' is the correct option
  })

  it('POST /api/answer rejects an unknown case', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    const res = await answer(post({ playerId: player.id, caseId: 'ghost', optionId: 'x', elapsedMs: 0 }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer rejects an unknown player', async () => {
    const res = await answer(post({ playerId: 'nobody', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer rejects an unknown option', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    const res = await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'nonsense', elapsedMs: 0 }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer is idempotent: re-answering the same case overwrites, not duplicates', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 100 }))
    await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 200 }))

    const body = await (await stats()).json()
    const artemis = body.caseStats.find((c: { caseId: string }) => c.caseId === 'artemis')
    expect(artemis.answered).toBe(1)
    expect(artemis.fooled).toBe(0) // final answer was 'stale', the correct option
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
})

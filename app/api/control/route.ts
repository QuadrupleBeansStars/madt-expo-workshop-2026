import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'control is disabled: FACILITATOR_TOKEN is not set' }, { status: 403 })
  }
  if (req.headers.get('x-facilitator-token') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const action = (body as { action?: unknown })?.action
  const now = Date.now()
  const store = getStore()
  if (action === 'start') store.startGame(now)
  // `reveal` ends the question early and stops on the reveal; `next` moves past a reveal already
  // on screen. Two actions, not one, so a host cutting a question short cannot skip the teaching.
  else if (action === 'reveal') store.revealNow(now)
  else if (action === 'next') store.nextRound(now)
  else return NextResponse.json({ error: 'action must be "start", "reveal" or "next"' }, { status: 400 })

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

const ACTIONS = ['advance', 'back'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: Request) {
  // NOTE: No host/origin/localhost check here — see app/api/reset/route.ts's comment. In App
  // Router route handlers `req.url`'s hostname is always `localhost` regardless of the real
  // client, and there is no trusted proxy signal, so origin can never be used to authorize this.
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
  if (typeof action !== 'string' || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 })
  }

  const store = getRoomStore()
  if (action === 'back') store.back(Date.now())
  else store.advance(Date.now())
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

/*
 * `ping` validates the token and does NOTHING else — it is what the projector's login gate submits
 * to find out whether a typed code is right, before there is any host UI on screen to report a 403
 * from. It has to be an action on this route rather than a route of its own: the check that matters
 * is "would THIS token be accepted by the control endpoint", and only this handler can answer that.
 * AI Detective's gate works the same way (app/api/control/route.ts).
 */
const ACTIONS = ['advance', 'back', 'ping'] as const
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

  // Past the token check, and that is the whole job: a wrong code has already 403'd above.
  if (action === 'ping') return NextResponse.json({ ok: true })

  const store = getRoomStore()
  if (action === 'back') store.back(Date.now())
  else store.advance(Date.now())
  return NextResponse.json({ ok: true })
}

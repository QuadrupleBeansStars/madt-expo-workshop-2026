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
  // One forward control for every phase. `hold` is GONE: it existed only to freeze the reveal's
  // auto-advance, and the reveal is untimed now — every screen that is not reading or question
  // waits for a press, so there is no clock left to fight.
  // cutting a beat short and skipping the teaching are different acts, and the host must not be
  // able to do the second by accident on a laggy projector.
  else if (action === 'next') store.next(now)
  // Token validation only — the projector's login gate calls this to find out whether a typed
  // token is the right one. It must never touch room state: a host authenticating mid-reveal
  // would otherwise freeze the room's clock as a side effect of logging in.
  else if (action === 'ping') { /* the token check above is the whole point */ }
  else return NextResponse.json({ error: 'action must be "start", "next" or "ping"' }, { status: 400 })
  return NextResponse.json({ ok: true })
}

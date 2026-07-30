import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

export async function POST(req: Request) {
  // NOTE: No host/origin/localhost check here — see app/api/reset/route.ts's comment. In App
  // Router route handlers `req.url`'s hostname is always `localhost` regardless of the real
  // client, and there is no trusted proxy signal, so origin can never be used to authorize this.
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: 'reset is disabled: FACILITATOR_TOKEN is not set on the server' },
      { status: 403 },
    )
  }

  const token = req.headers.get('x-facilitator-token')
  if (!token || token !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  getRoomStore().reset()
  return NextResponse.json({ ok: true })
}

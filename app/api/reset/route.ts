import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  // NOTE: There is intentionally no "localhost bypass" here. In Next.js App
  // Router route handlers, `req.url`'s hostname is ALWAYS `localhost` no
  // matter which machine actually made the request or what `Host` header it
  // sent (the dev server runs with `-H 0.0.0.0` so any laptop on the LAN can
  // reach it). There is no reverse proxy in front of this app to supply a
  // trustworthy client-origin signal, so origin/hostname can never be used
  // to authorize this endpoint. Do not add one back.
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: 'reset is disabled: FACILITATOR_TOKEN is not set on the server' },
      { status: 403 }
    )
  }

  const token = req.headers.get('x-facilitator-token')
  if (!token || token !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  getStore().reset()
  return NextResponse.json({ ok: true })
}

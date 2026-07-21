import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

export async function POST(req: Request) {
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'reset is disabled: FACILITATOR_TOKEN is not set' }, { status: 403 })
  }
  if (req.headers.get('x-facilitator-token') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  getDeckStore().reset()
  return NextResponse.json({ ok: true })
}

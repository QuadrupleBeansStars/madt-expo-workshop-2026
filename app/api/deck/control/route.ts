import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

const ACTIONS = ['start', 'next', 'back', 'closeVoting'] as const
type Action = (typeof ACTIONS)[number]

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
  if (typeof action !== 'string' || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 })
  }

  const now = Date.now()
  const store = getDeckStore()
  if (action === 'start') store.start(now)
  else if (action === 'next') store.next(now)
  else if (action === 'back') store.back(now)
  else store.closeVoting(now)

  return NextResponse.json({ ok: true })
}

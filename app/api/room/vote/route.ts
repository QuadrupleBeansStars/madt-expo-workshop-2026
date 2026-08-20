import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'
import type { VoteResult } from '@/lib/room-store'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const { playerId, questionId, choiceIndex } = body as
    { playerId?: unknown; questionId?: unknown; choiceIndex?: unknown }
  if (typeof playerId !== 'string' || !playerId ||
      typeof questionId !== 'string' || !questionId ||
      typeof choiceIndex !== 'number') {
    return NextResponse.json({ error: 'playerId, questionId and choiceIndex are required' }, { status: 400 })
  }

  // Shape errors are the route's job (400); range/integrality is the store's ('closed' → 409).
  const result: VoteResult = getRoomStore().vote({ playerId, questionId, choiceIndex }, Date.now())
  switch (result) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'closed':
      return NextResponse.json({ error: 'voting is not open for this question' }, { status: 409 })
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

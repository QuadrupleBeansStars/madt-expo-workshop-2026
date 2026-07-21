import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

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
  const { playerId, slideId, optionId } = body as
    { playerId?: unknown; slideId?: unknown; optionId?: unknown }
  if (typeof playerId !== 'string' || !playerId ||
      typeof slideId !== 'string' || !slideId ||
      typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, slideId and optionId are required' }, { status: 400 })
  }

  const result = getDeckStore().recordVote({ playerId, slideId, optionId }, Date.now())
  switch (result) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'closed':
      return NextResponse.json({ error: 'voting is not open for this slide' }, { status: 409 })
  }
}

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
  const { playerId, stageId, optionId } = body as
    { playerId?: unknown; stageId?: unknown; optionId?: unknown }
  if (typeof playerId !== 'string' || !playerId ||
      typeof stageId !== 'string' || !stageId ||
      typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, stageId and optionId are required' }, { status: 400 })
  }

  const result: VoteResult = getRoomStore().vote({ playerId, stageId, optionId }, Date.now())
  switch (result) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'closed':
      return NextResponse.json({ error: 'voting is not open for this stage' }, { status: 409 })
    default: {
      const _exhaustive: never = result
      return _exhaustive
    }
  }
}

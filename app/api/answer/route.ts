import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

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
  const { playerId, caseId, optionId } = body as { playerId?: unknown; caseId?: unknown; optionId?: unknown }
  if (typeof playerId !== 'string' || !playerId || typeof caseId !== 'string' || !caseId || typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, caseId and optionId are required' }, { status: 400 })
  }

  // elapsedMs is stamped by the store from server state — client values are ignored.
  const result = getStore().recordAnswer({ playerId, caseId, optionId }, Date.now())
  switch (result) {
    case 'ok':
    case 'duplicate':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'spectator':
    case 'closed':
      return NextResponse.json({ error: 'round not accepting answers' }, { status: 409 })
  }
}

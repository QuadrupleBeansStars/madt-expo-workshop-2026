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
  const { playerId, questionId, verdict } = body as { playerId?: unknown; questionId?: unknown; verdict?: unknown }
  if (typeof playerId !== 'string' || !playerId || typeof questionId !== 'string' || !questionId) {
    return NextResponse.json({ error: 'playerId and questionId are required' }, { status: 400 })
  }
  if (verdict !== 'pass' && verdict !== 'reject') {
    return NextResponse.json({ error: 'verdict must be "pass" or "reject"' }, { status: 400 })
  }

  // elapsedMs is stamped by the store from server state — client values are ignored.
  const result = getStore().recordAnswer({ playerId, questionId, verdict }, Date.now())
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

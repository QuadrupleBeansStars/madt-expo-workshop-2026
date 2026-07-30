import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

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

  const { name, playerId } = body as { name?: unknown; playerId?: unknown }
  if (typeof name !== 'string') {
    return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
  }
  const trimmed = name.trim()
  if (!trimmed) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (playerId !== undefined && typeof playerId !== 'string') {
    return NextResponse.json({ error: 'playerId must be a string' }, { status: 400 })
  }

  const player = getRoomStore().join(trimmed.slice(0, 40), Date.now(), playerId)
  return NextResponse.json({ player })
}

import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get('playerId') ?? undefined
  return NextResponse.json(getDeckStore().getPublicState(Date.now(), playerId))
}

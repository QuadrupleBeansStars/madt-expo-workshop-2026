import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const now = Date.now()
  const store = getStore()
  store.tick(now) // lazy phase expiry — someone always polls, so this fires
  const playerId = new URL(req.url).searchParams.get('playerId') ?? undefined
  return NextResponse.json(store.getPublicState(now, playerId))
}

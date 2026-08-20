import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get('playerId') ?? undefined
  return NextResponse.json(getRoomStore().getPublicState(Date.now(), playerId))
}

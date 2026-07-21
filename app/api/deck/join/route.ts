import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

/** Anonymous join: opening /biz is the whole handshake. No codename by design. */
export async function POST(_req: Request) {
  return NextResponse.json({ player: getDeckStore().join(Date.now()) })
}

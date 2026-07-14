import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { computeStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = getStore()
  return NextResponse.json(computeStats(store.getPlayers(), store.getAnswers()))
}

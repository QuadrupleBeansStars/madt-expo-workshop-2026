import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { getCase } from '@/content/cases'

export async function POST(req: Request) {
  let body: { playerId?: string; caseId?: string; optionId?: string; elapsedMs?: number }
  try {
    body = (await req.json()) as {
      playerId?: string; caseId?: string; optionId?: string; elapsedMs?: number
    }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const { playerId, caseId, optionId } = body ?? {}
  const elapsedMs = body?.elapsedMs ?? 0

  if (!playerId || !caseId || !optionId) {
    return NextResponse.json({ error: 'playerId, caseId and optionId are required' }, { status: 400 })
  }

  const store = getStore()
  if (!store.getPlayers().some((p) => p.id === playerId)) {
    return NextResponse.json({ error: 'unknown player' }, { status: 400 })
  }

  const c = getCase(caseId)
  if (!c) return NextResponse.json({ error: 'unknown case' }, { status: 400 })
  if (!c.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: 'unknown option' }, { status: 400 })
  }

  store.recordAnswer({ playerId, caseId, optionId, elapsedMs })
  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { getCase } from '@/content/cases'

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

  const raw = body as { playerId?: unknown; caseId?: unknown; optionId?: unknown; elapsedMs?: unknown }
  const { playerId, caseId, optionId, elapsedMs: rawElapsedMs } = raw

  if (typeof playerId !== 'string' || !playerId || typeof caseId !== 'string' || !caseId || typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, caseId and optionId are required' }, { status: 400 })
  }

  let elapsedMs = 0
  if (rawElapsedMs !== undefined) {
    if (typeof rawElapsedMs !== 'number' || !Number.isFinite(rawElapsedMs)) {
      return NextResponse.json({ error: 'elapsedMs must be a finite number' }, { status: 400 })
    }
    elapsedMs = rawElapsedMs
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

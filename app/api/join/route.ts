import { NextResponse } from 'next/server'
import { NAME_MAX } from '@/lib/names'
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

  const codename = (body as { codename?: unknown }).codename
  if (typeof codename !== 'string') {
    return NextResponse.json({ error: 'codename must be a string' }, { status: 400 })
  }

  const trimmed = codename.trim()
  if (!trimmed) return NextResponse.json({ error: 'codename required' }, { status: 400 })
  const player = getStore().join(trimmed.slice(0, NAME_MAX), Date.now())
  return NextResponse.json({ player })
}

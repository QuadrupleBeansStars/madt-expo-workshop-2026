import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  let body: { codename?: string }
  try {
    body = (await req.json()) as { codename?: string }
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const trimmed = (body?.codename ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'codename required' }, { status: 400 })
  const player = getStore().join(trimmed.slice(0, 40))
  return NextResponse.json({ player })
}

import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])

function isLocalhost(req: Request): boolean {
  try {
    const hostname = new URL(req.url).hostname
    return LOCALHOST_HOSTNAMES.has(hostname)
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  if (!isLocalhost(req)) {
    const token = req.headers.get('x-facilitator-token')
    const expected = process.env.FACILITATOR_TOKEN
    if (!expected || token !== expected) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  getStore().reset()
  return NextResponse.json({ ok: true })
}

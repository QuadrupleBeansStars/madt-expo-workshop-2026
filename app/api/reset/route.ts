import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST() {
  getStore().reset()
  return NextResponse.json({ ok: true })
}

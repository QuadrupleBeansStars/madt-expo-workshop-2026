'use client'
import { useEffect, useState } from 'react'

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Displays server-provided remainingMs, ticking down locally between polls. */
export function Countdown({ remainingMs }: { remainingMs: number }) {
  const [displayMs, setDisplayMs] = useState(remainingMs)

  // Snap to the authoritative value whenever the server sends a fresh one.
  useEffect(() => { setDisplayMs(remainingMs) }, [remainingMs])

  // Smooth local tick between polls; the next poll re-snaps.
  useEffect(() => {
    if (displayMs <= 0) return
    const id = setInterval(() => setDisplayMs((v) => Math.max(0, v - 250)), 250)
    return () => clearInterval(id)
  }, [displayMs])

  const urgent = displayMs <= 15_000
  return (
    <span
      className="tabular-nums font-bold"
      style={{ fontFamily: 'var(--font-pixel), monospace', color: urgent ? 'var(--rt-pink)' : 'var(--rt-gold)' }}
    >
      {formatClock(displayMs)}
    </span>
  )
}

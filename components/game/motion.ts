'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Reduced motion, read in JavaScript rather than in CSS.
 *
 * app/globals.css already collapses every CSS-driven beat under `prefers-reduced-motion: reduce`
 * (see the two unlayered override blocks there, and the live trap documented above the first one).
 * CSS cannot reach the beats this module drives: a number counting up, a podium card landing on a
 * timer, a rank numeral flipping at the midpoint of a slide. Those are JS, so the query has to be
 * asked in JS too, or "hold still under reduced motion" silently applies to half the screen.
 *
 * RESOLVED IN AN EFFECT, never in a `useState` initialiser. `/tv` server-renders and `matchMedia`
 * does not exist on the server — the same hazard `TvPage`'s `token` state documents for
 * `localStorage`, and the same fix. `false` on the first render is the safe default: it means the
 * first paint is the start of the animation, which is where a non-reduced viewer is anyway, and a
 * reduced-motion viewer is corrected before the first frame of travel could be seen.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    // jsdom implements matchMedia; a browser with the query unsupported would not. Guard anyway —
    // a throw here would take the whole projector down mid-workshop.
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return reduced
}

/**
 * A number climbing from zero to `target` over `durationMs`.
 *
 * The climb IS the announcement (spec §6/§9): a podium score already sitting there when the card
 * lands throws away half the beat, and the tally is the one number the whole workshop walks
 * toward. Both are JS, so both need {@link usePrefersReducedMotion} rather than a CSS override.
 *
 * `start` gates the climb so a podium score can begin exactly as its own card lands, not when the
 * screen mounts. While `start` is false the value stays at zero — the card is not on screen yet.
 *
 * Eased out, not linear: a linear count reads as a spinning odometer, an eased one reads as a
 * number arriving.
 */
export function useCountUp(target: number, durationMs: number, start = true): number {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(0)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    if (!start) { setValue(0); return }
    // The end state, immediately — "show the end state, skip the travel".
    if (reduced || durationMs <= 0 || target === 0) { setValue(target); return }

    const began = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - began) / durationMs)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) frameRef.current = requestAnimationFrame(step)
      else frameRef.current = null
    }
    frameRef.current = requestAnimationFrame(step)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [target, durationMs, reduced, start])

  return value
}

/**
 * The one beat everything on the standings moves on (spec §6). 0.95s: long enough that a row
 * crossing four places is followable, short enough that the host is not waiting on it.
 */
export const STANDINGS_BEAT_MS = 950

/**
 * `true` once one frame has passed since `key` last changed — the flag a CSS transition needs to
 * have something to transition FROM.
 *
 * A transition only runs when a property changes between two rendered frames, so the start state
 * has to be painted before the end state is set. `useEffect` + one `requestAnimationFrame` is
 * exactly that: the browser paints the offset, then the next frame sets the resting value and the
 * transition carries the difference.
 */
export function useAfterFirstFrame(key: string | number): boolean {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    setSettled(false)
    const id = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(id)
  }, [key])
  return settled
}

/**
 * Reveals `count` items one at a time on the given schedule, in milliseconds from mount.
 * Returns how many are revealed so far. Under reduced motion every item is revealed on the first
 * effect — the end state, with no travel.
 *
 * Used by the podium, whose whole shape is 3 → 2 → 1 with a longer beat before first place.
 */
export function useStaggeredReveal(schedule: readonly number[]): number {
  const reduced = usePrefersReducedMotion()
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (reduced) { setRevealed(schedule.length); return }
    const timers = schedule.map((at, i) => setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), at))
    return () => timers.forEach(clearTimeout)
    // `schedule` is a module-level constant at every call site; spreading it keeps the dependency
    // on the VALUES rather than on a fresh array identity, which would restart the podium on
    // every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...schedule])

  return revealed
}

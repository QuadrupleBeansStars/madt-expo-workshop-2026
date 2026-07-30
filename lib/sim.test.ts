import { describe, it, expect } from 'vitest'
import { AUDIENCE } from '@/content/audience'
import { simulateStaffing } from './sim'

describe('simulateStaffing', () => {
  it('is deterministic — same input, same output', () => {
    expect(simulateStaffing(2, AUDIENCE)).toEqual(simulateStaffing(2, AUDIENCE))
  })

  it('more baristas serve at least as many customers', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(simulateStaffing(n + 1, AUDIENCE).trace.served)
        .toBeGreaterThanOrEqual(simulateStaffing(n, AUDIENCE).trace.served)
    }
  })

  it('profit is not monotonic in staffing — overstaffing costs money', () => {
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, AUDIENCE).profit)
    const best = profits.indexOf(Math.max(...profits))
    expect(best).toBeGreaterThan(0)                  // understaffing is not optimal
    expect(best).toBeLessThan(profits.length - 1)    // nor is maximum staffing
  })

  it('the winning choice wins by a visible margin', () => {
    // An interior optimum is not enough: [10, 11, 10.5, 10, 9] passes the test above
    // and is an unreadable flat curve on a projector. The room must be able to SEE
    // that one answer beat the next-best one.
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, AUDIENCE).profit)
    const sorted = [...profits].sort((a, b) => b - a)
    expect(sorted[0]).toBeGreaterThan(sorted[1] * 1.15)   // best beats runner-up by >15%
    expect(sorted[0]).toBeGreaterThan(sorted[4] * 2)      // best is at least double the worst
  })

  it('served + lostToQueue never exceeds arrivals', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const t = simulateStaffing(n, AUDIENCE).trace
      expect(t.served + t.lostToQueue).toBeLessThanOrEqual(t.arrivals)
    }
  })

  it('returns a defensible result for every legal choice, including bad ones', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const r = simulateStaffing(n, AUDIENCE)
      expect(Number.isFinite(r.profit)).toBe(true)
      expect(r.revenue).toBeGreaterThanOrEqual(0)
      expect(r.trace.served).toBeGreaterThanOrEqual(0)
    }
  })

  it('nobody is lost to the queue when capacity exceeds arrivals', () => {
    const r = simulateStaffing(20, AUDIENCE)
    expect(r.trace.lostToQueue).toBe(0)
  })
})

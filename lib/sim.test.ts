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

  it('every arrival is accounted for', () => {
    const audiences = [AUDIENCE, { ...AUDIENCE, queuePatience: { under3: 10, '3to5': 20, '5to10': 40, any: 110 } }]
    for (const a of audiences) for (const n of [1, 2, 3, 4, 5]) {
      const t = simulateStaffing(n, a).trace
      expect(t.served + t.lostToQueue + t.stillQueuing).toBe(t.arrivals)
    }
  })

  // Pins the knife-edge: 3 baristas only wins because 2 baristas cannot meet the rush
  // (capacity(2) < arrivals). If this stops holding — one fewer 7-9 respondent, or
  // servedPerBaristaPerMin nudged from 0.205 to 0.207 — the game's winning answer silently
  // flips, so this must fail loudly rather than let the other tests pass around it.
  it('two baristas cannot meet the rush — this is what makes 3 the answer', () => {
    const r = simulateStaffing(2, AUDIENCE)
    expect(r.trace.capacity).toBeLessThan(r.trace.arrivals)
  })

  it('nobody arrives when nobody drinks coffee first', () => {
    const a = { ...AUDIENCE, firstDrink: { coffee: 0, tea: 90, water: 80, nothing: 10 } }
    expect(simulateStaffing(3, a).trace.arrivals).toBe(0)
  })

  it('satisfaction stays within 0-100 and is monotone non-decreasing in staffing', () => {
    const satisfactions = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, AUDIENCE).satisfaction)
    for (const s of satisfactions) {
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(100)
    }
    for (let i = 1; i < satisfactions.length; i++) {
      expect(satisfactions[i]).toBeGreaterThanOrEqual(satisfactions[i - 1])
    }
  })
})

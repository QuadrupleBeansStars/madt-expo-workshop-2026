import { describe, it, expect } from 'vitest'
import { AUDIENCE, type AudienceAggregate } from '@/content/audience'
import { simulateStaffing } from './sim'


/**
 * A room big enough for the staffing round to be a game.
 *
 * These shape assertions used to run against AUDIENCE, and stopped holding when the real survey
 * landed: 18 respondents produce THREE morning arrivals against a single barista's capacity of
 * 25, so no queue forms, nobody walks out, and fewer staff is simply always better. That is why
 * this round is not currently played — see the header of lib/sim.ts and lib/pricing.ts.
 *
 * They are kept, pointed at a projection of the same SHAPE onto a room of 200, because that is
 * the condition under which the round becomes playable again — and the survey is still open. If
 * it reaches that size, these tests are what say the round is ready to come back.
 */
const ROOM_OF_200: AudienceAggregate = {
  ...AUDIENCE,
  respondents: 200,
  firstDrink: { coffee: 67, tea: 44, water: 89, nothing: 0 },
  buyTime: { before7: 11, '7to9': 89, '9to11': 22, after11: 33, never: 45 },
  queuePatience: { under5: 44, under10: 89, under15: 33, any: 34 },
}

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
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, ROOM_OF_200).profit)
    const best = profits.indexOf(Math.max(...profits))
    expect(best).toBeGreaterThan(0)                  // understaffing is not optimal
    expect(best).toBeLessThan(profits.length - 1)    // nor is maximum staffing
  })

  it('the winning choice wins by a visible margin', () => {
    // An interior optimum is not enough: [10, 11, 10.5, 10, 9] passes the test above
    // and is an unreadable flat curve on a projector. The room must be able to SEE
    // that one answer beat the next-best one.
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, ROOM_OF_200).profit)
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
    const audiences = [AUDIENCE, { ...AUDIENCE, queuePatience: { under5: 10, under10: 20, under15: 40, any: 110 } }]
    for (const a of audiences) for (const n of [1, 2, 3, 4, 5]) {
      const t = simulateStaffing(n, a).trace
      expect(t.served + t.lostToQueue + t.stillQueuing).toBe(t.arrivals)
    }
  })

  // Pins the knife-edge: 3 baristas only wins because 2 baristas cannot meet the rush
  /*
   * The property that makes the round a game, stated as a property rather than as "3 wins".
   *
   * The old assertion was `capacity(2) < arrivals` — true of the placeholder data, where three
   * baristas was the answer. On any other room the winning number moves, and an assertion pinned
   * to a specific staffing level fails for the wrong reason. What must hold is the SHAPE: one
   * short of the optimum, the bar physically cannot serve everyone who turned up. That is what
   * makes understaffing lose, and it is what a re-import could quietly destroy.
   */
  it('one short of the optimum, the bar cannot serve the people who came', () => {
    const levels = [1, 2, 3, 4, 5]
    const profits = levels.map((n) => simulateStaffing(n, ROOM_OF_200).profit)
    const best = levels[profits.indexOf(Math.max(...profits))]
    expect(best).toBeGreaterThan(1)

    const under = simulateStaffing(best - 1, ROOM_OF_200)
    expect(under.trace.capacity).toBeLessThan(under.trace.arrivals)
  })

  it('records WHY this round is not currently in play, on the real data', () => {
    /*
     * Not a curiosity — this is the assertion that would tell you the round has become viable
     * again after a re-import. Today, one barista serves the entire morning peak on their own.
     * When that stops being true, this test fails and the staffing round is worth reconsidering.
     */
    const one = simulateStaffing(1, AUDIENCE)
    expect(one.trace.arrivals).toBeLessThan(one.trace.capacity)
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

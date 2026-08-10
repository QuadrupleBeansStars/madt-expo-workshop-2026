import { describe, it, expect } from 'vitest'
import { AUDIENCE, type AudienceAggregate } from '@/content/audience'
import {
  PRICE_POINTS, PRICING_CONSTANTS, bestPrice, simulatePricing, willingShare,
} from './pricing'

/** A synthetic room with a hard ceiling at ฿100, for tests that need a known answer. */
const CEILING_AT_100: AudienceAggregate = {
  ...AUDIENCE,
  respondents: 10,
  spend: { under50: 0, '50to100': 10, '101to200': 0 },
}

describe('willingShare — read straight off the spend answers', () => {
  it('counts everyone whose stated band tops out at or above the price', () => {
    // 1 person tops out at ฿50, 13 at ฿100, 4 at ฿200 (18 respondents).
    expect(willingShare(45, AUDIENCE)).toBeCloseTo(18 / 18)
    expect(willingShare(50, AUDIENCE)).toBeCloseTo(18 / 18)   // ฿50 is still inside the lowest band
    expect(willingShare(65, AUDIENCE)).toBeCloseTo(17 / 18)
    expect(willingShare(100, AUDIENCE)).toBeCloseTo(17 / 18)  // ฿100 is still inside the middle band
    expect(willingShare(101, AUDIENCE)).toBeCloseTo(4 / 18)   // the cliff
    expect(willingShare(500, AUDIENCE)).toBe(0)
  })

  it('never rises as the price rises', () => {
    let last = 1
    for (let p = 0; p <= 250; p += 5) {
      const s = willingShare(p, AUDIENCE)
      expect(s).toBeLessThanOrEqual(last + 1e-9)
      last = s
    }
  })

  it('is 0 for an empty room rather than dividing by zero', () => {
    expect(willingShare(70, { ...AUDIENCE, respondents: 0 })).toBe(0)
  })
})

describe('simulatePricing', () => {
  it('accounts for every customer through the door', () => {
    for (const p of PRICE_POINTS) {
      const { trace } = simulatePricing(p, AUDIENCE)
      expect(trace.buyers + trace.pricedOut).toBe(trace.footfall)
    }
  })

  it('is deterministic — the same price always gives the same shop', () => {
    expect(simulatePricing(85, AUDIENCE)).toEqual(simulatePricing(85, AUDIENCE))
  })

  it('bins the stock prepped for everyone who was priced out', () => {
    const { waste, trace } = simulatePricing(120, AUDIENCE)
    expect(trace.pricedOut).toBeGreaterThan(0)
    expect(waste).toBe(trace.unsold * PRICING_CONSTANTS.wastePerUnsoldBaht)
  })

  it('charges nobody more than they said they would pay', () => {
    // Above a room's ceiling, there is no revenue at all — and the prepped stock is still binned.
    const r = simulatePricing(150, CEILING_AT_100)
    expect(r.trace.buyers).toBe(0)
    expect(r.revenue).toBe(0)
    expect(r.satisfaction).toBe(0)
    expect(r.waste).toBeGreaterThan(0)
    expect(r.profit).toBeLessThan(0)
  })

  it('treats a nonsense price as free rather than producing NaN', () => {
    const r = simulatePricing(Number.NaN, AUDIENCE)
    expect(Number.isFinite(r.profit)).toBe(true)
    expect(r.trace.pricePaid).toBe(0)
  })
})

describe('the round is decided by the audience, not by the constants', () => {
  /*
   * THIS IS THE TEST THAT LICENSES THE OUTCOME SCREEN.
   *
   * The script tells 200 people that their own registration answers decided this round. That
   * sentence is only true if the constants cannot move the winner — otherwise the honest
   * description is "we picked a winner and dressed it in their data", which is precisely the
   * dishonesty this workshop argues against.
   *
   * An earlier draft of the simulator smoothed each spend ceiling over a ramp, and the winner
   * flipped between ฿65 and ฿85 on the ramp width alone. That draft would have failed here. This
   * one holds because the cliff at ฿100 comes from the respondents.
   */
  it('the winning price is unchanged across the full plausible range of COGS', () => {
    const original = PRICING_CONSTANTS.cogsPerDrinkBaht
    try {
      for (let cogs = 10; cogs <= 40; cogs += 2) {
        PRICING_CONSTANTS.cogsPerDrinkBaht = cogs
        expect(bestPrice(AUDIENCE)).toBe(85)
      }
    } finally {
      PRICING_CONSTANTS.cogsPerDrinkBaht = original
    }
  })

  it('footfall is cosmetic — it scales the numbers and cannot change the winner', () => {
    const original = PRICING_CONSTANTS.footfallPerDay
    try {
      for (const footfall of [30, 120, 400, 2000]) {
        PRICING_CONSTANTS.footfallPerDay = footfall
        expect(bestPrice(AUDIENCE)).toBe(85)
      }
    } finally {
      PRICING_CONSTANTS.footfallPerDay = original
    }
  })

  it('moving the spend answers DOES move the winner — the data is what is driving it', () => {
    // A room that says it spends under ฿50 cannot be sold an ฿85 cup, whatever the constants say.
    const thrifty: AudienceAggregate = {
      ...AUDIENCE,
      respondents: 18,
      spend: { under50: 16, '50to100': 2, '101to200': 0 },
    }
    expect(bestPrice(thrifty)).toBe(45)
  })
})

describe('the shape of the round', () => {
  it('has an interior optimum — neither the cheapest nor the dearest price wins', () => {
    const winner = bestPrice(AUDIENCE)
    expect(winner).not.toBe(PRICE_POINTS[0])
    expect(winner).not.toBe(PRICE_POINTS[PRICE_POINTS.length - 1])
  })

  it('the winner beats every other option by a margin the room can see', () => {
    const winner = bestPrice(AUDIENCE)
    const winnerProfit = simulatePricing(winner, AUDIENCE).profit
    for (const p of PRICE_POINTS) {
      if (p === winner) continue
      // A round whose winner edges the field by ฿50 teaches nothing on a projector.
      expect(winnerProfit - simulatePricing(p, AUDIENCE).profit).toBeGreaterThan(1000)
    }
  })

  it('THE TEACHING BEAT: discounting buys almost no extra customers and costs most of the profit', () => {
    const held = simulatePricing(85, AUDIENCE)
    const discounted = simulatePricing(45, AUDIENCE)

    // Barely anyone was priced out to begin with, so the discount has almost nothing to win back.
    const extraCustomers = discounted.trace.buyers - held.trace.buyers
    expect(extraCustomers).toBeGreaterThan(0)
    expect(extraCustomers / held.trace.buyers).toBeLessThan(0.1)   // under 10% more customers

    // And it gives away more than half the profit to get them.
    expect(discounted.profit).toBeLessThan(held.profit * 0.5)
  })

  it('the premium price is punished by waste, not just by lost sales', () => {
    const premium = simulatePricing(120, AUDIENCE)
    expect(premium.waste).toBeGreaterThan(premium.revenue * 0.5)
  })
})

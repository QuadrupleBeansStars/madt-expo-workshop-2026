// The pricing simulator — round 1 of The Decision Room.
//
// WHY THIS REPLACED THE STAFFING ROUND. Round 1 used to ask how many baristas to put on the bar
// (`lib/sim.ts`, still present and still tested). On the real registration data that round is
// unplayable: `buyTime['7to9']` is 8 people, scaled by a coffee share of 6/18, which is THREE
// arrivals against a single barista's capacity of 25. No queue ever forms, nobody walks out, and
// every staffing level loses money — so the round degenerates to "hire the fewest", with the
// outcome screen quoting walk-out figures that cannot occur. Two questions were added to the live
// form that the original five did not have (what people SPEND, and what DECIDES their purchase),
// and those two carry a real decision.
//
// `lib/sim.ts` is deliberately NOT deleted. The survey is open until the event; at a few hundred
// respondents with this shape the staffing round becomes viable again, and keeping tested code
// costs nothing.
//
// This is NOT machine learning and must never be described as such on screen. It is a simulation:
// treat the respondents as the shop's customer population and play their own stated answers
// forward against the player's price.
//
// Deterministic: no randomness, no wall-clock reads. Two players who pick alike rank alike.

import type { AudienceAggregate } from '@/content/audience'

/**
 * The prices on the board, ฿. Four, deliberately short — the room reads and taps in seconds.
 *
 * ฿45 is the panic discount (a competitor undercut you), ฿65 is holding roughly where you are,
 * ฿85 is trading up, ฿120 is premium. The spread is chosen to straddle the ฿100 ceiling that the
 * respondents' own spend answers create; see `willingShare`.
 */
export const PRICE_POINTS = [45, 65, 85, 120] as const

export type PricingConstants = {
  /**
   * Customers through the door on a normal day, before anyone decides whether to buy.
   *
   * COSMETIC — this scales revenue, profit and waste linearly and CANNOT change which price wins.
   * It sets the size of the numbers on screen and nothing else. Review it for plausibility, not
   * for correctness.
   */
  footfallPerDay: number
  /**
   * What one drink costs to make, ฿ (beans, milk, cup — not the price on the board).
   *
   * LOAD-BEARING IN PRINCIPLE: this is the one constant that could in theory move the winner,
   * because it sets the margin each price earns. In practice it does not — `pricing.test.ts`
   * asserts the winner is unchanged across ฿10-฿40, because the winner is pinned by where the
   * respondents' spend ceiling sits, not by the margin. That test is the reason this file is
   * allowed to claim on screen that the audience's answers decided the round.
   */
  cogsPerDrinkBaht: number
  /** Cost of one drink prepped for a customer who never bought, ฿. */
  wastePerUnsoldBaht: number
}

/**
 * The workshop's economic knobs, in one place so the project owner can sanity check them without
 * reading code. Note which of the three actually decides anything — see the field docs above.
 */
export const PRICING_CONSTANTS: PricingConstants = {
  footfallPerDay: 120,
  cogsPerDrinkBaht: 22,
  wastePerUnsoldBaht: 20,
}

/**
 * What each stated spend band means as a ceiling, ฿ — the most that person will pay.
 *
 * The TOP of the band, not the middle: somebody who answered "I usually spend 50-100" is telling
 * you ฿100 is a price they pay, so a drink at ฿85 is inside what they said. Reading the midpoint
 * instead would have the model reject prices the respondent explicitly named.
 *
 * This is a STEP function, with no smoothing ramp, and that is deliberate. An earlier draft
 * softened each ceiling over a ~40฿ ramp; the winner then flipped between ฿65 and ฿85 depending
 * on the ramp width — a constant nobody chose for a reason silently picking the answer. The cliff
 * at ฿100 is what the respondents actually said. The smoothing was what I said.
 */
const SPEND_CEILING_BAHT: Record<keyof AudienceAggregate['spend'], number> = {
  under50: 50,
  '50to100': 100,
  '101to200': 200,
}

export type PricingTrace = {
  /** Customers through the door, before anyone decides to buy. */
  footfall: number
  /** Share of respondents whose stated ceiling covers this price, 0-1. */
  willingShare: number
  /** Customers who actually bought. */
  buyers: number
  /** Walked past: the price is above the most they said they pay. */
  pricedOut: number
  /** Drinks prepped for the footfall and never sold. */
  unsold: number
  pricePaid: number
}

export type PricingResult = {
  revenue: number
  profit: number
  /** 0-100. The share of the room that could afford to be a customer at all. */
  satisfaction: number
  /** ฿ of drinks prepped for customers who were priced out. */
  waste: number
  trace: PricingTrace
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * The share of respondents who would pay this price, straight off their own spend answers.
 *
 * This single function is where the round is decided, and every number in it comes from the
 * registration form. Nothing here is tuned.
 */
export function willingShare(price: number, a: AudienceAggregate): number {
  const respondents = Math.max(0, a.respondents)
  if (respondents === 0) return 0
  let willing = 0
  for (const band of Object.keys(SPEND_CEILING_BAHT) as (keyof typeof SPEND_CEILING_BAHT)[]) {
    if (price <= SPEND_CEILING_BAHT[band]) willing += Math.max(0, a.spend[band])
  }
  return clamp(willing / respondents, 0, 1)
}

/**
 * Round 1: what do you charge for a cup?
 *
 * Underpricing sells to everybody at a margin too thin to matter. Overpricing walks past most of
 * the room and bins the stock prepped for them. The optimum is interior, and the audience's own
 * spend answers — not the constants — put it where it is.
 */
export function simulatePricing(price: number, a: AudienceAggregate): PricingResult {
  const { footfallPerDay, cogsPerDrinkBaht, wastePerUnsoldBaht } = PRICING_CONSTANTS
  const pricePaid = Number.isFinite(price) ? Math.max(0, price) : 0

  const footfall = Math.max(0, Math.round(footfallPerDay))
  const share = willingShare(pricePaid, a)

  const buyers = Math.round(footfall * share)
  const pricedOut = Math.max(0, footfall - buyers)

  // The shop preps for the traffic it expects, not for the traffic that converts — it cannot know
  // in advance who will balk at the board. Everything prepped and not sold is binned. This is the
  // same assumption `lib/sim.ts` makes about the morning rush, and it is what stops the cheapest
  // price from being free of any downside.
  const unsold = pricedOut

  const revenue = buyers * pricePaid
  const waste = unsold * wastePerUnsoldBaht
  const profit = buyers * (pricePaid - cogsPerDrinkBaht) - waste

  // Satisfaction is the share of the room that could be a customer at all. A price most people
  // said they would not pay is not a satisfying shop, however profitable the few who stay are.
  const satisfaction = Math.round(clamp(share * 100, 0, 100))

  return {
    revenue,
    profit,
    satisfaction,
    waste,
    trace: { footfall, willingShare: share, buyers, pricedOut, unsold, pricePaid },
  }
}

/**
 * The price that earns the most profit among those actually offered.
 *
 * Note the qualifier — "among those offered". The model's real statement is that the ceiling sits
 * at ฿100, so the best price on the board is simply the highest one under it. The outcome copy
 * must say that, and must not claim the winning price is optimal in general.
 */
export function bestPrice(a: AudienceAggregate, prices: readonly number[] = PRICE_POINTS): number {
  let best = prices[0]
  let bestProfit = -Infinity
  for (const p of prices) {
    const { profit } = simulatePricing(p, a)
    if (profit > bestProfit) { bestProfit = profit; best = p }
  }
  return best
}

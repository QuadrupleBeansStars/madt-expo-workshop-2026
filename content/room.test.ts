import { describe, expect, it } from 'vitest'
import { ALLOWANCE_MS, ARCHETYPES, STAGES } from './room'
import { SHOP_VALUE_WEIGHTS, StageSchema, type EvidenceKey, type Kpi } from '@/lib/room-types'
import { AUDIENCE, type AudienceAggregate } from './audience'
import { PRICE_POINTS, bestPrice, simulatePricing } from '@/lib/pricing'

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000

/** The leaderboard score, computed here exactly as Task 6's `shopValue` must compute it. */
function score(fx: Partial<Kpi>): number {
  const w = SHOP_VALUE_WEIGHTS
  return (
    w.revenue * (fx.revenue ?? 0) +
    w.profit * (fx.profit ?? 0) +
    w.satisfaction * (fx.satisfaction ?? 0) -
    w.waste * (fx.waste ?? 0)
  )
}

function localizedStrings(): [string, { th: string; en: string }][] {
  const out: [string, { th: string; en: string }][] = []
  for (const stage of STAGES) {
    const at = (field: string) => `${stage.id}.${field}`
    switch (stage.kind) {
      case 'intro':
        out.push([at('headline'), stage.headline], [at('body'), stage.body])
        break
      case 'data':
        out.push([at('headline'), stage.headline], [at('body'), stage.body])
        stage.points.forEach((p, i) => out.push([at(`points[${i}]`), p]))
        break
      case 'decide':
        out.push([at('prompt'), stage.prompt], [at('context'), stage.context])
        stage.options.forEach((o) => out.push([at(o.id), o.label]))
        break
      case 'outcome':
        out.push(
          [at('headline'), stage.headline],
          [at('body'), stage.body],
          [at('lesson'), stage.lesson],
        )
        break
      case 'close':
        out.push([at('headline'), stage.headline], [at('body'), stage.body])
        stage.takeaways.forEach((t, i) => out.push([at(`takeaways[${i}]`), t]))
        break
    }
  }
  for (const [key, a] of Object.entries(ARCHETYPES)) {
    out.push([`archetype.${key}.name`, a.name], [`archetype.${key}.sting`, a.sting])
  }
  return out
}

const decideStages = () => STAGES.filter((s) => s.kind === 'decide')

describe('room stage sequence', () => {
  it('every stage passes its schema', () => {
    for (const stage of STAGES) {
      expect(() => StageSchema.parse(stage), stage.id).not.toThrow()
    }
  })

  it('stage ids are unique', () => {
    const ids = STAGES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('is the spec §5.2 sequence: intro, two data stages, three rounds, close', () => {
    const count = (k: string) => STAGES.filter((s) => s.kind === k).length
    expect(count('intro')).toBe(1)
    expect(count('data')).toBe(2)
    expect(count('decide')).toBe(3)
    expect(count('outcome')).toBe(3)
    expect(count('close')).toBe(1)
    expect(STAGES[0].kind).toBe('intro')
    expect(STAGES[STAGES.length - 1].kind).toBe('close')
  })

  it('every outcome names a real decide stage, and comes after it', () => {
    for (const [i, stage] of STAGES.entries()) {
      if (stage.kind !== 'outcome') continue
      const target = STAGES.findIndex((s) => s.id === stage.forStageId)
      expect(target, `${stage.id} -> ${stage.forStageId}`).toBeGreaterThanOrEqual(0)
      expect(target, `${stage.id} must follow its decide stage`).toBeLessThan(i)
      expect(STAGES[target].kind).toBe('decide')
    }
  })

  it('every decide stage has 2-4 options with unique ids and a positive duration', () => {
    for (const stage of decideStages()) {
      expect(stage.options.length, stage.id).toBeGreaterThanOrEqual(2)
      expect(stage.options.length, stage.id).toBeLessThanOrEqual(4)
      const ids = stage.options.map((o) => o.id)
      expect(new Set(ids).size, stage.id).toBe(ids.length)
      expect(stage.durationMs, stage.id).toBeGreaterThan(0)
    }
  })

  it('exactly one decide stage is simulated; every other supplies fx for all its options', () => {
    const simulated = decideStages().filter((s) => s.resolve === 'simulate-pricing')
    expect(simulated).toHaveLength(1)
    for (const stage of decideStages()) {
      if (stage.resolve === 'simulate-pricing') {
        // The simulator computes the outcome from the audience's own spend answers; a simulated
        // option carries only the price it stands for, never a hand-written result.
        for (const o of stage.options) {
          expect(Number.isInteger(o.priceBaht), `${stage.id}.${o.id}`).toBe(true)
          expect(o.priceBaht, `${stage.id}.${o.id}`).toBeGreaterThan(0)
          expect(o).not.toHaveProperty('fx')
        }
        continue
      }
      if (stage.resolve === 'simulate-staffing') continue
      for (const o of stage.options) {
        expect(Object.keys(o.fx).length, `${stage.id}.${o.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('every localized string is non-empty in both languages', () => {
    const strings = localizedStrings()
    expect(strings.length).toBeGreaterThan(0)
    for (const [where, t] of strings) {
      expect(t.en.trim(), `${where}.en`).not.toBe('')
      expect(t.th.trim(), `${where}.th`).not.toBe('')
    }
  })

  it('never names the simulator as anything it is not', () => {
    const banned = /machine learning|\bml\b|\bai\b|artificial intelligence|\bmodel\b|press start/i
    for (const [where, t] of localizedStrings()) {
      expect(banned.test(t.en), `${where}.en`).toBe(false)
      expect(banned.test(t.th), `${where}.th`).toBe(false)
    }
  })
})

/**
 * Spec §2: a decide stage shows "the question, the data that bears on it, a live timer". These
 * guard the middle clause — the one that was missing, which left the room voting from memory of a
 * dashboard two stages earlier.
 */
describe('the evidence on each decision', () => {
  // Against the runtime keys of AUDIENCE, not a re-typed list: a list here would pass by
  // construction and catch nothing the day the aggregate's shape changes.
  const audienceKeys = Object.keys(AUDIENCE).filter((k) => k !== 'respondents')

  it('names only real audience distributions', () => {
    for (const stage of decideStages()) {
      for (const key of stage.evidence ?? []) {
        expect(audienceKeys, `${stage.id}.evidence`).toContain(key)
      }
    }
  })

  // The type-level half of the same claim, kept here rather than in lib/room-types.ts: that file
  // must not import from content/ (the dependency runs content→lib), so this is where the enum
  // and the aggregate can be held against each other. A key added to one and not the other is a
  // compile error in `npx tsc --noEmit`.
  it('has an EvidenceKey union that matches AudienceAggregate exactly', () => {
    type FromAggregate = Exclude<keyof AudienceAggregate, 'respondents'>
    const _sameKeys: EvidenceKey extends FromAggregate
      ? FromAggregate extends EvidenceKey ? true : never
      : never = true
    expect(_sameKeys).toBe(true)
  })

  it('gives round 1 both of the distributions the answer is derived from', () => {
    const pricing = STAGES.find((s) => s.kind === 'decide' && s.id === 'decide-price')
    expect(pricing?.kind).toBe('decide')
    // What the room will pay, and what actually decides the purchase. `spend` settles the round;
    // `mainFactor` is why the discount does not work. Without both on screen the round is
    // unwinnable by reasoning, and reasoning is the whole point of it.
    expect(pricing && pricing.kind === 'decide' ? pricing.evidence : undefined)
      .toEqual(expect.arrayContaining(['spend', 'mainFactor']))
  })

  it('quotes no distribution twice on one decision', () => {
    for (const stage of decideStages()) {
      const keys = stage.evidence ?? []
      expect(new Set(keys).size, `${stage.id}.evidence`).toBe(keys.length)
    }
  })
})

describe('round 3 — the investment trade-off', () => {
  const round3 = () => {
    const stage = STAGES.find((s) => s.kind === 'decide' && s.id === 'decide-invest')
    if (!stage || stage.kind !== 'decide' || stage.resolve !== 'fixed') {
      throw new Error('decide-invest must exist and resolve fixed')
    }
    return stage
  }

  it('has an option that raises revenue AND raises waste', () => {
    // Without this, waste only ever rises from overstaffing — which already suppresses profit —
    // so it is redundant with profit rather than a real trade-off, and a player who pushes every
    // bar upward can no longer lose (spec §5.1).
    const both = round3().options.filter((o) => (o.fx.revenue ?? 0) > 0 && (o.fx.waste ?? 0) > 0)
    expect(both.length).toBeGreaterThanOrEqual(1)
  })

  it('is won by the recurring option, not the largest one-off gain', () => {
    const options = round3().options
    const ranked = [...options].sort((a, b) => score(b.fx) - score(a.fx))
    expect(ranked[0].id).toBe('equipment')
    expect(score(ranked[0].fx)).toBeGreaterThan(score(ranked[1].fx))
    // The largest single revenue number must NOT be the winner — that is the whole lesson.
    const biggestRevenue = [...options].sort((a, b) => (b.fx.revenue ?? 0) - (a.fx.revenue ?? 0))[0]
    expect(biggestRevenue.id).not.toBe(ranked[0].id)
  })

  it('the recurring option still wins across any defensible weighting', () => {
    // Robustness beyond the exact weights: revenue is capped at half the weight of profit
    // because revenue is already largely counted inside profit.
    const options = round3().options
    for (const revenue of [0, 0.1, 0.25, 0.5]) {
      for (const satisfaction of [0, 10, 25, 50]) {
        for (const waste of [0.5, 1, 2]) {
          const w = { revenue, profit: 1, satisfaction, waste }
          const s = (fx: Partial<Kpi>) =>
            w.revenue * (fx.revenue ?? 0) +
            w.profit * (fx.profit ?? 0) +
            w.satisfaction * (fx.satisfaction ?? 0) -
            w.waste * (fx.waste ?? 0)
          const winner = [...options].sort((a, b) => s(b.fx) - s(a.fx))[0]
          expect(winner.id, JSON.stringify(w)).toBe('equipment')
        }
      }
    }
  })
})

describe('the fifteen minutes', () => {
  it('fits inside fifteen minutes with the host talking allowance counted', () => {
    const votingMs = decideStages().reduce((sum, s) => sum + s.durationMs, 0)
    const nonDecide = STAGES.filter((s) => s.kind !== 'decide').length
    const total = votingMs + nonDecide * ALLOWANCE_MS
    expect(ALLOWANCE_MS).toBeGreaterThan(0)
    expect(total, `${Math.round(total / 1000)}s`).toBeLessThan(FIFTEEN_MINUTES_MS)
  })

  it('leaves slack — spec §9 calls fifteen minutes binding', () => {
    const votingMs = decideStages().reduce((sum, s) => sum + s.durationMs, 0)
    const nonDecide = STAGES.filter((s) => s.kind !== 'decide').length
    const total = votingMs + nonDecide * ALLOWANCE_MS
    expect(FIFTEEN_MINUTES_MS - total).toBeGreaterThanOrEqual(90_000)
  })
})

describe('the numbers quoted on stage', () => {
  /*
   * The round 1 outcome copy quotes figures derived from AUDIENCE. The survey is still open, so
   * these WILL move when the CSV is re-imported — and when they do, this test fails and the copy
   * on the projector gets corrected instead of quietly going stale in front of 200 people. That
   * is the entire job of this block. Do not soften an assertion here to make it pass; change the
   * sentence in content/room.ts to match what the simulator now says.
   */
  const WINNING_PRICE = 85
  const DISCOUNT_PRICE = 45

  it('still matches what the simulator produces from AUDIENCE', () => {
    const held = simulatePricing(WINNING_PRICE, AUDIENCE)
    const cut = simulatePricing(DISCOUNT_PRICE, AUDIENCE)

    // "฿85 held" — it is the best price on the board.
    expect(bestPrice(AUDIENCE)).toBe(WINNING_PRICE)

    // "7 of the 120 people who walked past could not buy"
    expect(held.trace.footfall).toBe(120)
    expect(held.trace.pricedOut).toBe(7)

    // "won 7 customers"
    expect(cut.trace.buyers - held.trace.buyers).toBe(7)

    // "and cost ฿4,219"
    expect(held.profit - cut.profit).toBe(4219)

    // "exactly one of you, out of 18, said you spend under ฿50"
    expect(AUDIENCE.spend.under50).toBe(1)
    expect(AUDIENCE.respondents).toBe(18)

    // "took ฿40 off every one of the other 113"
    expect(WINNING_PRICE - DISCOUNT_PRICE).toBe(40)
    expect(held.trace.buyers).toBe(113)

    // "11 of you named price, but all 18 named taste"
    expect(AUDIENCE.mainFactor.price).toBe(11)
    expect(AUDIENCE.mainFactor.taste).toBe(18)
  })

  it('the data-you stage quotes the aggregate correctly', () => {
    // "13 of you said you usually pay between ฿50 and ฿100"
    expect(AUDIENCE.spend['50to100']).toBe(13)
  })

  it('the price the copy names also tops the leaderboard', () => {
    // The outcome stage says ฿85 won, while the board beside it ranks shopValue, not profit.
    // ฿45 scores higher on satisfaction, so this coupling has to be asserted rather than assumed.
    const ranked = [...PRICE_POINTS]
      .map((p) => ({ p, value: score(simulatePricing(p, AUDIENCE)) }))
      .sort((a, b) => b.value - a.value)
    expect(ranked[0].p).toBe(WINNING_PRICE)
  })

  it('round 2 orders its options the way the audience ordered those factors', () => {
    /*
     * The round 2 outcome copy claims the ranking "is the order you put those four factors in at
     * registration". That sentence is only true if it is. Each option is tied to one mainFactor
     * bucket; profit must fall in the same order the counts do.
     */
    const stage = STAGES.find((s) => s.kind === 'decide' && s.id === 'decide-defend')
    if (!stage || stage.kind !== 'decide' || stage.resolve !== 'fixed') throw new Error('no decide-defend')

    const FACTOR_OF: Record<string, keyof typeof AUDIENCE.mainFactor> = {
      quality: 'taste', promotion: 'promotion', speed: 'convenience', price: 'price',
    }
    const byProfit = [...stage.options].sort((a, b) => (b.fx.profit ?? 0) - (a.fx.profit ?? 0))

    // Taste is the top factor and quality must be the top option.
    expect(FACTOR_OF[byProfit[0].id]).toBe('taste')
    expect(AUDIENCE.mainFactor.taste).toBeGreaterThanOrEqual(
      AUDIENCE.mainFactor[FACTOR_OF[byProfit[1].id]],
    )
    // And the discount is last, despite price being the second most-named factor — which is the
    // point the copy makes, so it must not silently become true by accident.
    expect(byProfit[byProfit.length - 1].id).toBe('price')
  })
})

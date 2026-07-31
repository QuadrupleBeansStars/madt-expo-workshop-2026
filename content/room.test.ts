import { describe, expect, it } from 'vitest'
import { ALLOWANCE_MS, ARCHETYPES, STAGES } from './room'
import { SHOP_VALUE_WEIGHTS, StageSchema, type EvidenceKey, type Kpi } from '@/lib/room-types'
import { AUDIENCE, type AudienceAggregate } from './audience'
import { simulateStaffing } from '@/lib/sim'

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
    const simulated = decideStages().filter((s) => s.resolve === 'simulate-staffing')
    expect(simulated).toHaveLength(1)
    for (const stage of decideStages()) {
      if (stage.resolve === 'simulate-staffing') {
        // The simulator computes the outcome from the audience's own answers; a simulated
        // option carries only the staffing level it stands for, never a hand-written result.
        for (const o of stage.options) {
          expect(Number.isInteger(o.baristas), `${stage.id}.${o.id}`).toBe(true)
          expect(o).not.toHaveProperty('fx')
        }
        continue
      }
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
    const staffing = STAGES.find((s) => s.kind === 'decide' && s.id === 'decide-staffing')
    expect(staffing?.kind).toBe('decide')
    // When the room is at the counter, and how long it will stand there. Without either chart on
    // screen the round is unwinnable by reasoning, and reasoning is the whole point of it.
    expect(staffing && staffing.kind === 'decide' ? staffing.evidence : undefined)
      .toEqual(expect.arrayContaining(['buyTime', 'queuePatience']))
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
  // The round 1 outcome copy quotes figures derived from AUDIENCE. When the real registration
  // CSV lands (scripts/import-audience.ts) these move, and the copy must move with them.
  it('still matches what the simulator produces from AUDIENCE', () => {
    const two = simulateStaffing(2, AUDIENCE)
    const three = simulateStaffing(3, AUDIENCE)
    const four = simulateStaffing(4, AUDIENCE)
    expect(three.trace.arrivals).toBe(50)
    expect(Math.round(two.trace.waitMinutes * 10) / 10).toBe(3.7)
    expect(two.trace.lostToQueue).toBe(19)
    expect(three.profit).toBe(1700)
    expect(four.profit).toBe(1100)
    // The copy quotes the floor (54%), not the rounded figure (54.5% -> 55%): understating the
    // margin on stage is the safe direction to be wrong in.
    expect(Math.floor((three.profit / four.profit - 1) * 100)).toBe(54)
    expect(three.profit).toBeGreaterThan(two.profit)
  })

  it('the staffing level the copy names also tops the leaderboard', () => {
    // The outcome stage says "three baristas won" while the board beside it ranks shopValue, not
    // profit. Four baristas score higher on satisfaction, so this coupling has to be asserted.
    const ranked = [1, 2, 3, 4]
      .map((baristas) => ({ baristas, s: score(simulateStaffing(baristas, AUDIENCE)) }))
      .sort((a, b) => b.s - a.s)
    expect(ranked[0].baristas).toBe(3)
    expect(ranked[0].s).toBeGreaterThan(ranked[1].s)
  })

  it('offers the staffing levels the lesson depends on', () => {
    const stage = STAGES.find((s) => s.kind === 'decide' && s.resolve === 'simulate-staffing')
    if (!stage || stage.kind !== 'decide' || stage.resolve !== 'simulate-staffing') {
      throw new Error('the simulated round must exist')
    }
    const levels = stage.options.map((o) => o.baristas)
    expect(levels).toContain(2)
    expect(levels).toContain(3)
  })
})

describe('archetypes', () => {
  it('names one per KPI, each with a sting', () => {
    expect(Object.keys(ARCHETYPES).sort()).toEqual(
      ['profit', 'revenue', 'satisfaction', 'waste'].sort(),
    )
  })
})

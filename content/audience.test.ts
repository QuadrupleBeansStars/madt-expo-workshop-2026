import { describe, it, expect } from 'vitest'
import { AUDIENCE, IS_PLACEHOLDER, bucketTotal } from './audience'

describe('audience aggregate', () => {
  it('every bucket sums to the respondent count', () => {
    expect(bucketTotal(AUDIENCE.arrivalMode)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.wakeTime)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.firstDrink)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.buyTime)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.queuePatience)).toBe(AUDIENCE.respondents)
  })

  it('has no negative counts', () => {
    const all = [AUDIENCE.arrivalMode, AUDIENCE.wakeTime, AUDIENCE.firstDrink,
                 AUDIENCE.buyTime, AUDIENCE.queuePatience]
    for (const rec of all) for (const v of Object.values(rec)) expect(v).toBeGreaterThanOrEqual(0)
  })

  it('flags itself as placeholder until real data lands', () => {
    expect(typeof IS_PLACEHOLDER).toBe('boolean')
  })
})

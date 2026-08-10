import { describe, it, expect } from 'vitest'
import { AUDIENCE, IS_PLACEHOLDER, SINGLE_CHOICE_FIELDS, bucketTotal } from './audience'

describe('audience aggregate', () => {
  /*
   * Driven off SINGLE_CHOICE_FIELDS rather than a hand-written list.
   *
   * The hand-written version listed five fields and was never extended when the live form added
   * two more — so `spend`, the distribution the entire round 1 outcome is derived from, had no
   * sum-to-respondents guard at all. A miscounted spend bucket would move the winning price and
   * every figure on the outcome screen, and nothing would have failed.
   *
   * `mainFactor` is absent from SINGLE_CHOICE_FIELDS because it is multi-select and legitimately
   * sums to more than `respondents`. It is exempted BY NAME, in one place, rather than by
   * loosening this assertion for the fields that do have to add up.
   */
  it('every single-choice bucket sums to the respondent count', () => {
    expect(SINGLE_CHOICE_FIELDS.length).toBeGreaterThan(0)
    for (const field of SINGLE_CHOICE_FIELDS) {
      expect(bucketTotal(AUDIENCE[field]), field).toBe(AUDIENCE.respondents)
    }
  })

  it('covers every distribution in the aggregate — a new question cannot arrive unguarded', () => {
    // The failure this catches: a question is added to the form, the importer learns it, and it
    // silently joins AUDIENCE with nothing checking it. Either it is single-choice and belongs in
    // SINGLE_CHOICE_FIELDS, or it is multi-select and belongs in the exempt list below.
    const MULTI_SELECT = ['mainFactor']
    const distributions = Object.keys(AUDIENCE).filter((k) => k !== 'respondents')
    expect([...SINGLE_CHOICE_FIELDS, ...MULTI_SELECT].sort()).toEqual(distributions.sort())
  })

  it('has no negative counts anywhere, multi-select included', () => {
    for (const field of Object.keys(AUDIENCE) as (keyof typeof AUDIENCE)[]) {
      if (field === 'respondents') continue
      for (const [bucket, v] of Object.entries(AUDIENCE[field])) {
        expect(v, `${field}.${bucket}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('multi-select is allowed to exceed the respondent count, and here does', () => {
    // Guards the inverse mistake: someone "fixing" mainFactor to sum to respondents would be
    // discarding real answers, since people could name several factors.
    expect(bucketTotal(AUDIENCE.mainFactor)).toBeGreaterThan(AUDIENCE.respondents)
  })

  it('is no longer flagged as placeholder — the real survey has been imported', () => {
    expect(IS_PLACEHOLDER).toBe(false)
    expect(AUDIENCE.respondents).toBeGreaterThan(0)
  })
})

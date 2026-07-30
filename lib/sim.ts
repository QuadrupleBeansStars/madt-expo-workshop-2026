// The staffing simulator — round 1 of The Decision Room.
//
// This is NOT machine learning and must never be described as such on any screen. There is no
// outcome variable in the registration data to train against: five facts per person, no results.
// What the data supports is a simulation — treat the respondents as the cafe's customer
// population and play their own stated behaviour forward against the player's choice.
//
// Every input maps to a question the audience personally answered at registration
// (docs/registration-questions.md, Group B):
//
//   who buys at all      ← B3 firstDrink, B4 buyTime ≠ 'never'
//   when they arrive     ← B4 buyTime ('7to9' is the 07:00-09:00 peak this round simulates)
//   how long they wait   ← B5 queuePatience
//
// Deterministic by construction: no randomness, no wall-clock reads. The same choice always
// yields the same result, so two players who choose alike rank alike on the leaderboard.
//
// Scope: round 1 only. Rounds 2 and 3 apply fixed KPI deltas per option, deliberately — price
// sensitivity and capital allocation are not in the five registration questions, and simulating
// them would mean inventing inputs. See spec §4.

import type { AudienceAggregate } from '@/content/audience'

export type SimConstants = {
  /** Average spend per customer, ฿. A single morning drink at a Bangkok cafe. */
  ticketBaht: number
  /** What one barista costs for the whole morning shift, ฿. */
  baristaWageBaht: number
  /**
   * Drinks one barista completes per minute — 0.205 is roughly one drink every five minutes,
   * order to handover. Slower than a chain barista on purpose: this is one person taking the
   * order, pulling the shot, steaming, and handing over, with no runner.
   */
  servedPerBaristaPerMin: number
  /** Cost of one drink prepped and never sold, ฿ (ingredients + cup, not the ticket price). */
  wastePerUnsoldBaht: number
}

/**
 * The workshop's economic tuning knobs, all in one place so the project owner can sanity check
 * them without reading code. These decide the shape of the game: they are set so that the
 * profit curve has one clear winner with a visible margin (see lib/sim.test.ts).
 */
export const CONSTANTS: SimConstants = {
  ticketBaht: 70,
  baristaWageBaht: 600,
  servedPerBaristaPerMin: 0.205,
  wastePerUnsoldBaht: 20,
}

/** The morning peak this round simulates: 07:00-09:00, the `buyTime.7to9` bucket. */
export const PEAK_MINUTES = 120

/**
 * Stated patience (B5) is a bucket, not a number. Each bucket is read as "they leave once the
 * wait passes this many minutes", with a short ramp just below the threshold so the curve is
 * continuous rather than a cliff — a bucket does not empty all at once. `any` never leaves.
 */
const PATIENCE_LIMIT_MINUTES: Record<keyof AudienceAggregate['queuePatience'], number> = {
  under3: 3,
  '3to5': 5,
  '5to10': 10,
  any: Number.POSITIVE_INFINITY,
}

/** Width of the ramp below each patience threshold, in minutes. */
const PATIENCE_RAMP_MINUTES = 0.5

export type SimTrace = {
  /** Customers who wanted to buy in the 07:00-09:00 peak. */
  arrivals: number
  /** How many drinks the staffed baristas could serve in that window. */
  capacity: number
  served: number
  /** Walked out — the wait exceeded the patience they stated at registration. */
  lostToQueue: number
  /** Average minutes a customer spent waiting. */
  waitMinutes: number
}

export type SimResult = {
  revenue: number
  profit: number
  /** 0-100. Falls with the wait, and with the share of arrivals who never got served. */
  satisfaction: number
  /** ฿ of drinks prepped for customers who walked out. */
  waste: number
  trace: SimTrace
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/** Round to two decimals so traces read cleanly and equality stays exact. */
function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * How many respondents actually want to buy a coffee in the morning peak.
 *
 * Two registration answers, joined: `buyTime['7to9']` is the peak bucket (and, being a real
 * time bucket, it already excludes everyone who answered `never`), scaled by the share of the
 * room whose first drink of the day is coffee — the cafe's core demand. Nothing here is
 * invented; both numbers come straight off the registration form.
 *
 * Deliberately conservative: the tea and water drinkers are not counted as morning-peak coffee
 * demand even though a real cafe would sell to some of them. See the Task 3 report.
 */
function peakArrivals(a: AudienceAggregate): number {
  const respondents = Math.max(0, a.respondents)
  if (respondents === 0) return 0
  const coffeeShare = Math.max(0, a.firstDrink.coffee) / respondents
  const peakBuyers = Math.max(0, a.buyTime['7to9'])
  return Math.round(peakBuyers * coffeeShare)
}

/**
 * Average wait, in minutes: your own service time, plus the time it takes to clear the queue
 * standing in front of you. Continuous in `baristas` (no cliff at the point where demand meets
 * capacity), strictly falling as baristas are added, and capped at the length of the peak —
 * nobody waits past 09:00, the rush is over.
 */
function averageWait(arrivals: number, capacity: number, perMinute: number): number {
  if (perMinute <= 0) return PEAK_MINUTES
  const queueAhead = Math.max(0, arrivals - capacity) / 2
  return Math.min(PEAK_MINUTES, (1 + queueAhead) / perMinute)
}

/**
 * The share of the audience whose stated patience (B5) is shorter than the wait they'd face.
 * This is the sentence the outcome screen exists to say: *someone told us they would wait three
 * minutes; you staffed two baristas; they left at 7:14.*
 */
function walkOutShare(a: AudienceAggregate, waitMinutes: number): number {
  const respondents = Math.max(0, a.respondents)
  if (respondents === 0) return 0
  let leaving = 0
  for (const key of Object.keys(PATIENCE_LIMIT_MINUTES) as (keyof typeof PATIENCE_LIMIT_MINUTES)[]) {
    const limit = PATIENCE_LIMIT_MINUTES[key]
    if (!Number.isFinite(limit)) continue
    const rampStart = limit - PATIENCE_RAMP_MINUTES
    const share = clamp((waitMinutes - rampStart) / PATIENCE_RAMP_MINUTES, 0, 1)
    leaving += Math.max(0, a.queuePatience[key]) * share
  }
  return clamp(leaving / respondents, 0, 1)
}

/**
 * Round 1: how many baristas at 7am?
 *
 * Understaffing loses customers to the queue and wastes the drinks already prepped for them.
 * Overstaffing serves nobody extra and burns a wage. The optimum is interior, and it is the
 * audience's own answers — not the constants — that put it where it is.
 */
export function simulateStaffing(baristas: number, a: AudienceAggregate): SimResult {
  const staff = Number.isFinite(baristas) ? Math.max(0, Math.floor(baristas)) : 0

  const arrivals = peakArrivals(a)
  const perMinute = staff * CONSTANTS.servedPerBaristaPerMin
  const capacity = Math.round(perMinute * PEAK_MINUTES)

  const waitMinutes = round2(averageWait(arrivals, capacity, perMinute))

  // Integers first, then derive `served` from them, so served + lostToQueue can never drift
  // above arrivals through independent rounding.
  const lostToQueue = Math.min(arrivals, Math.round(arrivals * walkOutShare(a, waitMinutes)))
  const served = Math.max(0, Math.min(capacity, arrivals - lostToQueue))

  // The cafe preps for the customers it could serve, never beyond the demand it expects.
  // Anything prepped that nobody collects is waste — traceable straight back to queuePatience.
  const prepped = Math.min(capacity, arrivals)
  const unsold = Math.max(0, prepped - served)

  const revenue = served * CONSTANTS.ticketBaht
  const waste = unsold * CONSTANTS.wastePerUnsoldBaht
  const profit = revenue - staff * CONSTANTS.baristaWageBaht - waste

  const servedShare = arrivals > 0 ? served / arrivals : 1
  const patienceScore = clamp(100 - 10 * waitMinutes, 0, 100)
  const satisfaction = Math.round(clamp(patienceScore * servedShare, 0, 100))

  return {
    revenue,
    profit,
    satisfaction,
    waste,
    trace: { arrivals, capacity, served, lostToQueue, waitMinutes },
  }
}

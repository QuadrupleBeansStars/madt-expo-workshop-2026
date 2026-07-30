// The audience aggregate — the single seam where real registration data enters The Decision
// Room. Every downstream module (simulator, dashboards, game store) reads AUDIENCE from here
// and nothing else touches the registration CSV.
//
// The registration form is documented in docs/registration-questions.md (Group B, questions
// B1-B5). Each bucket below corresponds to one question's answer options.

export type AudienceAggregate = {
  respondents: number
  arrivalMode: Record<'walk' | 'train' | 'car' | 'moto', number>
  wakeTime: Record<'before6' | '6to8' | '8to10' | 'after10', number>
  firstDrink: Record<'coffee' | 'tea' | 'water' | 'nothing', number>
  buyTime: Record<'before7' | '7to9' | '9to11' | 'after11' | 'never', number>
  queuePatience: Record<'under3' | '3to5' | '5to10' | 'any', number>
}

// PLACEHOLDER DATA — the registration CSV does not exist yet (event is 23 Aug 2026).
// This flag is a safety mechanism, not a note: the UI renders a visible "PLACEHOLDER DATA"
// badge wherever AUDIENCE is used, driven directly by this value.
//
// To clear it: run `scripts/import-audience.ts` against the real registration CSV once it
// exists, then set IS_PLACEHOLDER to `false` here.
export const IS_PLACEHOLDER = true

// Plausible answers to the five Group B questions (docs/registration-questions.md), shaped so
// Beat 2's staffing simulator (Task 3) has a real interior optimum:
//   - buyTime peaks hard in 7to9 — a real morning rush, not a flat distribution.
//   - queuePatience is weighted toward under3/3to5 — understaffing genuinely loses customers.
//   - firstDrink.coffee is the largest bucket — the cafe's core demand is real.
// Every bucket below sums to exactly `respondents` (180).
export const AUDIENCE: AudienceAggregate = {
  respondents: 180,
  arrivalMode: {
    walk: 40,
    train: 90,
    car: 30,
    moto: 20,
  }, // 40+90+30+20 = 180
  wakeTime: {
    before6: 20,
    '6to8': 100,
    '8to10': 50,
    after10: 10,
  }, // 20+100+50+10 = 180
  firstDrink: {
    coffee: 100,
    tea: 40,
    water: 30,
    nothing: 10,
  }, // 100+40+30+10 = 180
  buyTime: {
    before7: 15,
    '7to9': 90,
    '9to11': 40,
    after11: 15,
    never: 20,
  }, // 15+90+40+15+20 = 180
  queuePatience: {
    under3: 70,
    '3to5': 60,
    '5to10': 35,
    any: 15,
  }, // 70+60+35+15 = 180
}

export function bucketTotal(rec: Record<string, number>): number {
  return Object.values(rec).reduce((sum, v) => sum + v, 0)
}

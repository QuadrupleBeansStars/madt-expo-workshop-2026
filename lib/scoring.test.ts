import { describe, it, expect } from 'vitest'
import {
  BASE_POINTS, MAX_SPEED_BONUS, MAX_STREAK_MULTIPLIER,
  scoreAnswer, scorePlayer, speedBonus, streakMultiplier,
} from './scoring'
import { QUESTION_COUNT, QUESTIONS_IN_ORDER } from './game'
import type { Answer } from './types'

const ans = (questionId: string, verdict: 'pass' | 'reject', elapsedMs = 15_000): Answer =>
  ({ playerId: 'p1', questionId, verdict, elapsedMs })

describe('the tiebreaker invariant', () => {
  // If this fails, a fast player can out-score someone who got one more question right,
  // in a workshop about not trusting snap judgments. Fix the constants, not the test.
  it('all the speed bonus in the game is worth less than one correct answer', () => {
    expect(QUESTION_COUNT * MAX_SPEED_BONUS).toBeLessThan(BASE_POINTS)
  })
})

describe('streakMultiplier', () => {
  it('is 1, 2, then 3 forever', () => {
    expect([1, 2, 3, 4, 9].map(streakMultiplier)).toEqual([1, 2, 3, 3, 3])
  })
  it('never exceeds the cap', () => {
    expect(streakMultiplier(99)).toBe(MAX_STREAK_MULTIPLIER)
  })
})

describe('speedBonus', () => {
  it('is capped, floored, and clamps hostile input', () => {
    expect(speedBonus(0)).toBe(MAX_SPEED_BONUS)
    expect(speedBonus(-999_999)).toBe(MAX_SPEED_BONUS)
    expect(speedBonus(15_000)).toBe(0)
    expect(speedBonus(999_999)).toBe(0)
  })
})

describe('scoreAnswer', () => {
  it('pays nothing for a wrong answer, however fast', () => {
    expect(scoreAnswer(false, 3, 0)).toBe(0)
  })
  it('multiplies the base but NOT the speed bonus', () => {
    // 100*3 + 10, never (100+10)*3 — multiplying the bonus breaks the invariant above.
    expect(scoreAnswer(true, 3, 0)).toBe(BASE_POINTS * 3 + MAX_SPEED_BONUS)
  })
})

describe('scorePlayer', () => {
  it('walks questions in play order and builds the streak', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, q.verdict, 15_000)) // all correct, no speed bonus
    const { total, correct } = scorePlayer(answers, qs)
    expect(correct).toBe(9)
    // ×1 + ×2 + ×3 seven times
    expect(total).toBe(BASE_POINTS * (1 + 2 + 3 * 7))
  })

  it('resets the streak on a wrong answer and on a missing one', () => {
    const qs = QUESTIONS_IN_ORDER
    const flip = (v: 'pass' | 'reject') => (v === 'pass' ? 'reject' : 'pass') as 'pass' | 'reject'
    // correct, correct, WRONG, correct → 100 + 200 + 0 + 100
    const answers = [
      ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict),
      ans(qs[2].id, flip(qs[2].verdict)), ans(qs[3].id, qs[3].verdict),
    ]
    expect(scorePlayer(answers, qs).total).toBe(100 + 200 + 0 + 100)

    // skipping question 3 entirely must also reset, not carry the streak across the gap
    const withGap = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict), ans(qs[3].id, qs[3].verdict)]
    expect(scorePlayer(withGap, qs).total).toBe(100 + 200 + 100)
  })

  it('counts wrongPass ONLY for approving something that should have been rejected', () => {
    const qs = QUESTIONS_IN_ORDER
    const rejects = qs.filter((q) => q.verdict === 'reject')
    const passes = qs.filter((q) => q.verdict === 'pass')
    const approvedEverything = qs.map((q) => ans(q.id, 'pass'))
    expect(scorePlayer(approvedEverything, qs).wrongPass).toBe(rejects.length)
    // rejecting a true answer is wrong, but it is NOT a wrongPass
    const rejectedEverything = qs.map((q) => ans(q.id, 'reject'))
    expect(scorePlayer(rejectedEverything, qs).wrongPass).toBe(0)
    expect(scorePlayer(rejectedEverything, qs).correct).toBe(rejects.length)
    // Two, not v3's three — the team's set has two จริง cases. Pinned rather than derived so a
    // content change that alters the guessing floor cannot slip through this file unnoticed.
    expect(passes.length).toBe(2)
  })

  it('reports the streak standing at the end of the walk', () => {
    const qs = QUESTIONS_IN_ORDER
    expect(scorePlayer(qs.map((q) => ans(q.id, q.verdict)), qs).streak).toBe(9)
    const broken = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict === 'pass' ? 'reject' : 'pass')]
    expect(scorePlayer(broken, qs).streak).toBe(0)
  })

  // Spec §5b: PublicGameState.you.lastCorrect/lastPoints read this map for "the current
  // question's outcome" — the 3-way distinction (right / wrong / never-answered) has to survive
  // here, at the source, or the phone's reveal can't tell a real loss from a timeout on reload.
  it('records a per-question outcome: present+correct for a right answer, present+wrong (0 points) for a miss, absent for never answered', () => {
    const qs = QUESTIONS_IN_ORDER
    const flip = (v: 'pass' | 'reject') => (v === 'pass' ? 'reject' : 'pass') as 'pass' | 'reject'
    const answers = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, flip(qs[1].verdict))]
    const { perQuestion } = scorePlayer(answers, qs)

    expect(perQuestion[qs[0].id]?.correct).toBe(true)
    expect(perQuestion[qs[0].id]?.points).toBeGreaterThan(0)

    expect(perQuestion[qs[1].id]).toEqual({ correct: false, points: 0 })

    expect(perQuestion[qs[2].id]).toBeUndefined() // never answered — absence, not a false entry
  })

  /*
   * WHAT THE MULTIPLIER PROMISES ABOUT GUESSING — and it is WEAKER than it used to be.
   *
   * THIS TEST USED TO ASSERT: "never lets an always-reject player reach the ×3 multiplier". v3's
   * answer key had THREE จริง cases and placed them so no three ตีกลับ answers were ever adjacent;
   * a player tapping ตีกลับ nine times scored 800 with six correct and never once reached ×3.
   *
   * WHY IT WEAKENED: the team's set (docs/superpowers/specs/2026-08-19-hallucination-nine-content.md)
   * has TWO จริง cases among nine, and no arrangement of two can restore the old rule. With `p`
   * จริง answers the `9 − p` rejects fall into at most `p + 1` runs, so the shortest possible
   * longest run is `ceil((9 − p) / (p + 1))` — 3 at p=2, 2 at p=3. A run of three is unavoidable,
   * so ×3 is reachable however the cases are ordered. The running order (จริง at 4 and 7) makes
   * that run happen exactly ONCE instead of the four-question stretch the team's own numbering
   * would have handed out.
   *
   * WHAT IT PROMISES NOW: an always-reject player gets seven of nine RIGHT and still scores half
   * what a thinking player scores, and touches ×3 on one question only. That is the honest,
   * weaker property. Do not restore the old wording over it.
   *
   * WHAT RESTORES THE OLD GUARANTEE: a THIRD จริง case. At p=3, placed at 3, 6 and 8, an
   * always-reject player scores 800 with six correct and never reaches ×3 — v3's exact numbers.
   * That is a content decision for the team; `content/questions.test.ts`'s run test already
   * tightens to 2 on its own the moment a third one lands.
   */
  it('leaves an always-reject player at half a thinking player’s score, touching ×3 once', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, 'reject')) // 15_000ms — no speed bonus in the sums
    const { total, correct, perQuestion } = scorePlayer(answers, qs)

    // Seven right out of nine, because seven of the nine answers are มั่ว. Being right often is
    // not the thing the score is measuring.
    expect(correct).toBe(7)

    // q1 100, q2 200, q3 300 | q4 wrong | q5 100, q6 200 | q7 wrong | q8 100, q9 200
    expect(total).toBe(1200)

    const perfect = BASE_POINTS * (1 + 2 + 3 * 7)
    expect(perfect).toBe(2400)
    expect(total, 'guessing must not come within reach of thinking').toBeLessThanOrEqual(perfect / 2)

    const atMaxMultiplier = qs.filter(
      (q) => perQuestion[q.id]?.points === BASE_POINTS * MAX_STREAK_MULTIPLIER,
    )
    expect(atMaxMultiplier.map((q) => q.order), 'only case 3 may pay ×3 to a guesser').toEqual([3])
  })
})

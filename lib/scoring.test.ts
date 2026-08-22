import { describe, it, expect } from 'vitest'
import {
  BASE_POINTS, MAX_SPEED_BONUS, MAX_STREAK_BONUS, STREAK_STEP,
  scoreAnswer, scorePlayer, speedBonus, streakBonus,
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

describe('streakBonus', () => {
  /* A BONUS, not a multiplier. The first correct answer earns none — the bonus is for the RUN, and
     a run needs two. Then +50 a step to a ceiling of +100, so a streak is worth at most double a
     plain correct answer rather than the triple the multiplier paid. */
  it('starts at the second in a row and climbs by a step to its ceiling', () => {
    expect([0, 1, 2, 3, 4, 9].map(streakBonus)).toEqual([0, 0, STREAK_STEP, MAX_STREAK_BONUS, MAX_STREAK_BONUS, MAX_STREAK_BONUS])
  })
  it('caps a streak at double a plain correct answer, never more', () => {
    expect(BASE_POINTS + streakBonus(99)).toBe(BASE_POINTS * 2)
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
  it('adds its three parts and multiplies none of them', () => {
    // base + streak + speed, each earned separately. Multiplying any pair by another would put a
    // fast streak beyond the reach of a careful player, which is what MAX_SPEED_BONUS forbids.
    expect(scoreAnswer(true, 3, 0)).toBe(BASE_POINTS + MAX_STREAK_BONUS + MAX_SPEED_BONUS)
  })
})

describe('scorePlayer', () => {
  it('walks questions in play order and builds the streak', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, q.verdict, 15_000)) // all correct, no speed bonus
    const { total, correct } = scorePlayer(answers, qs)
    expect(correct).toBe(10)
    // Ten bases, plus the streak bonus climbing 0, +50, +100 and holding there.
    expect(total).toBe(qs.reduce((sum, _q, i) => sum + BASE_POINTS + streakBonus(i + 1), 0))
  })

  it('resets the streak on a wrong answer and on a missing one', () => {
    const qs = QUESTIONS_IN_ORDER
    const flip = (v: 'pass' | 'reject') => (v === 'pass' ? 'reject' : 'pass') as 'pass' | 'reject'
    // correct, correct, WRONG, correct → 100 + 200 + 0 + 100
    const answers = [
      ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict),
      ans(qs[2].id, flip(qs[2].verdict)), ans(qs[3].id, qs[3].verdict),
    ]
    // streak 1, streak 2, nothing, then streak 1 again — the reset is the whole assertion.
    const one = BASE_POINTS + streakBonus(1)
    const two = BASE_POINTS + streakBonus(2)
    expect(scorePlayer(answers, qs).total).toBe(one + two + 0 + one)

    // skipping question 3 entirely must also reset, not carry the streak across the gap
    const withGap = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict), ans(qs[3].id, qs[3].verdict)]
    expect(scorePlayer(withGap, qs).total).toBe(one + two + one)
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
    // Three, as of `coffee-sleep-source` at order 5. Pinned rather than derived so a content change that
    // alters the guessing floor cannot slip through this file unnoticed — the floor IS this number.
    expect(passes.length).toBe(3)
  })

  it('reports the streak standing at the end of the walk', () => {
    const qs = QUESTIONS_IN_ORDER
    expect(scorePlayer(qs.map((q) => ans(q.id, q.verdict)), qs).streak).toBe(10)
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
   * WHAT THE MULTIPLIER PROMISES ABOUT GUESSING — and it is back to being strong-ish.
   *
   * v3 promised the strong rule: an always-reject player never reached the streak ceiling at all.
   * That held because v3's key had THREE จริง cases among nine, enough to keep every run of มั่ว
   * answers down to two. The team's own set arrived with TWO, no arrangement of two can do it, and
   * this test spent two rounds documenting the weaker property instead.
   *
   * THE THIRD จริง CASE HAS NOW LANDED — `coffee-sleep-source`, order 5 — and the numbers moved: the
   * reject runs are [3, 3, 1] where they were [6, 1], and an always-reject player takes 54% of a
   * perfect game where they used to take 70%.
   *
   * THE CEILING IS STILL REACHED TWICE, and that is the floor rather than an oversight: a จริง
   * case at order 1 opens no reject run, so it spends one of the four dividers on nothing, and
   * runs of two would need the game to open on a lie. Case 1 is the room's warm-up and the team
   * has kept it there through two rounds of this exact trade. See `content/questions.test.ts`.
   *
   * If you are here because this test went red: the arrangement changed. Fix the content, not the
   * numbers below.
   */
  it('leaves an always-reject player barely half of a thinking one, at the ceiling twice', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, 'reject')) // 15_000ms — no speed bonus in the sums
    const { total, correct, perQuestion } = scorePlayer(answers, qs)

    // Seven right out of ten, because seven of the ten answers are มั่ว. Being right often is not
    // the thing the score is measuring.
    expect(correct).toBe(7)

    // Three runs — [3, 3, 1] — each restarting the bonus from zero. Written as the runs rather
    // than as one total, because the runs are the mechanic and the total is only their sum.
    const runScore = (len: number) =>
      Array.from({ length: len }, (_, i) => BASE_POINTS + streakBonus(i + 1)).reduce((a, b) => a + b, 0)
    expect(total).toBe(runScore(3) + runScore(3) + runScore(1))
    expect(total).toBe(1000)

    // A perfect game: ten correct, the bonus climbing to its ceiling and staying there.
    const perfect = qs.reduce((sum, _q, i) => sum + BASE_POINTS + streakBonus(i + 1), 0)
    expect(perfect).toBe(1850)
    expect(total, 'guessing must stay clearly behind thinking').toBeLessThan(perfect * 0.6)

    const atCeiling = qs.filter(
      (q) => perQuestion[q.id]?.points === BASE_POINTS + MAX_STREAK_BONUS,
    )
    // The third question of each run of three, and nowhere else. It was four cases. Asserted
    // exactly, so a run growing back cannot pass unnoticed.
    expect(atCeiling.map((q) => q.order)).toEqual([4, 8])
  })
})

/*
 * THE RULES SCREEN'S CLAIM, checked against the walk it describes.
 *
 * The projector tells the room "ผิดหรือไม่ทัน เริ่มนับใหม่". It used to say only "ผิด", which was
 * a quieter version of the same bug the reveal had: the screen that teaches the rule stating a
 * rule the code does not apply. A MISSING answer breaks the streak exactly as a wrong one does,
 * and at an eight-second window that will happen to somebody every round.
 */
describe('what breaks a streak', () => {
  const qs = QUESTIONS_IN_ORDER.slice(0, 4)
  const right = (q: (typeof qs)[number]) => ans(q.id, q.verdict)

  it('a wrong answer resets it', () => {
    const wrong = qs[1].verdict === 'pass' ? 'reject' : 'pass'
    const { perQuestion } = scorePlayer(
      [right(qs[0]), ans(qs[1].id, wrong), right(qs[2])].filter(Boolean),
      qs,
    )
    // Third question is a fresh streak of one, so it pays the base — not the double it would have
    // paid had the miss in between not reset anything.
    expect(perQuestion[qs[2].id].points).toBe(BASE_POINTS)
  })

  it('NOT answering resets it too — the half the screen used to leave out', () => {
    const { perQuestion } = scorePlayer([right(qs[0]), right(qs[2])], qs) // qs[1] never answered
    expect(perQuestion[qs[1].id]).toBeUndefined()
    expect(perQuestion[qs[2].id].points).toBe(BASE_POINTS)
  })
})

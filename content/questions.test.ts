import { describe, it, expect } from 'vitest'
import { QUESTIONS, CLOSING_LINES, getQuestion } from './questions'
import { QuestionSchema } from '@/lib/types'
import type { Question, Verdict } from '@/lib/types'

const byOrder = (): Question[] => [...QUESTIONS].sort((a, b) => a.order - b.order)

/** Lengths of the consecutive runs of `reject`, in play order. Computed — never hardcoded. */
function rejectRuns(qs: Question[]): number[] {
  const runs: number[] = []
  let run = 0
  for (const q of qs) {
    if (q.verdict === 'reject') { run++; continue }
    if (run > 0) runs.push(run)
    run = 0
  }
  if (run > 0) runs.push(run)
  return runs
}

describe('QUESTIONS', () => {
  it('has exactly 10 questions ordered 1..10 with unique ids', () => {
    expect(QUESTIONS).toHaveLength(10)
    expect(byOrder().map((q) => q.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(10)
  })

  it('every question is schema-valid (implies highlight is inside duckSays)', () => {
    for (const q of QUESTIONS) {
      const r = QuestionSchema.safeParse(q)
      expect(r.success, `${q.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
  })


  /*
   * THE ANSWER KEY, POSITION BY POSITION.
   *
   * This is the thing a careless edit breaks silently: reorder two cases and every test above
   * still passes while the anti-guess arrangement quietly disappears. The sequence is not
   * decorative — see the run test below for what each ตีกลับ run is worth.
   */
  it('runs pass reject reject reject pass reject reject reject pass reject', () => {
    const expected: Verdict[] = [
      'pass', 'reject', 'reject', 'reject', 'pass', 'reject', 'reject', 'reject', 'pass', 'reject',
    ]
    const actual = byOrder()
    expected.forEach((verdict, i) => {
      expect(actual[i].verdict, `case ${i + 1} (${actual[i].id}) must be ${verdict}`).toBe(verdict)
    })
  })

  /*
   * THE ANTI-GUESS ARRANGEMENT, and what it still costs.
   *
   * The third จริง case landed at order 5 and cut the six-case ตีกลับ run in half: the runs are
   * [3, 3, 1] where they were [6, 1], and an always-reject player fell from 70% of a perfect game
   * to 54%. The arithmetic is on the always-reject test in `lib/scoring.test.ts`.
   *
   * A RUN OF THREE IS THE FLOOR WHILE CASE 1 IS จริง, and that is the assertion below rather than
   * a preference. With `p` จริง answers among `n` cases the rejects fall into at most `p + 1` runs,
   * so at n=10, p=3 runs of two are arithmetically available — but only for arrangements whose
   * FIRST จริง case sits at order 3 or later, because a จริง case at order 1 opens no reject run
   * and wastes one of the four dividers. Case 1 is the room's warm-up, a joke about a comedy trio,
   * and the team has now kept it there through two rounds of exactly this trade.
   *
   * DO NOT "fix" this by moving the warm-up. Runs of [2,2,2,1] need order 1 to be a lie, which is
   * a content decision the team has twice declined. Fix the content, never the test.
   */
  it('keeps every reject run to three, the floor while the warm-up opens', () => {
    const qs = byOrder()
    const passCount = qs.filter((q) => q.verdict === 'pass').length
    const runs = rejectRuns(qs)

    expect(passCount).toBe(3)
    expect(runs).toEqual([3, 3, 1])

    // The arithmetic floor ignores where the จริง cases sit, so it is one shorter than what an
    // opening จริง case allows. Asserted as the gap, so it stays true if `n` changes again.
    expect(Math.ceil((qs.length - passCount) / (passCount + 1))).toBe(2)
    expect(qs[0].verdict, 'the warm-up is why the real floor is 3, not 2').toBe('pass')
  })


  /* No case's reason may point at another case. Case 1's used to end "ต่างจากอีกสองข้อในบทนี้" —
     a comparison to two questions the room had not been asked yet, on the very first reveal of the
     game. The reveal explains the case in front of the room and nothing else; the act card is the
     screen that draws the three together, and it comes after all three have been played. */
  it('explains each case on its own, never by pointing at another', () => {
    const CROSS = /อีกสองข้อ|ข้ออื่น|ในบทนี้|ข้อถัดไป|ข้อต่อไป|สองข้อที่เหลือ/
    for (const q of QUESTIONS) {
      expect(CROSS.test(q.truth), `${q.id}: ${q.truth}`).toBe(false)
    }
  })

  // Short enough to be read aloud in one breath while the room is still looking at the case.
  it('keeps every reason under 120 characters', () => {
    for (const q of QUESTIONS) {
      expect(q.truth.length, `${q.id} is ${q.truth.length}`).toBeLessThanOrEqual(120)
    }
  })

  it('getQuestion finds by id and returns undefined otherwise', () => {
    expect(getQuestion(QUESTIONS[0].id)?.id).toBe(QUESTIONS[0].id)
    expect(getQuestion('nope')).toBeUndefined()
  })

  /*
   * `needsCheck` is a facilitator note that is NEVER rendered (lib/types.ts), and it is optional —
   * so a content rewrite can silently drop every one of them. `app/tv/tv.test.tsx` derives its
   * "never renders the facilitator note" fixture with `QUESTIONS_IN_ORDER.find((q) => q.needsCheck)!`
   * in the describe body: with none in the set, that file throws at collection and takes its whole
   * suite down for a reason nothing points at. This fails first, and in the right place.
   */
  it('still carries at least one facilitator needsCheck note', () => {
    expect(QUESTIONS.filter((q) => q.needsCheck).length).toBeGreaterThan(0)
  })
})

describe('the closing beat', () => {
  /*
   * The team supplied this word for word and nothing renders it yet (see CLOSING_LINES' own
   * comment). Pinned so that whoever wires it onto the tally or podium cannot quietly paraphrase
   * the one line the team emphasised — which is the line the room is meant to leave with.
   */
  it('carries the team’s closing remark verbatim, ending on the line they emphasised', () => {
    expect(CLOSING_LINES).toEqual([
      'ในเกม คุณจับ Hallucination ได้ เพราะคุณหยุดคิดก่อนเชื่อ',
      'ในงานจริงก็เหมือนกัน — อย่าให้ AI เป็นคนตัดสินใจแทนเรา',
      'AI ช่วยคิดได้ แต่คนต้อง Verify ก่อนใช้',
    ])
  })
})

describe('the opener', () => {
  it('opens on the warm-up: a จริง case the room reads instantly', () => {
    const first = byOrder()[0]
    expect(first.id).toBe('mum-teng-nong')
    /* Deliberately จริง, and deliberately first. หม่ำ, เท่ง and โหน่ง are one comedy troupe, so
     * the room answers before it has finished reading — which is the point of a warm-up: everyone
     * taps, everyone scores, nobody is behind before the game has started. It also establishes
     * that ผ่าน is a real answer, so ตีกลับ is a judgement rather than the default.
     *
     * The cost is in `pays for opening on the warm-up with one long reject run` above. Do not
     * "fix" it by moving this case. */
    expect(first.verdict).toBe('pass')
  })
})

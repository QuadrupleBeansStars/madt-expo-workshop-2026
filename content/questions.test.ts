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
  it('has exactly 9 questions ordered 1..9 with unique ids', () => {
    expect(QUESTIONS).toHaveLength(9)
    expect(byOrder().map((q) => q.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(9)
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
  it('runs pass reject reject reject reject reject reject pass reject', () => {
    const expected: Verdict[] = [
      'pass', 'reject', 'reject', 'reject', 'reject', 'reject', 'reject', 'pass', 'reject',
    ]
    const actual = byOrder()
    expected.forEach((verdict, i) => {
      expect(actual[i].verdict, `case ${i + 1} (${actual[i].id}) must be ${verdict}`).toBe(verdict)
    })
  })

  /*
   * THE ANTI-GUESS ARRANGEMENT — what replaced v3's "never three consecutive rejects".
   *
   * v3 had THREE จริง cases and could keep every reject run to two, so a player tapping ตีกลับ
   * nine times never reached the ×3 multiplier at all. The team's set has TWO, and no arrangement
   * of two can do it: with `p` จริง answers the `9 − p` rejects fall into at most `p + 1` runs, so
   * the shortest possible longest run is `ceil((9 − p) / (p + 1))` — 3 at p=2, 2 at p=3.
   *
   * So the assertion below is the OPTIMALITY of the arrangement, not the old guarantee: the runs
   * are as short as two จริง cases allow, and ×3 is reachable exactly once. The team's own
   * numbering scored 6/1 here. Add a third จริง case and this test tightens to 2 by itself, which
   * is exactly the point at which `lib/scoring.test.ts` can go back to promising the strong rule.
   */
  /*
   * This asserts what the arrangement COSTS, not that it is optimal — because it is not, and that
   * was a deliberate trade. Case 1 is the room's warm-up, a joke about a comedy trio, and the team
   * chose opening on it over 400 points of guessing resistance. Reordering to orders 4 and 7 would
   * give runs of [3,2,2] and drop an always-reject player from 1600 to 1200; DO NOT make that
   * change here to turn this green. The fix is a third จริง case, which makes runs of [2,2,2]
   * possible with case 1 still first — and this test then fails loudly, asking to be updated.
   */
  it('pays for opening on the warm-up with one long reject run', () => {
    const qs = byOrder()
    const passCount = qs.filter((q) => q.verdict === 'pass').length
    const runs = rejectRuns(qs)

    expect(passCount, 'a third จริง case is what restores the ×3 guarantee').toBe(2)
    expect(runs).toEqual([6, 1])
    expect(Math.max(...runs)).toBeGreaterThan(Math.ceil((qs.length - passCount) / (passCount + 1)))
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

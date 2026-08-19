import { describe, it, expect } from 'vitest'
import { QUESTIONS, ACTS, CLOSING_LINES, getQuestion } from './questions'
import { QuestionSchema, ActSchema } from '@/lib/types'
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

  it('has three acts of three, and act numbers follow play order', () => {
    expect(ACTS).toHaveLength(3)
    for (const a of ACTS) {
      const r = ActSchema.safeParse(a)
      expect(r.success, `act ${a.n}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
    // lib/game.ts derives the act card from Math.floor(qIndex / 3). A question whose `act`
    // disagrees with its position puts it under an act card that does not describe it.
    expect(byOrder().map((q) => q.act)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
  })

  /*
   * THE ANSWER KEY, POSITION BY POSITION.
   *
   * This is the thing a careless edit breaks silently: reorder two cases and every test above
   * still passes while the anti-guess arrangement quietly disappears. The sequence is not
   * decorative — see the run test below for what each ตีกลับ run is worth.
   */
  it('runs reject reject reject pass reject reject pass reject reject', () => {
    const expected: Verdict[] = [
      'reject', 'reject', 'reject', 'pass', 'reject', 'reject', 'pass', 'reject', 'reject',
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
  it('breaks the reject runs as short as two จริง cases allow, so ×3 is reachable once', () => {
    const qs = byOrder()
    const passCount = qs.filter((q) => q.verdict === 'pass').length
    const runs = rejectRuns(qs)

    const bestPossible = Math.ceil((qs.length - passCount) / (passCount + 1))
    expect(Math.max(...runs), 'a shorter longest-run is available — reorder the cases').toBe(bestPossible)
    expect(runs.filter((r) => r >= 3), 'an always-reject player must reach ×3 at most once').toHaveLength(1)
    expect(runs).toEqual([3, 2, 2])
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

describe('the acts', () => {
  /*
   * The acts group by KIND OF WRONGNESS, not by topic, and the grouping is what forces the
   * running order: acts run 1,1,1 / 2,2,2 / 3,3,3 by position and the two จริง cases have to sit
   * at 4 and 7, so the all-มั่ว causation group has to be act 1 and the other two groups each
   * have to OPEN with their จริง case. Move a case between acts and one of those breaks.
   */
  it('opens each act with the case that sets up the other two', () => {
    const inAct = (n: 1 | 2 | 3) => byOrder().filter((q) => q.act === n).map((q) => q.id)
    expect(inAct(1)).toEqual(['hyrox-itch', 'pa-da-confidence', 'mala-sweat'])
    expect(inAct(2)).toEqual(['mum-teng-nong', 'ultra-smooth', 'five-more-minutes'])
    expect(inAct(3)).toEqual(['octopus-hearts', 'million-views', 'einstein-fish'])
  })

  // The chips are the three cases just played, in the order the room was asked them. Reorder an
  // act's questions without reordering its chips and the act card recaps a game nobody played.
  it('lists each act chip in the order its questions were asked', () => {
    expect(ACTS[0].chips).toEqual(['คันหลัง = กล้ามโต?', 'มั่นใจ = ถูก?', 'เหงื่อออก = ไขมันละลาย?'])
    expect(ACTS[1].chips).toEqual(['ข้อสรุปที่ตามจากข้อมูล', 'Ultra Smooth', 'อีก 5 นาทีถึงบ้าน'])
    expect(ACTS[2].chips).toEqual(['หัวใจ 3 ดวง', '1 ล้านวิว', 'คำคมของ Einstein'])
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
  it('opens on a มั่ว case, so approving out of politeness costs the room round one', () => {
    const first = byOrder()[0]
    expect(first.id).toBe('hyrox-itch')
    // The duck is not obviously lying — it offers the explanation a gym would offer. A room that
    // approves it has been fooled by a cause that merely sounds like one, which is act 1's whole
    // subject. Opening on a จริง case would teach the opposite reflex in the round that sets the
    // tone, and it is also the position the anti-guess arrangement cannot spare (see above).
    expect(first.verdict).toBe('reject')
    expect(first.act).toBe(1)
  })
})

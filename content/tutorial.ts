import type { Question } from '@/lib/types'

/**
 * THE WORKED EXAMPLE, and the only case in this repo the room is never scored on.
 *
 * It exists because the room used to meet the game's three beats — the case sheet, the two stamps
 * on the phone, the reveal — for the first time ON CASE 01, with a ten-second reading beat and an
 * eight-second answer window to work them out in. The rules screen before it says what the beats
 * ARE; this shows them, side by side on one screen, with nothing running.
 *
 * WHY IT IS NOT ONE OF THE TEN. Walking a real case here would spend it: the room would arrive at
 * that case already knowing the verdict, and `content/questions.ts` is explicit that the ORDER of
 * the ten is load-bearing (the run of verdicts is what stops ตีกลับ-at-everything scoring well).
 * Burning one to teach the interface would cost the set an answer it cannot spare.
 *
 * WHY THIS QUESTION. It is the easiest reject that can be written: the duck is asked something it
 * has no information about at all and answers anyway. Nobody in the room can disagree about it,
 * which is the point — this screen teaches the MECHANIC, and a debatable example turns the room's
 * attention to the puzzle exactly when it should be on the buttons. Its lesson (no information at
 * all → say so) also sits beside case 3's rather than on top of it: that one is not ENOUGH
 * information, this one is none.
 *
 * `order` IS MEANINGLESS HERE and is present only because `Question` requires it: nothing draws a
 * case number for this example — the projector plate on this phase reads TUTORIAL, not CASE 01 —
 * and it is never in `QUESTIONS_IN_ORDER`, so nothing indexes or sorts it.
 */
export const TUTORIAL_CASE: Question = {
  id: 'tutorial-cat',
  order: 1,
  ask: 'แมวที่บ้านผมชื่ออะไรครับ?',
  duckSays: 'ชื่อส้มครับ แมวสีส้มส่วนใหญ่ชื่อนี้',
  highlight: 'ชื่อส้มครับ',
  verdict: 'reject',
  truth: 'ตีกลับ เพราะเป็ดไม่มีข้อมูลแมวของคุณเลย คำตอบนี้คือการเดาที่ฟังดูมั่นใจ',
  tell: 'ไม่มีข้อมูล ต้องตอบว่ายังไม่รู้ ไม่ใช่เดาให้ฟังดูดี',
}

/**
 * The split the example reveal draws.
 *
 * INVENTED, and it has to be: nobody has voted when this screen is up. It is here so the room can
 * see WHAT THE BAR IS before a real one arrives — a bar whose two shares are both zero renders as
 * `ยังไม่มีใครตอบข้อนี้` (components/game/SplitBar.tsx), which teaches nothing about the object.
 *
 * Deliberately NOT a round split, and deliberately a room that mostly got it right: a 50/50 reads
 * as a placeholder, and a mostly-wrong example rehearses the wrong outcome on the one screen where
 * nothing is at stake.
 */
export const TUTORIAL_SPLIT = { pass: 38, reject: 62 } as const

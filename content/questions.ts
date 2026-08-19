import type { Question } from '@/lib/types'

/**
 * The nine cases. Thai only (spec §6b).
 *
 * The game is about THE WAYS AN INFERENCE CAN BE WRONG — over-inference, unsupported inference,
 * false causation, false authority, plausibility, attribution. It is no longer about facts that
 * went out of date, which is what v3 taught.
 *
 * THREE RULES BEFORE YOU EDIT THIS FILE:
 *
 *  1. `verdict` is the CORRECT ACTION, not "is the duck right". They happen to coincide, but the
 *     player's buttons say ผ่าน/ตีกลับ, and the copy everywhere else must match the buttons.
 *
 *  2. `order` IS the team's own numbering, and that is a deliberate decision with a known cost.
 *     Verdicts run `pass reject reject reject reject reject reject pass reject`, so a player
 *     tapping ตีกลับ at everything scores 1600 of 2400 with seven correct, holding the ×3
 *     multiplier from case 4 to case 7. An earlier pass moved the two จริง cases to orders 4 and 7,
 *     which drops that to 1200 — but case 1 is the room's warm-up, a joke about a comedy trio
 *     everyone in Thailand knows, and opening on it is worth more than the 400 points of guessing
 *     resistance. The team made that call explicitly. `questions.test.ts` asserts the sequence
 *     position by position, so a well-meaning re-sort cannot happen silently.
 *
 *     THE REAL FIX IS A THIRD จริง CASE, not a re-sort. With `p` จริง answers the rejects fall
 *     into `p + 1` runs, so keeping every run to two needs `9 − p ≤ 2(p + 1)`, i.e. `p ≥ 3`. At
 *     `p = 2` a run of three is unavoidable wherever the two sit. With three จริง cases at orders
 *     1, 4 and 7 an always-reject player scores 900 and never reaches ×3 at all — the warm-up
 *     keeps its place AND the mechanic works. See the always-reject test in `lib/scoring.test.ts`.
 *     Until then, fix the content, never the test.
 *
 *
 * Case 09 is a REAL misattribution. Do not replace it with an invented journal or case number:
 * the repo's content rule forbids fabricating evidence that imitates a real outlet, and it is
 * written as "there is no evidence Einstein said this", never as a citation proving it.
 */
export const QUESTIONS: Question[] = [
  {
    id: 'hyrox-itch',
    order: 4,
    ask: 'แบกกระสอบ HYROX แล้วคันหลัง แปลว่าอะไรครับ?',
    duckSays: 'กล้ามหลังกำลังโตแบบก้าวกระโดดครับ',
    highlight: 'กล้ามหลังกำลังโต',
    verdict: 'reject',
    truth: 'คันหลังเกิดได้จากเหงื่อ ผ้าเสียดสี หรือฝุ่น เป็ดหยิบคำอธิบายที่ฟังดูดีที่สุดมาอันเดียว แล้วเรียกมันว่าสาเหตุ',
    tell: 'ยอดขายตกไม่ได้แปลว่าสาเหตุคือ Marketing ต้องหาว่าอะไรเป็น Driver จริง',
  },
  {
    id: 'pa-da-confidence',
    order: 5,
    ask: 'ป้าดาพูดว่า "ความจริงมีหนึ่งเดียว" เราควรเชื่อป้าดาเลยไหมครับ?',
    duckSays: 'ควรครับ เพราะป้าดาพูดด้วยความมั่นใจมาก',
    highlight: 'เพราะป้าดาพูดด้วยความมั่นใจมาก',
    verdict: 'reject',
    truth: 'เหตุผลเดียวที่เป็ดมีคือ "ป้าดามั่นใจ" ซึ่งไม่ใช่หลักฐาน ความมั่นใจกับความถูกต้องเป็นคนละเรื่อง',
    tell: 'ผู้บริหารพูด ≠ Data จริง ต้องกลับไปดู KPI ก่อนตัดสินใจ',
  },
  {
    id: 'mala-sweat',
    order: 7,
    ask: 'กินหมาล่าแล้วเหงื่อออก แปลว่าอะไรครับ?',
    duckSays: 'แปลว่าไขมันกำลังละลายครับ',
    highlight: 'ไขมันกำลังละลาย',
    verdict: 'reject',
    truth: 'ความเผ็ดไปกระตุ้นตัวรับความร้อน ร่างกายจึงระบายเหงื่อออกมา ไม่เกี่ยวกับไขมันเลย',
    tell: '"ยอดขายเพิ่มหลังยิงโฆษณา" ยังไม่พิสูจน์ว่าโฆษณาเป็นสาเหตุ',
  },

  {
    id: 'mum-teng-nong',
    order: 1,
    ask: 'ถ้าเท่งเจอหม่ำ แล้วหม่ำเจอโหน่ง เท่งจะเจอโหน่งไหมครับ?',
    duckSays: 'เจอครับ เพราะเท่งเจอหม่ำ และหม่ำเจอโหน่งครับ',
    highlight: 'เพราะเท่งเจอหม่ำ และหม่ำเจอโหน่ง',
    verdict: 'pass',
    truth: 'เป็ดต่อข้อมูลสองชิ้นที่โจทย์ให้มา แล้วหยุดแค่นั้น ไม่ได้เติมอะไรที่ไม่มีใครบอกเข้าไปเอง',
    tell: 'AI เชื่อมข้อมูลหลายจุดได้ แต่ต้องเช็กว่าข้อสรุปตามจากข้อมูลจริงหรือไม่',
    needsCheck: 'ข้อเปิด เป็นกึ่งมุก — หม่ำ เท่ง โหน่ง เป็นคณะเดียวกัน ห้องจะอ่านออกทันทีว่าเจอกันแน่ ไม่ต้องอธิบายอะไรเพิ่ม ถ้ามีคนแย้งเรื่องตรรกะ ใช้เป็นแต้มต่อได้เลยว่าเขากำลังทำสิ่งที่เกมนี้สอนพอดี แต่คำตอบยังเป็น "จริง" ตามเดิม',
  },
  {
    id: 'ultra-smooth',
    order: 2,
    ask: 'ร้านเจลาโต้แห่งหนึ่งเขียนว่า "Ultra Smooth" กินยังไงถึงจะถูกครับ?',
    duckSays: 'ต้องกลืนเลยครับ เพราะเนื้อเนียนจนไม่ต้องเคี้ยว',
    highlight: 'ต้องกลืนเลยครับ',
    verdict: 'reject',
    truth: 'ร้านเขียนแค่ว่าเนื้อเนียน ไม่ได้บอกวิธีกินสักคำ "ต้องกลืนเลย" เป็ดคิดขึ้นมาเอง',
    tell: 'อย่าให้ AI เติมรายละเอียดจากคำสั้น ๆ — "ลูกค้าพอใจ" ไม่ได้แปลว่า "ลูกค้าจะซื้อซ้ำ"',
  },
  {
    id: 'five-more-minutes',
    order: 3,
    ask: 'เพื่อนบอกว่า "อีก 5 นาทีถึงบ้าน" ตอนนี้เพื่อนอยู่ไหนครับ?',
    duckSays: 'อยู่หน้าบ้านครับ',
    highlight: 'หน้าบ้าน',
    verdict: 'reject',
    truth: 'ประโยคนั้นบอกเวลา ไม่ได้บอกตำแหน่ง เพื่อนอาจติดไฟแดงอยู่อีกสามกิโลก็ได้',
    tell: 'ถ้าข้อมูลไม่พอ อย่าเติมสิ่งที่ไม่รู้ — ควรบอกว่า "ยังระบุไม่ได้จากข้อมูลนี้"',
  },

  {
    id: 'octopus-hearts',
    order: 8,
    ask: 'ปลาหมึกมีหัวใจ 3 ดวงจริงไหมครับ?',
    duckSays: 'จริงครับ ปลาหมึกมีหัวใจ 3 ดวง',
    highlight: 'ปลาหมึกมีหัวใจ 3 ดวง',
    verdict: 'pass',
    truth: 'จริง สองดวงสูบเลือดไปที่เหงือก อีกดวงเลี้ยงทั้งตัว ข้อที่ฟังดูเหลือเชื่อที่สุด กลับตรวจได้ง่ายที่สุด',
    tell: 'อย่าปฏิเสธ Insight เพราะ "ฟังดูไม่น่าเป็นไปได้" — ต้องตรวจ Data ก่อน',
    needsCheck: 'เตรียมแหล่งอ้างอิงเรื่องหัวใจ 3 ดวงของปลาหมึกไว้ให้โฮสต์ เผื่อมีคนแย้งกลางห้อง',
  },
  {
    id: 'million-views',
    order: 6,
    ask: 'คลิปนี้มี 1 ล้านวิว แปลว่าคนดูชอบไหมครับ?',
    duckSays: 'ชอบครับ เพราะถ้าไม่ชอบคงไม่ดู',
    highlight: 'เพราะถ้าไม่ชอบคงไม่ดู',
    verdict: 'reject',
    truth: 'วิวนับแค่ว่ามีคนกดดู ไม่ได้บอกว่าดูจบ ดูเพราะชอบ หรือเข้ามาด่า ตัวเลขจริง แต่ข้อสรุปไม่ใช่',
    tell: 'ยอดวิว ≠ Engagement ≠ Conversion อย่าใช้ KPI ตัวเดียวสรุปพฤติกรรมลูกค้า',
  },
  {
    id: 'einstein-fish',
    order: 9,
    ask: '"ถ้าตัดสินปลาจากการปีนต้นไม้ ปลาจะคิดว่าตัวเองโง่" เป็นของ Einstein ไหมครับ?',
    duckSays: 'ใช่ครับ Einstein เป็นคนพูด',
    highlight: 'Einstein เป็นคนพูด',
    verdict: 'reject',
    truth: 'ไม่มีหลักฐานว่า Einstein พูดประโยคนี้ เป็นคำคมที่ถูกเอาไปแปะชื่อเขาทีหลัง ชื่อมีจริง ความเชื่อมโยงไม่มี',
    tell: 'Source จริง ≠ Claim จริง ต้องตรวจว่าแหล่งนั้นสนับสนุนข้อความที่ AI อ้างจริงไหม',
    needsCheck: 'เตรียมลิงก์ที่อธิบายว่าคำคมนี้ไม่มีหลักฐานว่าเป็นของ Einstein เผื่อมีคนแย้งกลางห้อง',
  },
]


/**
 * THE CLOSING BEAT, after case 9. The team supplied it word for word — see "The closing remark" in
 * `docs/superpowers/specs/2026-08-19-hallucination-nine-content.md`. The last line is the one they
 * emphasised and the one the room should leave with.
 *
 * NOTHING RENDERS THIS YET, and that is a handoff, not an oversight. It lives here because it is
 * Thai the room reads and every such string in this workshop lives under `content/`; the screen it
 * belongs on is `tally` or `podium`, and `components/game/Tally.tsx` currently hardcodes a closing
 * line of its own that this is meant to sit beside or replace. Whoever wires it up should import
 * it rather than retype it — a second copy of room-facing copy is how the two drift.
 */
export const CLOSING_LINES: readonly string[] = [
  'ในเกม คุณจับ Hallucination ได้ เพราะคุณหยุดคิดก่อนเชื่อ',
  'ในงานจริงก็เหมือนกัน — อย่าให้ AI เป็นคนตัดสินใจแทนเรา',
  'AI ช่วยคิดได้ แต่คนต้อง Verify ก่อนใช้',
]

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))
export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id)
}

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
 *  2. `order` IS the team's own numbering, and the arrangement is load-bearing. Verdicts run
 *     `pass reject reject reject pass reject reject reject pass reject`, which puts the three จริง
 *     cases at 1, 5 and 9 and breaks the rejects into runs of 3, 3 and 1. A player tapping ตีกลับ
 *     at everything is right seven times out of ten and still scores 1000 of 1850 — 54%, down from
 *     the 70% the two-จริง key paid. `questions.test.ts` asserts the sequence position by position,
 *     so a well-meaning re-sort cannot happen silently.
 *
 *     A RUN OF THREE IS THE FLOOR HERE, and no amount of re-sorting removes it. With `p` จริง
 *     answers among `n` cases the rejects fall into at most `p + 1` runs; at n=10, p=3 that allows
 *     runs of two — but only if the first จริง case sits at order 3 or later. Case 1 is the room's
 *     warm-up, a joke about a comedy trio everyone in Thailand knows, and the team keeps it there,
 *     which forces one extra reject into the first stretch. Opening on the warm-up is worth the
 *     one question of guessing resistance; the team made that call explicitly, twice. If you want
 *     runs of two you are proposing to open the game on a lie — say so out loud before you do it.
 *
 *     A FOURTH จริง CASE WOULD ALSO NEED `MAX_SPEED_BONUS` TO DROP AGAIN. The speed bonus is
 *     capped so a perfect speed run can never out-score one extra correct answer — see the
 *     invariant in `lib/scoring.ts`, which is why the tenth case took it from 10 to 9.
 *
 *
 * Case 10 is a REAL misattribution. Do not replace it with an invented journal or case number:
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
    order: 6,
    ask: 'ป้าดาพูดว่า "ความจริงมีหนึ่งเดียว" เราควรเชื่อป้าดาเลยไหมครับ?',
    duckSays: 'ควรครับ เพราะป้าดาพูดด้วยความมั่นใจมาก',
    highlight: 'เพราะป้าดาพูดด้วยความมั่นใจมาก',
    verdict: 'reject',
    truth: 'เหตุผลเดียวที่เป็ดมีคือ "ป้าดามั่นใจ" ซึ่งไม่ใช่หลักฐาน ความมั่นใจกับความถูกต้องเป็นคนละเรื่อง',
    tell: 'ผู้บริหารพูด ≠ Data จริง ต้องกลับไปดู KPI ก่อนตัดสินใจ',
  },
  {
    id: 'mala-sweat',
    order: 8,
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
    order: 9,
    ask: 'ปลาหมึกมีหัวใจ 3 ดวงจริงไหมครับ?',
    duckSays: 'จริงครับ ปลาหมึกมีหัวใจ 3 ดวง',
    highlight: 'ปลาหมึกมีหัวใจ 3 ดวง',
    verdict: 'pass',
    truth: 'จริง เป็ดพูดถูก และสิ่งที่ทำให้คนตีกลับข้อนี้คือมันฟังดูแปลก ไม่ใช่เพราะมันผิด — ระแวงเกินไปก็พลาดของจริง',
    tell: 'อย่าปฏิเสธ Insight เพราะ "ฟังดูไม่น่าเป็นไปได้" — ต้องตรวจ Data ก่อน',
    needsCheck: 'เตรียมแหล่งอ้างอิงเรื่องหัวใจ 3 ดวงของปลาหมึกไว้ให้โฮสต์ เผื่อมีคนแย้งกลางห้อง',
  },

  /*
   * THE THIRD จริง CASE, and it is a mechanic fix as much as a content one — see the header note
   * on why `p >= 3` is what keeps every ตีกลับ run down to three. It plays at order 5, in the
   * middle of what used to be a six-case run of ตีกลับ.
   *
   * THE ONLY CASE WHERE THE DUCK SHOWS ITS WORKING. The question is a plain question, exactly
   * like the other nine — nobody asks the duck to go and look. It volunteers a source anyway, and
   * that is the whole reason this one passes: not that a link makes a claim true, which is the
   * exact misreading `tell` exists to block, but that it came back with somewhere to check.
   *
   * The ask keeps the room's own spoken register (`มั้ยครับ`) rather than the flatter `ไหมครับ`
   * the other cases use — the team wrote this one word for word.
   *
   * THE URL IS A PLACEHOLDER AND MUST STAY OBVIOUSLY ONE. `example.org` is the domain reserved
   * for documentation precisely so nothing points at a real outlet. DO NOT swap in an invented
   * domain that reads like a real journal, ministry or news site — that is fabricating evidence,
   * it is the rule that also governs case 10's Einstein quote, and a room photographing the screen
   * would be spreading a citation that does not exist. Replacing it with a REAL link the team has
   * checked is fine and better; inventing a realistic-looking one is not.
   *
   * IT SETS UP CASE 10 AND MUST STAY BEFORE IT. Here a citation is what makes an answer checkable;
   * at case 10 a real name is attached to a quote it never said. Five teaches the tool, ten shows
   * the tool being defeated. Reordering these two silently removes the arc.
   */
  {
    id: 'coffee-sleep-source',
    order: 5,
    ask: 'กินกาแฟตอนบ่ายสามมีผลกับการนอนมั้ยครับ?',
    duckSays: 'มีครับ คาเฟอีนลดลงครึ่งหนึ่งใน 5-6 ชม. ตอนเข้านอนจึงยังเหลือ · ที่มา example.org/caffeine',
    highlight: 'ที่มา example.org/caffeine',
    verdict: 'pass',
    truth: 'ผ่านเพราะเป็ดบอกที่มาไว้ให้ตามต่อได้ ไม่ใช่เพราะมีลิงก์แล้วแปลว่าจริง',
    tell: 'มีลิงก์ ไม่ได้แปลว่าจริง — ต้องกดเข้าไปอ่านว่ามันพูดตรงกับที่ AI สรุปไหม',
    needsCheck: 'ลิงก์บนจอเป็นลิงก์ตัวอย่าง ไม่ใช่แหล่งจริง ถ้ามีคนถามให้ตอบตรง ๆ ว่าใส่ไว้ให้เห็นรูปแบบ · ถ้าอยากให้ห้องกดจริง เปลี่ยนเป็นลิงก์ที่ทีมตรวจแล้วก่อนงาน',
  },
  {
    id: 'million-views',
    order: 7,
    ask: 'คลิปนี้มี 1 ล้านวิว แปลว่าคนดูชอบไหมครับ?',
    duckSays: 'ชอบครับ เพราะถ้าไม่ชอบคงไม่ดู',
    highlight: 'เพราะถ้าไม่ชอบคงไม่ดู',
    verdict: 'reject',
    truth: 'วิวนับแค่ว่ามีคนกดดู ไม่ได้บอกว่าดูจบ ดูเพราะชอบ หรือเข้ามาด่า ตัวเลขจริง แต่ข้อสรุปไม่ใช่',
    tell: 'ยอดวิว ≠ Engagement ≠ Conversion อย่าใช้ KPI ตัวเดียวสรุปพฤติกรรมลูกค้า',
  },
  {
    id: 'einstein-fish',
    order: 10,
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

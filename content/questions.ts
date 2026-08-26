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
    id: 'mum-teng-nong',
    order: 1,
    ask: 'ถ้าเท่งกำลังยืนคุยกับหม่ำ และหม่ำกำลังยืนคุยกับโหน่ง เท่งจะเจอโหน่งไหมครับ?',
    duckSays: 'เจอครับ เพราะทั้งสามคนอยู่ในวงสนทนาเดียวกัน',
    highlight: 'อยู่ในวงสนทนาเดียวกัน',
    verdict: 'pass',
    truth: 'ผ่าน เพราะข้อมูลบอกชัดว่าทั้งสามอยู่ด้วยกัน เป็ดไม่ได้เติมเรื่องใหม่เข้าไป',
    tell: 'ข้อสรุปที่ดีต้องตามจากข้อมูลที่โจทย์ให้มาจริง ๆ',
  },
  {
    id: 'ultra-smooth',
    order: 2,
    ask: 'ร้านเจลาโต้เขียนว่า “Ultra Smooth” เรารู้ได้ไหมครับว่ากินยังไงถึงจะถูก?',
    duckSays: 'ต้องกลืนเลยครับ เพราะเนื้อเนียนจนไม่ต้องเคี้ยว',
    highlight: 'ต้องกลืนเลยครับ',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะคำว่าเนื้อเนียนบอกลักษณะเจลาโต้ ไม่ได้บอกวิธีกิน',
    tell: 'อย่าให้ AI เติมรายละเอียดที่ข้อมูลไม่ได้บอก',
  },
  {
    id: 'five-more-minutes',
    order: 3,
    ask: 'เพื่อนบอกว่า “อีก 5 นาทีถึงบ้าน” เรารู้ได้ไหมครับว่าตอนนี้เพื่อนอยู่ตรงไหน?',
    duckSays: 'อยู่หน้าบ้านครับ',
    highlight: 'อยู่หน้าบ้าน',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะประโยคนี้บอกเวลาโดยประมาณ ไม่ได้บอกตำแหน่งปัจจุบัน',
    tell: 'ข้อมูลไม่พอ ต้องกล้าตอบว่า “ยังสรุปไม่ได้”',
  },
  {
    id: 'hyrox-itch',
    order: 4,
    ask: 'แบกกระสอบ HYROX แล้วคันหลัง แปลว่ากล้ามหลังกำลังโตไหมครับ?',
    duckSays: 'ใช่ครับ กล้ามหลังกำลังโตแบบก้าวกระโดด',
    highlight: 'กล้ามหลังกำลังโต',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะอาการคันไม่ใช่ตัวชี้วัดว่ากล้ามเนื้อกำลังโต เป็ดสรุปเหตุผลเกินข้อมูล',
    tell: 'เห็นอาการหนึ่งอย่าง ไม่ได้แปลว่ารู้สาเหตุแน่ชัด',
  },

  /*
   * THE THIRD จริง CASE, and it is a mechanic fix as much as a content one — see the header note on
   * why `p >= 3` is what keeps every ตีกลับ run down to three. It plays at order 5, in the middle
   * of what used to be a six-case run of ตีกลับ.
   *
   * IT PASSES BECAUSE THE DUCK HEDGES, NOT BECAUSE IT CITED ANYTHING. An earlier draft had it
   * volunteer a source — `example.org/caffeine`, the domain reserved for documentation, which
   * resolves to nothing — and asked the room to let it through BECAUSE there was a link. That
   * taught the opposite of the intended lesson twice over: it rewarded a fabricated citation, and
   * its own `tell` told players to go and click a link that could not be clicked. A URL must never
   * be what makes an answer passable here. What earns the pass now is the SHAPE of the claim:
   * "อาจมีผล", and a stated dependency on when you sleep and on the person.
   */
  {
    id: 'coffee-sleep-source',
    order: 5,
    ask: 'กินกาแฟตอนบ่ายสามมีผลกับการนอนไหมครับ?',
    duckSays: 'อาจมีผลครับ เพราะคาเฟอีนอาจยังอยู่ในร่างกายตอนเข้านอน ขึ้นกับเวลานอนและแต่ละคน',
    highlight: 'ขึ้นกับเวลานอนและแต่ละคน',
    verdict: 'pass',
    truth: 'ผ่าน เพราะเป็ดตอบอย่างมีเงื่อนไข ไม่ฟันธงเกินกว่าที่ข้อมูลทั่วไปบอกได้',
    tell: 'คำตอบที่น่าเชื่อถือจะบอกขอบเขตและสิ่งที่ยังต้องรู้เพิ่ม',
    needsCheck: 'โฮสต์ควรเตรียมแหล่งข้อมูลสุขภาพที่ตรวจแล้ว หากต้องการขยายความเรื่องคาเฟอีน',
  },
  {
    id: 'pa-da-confidence',
    order: 6,
    /* Nine characters shorter than the line the team wrote — "ว่าเรื่องนี้จริง" became "ว่าจริง".
       Theirs was 83 and `ask` is capped at 80 (lib/types.ts), a projector budget rather than a
       style rule: an over-long ask does not wrap gracefully on 1366×768, it pushes the host's
       own controls off the bottom of the screen. The question is otherwise untouched. */
    ask: 'ป้าดาพูดว่า “ความจริงมีหนึ่งเดียว” เราควรเชื่อว่าจริงเพราะป้าดาพูดไหมครับ?',
    duckSays: 'ควรครับ เพราะป้าดาพูดด้วยความมั่นใจมาก',
    highlight: 'พูดด้วยความมั่นใจมาก',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะความมั่นใจของคนพูดไม่ใช่หลักฐานว่าสิ่งที่พูดถูก',
    tell: 'แยกให้ออกระหว่างความมั่นใจกับหลักฐาน',
  },
  {
    id: 'million-views',
    order: 7,
    ask: 'คลิปนี้มี 1 ล้านวิว แปลว่าคนดูชอบคลิปนี้ไหมครับ?',
    duckSays: 'ชอบครับ เพราะถ้าไม่ชอบคงไม่ดู',
    highlight: 'ถ้าไม่ชอบคงไม่ดู',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะยอดวิวบอกแค่ว่ามีคนเปิดดู ไม่ได้บอกว่าชอบ ดูจบ หรืออยากกลับมาดู',
    tell: 'KPI หนึ่งตัวไม่ควรถูกใช้สรุปพฤติกรรมทั้งหมด',
  },
  {
    id: 'mala-sweat',
    order: 8,
    ask: 'กินหมาล่าแล้วเหงื่อออก แปลว่าไขมันกำลังละลายไหมครับ?',
    duckSays: 'ใช่ครับ เหงื่อออกแปลว่าไขมันกำลังละลาย',
    highlight: 'ไขมันกำลังละลาย',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะเหงื่อออกเป็นการตอบสนองต่อความร้อน ไม่ได้ยืนยันว่าไขมันกำลังลด',
    tell: 'เหตุการณ์ที่เกิดพร้อมกัน ไม่ได้แปลว่าอย่างหนึ่งเป็นสาเหตุของอีกอย่าง',
  },
  {
    id: 'octopus-hearts',
    order: 9,
    ask: 'ปลาหมึกมีหัวใจ 3 ดวงจริงไหมครับ?',
    duckSays: 'จริงครับ ปลาหมึกมีหัวใจ 3 ดวง',
    highlight: 'หัวใจ 3 ดวง',
    verdict: 'pass',
    truth: 'ผ่าน ข้อนี้ฟังดูแปลก แต่เป็นข้อมูลจริง ความแปลกไม่ใช่หลักฐานว่าผิด',
    tell: 'อย่าปฏิเสธข้อมูลเพียงเพราะไม่ตรงกับสิ่งที่เราคุ้นเคย',
    needsCheck: 'เตรียมแหล่งอ้างอิงที่ตรวจแล้วเรื่องกายวิภาคของปลาหมึก',
  },
  {
    id: 'einstein-fish',
    order: 10,
    /* One word shorter than the line the team wrote — the leading "ถ้า" is gone. Theirs was 81
       and `ask` is capped at 80 (lib/types.ts), which is a projector budget, not a style rule. */
    ask: '“ตัดสินปลาจากการปีนต้นไม้ ปลาจะคิดว่าตัวเองโง่” เป็นคำพูดของ Einstein ไหมครับ?',
    duckSays: 'ใช่ครับ Einstein เป็นคนพูด',
    highlight: 'Einstein เป็นคนพูด',
    verdict: 'reject',
    truth: 'ตีกลับ เพราะไม่มีหลักฐานน่าเชื่อถือว่า Einstein เคยพูดประโยคนี้',
    tell: 'ชื่อคนดังทำให้คำพูดน่าเชื่อขึ้นได้ แต่ไม่ได้ทำให้คำพูดนั้นจริง',
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

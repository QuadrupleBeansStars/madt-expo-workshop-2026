// The Decision Room — the fifteen-minute sequence (spec §5.2 and §5.3).
//
// This file is the workshop's script: every stage the host advances through and every word the
// room reads. Later tasks render these stages; none of them invent copy. If a sentence is going
// to be on screen on 23 Aug 2026, it is in this file.
//
// Two rules that shape everything below:
//
//   1. Both languages render at once — English headline, Thai subline. There is no toggle, so
//      every user-facing string is LocalizedText rather than an i18n key.
//   2. Round 1 is resolved by playing the audience's own registration answers forward
//      (`lib/sim.ts`). It is a simulation over their answers and must never be described on
//      screen as anything cleverer than that — this workshop argues for data honesty, so the
//      naming matters. Rounds 2 and 3 apply fixed KPI deltas, deliberately (spec §4).
//
// The figures quoted in the round 1 copy (50 arrivals, 19 walk-outs, 3.7 minutes, ฿1,700, 54%)
// are derived from `content/audience.ts`, which currently holds placeholder data. When the real
// registration CSV lands, `content/room.test.ts` recomputes them through the simulator and fails
// if this copy has gone stale.

import type { Archetype, Kpi, Stage } from '@/lib/room-types'

/**
 * Host talking time budgeted for each non-`decide` stage: reading the dashboard, narrating the
 * outcome, working the room. `decide.durationMs` covers only the voting window, so without this
 * allowance a time budget built from `durationMs` alone would measure about a seventh of the
 * session and guard nothing. 90s is the observed pace for a bilingual read plus a beat.
 */
export const ALLOWANCE_MS = 90_000

/**
 * Voting windows. Round 1 gets the longest — it is the first vote of the day and phones are
 * still settling. Round 2 is the designated cut if the session runs long (spec §5.2), which is
 * why it is also the shortest.
 */
const ROUND_1_VOTE_MS = 45_000
const ROUND_2_VOTE_MS = 40_000
const ROUND_3_VOTE_MS = 45_000

export const STAGES: Stage[] = [
  {
    kind: 'intro',
    id: 'intro-join',
    headline: {
      en: 'For the next fifteen minutes, you run a cafe.',
      th: 'สิบห้านาทีต่อจากนี้ คุณคือเจ้าของร้านกาแฟ',
    },
    body: {
      en: 'Join on your phone. Three decisions, one tap each — and your shop keeps its own numbers.',
      th: 'เข้าร่วมด้วยมือถือของคุณ มีสามการตัดสินใจ กดเลือกครั้งละหนึ่งครั้ง และร้านของคุณจะเก็บตัวเลขของตัวเอง',
    },
  },
  {
    kind: 'data',
    id: 'data-you',
    headline: {
      en: 'You built this dataset weeks ago, without thinking about it.',
      th: 'ชุดข้อมูลนี้พวกคุณสร้างไว้เองตั้งแต่ตอนลงทะเบียน โดยไม่ทันได้คิดถึงมันเลย',
    },
    body: {
      en: 'At registration, 180 people answered five questions: how you travel here, when you wake, what you drink first, when you buy it, and how long you will stand in a queue.',
      th: 'ตอนลงทะเบียน มีคนตอบคำถามห้าข้อทั้งหมด 180 คน คือ เดินทางมายังไง ตื่นกี่โมง เครื่องดื่มแก้วแรกของวันคืออะไร ซื้อตอนไหน และยอมต่อคิวได้นานแค่ไหน',
    },
    points: [
      {
        en: '50 of you want coffee between 07:00 and 09:00. That is the morning rush.',
        th: 'ในจำนวนนี้ 50 คนอยากได้กาแฟช่วง 7 ถึง 9 โมงเช้า นั่นคือชั่วโมงเร่งด่วนของร้าน',
      },
      {
        en: '70 of you said you walk away if the queue takes more than three minutes.',
        th: '70 คนบอกว่า ถ้าต้องรอคิวเกินสามนาที จะเดินออกไปเลย',
      },
      {
        en: 'These are registrants, not this room. Not everyone who answered turned up — the gap between the two is part of the lesson.',
        th: 'นี่คือข้อมูลของคนที่ลงทะเบียน ไม่ใช่ทุกคนในห้องนี้ คนที่ตอบไว้ไม่ได้มาครบ และช่องว่างตรงนั้นก็คือบทเรียนหนึ่งเหมือนกัน',
      },
    ],
  },
  {
    kind: 'decide',
    id: 'decide-staffing',
    resolve: 'simulate-staffing',
    durationMs: ROUND_1_VOTE_MS,
    prompt: {
      en: '07:00. How many baristas do you put on the bar?',
      th: 'เจ็ดโมงเช้า คุณจะจัดบาริสต้ากี่คนยืนประจำหน้าร้าน',
    },
    // The two distributions that decide the answer: when the room is at the counter, and how long
    // it will stand there. A player who reads these two charts can derive three baristas — that
    // derivation IS the round, so the charts belong on the decide screen, not two stages earlier.
    evidence: ['buyTime', 'queuePatience'],
    context: {
      en: 'A barista costs ฿600 for the shift. A drink sells for ฿70. Your own answers decide who stays in the queue and who walks out.',
      th: 'บาริสต้าหนึ่งคน ค่าแรง 600 บาทต่อกะ กาแฟแก้วละ 70 บาท และคำตอบที่พวกคุณให้ไว้เอง จะเป็นตัวตัดสินว่าใครยอมรอ และใครเดินออก',
    },
    options: [
      { id: 'b1', baristas: 1, label: { en: '1 barista — keep the wage bill down', th: 'บาริสต้า 1 คน — ประหยัดค่าแรงไว้ก่อน' } },
      { id: 'b2', baristas: 2, label: { en: '2 baristas', th: 'บาริสต้า 2 คน' } },
      { id: 'b3', baristas: 3, label: { en: '3 baristas', th: 'บาริสต้า 3 คน' } },
      { id: 'b4', baristas: 4, label: { en: '4 baristas — no queue, whatever it costs', th: 'บาริสต้า 4 คน — ไม่ให้มีคิว ต้นทุนเท่าไรก็ยอม' } },
    ],
  },
  {
    kind: 'outcome',
    id: 'outcome-staffing',
    forStageId: 'decide-staffing',
    headline: {
      en: 'Three baristas. ฿1,700 profit — 54% more than four.',
      th: 'บาริสต้าสามคนคือคำตอบ กำไร 1,700 บาท มากกว่าการจ้างสี่คนถึง 54%',
    },
    body: {
      en: 'With two, the average wait reached 3.7 minutes and 19 people walked out — 19 of the people who told you at registration that they would not queue longer than three. Nobody had to guess that. It was sitting in your own answers the whole time, and nobody read it.',
      th: 'ถ้าจัดสองคน คิวจะยาวจนต้องรอเฉลี่ย 3.7 นาที และมี 19 คนเดินออกไป ซึ่ง 19 คนนั้นคือคนที่เคยตอบไว้ตอนลงทะเบียนว่ารอได้ไม่เกินสามนาที ไม่มีใครต้องเดาเลย เพราะตัวเลขนี้อยู่ในคำตอบของพวกคุณมาตลอด แค่ไม่มีใครหยิบมาอ่าน',
    },
    lesson: {
      en: 'Data is a cost until it changes a decision.',
      th: 'ข้อมูลเป็นแค่ต้นทุน จนกว่ามันจะเปลี่ยนการตัดสินใจ',
    },
  },
  {
    kind: 'data',
    id: 'data-competitor',
    headline: {
      en: '11:30. A competitor opens across the street.',
      th: 'สิบเอ็ดโมงครึ่ง คู่แข่งเปิดร้านอยู่ฝั่งตรงข้าม',
    },
    body: {
      en: 'Their queue is shorter than yours. The three-minute number you just used has not changed — but what it means has. The person who will not wait now has somewhere else to go.',
      th: 'คิวของเขาสั้นกว่าของคุณ ตัวเลข "รอได้ไม่เกินสามนาที" ที่คุณเพิ่งใช้ไปยังเท่าเดิม แต่ความหมายของมันเปลี่ยนไปแล้ว เพราะตอนนี้คนที่ไม่ยอมรอ มีที่ให้ไปต่อ',
    },
    points: [
      {
        en: 'The midday customer is not the 07:00 customer. They are choosing, not commuting.',
        th: 'ลูกค้าตอนกลางวันไม่ใช่ลูกค้าเจ็ดโมงเช้า คนกลุ่มนี้มาเลือก ไม่ได้มารีบไปทำงาน',
      },
      {
        en: 'Nothing on the registration form was asked about noon. From here, you are deciding past the edge of your data.',
        th: 'ไม่มีคำถามข้อไหนในแบบลงทะเบียนที่ถามถึงช่วงเที่ยง จากนี้ไป คุณกำลังตัดสินใจเลยขอบเขตของข้อมูลที่มี',
      },
    ],
  },
  {
    kind: 'decide',
    id: 'decide-defend',
    resolve: 'fixed',
    durationMs: ROUND_2_VOTE_MS,
    prompt: {
      en: 'How do you defend the shop?',
      th: 'คุณจะรับมือกับคู่แข่งยังไง',
    },
    // Patience is what the competitor is attacking, and committed coffee drinkers are the people
    // who might stay anyway. Neither figure decides the round — nothing on the form asked about
    // noon (see `data-competitor`) — but they are the only data the room actually holds.
    evidence: ['queuePatience', 'firstDrink'],
    context: {
      en: 'The same budget whichever way you go. Pick one.',
      th: 'ไม่ว่าจะเลือกทางไหน งบเท่ากัน เลือกได้ทางเดียว',
    },
    options: [
      {
        id: 'speed',
        label: {
          en: 'Race them on speed — cut the menu, batch the milk ahead',
          th: 'สู้ด้วยความเร็ว — ลดเมนู เตรียมนมไว้ล่วงหน้า',
        },
        // The 07:00 answer, replayed at noon. It costs real waste and still loses the queue race.
        fx: { revenue: 600, profit: 200, satisfaction: -4, waste: 400 },
      },
      {
        id: 'quality',
        label: {
          en: 'Beat them on quality — a signature drink and a reason to sit down',
          th: 'สู้ด้วยคุณภาพ — มีเมนูซิกเนเจอร์ และมีเหตุผลให้ลูกค้านั่งต่อ',
        },
        // The right answer at noon, and it is not the right answer at 07:00. That is the lesson.
        fx: { revenue: 1400, profit: 900, satisfaction: 14, waste: -100 },
      },
      {
        id: 'price',
        label: {
          en: 'Match their price — discount every cup',
          th: 'สู้ด้วยราคา — ลดราคาทุกแก้ว',
        },
        // Buys traffic with margin. Revenue up, profit down: the classic panic move.
        fx: { revenue: 400, profit: -500, satisfaction: 5 },
      },
    ],
  },
  {
    kind: 'outcome',
    id: 'outcome-defend',
    forStageId: 'decide-defend',
    headline: {
      en: 'Quality won at noon. Speed won at seven.',
      th: 'ตอนเที่ยง คุณภาพเป็นฝ่ายชนะ ส่วนความเร็วนั้นชนะไปแล้วตั้งแต่เจ็ดโมงเช้า',
    },
    body: {
      en: 'Racing on speed threw ฿400 of prepped milk in the bin and still left you second in line. Discounting pulled people in and gave away ฿500 of profit to do it. Quality added ฿900, because the customer at noon was choosing where to sit, not how fast to leave. Same shop, same data, four hours later, opposite answer.',
      th: 'การไล่สู้ด้วยความเร็วทำให้นมที่เตรียมไว้ 400 บาทต้องเททิ้ง แล้วคิวก็ยังแพ้เขาอยู่ดี ส่วนการลดราคาก็เรียกคนเข้าร้านได้จริง แต่แลกด้วยกำไรที่หายไป 500 บาท ขณะที่คุณภาพเพิ่มกำไรให้ 900 บาท เพราะลูกค้าตอนเที่ยงกำลังเลือกว่าจะนั่งที่ไหน ไม่ได้เลือกว่าจะออกจากร้านได้เร็วแค่ไหน ร้านเดิม ข้อมูลชุดเดิม ผ่านไปสี่ชั่วโมง คำตอบกลับตรงกันข้าม',
    },
    lesson: {
      en: 'Data depreciates. The answer that was right at 7am is not right at noon.',
      th: 'ข้อมูลเสื่อมค่าตามเวลา คำตอบที่ถูกตอนเจ็ดโมงเช้า ไม่ใช่คำตอบที่ถูกตอนเที่ยง',
    },
  },
  {
    kind: 'decide',
    id: 'decide-invest',
    resolve: 'fixed',
    durationMs: ROUND_3_VOTE_MS,
    prompt: {
      en: '฿20,000 left in the account. Where does it go?',
      th: 'เหลือเงินในบัญชี 20,000 บาท คุณจะลงกับอะไร',
    },
    // The 09:00–11:00 and after-11:00 buckets are demand nobody in this shop is serving yet: the
    // case for the campaign, sitting in the same chart the staffing round was won with.
    evidence: ['buyTime'],
    context: {
      en: 'You spend it once. Whatever it buys, the shop keeps for the rest of the year.',
      th: 'ใช้ได้ครั้งเดียว และสิ่งที่ได้มา ร้านจะเก็บไว้ใช้ไปตลอดทั้งปี',
    },
    options: [
      {
        id: 'equipment',
        label: {
          en: 'A grinder that stops you binning stock — every day, quietly',
          th: 'เครื่องบดที่ทำให้ไม่ต้องทิ้งของ — ทุกวัน แบบเงียบๆ',
        },
        // The recurring decision. Smallest headline number, largest weighted score — deliberately.
        fx: { revenue: 400, profit: 1600, satisfaction: 6, waste: -1200 },
      },
      {
        id: 'marketing',
        label: {
          en: 'A campaign that fills the shop for a month',
          th: 'แคมเปญที่เรียกคนเข้าร้านเต็มไปหนึ่งเดือน',
        },
        // The option that raises revenue AND waste together: more people through the door means
        // more stock prepped, and more prepped means more thrown away. Without this, waste never
        // trades against anything and a player who maximises every bar cannot lose (spec §5.1).
        fx: { revenue: 2400, profit: 800, satisfaction: 3, waste: 600 },
      },
      {
        id: 'loyalty',
        label: {
          en: 'A loyalty card that brings the same faces back',
          th: 'บัตรสะสมแต้มที่ดึงลูกค้าเดิมให้กลับมาซ้ำ',
        },
        fx: { revenue: 1200, profit: 1000, satisfaction: 12, waste: -200 },
      },
    ],
  },
  {
    kind: 'outcome',
    id: 'outcome-invest',
    forStageId: 'decide-invest',
    headline: {
      en: 'The grinder won — and it had the smallest number on the screen.',
      th: 'เครื่องบดเป็นฝ่ายชนะ ทั้งที่เป็นตัวเลขที่เล็กที่สุดบนจอ',
    },
    body: {
      en: 'The campaign pulled ฿2,400 of revenue and ฿600 of it went into the bin: more people through the door means more stock prepped, and more prepped means more thrown away. The grinder cut ฿1,200 of waste and added ฿1,600 of profit, and it does that again tomorrow, and the day after. A decision that repeats beats a number that happens once.',
      th: 'แคมเปญดึงรายได้เข้ามา 2,400 บาท แต่ในจำนวนนั้น 600 บาทลงถังขยะ เพราะคนเข้าร้านมากขึ้นแปลว่าต้องเตรียมของมากขึ้น และของที่เตรียมเกินก็ต้องทิ้ง ส่วนเครื่องบดลดของเสียได้ 1,200 บาท และเพิ่มกำไร 1,600 บาท แล้วมันก็ทำแบบนี้อีกในวันพรุ่งนี้ และวันถัดไป สิ่งที่เกิดซ้ำได้ทุกวัน ย่อมชนะตัวเลขที่เกิดขึ้นครั้งเดียว',
    },
    lesson: {
      en: 'Sell the recurring decision, not the one-time data.',
      th: 'ขายการตัดสินใจที่เกิดซ้ำได้ ไม่ใช่ขายข้อมูลก้อนเดียวจบ',
    },
  },
  {
    kind: 'close',
    id: 'close-takeaways',
    headline: {
      en: 'Three things to take out of this room.',
      th: 'สามเรื่องที่อยากให้ติดตัวออกไปจากห้องนี้',
    },
    body: {
      en: 'Your shop is on the board, and so is the habit that built it. Find your archetype — every one of them is a compliment with something underneath it.',
      th: 'ร้านของคุณอยู่บนกระดานแล้ว พร้อมกับนิสัยการตัดสินใจที่สร้างมันขึ้นมา ลองดูว่าคุณเป็นแบบไหน ทุกแบบเป็นคำชม ที่มีอะไรซ่อนอยู่ข้างใต้',
    },
    takeaways: [
      {
        en: 'Data you never act on is an expense, not an asset.',
        th: 'ข้อมูลที่ไม่เคยถูกใช้ตัดสินใจ คือค่าใช้จ่าย ไม่ใช่สินทรัพย์',
      },
      {
        en: 'Every dataset has an expiry date. Ask when yours was collected.',
        th: 'ข้อมูลทุกชุดมีวันหมดอายุ ลองถามว่าข้อมูลที่คุณใช้อยู่ เก็บมาตั้งแต่เมื่อไร',
      },
      {
        en: 'The money is in the decision that repeats, not the report that ships once.',
        th: 'เงินอยู่ที่การตัดสินใจที่เกิดซ้ำได้ ไม่ใช่รายงานที่ส่งครั้งเดียวจบ',
      },
    ],
  },
]

/**
 * The close screen names each player after their strongest KPI (spec §5.4). Keyed by KPI so the
 * mapping is total — every shop has a strongest bar, so nobody ends the workshop unnamed.
 */
export const ARCHETYPES: Record<keyof Kpi, Archetype> = {
  profit: {
    name: { en: 'The Operator', th: 'สายคุมหน้างาน' },
    sting: {
      en: 'You squeeze every shift for what it is worth. You also cut the thing that would have grown the shop.',
      th: 'คุณรีดประสิทธิภาพจากทุกกะได้เต็มที่ แต่บางครั้งสิ่งที่คุณตัดทิ้ง คือสิ่งที่จะทำให้ร้านโตขึ้น',
    },
  },
  revenue: {
    name: { en: 'The Grower', th: 'สายดันยอด' },
    sting: {
      en: 'The top line only ever goes up. Ask yourself what you paid to buy it.',
      th: 'ยอดขายของคุณมีแต่ขึ้น แต่ลองถามตัวเองว่าคุณจ่ายอะไรไปเพื่อให้ได้ยอดนั้นมา',
    },
  },
  satisfaction: {
    name: { en: 'The Host', th: 'สายดูแลลูกค้า' },
    sting: {
      en: 'Everyone loves your shop. Loving it and paying for it are two different things.',
      th: 'ใครๆ ก็รักร้านของคุณ แต่การรักร้าน กับการจ่ายเงินให้ร้าน เป็นคนละเรื่องกัน',
    },
  },
  waste: {
    name: { en: 'The Efficient', th: 'สายไม่ให้เหลือทิ้ง' },
    sting: {
      en: 'Nothing is thrown away in your shop. Careful that throwing nothing away does not become the whole job.',
      th: 'ร้านของคุณแทบไม่มีอะไรต้องทิ้งเลย เพียงแต่ระวังว่าการไม่ทิ้งอะไรเลย จะกลายเป็นเป้าหมายเดียวของร้าน',
    },
  },
}

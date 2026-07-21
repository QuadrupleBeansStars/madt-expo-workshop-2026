import type { Slide } from '@/lib/deck-types'

const POLL_MS = 25_000
const VOTE_MS = 45_000

/**
 * The 15-minute deck. Order is presentation order; `lib/deck.ts` indexes into it.
 *
 * The three hook polls are not arbitrary: together they yield arrival time +
 * arrival mode + morning beverage, which is exactly the input to a cafe's
 * morning staffing decision. Beats 1-3 then reuse that one dataset.
 */
export const DECK: Slide[] = [
  {
    kind: 'poll',
    id: 'hook-transport',
    prompt: { th: 'วันนี้คุณเดินทางมาที่นี่อย่างไร?', en: 'How did you get here today?' },
    durationMs: POLL_MS,
    options: [
      { id: 'walk', label: { th: 'เดินมา', en: 'Walked' } },
      { id: 'train', label: { th: 'BTS / MRT', en: 'BTS / MRT' } },
      { id: 'car', label: { th: 'รถยนต์', en: 'Car' } },
      { id: 'moto', label: { th: 'มอเตอร์ไซค์', en: 'Motorbike' } },
    ],
  },
  {
    kind: 'poll',
    id: 'hook-wake',
    prompt: { th: 'เช้านี้คุณตื่นกี่โมง?', en: 'What time did you wake up?' },
    durationMs: POLL_MS,
    options: [
      { id: 'before6', label: { th: 'ก่อน 6 โมง', en: 'Before 6' } },
      { id: '6to8', label: { th: '6–8 โมง', en: '6–8' } },
      { id: '8to10', label: { th: '8–10 โมง', en: '8–10' } },
      { id: 'after10', label: { th: 'หลัง 10 โมง', en: 'After 10' } },
    ],
  },
  {
    kind: 'poll',
    id: 'hook-drink',
    prompt: { th: 'วันนี้คุณดื่มอะไรเป็นอย่างแรก?', en: 'What did you drink first today?' },
    durationMs: POLL_MS,
    options: [
      { id: 'coffee', label: { th: 'กาแฟ', en: 'Coffee' } },
      { id: 'tea', label: { th: 'ชา', en: 'Tea' } },
      { id: 'water', label: { th: 'น้ำเปล่า', en: 'Water' } },
      { id: 'nothing', label: { th: 'ยังไม่ได้ดื่มอะไร', en: 'Nothing yet' } },
    ],
  },

  // ---- Beat 1: data in business ----
  {
    kind: 'vote',
    id: 'beat1-worth',
    prompt: {
      th: 'ชุดข้อมูลที่เราเพิ่งสร้างขึ้นนี้ มีมูลค่าเท่าไร?',
      en: 'What is the dataset we just built worth?',
    },
    durationMs: VOTE_MS,
    bestOptionId: 'depends',
    options: [
      { id: 'zero', label: { th: '฿0', en: '฿0' } },
      { id: 'small', label: { th: '฿2,000', en: '฿2,000' } },
      { id: 'big', label: { th: '฿200,000', en: '฿200,000' } },
      { id: 'depends', label: { th: 'แล้วแต่ว่าใครซื้อ', en: "Depends who's buying" } },
    ],
  },
  {
    kind: 'reveal',
    id: 'beat1-reveal',
    forSlideId: 'beat1-worth',
    headline: {
      th: 'ตอนนี้มันมีค่า ฿0',
      en: 'Right now, it is worth ฿0',
    },
    body: {
      th: '“แล้วแต่ว่าใครซื้อ” ใกล้เคียงแล้ว — แต่ให้แม่นกว่านั้น: มันขึ้นอยู่กับว่าใครมี “การตัดสินใจ” ที่ต้องทำ ตอนนี้ยังไม่มีใครในห้องนี้ทำอะไรต่างไปเพราะข้อมูลชุดนี้เลย มันจึงมีค่า ฿0 แต่ร้านกาแฟข้างล่างต้องตัดสินใจพรุ่งนี้เช้าว่าจะจัดพนักงานกี่คนตอน 7 โมง',
      en: '“Depends who’s buying” is close — but sharpen it: it depends who has a decision to make. Nobody in this room has done anything differently because of this data, so it is worth ฿0. But the cafe downstairs has to decide how many staff to roster at 7am tomorrow.',
    },
    lesson: {
      th: 'ข้อมูลดิบคือ “ต้นทุน” ไม่ใช่ “สินทรัพย์”',
      en: 'Raw data is a cost, not an asset.',
    },
  },

  // ---- Beat 2: data strategy ----
  {
    kind: 'vote',
    id: 'beat2-decision',
    prompt: {
      th: 'ถ้าคุณเป็นเจ้าของร้านกาแฟนั้น ข้อมูลชุดนี้เปลี่ยน “การตัดสินใจ” ข้อไหนได้จริง?',
      en: 'You run that cafe. Which decision does this data actually change?',
    },
    durationMs: VOTE_MS,
    bestOptionId: 'staffing',
    options: [
      { id: 'menu', label: { th: 'จะขายอะไรในเมนู', en: "What's on the menu" } },
      { id: 'staffing', label: { th: 'จัดพนักงานกี่คนตอน 7 โมง', en: 'How many staff at 7am' } },
      { id: 'branch', label: { th: 'จะเปิดสาขาที่ 2 ที่ไหน', en: 'Where to open branch #2' } },
      { id: 'price', label: { th: 'จะตั้งราคาเท่าไร', en: 'What to charge' } },
    ],
  },
  {
    kind: 'reveal',
    id: 'beat2-reveal',
    forSlideId: 'beat2-decision',
    headline: {
      th: 'มีแค่ “การจัดพนักงาน” เท่านั้น',
      en: 'Only the staffing decision',
    },
    body: {
      th: 'เวลาตื่น + วิธีเดินทาง บอก “รูปร่าง” ของช่วงเร่งด่วนตอนเช้าได้ ส่วนอีกสามข้อต้องใช้ข้อมูลที่เราไม่มีและหาไม่ได้จากชุดนี้ ทำไมงาน Data Strategy ส่วนใหญ่ถึงล้มเหลว? เพราะเก็บข้อมูลรูปแบบ “จะเปิดสาขาที่ไหน” มาตอบคำถามรูปแบบ “จัดพนักงานกี่คน”',
      en: 'Wake time + arrival mode gives you the shape of the morning rush. The other three need data you do not have and cannot derive from this. Most data strategy fails exactly here: it collects branch-location-shaped data to answer a staffing-shaped question.',
    },
    lesson: {
      th: 'กลยุทธ์ = จับคู่ “ข้อมูลที่เก็บได้” กับ “การตัดสินใจที่คุณคุมได้”',
      en: 'Strategy is matching data you can collect to a decision you control.',
    },
  },

  // ---- Beat 3: monetization ----
  {
    kind: 'vote',
    id: 'beat3-money',
    prompt: {
      th: 'ร้านกาแฟอยากได้ข้อมูลนี้ คุณจะคิดเงินอย่างไร?',
      en: 'The cafe wants it. How do you charge?',
    },
    durationMs: VOTE_MS,
    bestOptionId: 'revshare',
    options: [
      { id: 'once', label: { th: 'ขายขาดครั้งเดียว ฿5,000', en: 'Sell it once, ฿5,000' } },
      { id: 'subscription', label: { th: 'ขายรายงานรายเดือน ฿3,000/เดือน', en: 'Monthly forecast, ฿3,000/mo' } },
      { id: 'revshare', label: { th: 'ให้ฟรี แล้วขอส่วนแบ่ง 5% จากรายได้ที่เพิ่มขึ้น', en: 'Free, take 5% of the uplift' } },
    ],
  },
  {
    kind: 'reveal',
    id: 'beat3-reveal',
    forSlideId: 'beat3-money',
    headline: {
      th: 'ตัวเลือกที่ชัดเจนที่สุด คือตัวเลือกที่แย่ที่สุด',
      en: 'The obvious option is the worst one',
    },
    body: {
      th: 'ขายขาดครั้งเดียว = คุณส่งมอบสินทรัพย์ไปแล้ว และเขาไม่ต้องการคุณอีกเลย แต่ช่วงเร่งด่วนของสัปดาห์หน้าไม่เหมือนสัปดาห์นี้ — ข้อมูลเสื่อมค่าลงเรื่อย ๆ ในขณะที่ “การตัดสินใจ” นั้นเกิดซ้ำทุกวันไม่มีวันจบ ส่วนแบ่งรายได้คือคำตอบที่ลึกที่สุด เพราะคุณได้เงินตามมูลค่าที่คุณสร้างขึ้นจริง',
      en: 'Sell once and you have handed over the asset — they never need you again. But next week’s rush is different: data depreciates, while the decision recurs forever. The revenue share is the sophisticated answer, because you get paid in proportion to the value you actually created.',
    },
    lesson: {
      th: 'ขาย “การตัดสินใจที่เกิดซ้ำ” ไม่ใช่ “ข้อมูลครั้งเดียว”',
      en: 'Monetize the recurring decision, not the one-time data.',
    },
  },

  {
    kind: 'content',
    id: 'close',
    headline: { th: 'สรุป 3 ข้อ', en: 'Three things to take away' },
    bullets: [
      { th: 'Data in business — ข้อมูลดิบคือต้นทุน ไม่ใช่สินทรัพย์', en: 'Data in business — raw data is a cost, not an asset' },
      { th: 'Data strategy — หา “การตัดสินใจ” ให้เจอก่อน แล้วค่อยย้อนกลับมาเก็บข้อมูล', en: 'Data strategy — find the decision first, collect backwards' },
      { th: 'Monetization — ขายการตัดสินใจที่เกิดซ้ำ ไม่ใช่ข้อมูลครั้งเดียว', en: 'Monetization — sell the recurring decision, not the one-time data' },
    ],
  },
]

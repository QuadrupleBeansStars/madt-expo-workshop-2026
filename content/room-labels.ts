// The Decision Room — bilingual labels for everything the projector renders that is NOT the
// stage script.
//
// `content/room.ts` holds the script: every sentence the host reads. This file holds the words
// around it — the bucket names on the registration charts, the labels on the causal chain, and
// the chrome on the board. They are separated because the script is signed off as copy, while
// these are captions on data that only exist because a chart needs an axis.
//
// `content/audience.ts` deliberately carries bucket KEYS only (`walk`, `7to9`, `under3`) and no
// prose, so the CSV importer never has to touch copy. The bilingual reading of each key lives
// here, taken verbatim from the registration form in `docs/registration-questions.md` (B1-B5) —
// the room must recognise the words it tapped weeks ago.
//
// Both languages always render at once. Nothing here takes, or implies, a `lang` prop.

import type { LocalizedText } from '@/lib/types'

type Labels = Record<string, LocalizedText>

/**
 * The staffing level the round 1 outcome copy narrates.
 *
 * `outcome-staffing`'s body in `content/room.ts` tells the two-barista story (3.7 minutes,
 * 19 walk-outs) even though three baristas is the winning answer — the cautionary case is the
 * teaching, the winner is the punchline. The causal chain on that screen therefore has to show
 * the SAME staffing level the sentence beneath it describes.
 *
 * A named constant rather than a derivation (e.g. "one below the profit optimum") on purpose: if
 * the real registration CSV moves the optimum, a derivation would quietly pick a different level
 * than the body copy narrates and nobody would notice. Here the coupling is visible, and
 * `content/room.test.ts` already pins the copy's figures to `simulateStaffing(2, AUDIENCE)`.
 */
export const NARRATED_BARISTAS = 2

/** The five registration questions, as they appeared on the form. */
export const QUESTIONS: Record<
  'arrivalMode' | 'wakeTime' | 'firstDrink' | 'buyTime' | 'queuePatience',
  LocalizedText
> = {
  arrivalMode: {
    en: 'How will you travel to the expo?',
    th: 'คุณจะเดินทางมางานอย่างไร?',
  },
  wakeTime: {
    en: 'What time do you usually wake up on a weekday?',
    th: 'ปกติวันธรรมดาคุณตื่นกี่โมง?',
  },
  firstDrink: {
    en: 'What is the first thing you drink in the morning?',
    th: 'เช้ามาคุณดื่มอะไรเป็นอย่างแรก?',
  },
  buyTime: {
    en: 'When do you usually buy your first drink of the day?',
    th: 'ปกติคุณซื้อเครื่องดื่มแก้วแรกของวันตอนกี่โมง?',
  },
  queuePatience: {
    en: 'How long would you wait in line for coffee before giving up?',
    th: 'คุณจะยอมต่อคิวกาแฟนานแค่ไหนก่อนจะเลิกซื้อ?',
  },
}

/** B1 — travel mode. */
export const ARRIVAL_MODE_LABELS: Labels = {
  walk: { en: 'Walk', th: 'เดินมา' },
  train: { en: 'BTS / MRT', th: 'รถไฟฟ้า BTS / MRT' },
  car: { en: 'Car', th: 'รถยนต์' },
  moto: { en: 'Motorbike', th: 'มอเตอร์ไซค์' },
}

/** B2 — wake time. */
export const WAKE_TIME_LABELS: Labels = {
  before6: { en: 'Before 6', th: 'ก่อน 6 โมง' },
  '6to8': { en: '6–8', th: '6–8 โมง' },
  '8to10': { en: '8–10', th: '8–10 โมง' },
  after10: { en: 'After 10', th: 'หลัง 10 โมง' },
}

/** B3 — first drink of the day. */
export const FIRST_DRINK_LABELS: Labels = {
  coffee: { en: 'Coffee', th: 'กาแฟ' },
  tea: { en: 'Tea', th: 'ชา' },
  water: { en: 'Water', th: 'น้ำเปล่า' },
  nothing: { en: 'Nothing', th: 'ยังไม่ได้ดื่มอะไร' },
}

/** B4 — when they are at the counter. The question the whole simulation turns on. */
export const BUY_TIME_LABELS: Labels = {
  before7: { en: 'Before 07:00', th: 'ก่อน 7 โมง' },
  '7to9': { en: '07:00–09:00', th: '7–9 โมง' },
  '9to11': { en: '09:00–11:00', th: '9–11 โมง' },
  after11: { en: 'After 11:00', th: 'หลัง 11 โมง' },
  never: { en: 'I don’t buy', th: 'ไม่ได้ซื้อ' },
}

/** B5 — queue patience. The answer that decides who walks out. */
export const QUEUE_PATIENCE_LABELS: Labels = {
  under3: { en: 'Under 3 minutes', th: 'ไม่เกิน 3 นาที' },
  '3to5': { en: '3–5 minutes', th: '3–5 นาที' },
  '5to10': { en: '5–10 minutes', th: '5–10 นาที' },
  any: { en: 'As long as it takes', th: 'รอได้เรื่อย ๆ' },
}

/**
 * The causal chain on the round 1 outcome screen — the most important screen in the workshop.
 *
 * Two labels here are load-bearing and were written against `lib/sim.ts`, not guessed:
 *
 *   - `capacity` is what the bar could MAKE in the two hours (49 at two baristas), which is not
 *     the same as what it served (31). Labelling it "could serve" would put a number on screen
 *     that the sentence underneath contradicts.
 *   - `waitMinutes` is a shop-throughput figure — the time you stand in the queue — NOT how long
 *     one drink takes to make (see the note at lib/sim.ts's `averageWait`). The label says queue.
 */
export const TRACE_LABELS = {
  arrivals: {
    en: 'wanted coffee between 07:00 and 09:00',
    th: 'อยากได้กาแฟช่วง 7 ถึง 9 โมงเช้า',
  },
  capacity: {
    en: 'drinks the bar could make in those two hours',
    th: 'จำนวนแก้วที่บาร์ทำได้จริงในสองชั่วโมงนั้น',
  },
  served: {
    en: 'got their coffee',
    th: 'ได้กาแฟกลับไป',
  },
  lostToQueue: {
    en: 'walked out — the queue passed the wait they told you they would accept',
    th: 'เดินออกไป เพราะคิวนานเกินเวลาที่เขาบอกไว้เองว่ารอได้',
  },
  stillQueuing: {
    en: 'still in line when the rush ended',
    th: 'ยังต่อคิวอยู่ตอนที่ชั่วโมงเร่งด่วนจบลง',
  },
  waitMinutes: {
    en: 'minutes in the queue, on average',
    th: 'นาที คือเวลารอคิวโดยเฉลี่ย',
  },
} satisfies Record<string, LocalizedText>

/** Chrome: the words around the numbers. Short enough to read from the back of the room. */
export const UI = {
  joinTitle: { en: 'Join on your phone', th: 'เข้าร่วมด้วยมือถือของคุณ' },
  scanHint: { en: 'Scan, or type the address', th: 'สแกน หรือพิมพ์ที่อยู่นี้' },
  inTheRoom: { en: 'shops open', th: 'ร้านที่เปิดแล้ว' },
  waitingForHost: { en: 'Waiting for the host to start.', th: 'รอผู้ดำเนินรายการเริ่ม' },
  votesIn: { en: 'votes in', th: 'โหวตเข้ามาแล้ว' },
  votingOpen: { en: 'Voting is open', th: 'เปิดให้โหวต' },
  votingClosed: { en: 'Voting closed', th: 'ปิดโหวตแล้ว' },
  seconds: { en: 'seconds left', th: 'วินาที' },
  whatHappened: { en: 'What happened', th: 'เกิดอะไรขึ้น' },
  // Rendered after the staffing number so the copy never hardcodes a level that NARRATED_BARISTAS
  // could move away from: "2 baristas on the bar".
  baristasOnBar: { en: 'baristas on the bar', th: 'บาริสต้ายืนประจำหน้าร้าน' },
  accounting: {
    en: 'Everyone is accounted for: served + walked out + still in line = arrived.',
    th: 'ทุกคนถูกนับครบ คนที่ได้กาแฟ + คนที่เดินออก + คนที่ยังต่อคิว = คนที่มาทั้งหมด',
  },
  whatEachChoiceDid: { en: 'What each choice did', th: 'แต่ละทางเลือกให้ผลอย่างไร' },
  theLesson: { en: 'The lesson', th: 'บทเรียน' },
  leaderboard: { en: 'The board', th: 'กระดานอันดับ' },
  noShopsYet: { en: 'No shops on the board yet.', th: 'ยังไม่มีร้านขึ้นกระดาน' },
  score: { en: 'score', th: 'คะแนน' },
  yourArchetype: { en: 'Which one are you?', th: 'คุณเป็นแบบไหน' },
  outsideTheData: {
    en: 'Nothing on the registration form was asked about noon.',
    th: 'ไม่มีคำถามข้อไหนในแบบลงทะเบียนที่ถามถึงช่วงเที่ยง',
  },
  hostToken: { en: 'Host token', th: 'รหัสผู้ดำเนินรายการ' },
  advance: { en: 'Next', th: 'ถัดไป' },
  tokenMissing: {
    en: 'Enter the host token before advancing.',
    th: 'ใส่รหัสผู้ดำเนินรายการก่อนกดถัดไป',
  },
  tokenWrong: {
    en: 'Wrong host token — the room did not advance.',
    th: 'รหัสผู้ดำเนินรายการไม่ถูกต้อง ห้องยังไม่ได้ไปต่อ',
  },
  offline: {
    en: 'Reconnecting — showing the last screen received.',
    th: 'กำลังเชื่อมต่อใหม่ กำลังแสดงหน้าจอล่าสุดที่ได้รับ',
  },
} satisfies Record<string, LocalizedText>

/**
 * The phone (`app/play`). Two hundred of these are held at arm's length in a dark room for
 * fifteen minutes, so every string here is short, plain, and reads the same in both scripts.
 *
 * Separate from `UI` because the audiences differ: `UI` is read from the back of a lecture hall
 * off a projector, this is read at arm's length by one person who also has to tap it. Nothing
 * here narrates the workshop — the script stays on the big screen, which is exactly what
 * `lookUp` tells the player.
 */
export const PHONE = {
  joinTitle: { en: 'Run your own cafe', th: 'เปิดร้านกาแฟของคุณเอง' },
  joinBlurb: {
    en: 'Three decisions, one tap each. Your shop keeps its own numbers.',
    th: 'มีสามการตัดสินใจ กดเลือกครั้งละหนึ่งครั้ง และร้านของคุณจะเก็บตัวเลขของตัวเอง',
  },
  namePrompt: { en: 'Name your shop', th: 'ตั้งชื่อร้านของคุณ' },
  joinButton: { en: 'Open the shop', th: 'เปิดร้าน' },
  joining: { en: 'Opening…', th: 'กำลังเปิดร้าน…' },
  nameRequired: { en: 'Type a name first.', th: 'พิมพ์ชื่อก่อนนะ' },
  joinFailed: {
    en: 'Could not join. Check the Wi-Fi and tap again.',
    th: 'เข้าร่วมไม่สำเร็จ ลองเช็ก Wi-Fi แล้วกดอีกครั้ง',
  },
  roomReset: {
    en: 'The room started over. Join again to keep your seat.',
    th: 'ห้องเริ่มรอบใหม่แล้ว เข้าร่วมอีกครั้งเพื่อเล่นต่อ',
  },
  lookUp: { en: 'Look at the big screen.', th: 'มองไปที่จอใหญ่' },
  waiting: { en: 'Waiting for the host.', th: 'รอผู้ดำเนินรายการ' },
  yourShop: { en: 'Your shop', th: 'ร้านของคุณ' },
  rank: { en: 'Rank', th: 'อันดับ' },
  ofShops: { en: 'of', th: 'จาก' },
  notTradingYet: {
    en: 'Your shop starts trading at the first decision.',
    th: 'ร้านของคุณจะเริ่มทำตัวเลขตอนการตัดสินใจแรก',
  },
  tapOne: { en: 'Tap one', th: 'แตะเลือกหนึ่งข้อ' },
  youPicked: { en: 'You picked', th: 'คุณเลือก' },
  locked: { en: 'Voting has closed for this round.', th: 'ปิดโหวตรอบนี้แล้ว' },
  tooLate: {
    en: 'Too late — that round had already closed.',
    th: 'ไม่ทันแล้ว รอบนั้นปิดไปก่อน',
  },
  finalTitle: { en: 'That is your shop for the day.', th: 'นี่คือผลของร้านคุณทั้งวัน' },
  thanks: { en: 'Thank you for running it.', th: 'ขอบคุณที่มาเปิดร้านด้วยกัน' },
} satisfies Record<string, LocalizedText>

/** KPI bar names on the board. `waste` is inverted — lower is better (lib/room-types.ts). */
export const KPI_LABELS = {
  revenue: { en: 'Revenue', th: 'รายได้' },
  profit: { en: 'Profit', th: 'กำไร' },
  satisfaction: { en: 'Happy customers', th: 'ความพอใจลูกค้า' },
  waste: { en: 'Waste (lower is better)', th: 'ของเสีย (ยิ่งน้อยยิ่งดี)' },
} satisfies Record<string, LocalizedText>

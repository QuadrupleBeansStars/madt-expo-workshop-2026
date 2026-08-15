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

/**
 * The price the round 1 outcome screen narrates — the discount, NOT the winner.
 *
 * The screen exists to show what the tempting wrong answer actually cost, so the causal chain is
 * drawn at ฿45 and compared against the price that held. `content/room.test.ts` pins the body
 * copy's figures to `simulatePricing` at exactly these two numbers, so moving either one here
 * fails the copy check rather than silently desynchronising the screen from the script.
 */
export const NARRATED_DISCOUNT_PRICE = 45
export const NARRATED_HELD_PRICE = 85

/**
 * The registration questions, worded as they appeared on the LIVE form — not as the spec drafted
 * them. The room is being asked to recognise a question it answered weeks ago, so a tidied-up
 * paraphrase here would quietly break the one thing this screen is for.
 */
export const QUESTIONS: Record<
  'arrivalMode' | 'wakeTime' | 'firstDrink' | 'buyTime' | 'queuePatience' | 'spend' | 'mainFactor',
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
  // The live form says "drinks", not "coffee" — and asks about giving up, not about not buying.
  queuePatience: {
    en: 'How long would you wait in line for drinks before giving up?',
    th: 'คุณจะยอมต่อคิวซื้อน้ำนานแค่ไหนก่อนจะล้มเลิก?',
  },
  spend: {
    en: 'How much do you usually spend on a drink?',
    th: 'ปกติคุณซื้อเครื่องดื่มในราคาเท่าไหร่?',
  },
  mainFactor: {
    en: 'What is the main factor when you buy a drink?',
    th: 'ปัจจัยหลักในการเลือกซื้อเครื่องดื่มของคุณคืออะไร?',
  },
}

/** Travel mode. The live form offers Bus, not BTS/MRT. */
export const ARRIVAL_MODE_LABELS: Labels = {
  walk: { en: 'Walk', th: 'เดินมา' },
  bus: { en: 'Bus', th: 'รถเมล์ รถสาธารณะ' },
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

/**
 * Queue patience. The live thresholds are 5 / 10 / 15 / forever — there is no three-minute
 * option and there never was one on the form people actually filled in.
 */
export const QUEUE_PATIENCE_LABELS: Labels = {
  under5: { en: 'Under 5 minutes', th: 'ไม่เกิน 5 นาที' },
  under10: { en: '10 minutes', th: '10 นาที' },
  under15: { en: '15 minutes', th: '15 นาที' },
  any: { en: 'As long as it takes', th: 'รอได้เรื่อย ๆ' },
}

/**
 * What they usually pay. This is the distribution round 1 is resolved against: the top of each
 * band is read as that person's ceiling, and the cliff between ฿100 and ฿101 is what decides the
 * round. See lib/pricing.ts.
 */
export const SPEND_LABELS: Labels = {
  under50: { en: 'Below ฿50', th: 'น้อยกว่า 50 บาท' },
  '50to100': { en: '฿50–100', th: '50–100 บาท' },
  '101to200': { en: '฿101–200', th: '101–200 บาท' },
}

/**
 * What decides the purchase — MULTI-SELECT, so these bars sum to more than the number of people.
 * Any screen showing this chart must say so; a bar at 18/18 next to a respondent count of 18 reads
 * as "everyone and only taste" unless the reader is told they could pick several.
 */
export const MAIN_FACTOR_LABELS: Labels = {
  taste: { en: 'Taste', th: 'รสชาติ' },
  price: { en: 'Price', th: 'ราคา' },
  brand: { en: 'Brand', th: 'แบรนด์' },
  promotion: { en: 'Promotion & discount', th: 'โปรโมชันและส่วนลด' },
  convenience: { en: 'Convenience & location', th: 'ความสะดวกและทำเลที่ตั้ง' },
}

/**
 * Bucket labels keyed the same way `AudienceAggregate` is, so a screen that has an evidence key
 * (`lib/room-types.ts`'s `EvidenceKey`) can find the words for that distribution without a second
 * per-stage lookup table. This is the ONLY set of bucket labels in the project — the decide
 * stage's charts and the data stage's charts read the same words, because the room is being asked
 * to recognise the answer it tapped weeks ago.
 */
export const BUCKET_LABELS: Record<
  'arrivalMode' | 'wakeTime' | 'firstDrink' | 'buyTime' | 'queuePatience' | 'spend' | 'mainFactor',
  Labels
> = {
  arrivalMode: ARRIVAL_MODE_LABELS,
  wakeTime: WAKE_TIME_LABELS,
  firstDrink: FIRST_DRINK_LABELS,
  buyTime: BUY_TIME_LABELS,
  queuePatience: QUEUE_PATIENCE_LABELS,
  spend: SPEND_LABELS,
  mainFactor: MAIN_FACTOR_LABELS,
}

/**
 * Distributions where one respondent can appear in several buckets. A screen rendering one of
 * these must not present the bars as shares of the room — see `MAIN_FACTOR_LABELS`.
 */
export const MULTI_SELECT_KEYS = ['mainFactor'] as const

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
  footfall: {
    en: 'people walked past your counter',
    th: 'คนเดินผ่านหน้าเคาน์เตอร์ของคุณ',
  },
  buyers: {
    en: 'could afford it, and bought',
    th: 'จ่ายไหว และซื้อจริง',
  },
  pricedOut: {
    en: 'walked past — the price was above what they told you they pay',
    th: 'เดินผ่านไป เพราะราคาสูงกว่าที่เขาบอกไว้เองว่าจ่ายเท่าไร',
  },
  unsold: {
    en: 'cups prepped for them and binned',
    th: 'แก้วที่เตรียมไว้ให้เขา แล้วต้องเททิ้ง',
  },
  // The comparison the whole screen is built to make.
  extraCustomers: {
    en: 'extra customers the discount actually won',
    th: 'ลูกค้าที่เพิ่มขึ้นจริงจากการลดราคา',
  },
  profitGivenUp: {
    en: '฿ of profit given up to win them',
    th: 'บาท คือกำไรที่ต้องยอมเสียไปเพื่อให้ได้ลูกค้ากลุ่มนั้นมา',
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
  // Sits over the charts on the decide screen. It says "already" because the room gave these
  // answers weeks ago — the decision is not a guess unless they choose to make it one.
  whatYouKnow: { en: 'What you already know', th: 'ข้อมูลที่คุณมีอยู่แล้ว' },
  // Rendered after the price so the copy never hardcodes a number the constants could move away
  // from: "฿45 on the board".
  onTheBoard: { en: 'on the board', th: 'บาท บนกระดานหน้าร้าน' },
  heldAt: { en: 'against holding at', th: 'เทียบกับการยืนราคาไว้ที่' },
  accounting: {
    en: 'Everyone is accounted for: bought + walked past = walked in.',
    th: 'ทุกคนถูกนับครบ คนที่ซื้อ + คนที่เดินผ่านไป = คนที่เดินเข้ามาทั้งหมด',
  },
  // Sits under the mainFactor chart. Without it, a bar at 18 beside a respondent count of 18
  // reads as "everyone, and only taste" — the question allowed several answers.
  // Kept to ONE line per script at projector sizes: it is a footnote on a slide with no spare
  // vertical budget, and a two-line version cost 38px on `decide-defend`, which put the stage
  // 50px over. The meaning has to survive the compression — "more answers than people" is the
  // whole point, and it does.
  multiSelectNote: {
    en: 'Pick-several question: more answers than people.',
    th: 'ข้อนี้เลือกได้หลายข้อ ผลรวมจึงเกินจำนวนคน',
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
  reset: { en: 'Reset room', th: '↺ รีเซ็ตห้อง' },
  // Armed state of the reset control. Says what is about to happen rather than repeating the
  // label — it is the last thing between the host and ejecting every phone in the room.
  resetArmed: { en: 'Press again to clear the room', th: '⚠ กดอีกครั้งเพื่อล้างห้อง' },
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
  // The heading on the phone's evidence strip. The figures themselves are the same ones charted
  // on the projector — the phone shows fewer of them, never different ones.
  fromYourAnswers: { en: 'From your answers', th: 'จากคำตอบของพวกคุณ' },
  // Shorter than the projector's wording (UI.multiSelectNote) — same caveat, read at arm's length.
  multiSelectNote: { en: 'You could pick more than one.', th: 'ข้อนี้เลือกได้มากกว่าหนึ่งข้อ' },
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

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
    storyboard: [
      {
        emoji: '📝',
        caption: {
          en: 'Weeks ago, you filled in a form to come here. Seven questions, two minutes.',
          th: 'หลายสัปดาห์ก่อน คุณกรอกแบบฟอร์มเพื่อมางานนี้ เจ็ดคำถาม สองนาที',
        },
      },
      {
        emoji: '🗄️',
        caption: {
          en: 'Nobody looked at it again. It sat in a spreadsheet.',
          th: 'หลังจากนั้นไม่มีใครเปิดดูอีกเลย มันนอนอยู่ในสเปรดชีต',
        },
      },
      {
        emoji: '☕️',
        caption: {
          en: 'This morning it is the only thing standing between you and a bad decision.',
          th: 'เช้านี้ มันคือสิ่งเดียวที่กั้นระหว่างคุณกับการตัดสินใจที่ผิดพลาด',
        },
      },
    ],
    headline: {
      en: 'You built this dataset weeks ago, without thinking about it.',
      th: 'ชุดข้อมูลนี้พวกคุณสร้างไว้เองตั้งแต่ตอนลงทะเบียน โดยไม่ทันได้คิดถึงมันเลย',
    },
    body: {
      en: 'At registration you answered seven questions about drinks: when you buy, how long you will queue, what you usually pay, and what actually decides the purchase. The last two are the ones this shop turns on.',
      th: 'ตอนลงทะเบียน พวกคุณตอบคำถามเกี่ยวกับเครื่องดื่มไว้เจ็ดข้อ ทั้งซื้อตอนไหน ต่อคิวได้นานแค่ไหน ปกติจ่ายเท่าไร และอะไรคือสิ่งที่ตัดสินใจจริง ๆ สองข้อหลังคือข้อที่ร้านนี้ทั้งร้านหมุนอยู่รอบมัน',
    },
    points: [
      // Every figure below is asserted against AUDIENCE in content/room.test.ts, so a re-import
      // of a larger CSV fails here rather than leaving stale prose on a projector.
      {
        en: '13 of you said you usually pay between ฿50 and ฿100 for a drink.',
        th: '13 คนบอกว่าปกติจ่ายค่าเครื่องดื่มอยู่ระหว่าง 50 ถึง 100 บาท',
      },
      {
        en: 'All 18 of you named taste as a deciding factor. 11 named price. You could pick several.',
        th: 'ทั้ง 18 คนเลือก "รสชาติ" เป็นปัจจัยตัดสินใจ มี 11 คนที่เลือก "ราคา" ด้วย ข้อนี้เลือกได้หลายข้อ',
      },
      {
        // The sample size is said out loud rather than hidden. A workshop arguing for data honesty
        // that quietly rounds 18 up to "the room" would be arguing against itself.
        en: 'That is 18 people, not 200 — and registrants, not this room. Deciding on a sample this small is itself part of the lesson.',
        th: 'ทั้งหมดนี้มาจาก 18 คน ไม่ใช่ 200 คน และเป็นคนที่ลงทะเบียน ไม่ใช่ทุกคนในห้องนี้ การตัดสินใจบนกลุ่มตัวอย่างเล็กแค่นี้ ก็เป็นบทเรียนหนึ่งเหมือนกัน',
      },
    ],
  },
  {
    kind: 'decide',
    id: 'decide-price',
    resolve: 'simulate-pricing',
    durationMs: ROUND_1_VOTE_MS,
    storyboard: [
      {
        emoji: '🪧',
        caption: {
          en: 'This morning, the shop across the street puts ฿45 on a board outside.',
          th: 'เช้านี้ ร้านฝั่งตรงข้ามเอาป้ายราคา 45 บาท มาตั้งไว้หน้าร้าน',
        },
      },
      {
        emoji: '👀',
        caption: {
          en: '120 people will walk past your counter today. Some of them saw it.',
          th: 'วันนี้จะมีคนเดินผ่านเคาน์เตอร์ของคุณ 120 คน และบางคนก็เห็นป้ายนั้นแล้ว',
        },
      },
      {
        emoji: '🧑‍🍳',
        caption: {
          en: 'Your barista is holding a marker, waiting to write your price on the board.',
          th: 'บาริสต้าถือปากกาเมจิกรออยู่ ว่าจะให้เขียนราคาเท่าไรบนกระดาน',
        },
      },
    ],
    prompt: {
      en: 'What goes on the board? Price one cup.',
      th: 'จะเขียนราคาเท่าไรบนกระดาน ตั้งราคากาแฟหนึ่งแก้ว',
    },
    // The two questions that decide the round, and the one that explains it. `spend` sets who can
    // buy at all; `mainFactor` is why the room does not simply leave over price. A player who
    // reads both charts can derive the answer, and that derivation IS the round.
    evidence: ['spend', 'mainFactor'],
    context: {
      en: 'A cup costs you ฿22 to make. Anything you prep and nobody buys goes in the bin. Your own answers decide who is still a customer at each price.',
      th: 'ต้นทุนกาแฟแก้วละ 22 บาท ของที่เตรียมไว้แล้วไม่มีคนซื้อ ต้องเททิ้ง และคำตอบที่พวกคุณให้ไว้เอง จะเป็นตัวตัดสินว่าที่ราคาไหน ใครยังเป็นลูกค้าอยู่บ้าง',
    },
    options: [
      { id: 'p45', priceBaht: 45, label: { en: '฿45 — match their sign', th: '45 บาท — สู้ราคาเท่าเขา' } },
      { id: 'p65', priceBaht: 65, label: { en: '฿65 — come down a little', th: '65 บาท — ลดลงมาหน่อย' } },
      { id: 'p85', priceBaht: 85, label: { en: '฿85 — hold your price', th: '85 บาท — ยืนราคาเดิมไว้' } },
      { id: 'p120', priceBaht: 120, label: { en: '฿120 — go premium instead', th: '120 บาท — ขึ้นไปเล่นตลาดพรีเมียมเลย' } },
    ],
  },
  {
    kind: 'outcome',
    id: 'outcome-price',
    forStageId: 'decide-price',
    headline: {
      en: '฿85 held. Matching their ฿45 sign won 7 customers and cost ฿4,219.',
      th: 'ยืนราคา 85 บาทคือคำตอบ การลดลงไปสู้ที่ 45 บาท ได้ลูกค้าเพิ่ม 7 คน แต่เสียกำไรไป 4,219 บาท',
    },
    body: {
      en: 'At ฿85, 7 of the 120 people who walked past could not buy — because exactly one of you, out of 18, said you spend under ฿50. Dropping to ฿45 brought those 7 back and took ฿40 off every one of the other 113. And the discount was aimed at the wrong thing anyway: 11 of you named price, but all 18 named taste. The people who were leaving were not leaving over price. Nobody had to guess that — you answered it weeks ago.',
      th: 'ที่ราคา 85 บาท มีคนซื้อไม่ได้ 7 คนจาก 120 คนที่เดินผ่าน เพราะในบรรดา 18 คนที่ตอบมา มีเพียงคนเดียวที่บอกว่าจ่ายต่ำกว่า 50 บาท การลดราคาลงมาที่ 45 บาท ดึง 7 คนนั้นกลับมาได้จริง แต่ก็หั่นเงินออกจากอีก 113 คนที่เหลือ คนละ 40 บาท และการลดราคาก็เล็งผิดจุดตั้งแต่แรก เพราะมี 11 คนที่เลือก "ราคา" แต่ทั้ง 18 คนเลือก "รสชาติ" คนที่เดินออกไป ไม่ได้เดินออกไปเพราะราคา และไม่มีใครต้องเดาเลย เพราะพวกคุณตอบไว้เองตั้งแต่หลายสัปดาห์ก่อน',
    },
    lesson: {
      en: 'A discount only wins back the people who left over price. Check that they did.',
      th: 'การลดราคาดึงกลับได้แค่คนที่เดินออกไปเพราะราคา ก่อนลด ต้องเช็กก่อนว่าเขาไปเพราะเรื่องนั้นจริงไหม',
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
    storyboard: [
      {
        emoji: '🏪',
        caption: {
          en: 'By 11:30 the new place across the road has a queue. Yours does not.',
          th: 'พอถึงสิบเอ็ดโมงครึ่ง ร้านใหม่ฝั่งตรงข้ามมีคนต่อคิว ส่วนร้านคุณไม่มี',
        },
      },
      {
        emoji: '💸',
        caption: {
          en: 'You have one budget left for today, and four things you could spend it on.',
          th: 'วันนี้คุณเหลืองบก้อนเดียว และมีสี่ทางให้เลือกใช้',
        },
      },
    ],
    prompt: {
      en: 'How do you defend the shop?',
      th: 'คุณจะรับมือกับคู่แข่งยังไง',
    },
    // `mainFactor` is the ranking the four options below are ordered against — see the note on
    // each `fx`. `queuePatience` is what the competitor is attacking. Neither figure DECIDES the
    // round (nothing on the form asked about noon — see `data-competitor`), but they are the data
    // the room actually holds, and the ordering is no longer a guess.
    evidence: ['mainFactor', 'queuePatience'],
    context: {
      en: 'The same budget whichever way you go. Pick one.',
      th: 'ไม่ว่าจะเลือกทางไหน งบเท่ากัน เลือกได้ทางเดียว',
    },
    options: [
      {
        id: 'quality',
        label: {
          en: 'Beat them on taste — a signature drink worth crossing the road for',
          th: 'สู้ด้วยรสชาติ — มีเมนูซิกเนเจอร์ที่คุ้มค่าให้ข้ามถนนมา',
        },
        /* TASTE — named by 18 of 18. The largest bar on the chart beside this question, and so
         * the largest effect here. The ORDER of these four is taken from `mainFactor`; the
         * magnitudes are still chosen by hand, and are flagged for review. */
        fx: { revenue: 1400, profit: 900, satisfaction: 14, waste: -100 },
      },
      {
        id: 'promotion',
        label: {
          en: 'Run a promotion — buy two, the second is half price',
          th: 'จัดโปรโมชัน — ซื้อสองแก้ว แก้วที่สองลดครึ่งราคา',
        },
        /* PROMOTION — named by 8 of 18. Pulls people in and prompts over-prepping for a rush that
         * only partly turns up, so it is the one defensive play that RAISES waste. */
        fx: { revenue: 900, profit: 400, satisfaction: 8, waste: 300 },
      },
      {
        id: 'speed',
        label: {
          en: 'Race them on speed — cut the menu, batch the milk ahead',
          th: 'สู้ด้วยความเร็ว — ลดเมนู เตรียมนมไว้ล่วงหน้า',
        },
        /* CONVENIENCE — named by 6 of 18. The 07:00 answer, replayed at noon: it costs real waste
         * and still loses the queue race. */
        fx: { revenue: 600, profit: 200, satisfaction: -4, waste: 400 },
      },
      {
        id: 'price',
        label: {
          en: 'Match their price — discount every cup',
          th: 'สู้ด้วยราคา — ลดราคาทุกแก้ว',
        },
        /* PRICE — named by 11 of 18, and still last. It is the only option that gives away margin
         * on customers who were never going to leave, which is round 1's lesson arriving again in
         * a different costume. Revenue up, profit down: the classic panic move. */
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
      en: 'Quality added ฿900. The promotion added ฿400 and put ฿300 of over-prepped stock in the bin. Racing on speed threw ฿400 of milk away and still left you second in line. Discounting pulled people in and gave away ฿500 of profit to do it. That order is not invented — it is the order you put those four factors in at registration, with taste at the top and price below it.',
      th: 'คุณภาพเพิ่มกำไร 900 บาท โปรโมชันเพิ่ม 400 บาท แต่ก็ทำให้ของที่เตรียมเกินอีก 300 บาทต้องลงถัง การไล่สู้ด้วยความเร็วทำให้นมที่เตรียมไว้ 400 บาทต้องเททิ้ง แล้วคิวก็ยังแพ้เขาอยู่ดี ส่วนการลดราคาเรียกคนเข้าร้านได้จริง แต่แลกด้วยกำไรที่หายไป 500 บาท ลำดับนี้ไม่ได้คิดขึ้นเอง แต่คือลำดับที่พวกคุณจัดปัจจัยทั้งสี่ข้อนี้ไว้เองตอนลงทะเบียน โดยมีรสชาติอยู่บนสุด และราคาอยู่ล่างกว่า',
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
    storyboard: [
      {
        emoji: '🏦',
        caption: {
          en: 'The day is over. There is ฿20,000 in the account that you do not need this week.',
          th: 'จบวันแล้ว ในบัญชีเหลืออยู่ 20,000 บาท ที่สัปดาห์นี้ยังไม่ต้องใช้',
        },
      },
      {
        emoji: '📅',
        caption: {
          en: 'Whatever you buy with it, the shop keeps for the rest of the year.',
          th: 'ไม่ว่าจะเอาไปซื้ออะไร ร้านจะได้ใช้สิ่งนั้นไปตลอดทั้งปี',
        },
      },
    ],
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
      {
        id: 'stock',
        label: {
          en: 'A year of deeper stock, so you never sell out at 09:00',
          th: 'ตุนของให้ลึกขึ้นทั้งปี จะได้ไม่ของหมดตั้งแต่เก้าโมง',
        },
        /* The team's "เพิ่ม stock". It is the option that looks safest and scores worst: holding
         * more stock against a demand you have not measured is how waste is manufactured, and
         * `waste` subtracts on the board. A deliberate trap, not an oversight. */
        fx: { revenue: 800, profit: 200, satisfaction: 4, waste: 900 },
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

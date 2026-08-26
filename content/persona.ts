// Café Persona — ALL authored content.
//
// EACH PERSONA IS A MAD+ MASCOT, mapped from the official profiles in `2026 MADT EXPO.pdf` rather
// than from the artwork: BIGLOK the Creator prototypes before anyone else has finished framing the
// problem (PIONEER), TECHIE the Builder ships and measures and ships again (SPRINTER), SHAPPY the
// Thinker orders the data before trusting it (ANALYST), BEEDEE the Listener will not answer until
// it has understood the question (GUARDIAN). The four colours below are those characters' own.
//
// The mapping is not decorative — `partner` is the diagonal, and the document's own loop closes
// Techie → BeeDee, which is the same pair. See lib/room-types.ts for the full note.
//
// `label` AND `coffee` ARE NO LONGER RENDERED. The screen shows the mascot's name and the Thai
// archetype — BIGLOK · นักบุกเบิก — because three names stacked on one quadrant is two more than a
// room can read from the back. Both fields stay authored here for the same reason `smallTalk`
// does: they are the host's words. "คุณคือเอสเพรสโซ่" is a line worth saying out loud; it is not
// worth a third line of type on a projector.
//
// `smallTalk` IS NOT RENDERED ANYWHERE. It is the host's line for the reveal — the workshop's
// teaching, delivered out loud over the bars rather than printed beside them (components/room/
// Stages.tsx says why). Keep authoring it: it is the script, and the reveal is empty without
// someone saying it. Personas are team-renameable without touching mechanics;
// question copy is team-editable. dataHook figures are template-computed from AUDIENCE so a
// survey re-import (scripts/import-audience.ts) updates every hook — never hand-type a figure.

import { AUDIENCE } from '@/content/audience'
import type { Persona, PersonaId, Question } from '@/lib/room-types'

const N = AUDIENCE.respondents

export const PERSONAS: Record<PersonaId, Persona> = {
  pioneer: {
    id: 'pioneer', label: 'THE PIONEER', coffee: 'เอสเพรสโซ่', archetype: 'นักบุกเบิก',
    mascot: { name: 'BIGLOK', art: '/personas/biglok.png', quote: 'Impossible? Let’s prototype.' },
    description:
      'คุณคือคนที่กดช็อตแล้วเสิร์ฟเลย ตอนคนอื่นยังเห็นว่ามันเป็นปัญหา คุณเริ่มลงมือทำต้นแบบไปแล้ว ' +
      'ไอเดียของคุณมาไวและมาเยอะ และพลังของคุณดึงคนทั้งทีมให้กล้าขยับตาม',
    strength: 'ได้ลงมือก่อนใคร สร้างโมเมนตัมเก่ง',
    caution: 'เร็วจนบางทีข้อมูลที่มีอยู่แล้วไม่ถูกเปิดอ่าน',
    partner: 'analyst',
  },
  sprinter: {
    id: 'sprinter', label: 'THE SPRINTER', coffee: 'Nitro', archetype: 'นักฉวยจังหวะ',
    mascot: { name: 'TECHIE', art: '/personas/techie.png', quote: 'Let’s make it real.' },
    description:
      'คุณไม่ปล่อยให้ไอเดียค้างอยู่บนกระดาน คุณปล่อยของจริงออกไปก่อน แล้ววัดผล ปรับ แล้วปล่อยใหม่ ' +
      'เร็วแต่ไม่มั่ว เพราะทุกรอบคุณเก็บผลกลับมาเสมอ',
    strength: 'ทดลองเร็ว เรียนรู้เร็ว ปรับตัวไว',
    caution: 'การทดลองที่เร็วเกินไปอาจวัดผลไม่ทันจบ',
    partner: 'guardian',
  },
  analyst: {
    id: 'analyst', label: 'THE ANALYST', coffee: 'โคลด์บริว', archetype: 'นักวิเคราะห์',
    mascot: { name: 'SHAPPY', art: '/personas/shappy.png', quote: 'Let’s connect the dots.' },
    description:
      'คุณไม่เชื่ออะไรง่าย ๆ จนกว่าจะจัดข้อมูลให้เข้าที่ก่อน คุณรู้ว่าข้อมูลเยอะไม่ได้แปลว่าฉลาด ' +
      'แต่ข้อมูลที่เรียงถูกวิธีจะกลายเป็นภาพใหญ่ที่คนอื่นมองไม่เห็น ' +
      'การตัดสินใจของคุณอาจมาช้ากว่าใคร แต่แทบไม่เคยต้องถอนคืน',
    strength: 'แม่นยำ พลาดยาก น่าเชื่อถือ',
    caution: 'รอข้อมูลครบจนโอกาสหลุดมือ',
    partner: 'pioneer',
  },
  guardian: {
    id: 'guardian', label: 'THE GUARDIAN', coffee: 'พัวร์โอเวอร์', archetype: 'ผู้พิทักษ์',
    mascot: { name: 'BEEDEE', art: '/personas/beedee.png', quote: 'Every great AI starts with understanding.' },
    description:
      'คุณค่อย ๆ รินอย่างมีจังหวะ และคุณไม่รีบตอบ — คุณฟังก่อน ฟังลูกค้า ฟังทีม ฟังว่าคำถามจริง ๆ คืออะไร ' +
      'คุณเชื่อว่าการตัดสินใจที่ดีเริ่มจากการเข้าใจคำถามที่ถูกต้อง และเป็นเหตุผลที่ลูกค้าเก่ากลับมาทุกวัน',
    strength: 'มั่นคง รักษาแก่นของทีมและแบรนด์',
    caution: 'ระวังจนบางครั้งเสียจังหวะที่ควรขยับ',
    partner: 'sprinter',
  },
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    dataHook: {
      field: 'mainFactor',
      highlight: ['taste'],
      caption: `“รสชาติ” มีผลกับทั้ง ${AUDIENCE.mainFactor.taste} จาก ${N} คนในห้องนี้ — มากกว่าราคาเสียอีก`,
    },
    scenario: 'เมล็ดเจ้าใหม่ถูกลง 20% แต่รสต่างจากเดิมนิดหน่อย — เอาไหม?',
    choices: [
      { label: 'ชิมเองแล้วตัดสินเลย เชื่อลิ้นตัวเอง', persona: 'pioneer' },
      { label: 'สลับใช้ 1 สัปดาห์ ดูยอดขายจริง', persona: 'sprinter' },
      { label: 'ทำ blind test ให้ลูกค้าชิม แล้วนับคะแนน', persona: 'analyst' },
      { label: 'ไม่เปลี่ยน — รสชาติคือทั้งหมดของร้าน', persona: 'guardian' },
    ],
    smallTalk:
      'ทั้งห้องพูดเป็นเสียงเดียวว่ารสชาติมาก่อน — คำถามจึงไม่ใช่ “ประหยัดได้ไหม” แต่ “เสี่ยงกับแก่นของร้านแค่ไหน” ' +
      'ทุกทางเลือกบนจอกำลังจัดการความเสี่ยงก้อนเดียวกัน ด้วยเครื่องมือคนละชิ้น ไม่มีใครผิด',
  },
  {
    id: 'q2',
    dataHook: {
      field: 'queuePatience',
      highlight: ['under5', 'under10'],
      caption: `${AUDIENCE.queuePatience.under5 + AUDIENCE.queuePatience.under10} จาก ${N} คนเลิกต่อคิวภายใน 10 นาที`,
    },
    scenario: 'เช้าวันธรรมดา คิวร้านเรายาว 15 นาที วันนี้เห็นคนถอดใจเดินออกหลายคน — แก้ยังไง?',
    choices: [
      { label: 'ลองรับออเดอร์ล่วงหน้าใน LINE 1 สัปดาห์', persona: 'sprinter' },
      { label: 'จ้างบาริสต้าเพิ่มพรุ่งนี้เลย', persona: 'pioneer' },
      { label: 'ยังไม่จ้างเพิ่ม — ฝึกทีมเดิมให้ชงเร็วขึ้น', persona: 'guardian' },
      { label: 'จับเวลาทุกขั้นตอนก่อน หาว่าช้าตรงไหน', persona: 'analyst' },
    ],
    smallTalk:
      'ตัวเลขบอกว่าลูกค้าหายไปตรงนาทีที่ 10 — แต่ไม่ได้บอกว่า “เพราะอะไร” ' +
      'บางคนแก้ที่จำนวนมือ บางคนแก้ที่ช่องทาง บางคนไปตามหาสาเหตุก่อน ทางไหนก็เดินถึงคิวที่สั้นลงได้',
  },
  {
    id: 'q3',
    dataHook: {
      field: 'spend',
      highlight: ['50to100'],
      caption: `${AUDIENCE.spend['50to100']} จาก ${N} คนจ่ายอยู่ในช่วง ฿50–100`,
    },
    scenario: 'จะเปิดเมนู signature ใหม่ — ตั้งราคาเท่าไหร่ดี?',
    choices: [
      { label: '฿50–100 ตามที่ลูกค้าเราจ่ายอยู่จริง', persona: 'guardian' },
      { label: 'ถามลูกค้าก่อนว่ายอมจ่ายสูงสุดเท่าไหร่', persona: 'analyst' },
      { label: '฿120 ไปเลย ของดีต้องกล้าตั้ง', persona: 'pioneer' },
      { label: 'เปิดตัวราคาพิเศษ 2 สัปดาห์ แล้วค่อยขึ้นราคา', persona: 'sprinter' },
    ],
    smallTalk:
      'ราคาไม่ใช่แค่ตัวเลข แต่เป็นข้อความที่ร้านส่งถึงลูกค้า — บางคนตั้งในกรอบเพื่อความชัวร์ ' +
      'บางคนตั้งเหนือกรอบเพื่อยกแบรนด์ และบางคนขอฟังข้อมูลก่อน ทุกทางมีเหตุผล ถ้ารู้ว่ากำลังแลกอะไรอยู่',
  },
  {
    id: 'q4',
    /*
     * IT USED TO PLOT `firstDrink` AND HIGHLIGHT water + tea, and the sum it printed — "33 of 50
     * do not start the day with coffee" — was true and meant nothing. Almost everyone drinks
     * water on waking; it is not a preference and nobody pays for it. Folding it in inflated the
     * real signal (tea) from 22% to 66% and pointed the room at "sign the deal" with a number
     * that never said so.
     *
     * That is the same move AI Detective's case 7 exists to teach people to catch — a true figure
     * carrying a conclusion it does not support — and a deck that does it to its own audience has
     * no business running the other workshop an hour earlier.
     *
     * `firstBuy` asks what people BUY instead, which is the question a café actually has. It is
     * MOCK until the form carries the column (content/audience.ts, MOCK_FIELDS) and the chart
     * says so on screen.
     */
    dataHook: {
      field: 'firstBuy',
      highlight: ['tea', 'juice', 'milk'],
      caption: `${AUDIENCE.firstBuy.tea + AUDIENCE.firstBuy.juice + AUDIENCE.firstBuy.milk} จาก ${N} คนซื้อแก้วแรกของวันเป็นอย่างอื่นที่ไม่ใช่กาแฟ`,
    },
    scenario: 'จะเพิ่มเมนูที่ไม่ใช่กาแฟ — ชา น้ำผลไม้ นม — เข้าร้านไหม?',
    choices: [
      { label: 'เพิ่มเลย ช้าแล้วร้านอื่นได้ไป', persona: 'pioneer' },
      { label: 'ไม่เอา — เราคือร้านกาแฟ', persona: 'guardian' },
      { label: 'ลองขาย 2 เมนู 1 เดือน แล้ววัดยอด', persona: 'sprinter' },
      { label: 'ถามลูกค้าก่อนว่าอยากได้เมนูไหน', persona: 'analyst' },
    ],
    smallTalk:
      'เกือบครึ่งของคนที่ซื้อ ไม่ได้ซื้อกาแฟ — แต่ยังไม่ได้บอกว่าเขาจะซื้อเมนูอื่นจากร้านเรา ' +
      'บางคนเห็นตลาดใหม่ บางคนเห็นความเสี่ยงต่อตัวตนของร้าน ส่วนการขอทดลองหรือถามต่อ ก็คือการซื้อข้อมูลเพิ่มก่อนจ่ายเงินจริง',
  },
  {
    id: 'q5',
    dataHook: {
      field: 'arrivalMode',
      highlight: ['car'],
      caption: `${AUDIENCE.arrivalMode.car} จาก ${N} คนขับรถยนต์มา`,
    },
    scenario: 'ห้องข้าง ๆ ว่าง เจ้าของตึกให้เช่าทำที่จอดรถ — เอาไหม?',
    choices: [
      { label: 'นับก่อน — วันหนึ่งมีรถหาที่จอดไม่ได้กี่คัน', persona: 'analyst' },
      { label: 'เซ็นเลย ที่จอดคือแต้มต่อที่คู่แข่งไม่มี', persona: 'pioneer' },
      { label: 'ขอเช่าสั้น 3 เดือน ลองก่อน', persona: 'sprinter' },
      { label: 'ไม่เอา — ค่าเช่าประจำเสี่ยงเกินไป', persona: 'guardian' },
    ],
    smallTalk:
      'ตึกข้าง ๆ ไม่ได้ว่างตลอดไป — โอกาสมีวันหมดอายุ แต่ค่าเช่าไม่มี ' +
      'คนที่รีบคว้าอาจได้แต้มต่อ คนที่ขอทดลองจ่ายค่าเรียนถูกกว่า และคนที่ปฏิเสธก็ปกป้องกระแสเงินสด ไม่มีคำตอบไหนฟรี',
  },
  {
    id: 'q6',
    dataHook: {
      field: 'buyTime',
      highlight: ['7to9', 'never'],
      caption: `ยอดขายกระจุกช่วง 7–9 โมง (${AUDIENCE.buyTime['7to9']} คน) — และมีคน “ไม่ซื้อเลย” ถึง ${AUDIENCE.buyTime.never} คน`,
    },
    scenario: 'ยอดกระจุกตอนเช้า บ่ายร้านเงียบ — ทำยังไงดี?',
    choices: [
      { label: 'ยิงโปรบ่ายนี้ 14:00–16:00 ดูผลทันที', persona: 'sprinter' },
      { label: 'ลดชั่วโมงพนักงานช่วงบ่าย รักษากำไรไว้', persona: 'guardian' },
      { label: 'จัด happy hour ช่วงบ่าย เริ่มพรุ่งนี้', persona: 'pioneer' },
      { label: 'หาก่อนว่าคนที่ไม่ซื้อเลย เขาติดอะไร', persona: 'analyst' },
    ],
    smallTalk:
      'ช่วงเวลาที่เงียบคือกระจกสองด้าน — ด้านหนึ่งคือต้นทุนที่ต้องคุม อีกด้านคือตลาดที่ยังไม่ถูกปลุก ' +
      'ห้องนี้ต่างกันตรงที่หยิบด้านไหนขึ้นมาก่อน ไม่ใช่ใครเก่งกว่าใคร',
  },
  {
    id: 'q7',
    dataHook: {
      field: 'mainFactor',
      highlight: ['price', 'promotion'],
      caption: `“ราคา” มีผลกับ ${AUDIENCE.mainFactor.price} คน “โปรโมชัน” อีก ${AUDIENCE.mainFactor.promotion} คน — แต่รสชาตินำทุกอย่าง`,
    },
    scenario: 'คู่แข่งเปิดตรงข้าม ลด 50% ทั้งสัปดาห์ — สู้ยังไง?',
    choices: [
      { label: 'ไม่ลดราคา — ขายรสชาติเหมือนเดิม', persona: 'guardian' },
      { label: 'อัดโปรสวนกลับวันนี้ ให้ดังกว่า', persona: 'pioneer' },
      { label: 'ยังไม่ทำอะไร — นับก่อนว่าลูกค้าหายจริงไหม', persona: 'analyst' },
      { label: 'ลองอัปไซส์ฟรีให้ลูกค้าประจำ 1 สัปดาห์', persona: 'sprinter' },
    ],
    smallTalk:
      'ในสงครามราคา คนชนะมักไม่ใช่คนลดเยอะสุด แต่เป็นคนที่รู้ว่าลูกค้าตัวเองมาเพราะอะไร — ' +
      'ห้องนี้เองก็บอกว่ารสชาติมาก่อนราคา การสวนกลับ การเจาะจง หรือการนิ่ง จึงเป็นคนละวิธีปกป้องสิ่งเดียวกัน',
  },
  {
    id: 'q8',
    dataHook: {
      field: 'wakeTime',
      highlight: ['before6'],
      caption: `${AUDIENCE.wakeTime.before6} จาก ${N} คนตื่นก่อน 6 โมงเช้า`,
    },
    scenario: 'ร้านเปิด 8 โมง จะขยับมา 6:30 เพื่อรับคนตื่นเช้า ทีมต้องมาเร็วขึ้น — เอาไหม?',
    choices: [
      { label: 'ลองเปิดเช้า 2 สัปดาห์ แล้วดูยอด', persona: 'sprinter' },
      { label: 'ดูก่อนว่าคนมาเช้าเยอะพอจะคุ้มไหม', persona: 'analyst' },
      { label: 'เปิดเลยจันทร์หน้า ใครเปิดก่อนได้ลูกค้า', persona: 'pioneer' },
      { label: 'เปิดเวลาเดิม — ทีมรับไม่ไหว', persona: 'guardian' },
    ],
    smallTalk:
      'ชั่วโมงเปิดร้านคือทรัพยากรที่แพงที่สุดของทีม — เปิดเพิ่มหนึ่งชั่วโมงคือพลังงานของคนทั้งร้าน ' +
      'คำถามจริงไม่ใช่ “จะมีลูกค้าไหม” แต่ “คุ้มกับสิ่งที่ทีมต้องจ่ายไหม” ซึ่งตอบได้ทั้งด้วยเซนส์และด้วยตัวเลข',
  },
]

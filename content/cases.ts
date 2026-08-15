import type { DetectiveCase } from '@/lib/types'

export const CASES: DetectiveCase[] = [
  // ── 🟢 CASE 1 — Artemis II — stale knowledge ───────────────────────────────
  {
    id: 'artemis',
    order: 1,
    difficulty: 'easy',
    question: {
      th: 'มีมนุษย์คนไหนเดินทางออกไปไกลกว่าวงโคจรระดับต่ำของโลก (Low Earth Orbit) นับตั้งแต่ปี 1972 หรือไม่?',
      en: 'Has any human traveled beyond low Earth orbit since 1972?',
    },
    // A storyboard, per the team's note after the 3 Aug run-through: a bilingual question plus an
    // AI answer is a wall of text on a projector. Two frames set the scene before the reading
    // starts. Every board in this file follows the same shape — the SITUATION, then the DOUBT.
    // None of them reveals the failure mode; that is what the room is for.
    storyboard: [
      {
        emoji: '🧑‍🚀',
        caption: {
          en: 'A student asks the AI a simple question about space.',
          th: 'นักเรียนคนหนึ่งถาม AI คำถามง่าย ๆ เกี่ยวกับอวกาศ',
        },
      },
      {
        emoji: '🤖',
        caption: {
          en: 'It answers instantly, in full sentences, with a date and a crew list.',
          th: 'AI ตอบทันที เป็นประโยคเต็ม มีทั้งวันที่และรายชื่อลูกเรือ',
        },
      },
      {
        emoji: '🔍',
        caption: {
          en: 'Everything it says is checkable. So check it.',
          th: 'ทุกอย่างที่มันพูดตรวจสอบได้ งั้นก็ลองตรวจดู',
        },
      },
    ],
    aiAnswer: {
      th: 'ไม่มีครับ มนุษย์กลุ่มสุดท้ายที่เดินทางออกไปไกลกว่าวงโคจรระดับต่ำของโลกคือลูกเรือ Apollo 17 ในเดือนธันวาคม 1972 หลังจากนั้นภารกิจที่มีมนุษย์ร่วมเดินทางทั้งหมดจำกัดอยู่แค่วงโคจรระดับต่ำเท่านั้น',
      en: 'No. The last humans to travel beyond low Earth orbit were the Apollo 17 crew in December 1972. Every crewed mission since has been confined to low Earth orbit.',
    },
    docs: [
      {
        filename: 'apollo_17_mission_record.pdf',
        kind: 'excerpt',
        found: true,
        fictional: false,
        title: { th: 'บันทึกภารกิจ Apollo 17 (ธันวาคม 1972)', en: 'Apollo 17 mission record (December 1972)' },
        body: {
          th: 'Apollo 17 คือภารกิจสุดท้ายของโครงการ Apollo ที่ส่งมนุษย์ไปยังดวงจันทร์ ในเดือนธันวาคม 1972',
          en: 'Apollo 17 was the final Apollo mission to send humans to the Moon, in December 1972.',
        },
        sourceUrl: 'https://www.nasa.gov/mission/apollo-17/',
      },
      {
        filename: 'iss_crew_rotations_1998_2025.csv',
        kind: 'table',
        found: true,
        fictional: false,
        title: { th: 'ตารางลูกเรือสถานีอวกาศนานาชาติ 1998–2025', en: 'ISS crew rotations, 1998–2025' },
        body: {
          th: 'ภารกิจที่มีมนุษย์ร่วมเดินทางทั้งหมดในช่วงนี้อยู่ในวงโคจรระดับต่ำของโลก',
          en: 'All crewed missions in this period remained in low Earth orbit.',
        },
        sourceUrl: 'https://www.nasa.gov/international-space-station/',
      },
      {
        filename: 'crewed_missions_2026.log',
        kind: 'excerpt',
        found: false, // ← THE GAP
        fictional: false,
        title: { th: 'บันทึกภารกิจที่มีมนุษย์ร่วมเดินทาง ปี 2026', en: 'Crewed mission log, 2026' },
      },
    ],
    options: [
      {
        id: 'ai-correct',
        label: {
          th: 'AI ตอบถูก — ยังไม่มีใครไปไกลกว่านั้นเลยตั้งแต่ปี 1972 ภารกิจ Artemis รุ่นใหม่ยังอยู่ในวงโคจรโลกรอการรับรอง',
          en: 'The AI is correct — nobody has, since 1972. Newer Artemis missions have so far stayed within Earth orbit.',
        },
        correct: false,
      },
      {
        id: 'stale',
        label: {
          th: 'AI ตอบถูก "เมื่อปีที่แล้ว" — แต่มันไม่เคยดึงข้อมูลปี 2026 มาเลย ภารกิจ Artemis II ทำสำเร็จไปแล้ว พร้อมลูกเรือ Wiseman, Glover, Koch และ Hansen',
          en: 'The AI was right last year — but it never retrieved anything from 2026. Artemis II already flew, crewed by Wiseman, Glover, Koch, and Hansen.',
        },
        correct: true,
      },
      {
        id: 'apollo-wrong',
        label: {
          th: 'AI จำผิด — ภารกิจสุดท้ายคือ Apollo 11 ไม่ใช่ Apollo 17 เพราะ Apollo 11 ปี 1969 คือภารกิจดวงจันทร์ครั้งสุดท้าย',
          en: 'The AI misremembered — the last mission was Apollo 11, not Apollo 17. Apollo 11 in 1969 was the final lunar landing.',
        },
        correct: false,
      },
      {
        id: 'never-happened',
        label: {
          th: 'AI แต่งเรื่องขึ้นมา — มนุษย์ไม่เคยออกไปไกลกว่าวงโคจรระดับต่ำเลย ภารกิจ Apollo ทั้งหกครั้งถูกจัดขึ้นในวงโคจรโลกเท่านั้น',
          en: 'The AI fabricated it — humans have never left low Earth orbit. All six crewed Apollo missions stayed in Earth orbit, not the Moon.',
        },
        correct: false,
      },
    ],
    failureMode: { th: 'ความรู้ที่ล้าสมัย (Stale Knowledge)', en: 'Stale knowledge' },
    checkNextTime: {
      th: 'ถามก่อนว่า "ข้อมูลของคุณอัปเดตถึงเมื่อไร" ทุกครั้งที่คำตอบเกี่ยวกับวันที่ เหตุการณ์ล่าสุด หรือสิ่งที่ยังเกิดขึ้นอยู่ คำตอบที่เคยถูก ไม่ได้แปลว่ายังถูกอยู่วันนี้',
      en: 'Ask "how recent is your information?" whenever the answer involves a date, a latest event, or anything still unfolding. An answer that used to be right does not stay right.',
    },
    reveal: {
      th: 'คำตอบของ AI เคยถูกต้อง — จนถึงเดือนเมษายน 2026 ภารกิจ Artemis II ปล่อยตัวเมื่อ 1 เมษายน 2026 และลงจอดในทะเลเมื่อ 10 เมษายน 2026 ลูกเรือคือ Reid Wiseman, Victor Glover, Christina Koch (NASA) และ Jeremy Hansen (CSA) พวกเขาคือมนุษย์กลุ่มแรกที่ออกไปไกลกว่าวงโคจรระดับต่ำนับตั้งแต่ปี 1972 สังเกตว่า AI ไม่เคยดึงเอกสารปี 2026 มาเลย — มันตอบจากสิ่งที่มันรู้ ไม่ใช่สิ่งที่มันหาเจอ บทเรียน: ความลื่นไหลไม่ใช่ความสดใหม่ ตรวจสอบ "วันที่" ของความรู้เสมอ',
      en: 'The AI\'s answer was true — until April 2026. Artemis II launched on 1 April 2026 and splashed down on 10 April 2026. Crew: Reid Wiseman, Victor Glover, Christina Koch (NASA) and Jeremy Hansen (CSA) — the first humans beyond low Earth orbit since 1972. Notice the AI never retrieved a single 2026 document. It answered from what it knew, not from what it found. Lesson: fluency is not freshness. Always check the date on the knowledge.',
    },
  },

  // ── 🟡 CASE 2 — Milan-Cortina medal table — fabricated specifics ───────────
  {
    id: 'olympics',
    order: 2,
    difficulty: 'medium',
    question: {
      th: 'ประเทศใดครองอันดับหนึ่งของตารางเหรียญรางวัลในโอลิมปิกฤดูหนาว Milan-Cortina 2026 และได้กี่เหรียญ?',
      en: 'Which country topped the medal table at the Milan-Cortina 2026 Winter Olympics, and with how many medals?',
    },
    storyboard: [
      {
        emoji: '🏅',
        caption: {
          en: 'A journalist is on deadline and needs the final medal table.',
          th: 'นักข่าวใกล้ถึงเดดไลน์ และต้องการตารางเหรียญรางวัลรอบสุดท้าย',
        },
      },
      {
        emoji: '📊',
        caption: {
          en: 'The AI gives exact numbers. Gold, total, runners-up — all of it.',
          th: 'AI ให้ตัวเลขมาแบบเป๊ะ ๆ ทั้งเหรียญทอง ยอดรวม และอันดับรองลงมา',
        },
      },
      {
        emoji: '📄',
        caption: {
          en: 'The official table is sitting right there in the evidence.',
          th: 'ตารางอย่างเป็นทางการก็วางอยู่ตรงนั้นในหลักฐานแล้ว',
        },
      },
    ],
    aiAnswer: {
      th: 'นอร์เวย์ครองอันดับหนึ่งของตารางเหรียญรางวัลในโอลิมปิกฤดูหนาว Milan-Cortina 2026 ด้วยเหรียญทอง 16 เหรียญ และรวมทั้งหมด 38 เหรียญ ตามมาด้วยสหรัฐอเมริกาและเยอรมนี',
      en: 'Norway topped the medal table at the Milan-Cortina 2026 Winter Olympics with 16 gold medals and 38 medals in total, followed by the United States and Germany.',
    },
    docs: [
      {
        filename: 'official_medal_table.html',
        kind: 'table',
        found: true,
        fictional: false,
        title: { th: 'ตารางเหรียญรางวัลอย่างเป็นทางการ — Milano Cortina 2026', en: 'Official medal table — Milano Cortina 2026' },
        body: {
          th: 'นอร์เวย์: ทอง 18 เงิน 12 ทองแดง 11 — รวม 41\nสหรัฐอเมริกา: ทอง 12 เงิน 12 ทองแดง 9 — รวม 33\nอิตาลี: ทอง 10 เงิน 6 ทองแดง 14 — รวม 30\nเยอรมนี: ทอง 8 เงิน 10 ทองแดง 8 — รวม 26\nญี่ปุ่น: ทอง 5 เงิน 7 ทองแดง 12 — รวม 24',
          en: 'Norway: 18 gold, 12 silver, 11 bronze — 41 total\nUnited States: 12 gold, 12 silver, 9 bronze — 33 total\nItaly: 10 gold, 6 silver, 14 bronze — 30 total\nGermany: 8 gold, 10 silver, 8 bronze — 26 total\nJapan: 5 gold, 7 silver, 12 bronze — 24 total',
        },
        sourceUrl: 'https://www.olympics.com/en/milano-cortina-2026/medals',
      },
      {
        filename: 'nbc_final_medal_count.html',
        kind: 'headline',
        found: true,
        fictional: false,
        title: { th: 'NBC: สรุปเหรียญรางวัลสุดท้าย Milan Cortina 2026', en: 'NBC: Final medal count, Milan Cortina 2026' },
        body: {
          th: 'นอร์เวย์ทำลายสถิติของตัวเองด้วยจำนวนเหรียญรวมสูงสุดในโอลิมปิกฤดูหนาว — 41 เหรียญ และเหรียญทอง 18 เหรียญ',
          en: 'Norway broke its own record for most medals won at a Winter Olympic Games — 41 medals, including 18 golds.',
        },
        sourceUrl: 'https://www.nbcolympics.com/news/final-medal-count-2026-milan-cortina-winter-olympics-and-paralympics',
      },
      {
        filename: 'norway_medal_breakdown.pdf',
        kind: 'chart',
        found: false, // ← THE GAP
        fictional: false,
        title: { th: 'รายละเอียดเหรียญของนอร์เวย์ แยกตามกีฬา', en: 'Norway medal breakdown by sport' },
      },
    ],
    options: [
      {
        id: 'ai-correct',
        label: {
          th: 'AI ตอบถูกทั้งหมด — ตัวเลขทอง 16 รวม 38 เหรียญตรงกับประกาศอย่างเป็นทางการของคณะกรรมการโอลิมปิกสากลในพิธีปิด',
          en: 'The AI is entirely correct — the 16-gold, 38-medal total matches the IOC\'s official closing-ceremony announcement.',
        },
        correct: false,
      },
      {
        id: 'wrong-country',
        label: {
          th: 'ผิดประเทศ — นอร์เวย์ไม่ได้อันดับหนึ่ง แชมป์เหรียญรวมที่แท้จริงคือสหรัฐอเมริกา ซึ่งครองอันดับหนึ่งในสเก็ตความเร็วเกือบทุกรายการ',
          en: 'Wrong country — Norway did not top the table. The real leader was the United States, which swept nearly every speed-skating event.',
        },
        correct: false,
      },
      {
        id: 'invented-numbers',
        label: {
          th: 'ถูกประเทศ — แต่ตัวเลขถูกแต่งขึ้น ของจริงคือทอง 18 เหรียญ รวม 41 เหรียญ ซึ่งเป็นสถิติใหม่ และอันดับสามคืออิตาลี ไม่ใช่เยอรมนี',
          en: 'Right country — but the numbers are invented. It was actually 18 gold and 41 medals total, a new record, and third place was Italy, not Germany.',
        },
        correct: true,
      },
      {
        id: 'not-happened',
        label: {
          th: 'โอลิมปิกครั้งนี้ยังไม่เกิดขึ้น — Milan-Cortina 2026 ถูกเลื่อนไปปี 2027 เพราะสนามแข่งขันที่ Cortina d\'Ampezzo สร้างไม่ทัน',
          en: 'These Olympics have not happened yet — Milan-Cortina 2026 was postponed to 2027 after venue construction fell behind schedule.',
        },
        correct: false,
      },
    ],
    failureMode: { th: 'การแต่งตัวเลขที่เฉพาะเจาะจง (Fabricated Specifics)', en: 'Fabricated specifics' },
    checkNextTime: {
      th: 'รูปร่างของคำตอบถูก ไม่ได้แปลว่าตัวเลขถูก ตัวเลขที่เจาะจงทุกตัวต้องเอาไปเทียบกับแหล่งต้นทาง ไม่ใช่แค่อ่านแล้วรู้สึกว่าสมเหตุสมผล',
      en: 'The right shape of an answer is not the right numbers. Check every specific figure against the source — plausible is not the same as verified.',
    },
    reveal: {
      th: 'AI ได้ "รูปร่าง" ของคำตอบถูก แต่ได้ "ตัวเลข" ผิด ของจริง: นอร์เวย์ได้ทอง 18 เหรียญ รวม 41 เหรียญ (สถิติใหม่ของโอลิมปิกฤดูหนาว) ไม่ใช่ 16 และ 38 และอันดับสามคืออิตาลี ไม่ใช่เยอรมนี สังเกตว่าเอกสารที่หายไปคือ "รายละเอียดเหรียญของนอร์เวย์" — และตัวเลขที่ AI แต่งขึ้นก็คือตัวเลขที่ควรอยู่ในเอกสารนั้นพอดี บทเรียน: คำตอบที่อันตรายที่สุด คือคำตอบที่มีรูปร่างเหมือนคำตอบที่ถูกต้องทุกประการ ตัวเลขต้องอ่าน ไม่ใช่เดา',
      en: 'The AI got the shape right and the numbers wrong. Actual: Norway won 18 gold and 41 total — a Winter Games record — not 16 and 38. And third place was Italy, not Germany. Notice which document was missing: Norway\'s medal breakdown. The numbers the AI invented are exactly the numbers that document would have contained. Lesson: the most dangerous wrong answer is the one shaped exactly like a right one. Numbers must be read, not vibed.',
    },
  },

  // ── 🟠 CASE 3 — The fake citation — right answer, invented source ──────────
  {
    id: 'citation',
    order: 3,
    difficulty: 'hard',
    question: {
      th: 'มีทนายความถูกลงโทษจริงหรือไม่ จากการยื่นคำร้องที่อ้างอิงคดีความซึ่ง AI แต่งขึ้นมา?',
      en: 'Have lawyers actually been punished for submitting AI-invented case law?',
    },
    storyboard: [
      {
        emoji: '⚖️',
        caption: {
          en: 'A lawyer asks whether anyone has been punished for citing fake cases.',
          th: 'ทนายคนหนึ่งถามว่า เคยมีใครโดนลงโทษเพราะอ้างคดีปลอมบ้างไหม',
        },
      },
      {
        emoji: '📚',
        caption: {
          en: 'The AI says yes — and names the case, the court, and the fine.',
          th: 'AI ตอบว่าเคย พร้อมบอกชื่อคดี ศาล และค่าปรับมาให้ครบ',
        },
      },
      {
        emoji: '❓',
        caption: {
          en: 'A right answer and a wrong source are not the same thing.',
          th: 'คำตอบที่ถูก กับแหล่งอ้างอิงที่ผิด ไม่ใช่เรื่องเดียวกัน',
        },
      },
    ],
    aiAnswer: {
      th: 'มีครับ กรณีที่เป็นบรรทัดฐานคือคดี Hendricks v. Meridian Logistics Corp., No. 24-CV-8871 (N.D. Cal. 2026) ซึ่งศาลได้ปรับทนายความเป็นเงิน 22,000 ดอลลาร์ หลังพบว่าคำร้องอ้างอิงคดีที่ไม่มีอยู่จริงถึง 9 คดี คดีนี้ถูกอ้างถึงอย่างกว้างขวางในฐานะคำตัดสินสำคัญเรื่องการใช้ AI ในวงการกฎหมาย',
      en: 'Yes. The landmark case is Hendricks v. Meridian Logistics Corp., No. 24-CV-8871 (N.D. Cal. 2026), in which the court fined the attorneys $22,000 after their filing was found to cite nine non-existent cases. It is widely cited as the leading decision on AI use in legal practice.',
    },
    docs: [
      {
        filename: 'aba_litigation_news_2026.html',
        kind: 'headline',
        found: true,
        fictional: false,
        title: { th: 'ABA Litigation News: รายงานเรื่องบทลงโทษจากการอ้างอิงคดีปลอมที่สร้างโดย AI', en: 'ABA Litigation News: coverage of sanctions over AI-fabricated case citations' },
        body: {
          th: 'ศาลอุทธรณ์เขต 6 ลงโทษทนายความสองคนในคดี Whiting v. City of Athens โดยปรับคนละ 15,000 ดอลลาร์ จากการอ้างอิงคดีปลอมกว่า 24 รายการ',
          en: 'The Sixth Circuit sanctioned two attorneys in Whiting v. City of Athens, ordering $15,000 each in punitive sanctions over 24+ fake citations.',
        },
        sourceUrl: 'https://www.americanbar.org/groups/litigation/resources/litigation-news/2026/fake-cases-real-sanctions-dangers-ai/',
      },
      {
        filename: 'npr_ai_legal_penalties.html',
        kind: 'excerpt',
        found: true,
        fictional: false,
        title: { th: 'NPR: รายงานแนวโน้มบทลงโทษจากการใช้ AI ในวงการกฎหมาย', en: 'NPR: coverage of the growing trend of AI-related legal penalties' },
        body: {
          th: 'นักวิจัยที่ติดตามเรื่องนี้พบกรณีมากกว่า 1,200 รายการ โดยราว 800 รายการมาจากศาลในสหรัฐฯ ศาลลงโทษปรับรวมราว 145,000 ดอลลาร์ในไตรมาสแรกของปี 2026',
          en: 'A researcher tracking instances has found more than 1,200 to date, about 800 of them from U.S. courts. Courts levied roughly $145,000 in penalties in Q1 2026 alone.',
        },
        sourceUrl: 'https://www.npr.org/2026/04/03/nx-s1-5761454/penalties-stack-up-ai-spreads-through-legal-system',
      },
      {
        filename: 'ny_daily_record_sanctions.html',
        kind: 'headline',
        found: true,
        fictional: false,
        title: { th: 'ศาลนิวยอร์กลงโทษทนายความและสำนักงานกฎหมาย', en: 'New York court sanctions attorney and law firm' },
        body: {
          th: 'ศาลอุทธรณ์นิวยอร์กสั่งปรับทนายความและสำนักงาน 10,500 ดอลลาร์ หลังคำร้องที่ใช้ AI ช่วยร่างมีการอ้างอิงคดีปลอม',
          en: 'A New York appellate court sanctioned an attorney and his firm $10,500 after an AI-assisted brief contained fake citations.',
        },
        sourceUrl: 'https://nydailyrecord.com/2026/06/26/new-york-attorney-law-firm-sanctioned-ai-fake-citations/',
      },
      {
        filename: 'federal_case_law_database.db',
        kind: 'excerpt',
        found: false, // ← THE GAP: the AI could not check whether its own citation exists
        fictional: false,
        title: { th: 'ฐานข้อมูลคำพิพากษาของศาลรัฐบาลกลาง (ค้นหาเลขคดี)', en: 'Federal case-law database (docket lookup)' },
      },
    ],
    options: [
      {
        id: 'ai-correct',
        label: {
          th: 'AI ตอบถูกทั้งหมด — คดี Hendricks v. Meridian Logistics Corp. เลขคดี 24-CV-8871 มีบันทึกอยู่จริงในระบบศาลแขวงแคลิฟอร์เนียเหนือ',
          en: 'The AI is entirely correct — the case, docket number, and court are all on file in the Northern District of California.',
        },
        correct: false,
      },
      {
        id: 'claim-false',
        label: {
          th: 'ข้ออ้างเป็นเท็จ — ไม่เคยมีทนายความถูกลงโทษจริง ศาลเพียงตักเตือนด้วยวาจาหรือสั่งแก้ไขคำร้องใหม่เท่านั้น',
          en: 'The claim is false — no lawyer has actually been punished. Courts have only issued verbal warnings or ordered refiling.',
        },
        correct: false,
      },
      {
        id: 'invented-source',
        label: {
          th: 'ข้ออ้าง "เป็นจริง" — แต่คดีที่ AI ยกมาอ้างนั้นไม่มีอยู่จริง มันแต่งแหล่งอ้างอิงขึ้นมาเอง แทนที่จะอ้างคดีจริงอย่าง Whiting v. City of Athens',
          en: 'The claim is TRUE — but the case the AI cites does not exist. It invented its own source instead of the real Whiting v. City of Athens sanctions.',
        },
        correct: true,
      },
      {
        id: 'wrong-amount',
        label: {
          th: 'AI ผิดแค่จำนวนเงินค่าปรับ — ชื่อคดีและศาลถูกต้อง แต่ค่าปรับจริงคือ 12,000 ดอลลาร์ ไม่ใช่ 22,000',
          en: 'The AI only got the fine amount wrong — the case name and court are accurate, but the real fine was $12,000, not $22,000.',
        },
        correct: false,
      },
    ],
    failureMode: { th: 'คำตอบถูก แต่แหล่งอ้างอิงถูกแต่งขึ้น (Fabricated Citation)', en: 'Right answer, invented source' },
    checkNextTime: {
      th: 'กดลิงก์ทุกครั้ง ถ้ามีการอ้างชื่อคดี เลขคดี งานวิจัย หรือมาตรากฎหมาย ให้เปิดดูว่ามีอยู่จริง ข้ออ้างที่ถูกต้อง กับแหล่งอ้างอิงที่ถูกแต่งขึ้น อยู่ในคำตอบเดียวกันได้',
      en: 'Open the link. If a case number, a paper, or a statute is named, check that it exists — a true claim and an invented source live happily in the same answer.',
    },
    reveal: {
      th: '⚠️ คดี "Hendricks v. Meridian Logistics Corp." ไม่มีอยู่จริง AI แต่งมันขึ้นมาเอง — ชื่อคดี เลขคดี ศาล และค่าปรับ ทั้งหมดเป็นเรื่องแต่ง แต่ "ข้ออ้างหลัก" นั้นถูกต้อง! มีทนายความถูกลงโทษจริง: ศาลอุทธรณ์เขต 6 ปรับทนายคนละ 15,000 ดอลลาร์ (Whiting v. City of Athens), ศาลนิวยอร์กปรับ 10,500 ดอลลาร์, รวมค่าปรับราว 145,000 ดอลลาร์ในไตรมาสแรกปี 2026 และมีกรณีที่ถูกบันทึกไว้กว่า 1,200 รายการ สังเกตว่าเอกสารที่หายไปคือ "ฐานข้อมูลคำพิพากษา" — AI ไม่มีทางตรวจสอบได้เลยว่าคดีที่ตัวเองอ้างมีอยู่จริงหรือไม่ มันจึงแต่งขึ้นมาแทนที่จะบอกว่า "ไม่รู้" บทเรียน: ถูกต้อง ≠ เชื่อถือได้ คำตอบที่ถูกพร้อมแหล่งอ้างอิงปลอม ก็ยังคือความล้มเหลว — และเป็นความล้มเหลวที่ทำให้คนเสียอาชีพมาแล้วกว่า 1,200 ครั้ง',
      en: '⚠️ "Hendricks v. Meridian Logistics Corp." DOES NOT EXIST. The AI invented it — the party names, the docket number, the court, and the fine are all fabricated. But the underlying claim is TRUE. Lawyers really have been punished: the Sixth Circuit ordered $15,000 each against two attorneys (Whiting v. City of Athens); a New York court sanctioned an attorney and firm $10,500; courts levied ~$145K in Q1 2026; 1,200+ instances have been tracked. Notice the missing document: the case-law database. The AI had no way to check whether its own citation existed — so it invented one rather than admit it did not know. Lesson: correct ≠ trustworthy. A right answer with a fake source is still a failure — and it is the failure that has ended careers over 1,200 times.',
    },
  },

  // ── 🔴 CASE 4 — NovaBrew — right numbers, wrong conclusion (FICTIONAL) ─────
  {
    id: 'novabrew',
    order: 4,
    difficulty: 'expert',
    question: {
      th: 'จากรายงานผลประกอบการไตรมาส 1/2026 ของ NovaBrew — AI สรุปได้ถูกต้องหรือไม่?',
      en: 'Based on NovaBrew\'s Q1 2026 results — is the AI\'s conclusion sound?',
    },
    storyboard: [
      {
        emoji: '📈',
        caption: {
          en: 'A manager pastes in the quarterly numbers and asks what they mean.',
          th: 'ผู้จัดการวางตัวเลขผลประกอบการรายไตรมาสให้ แล้วถามว่ามันแปลว่าอะไร',
        },
      },
      {
        emoji: '🤖',
        caption: {
          en: 'Every figure the AI quotes back is correct.',
          th: 'ตัวเลขทุกตัวที่ AI ยกกลับมาอ้าง ถูกต้องหมด',
        },
      },
      {
        emoji: '🧩',
        caption: {
          en: 'Right numbers can still add up to the wrong conclusion.',
          th: 'ตัวเลขถูกทุกตัว ก็ยังนำไปสู่ข้อสรุปที่ผิดได้',
        },
      },
    ],
    aiAnswer: {
      th: 'NovaBrew มีไตรมาสที่แข็งแกร่ง รายได้เติบโต 12.5% เป็น 270 ล้านบาท ขณะที่ขยายสาขาจาก 120 เป็น 150 สาขา เห็นได้ชัดว่าการขยายสาขากำลังขับเคลื่อนการเติบโต NovaBrew ควรเร่งเปิดสาขาเพิ่ม',
      en: 'NovaBrew had a strong quarter. Revenue grew 12.5% to ฿270M while the chain expanded from 120 to 150 stores. The expansion is clearly driving growth — NovaBrew should accelerate store openings.',
    },
    docs: [
      {
        filename: 'novabrew_q1_2026_internal.xlsx',
        kind: 'table',
        found: true,
        fictional: true,
        title: { th: '[บริษัทสมมติ] NovaBrew — รายงานภายใน ไตรมาส 1/2026', en: '[FICTIONAL COMPANY] NovaBrew — internal report, Q1 2026' },
        body: {
          th: 'ตัวชี้วัด | ไตรมาส 4/2025 | ไตรมาส 1/2026 | เปลี่ยนแปลง\nจำนวนสาขา | 120 | 150 | +25%\nรายได้รวม | 240 ล้านบาท | 270 ล้านบาท | +12.5%\nรายได้ต่อสาขา | 2.00 ล้านบาท | 1.80 ล้านบาท | −10%',
          en: 'Metric | Q4 2025 | Q1 2026 | Change\nStores | 120 | 150 | +25%\nTotal revenue | ฿240M | ฿270M | +12.5%\nRevenue per store | ฿2.00M | ฿1.80M | −10%',
        },
      },
      {
        filename: 'novabrew_store_openings.csv',
        kind: 'chart',
        found: true,
        fictional: true,
        title: { th: '[บริษัทสมมติ] NovaBrew — บันทึกการเปิดสาขา', en: '[FICTIONAL COMPANY] NovaBrew — store opening log' },
        body: {
          th: 'เปิดสาขาใหม่ 30 แห่งในไตรมาส 1/2026 ทุกสาขาเปิดดำเนินการเต็มไตรมาส',
          en: '30 new stores opened in Q1 2026. All were open for the full quarter.',
        },
      },
    ],
    options: [
      {
        id: 'ai-correct',
        label: {
          th: 'AI สรุปถูกต้อง — ควรเร่งขยายสาขา เพราะรายได้รวมโตขึ้นทุกไตรมาสติดต่อกันมาสี่ไตรมาสแล้ว จึงไม่มีเหตุผลให้เปลี่ยนทิศทาง',
          en: 'The AI is correct — accelerate the expansion. Total revenue has grown for four straight quarters, so there is no reason to change course.',
        },
        correct: false,
      },
      {
        id: 'numbers-wrong',
        label: {
          th: 'AI อ้างตัวเลขผิด — รายได้ไม่ได้โต 12.5% รายงานภายในจริง ๆ แสดงการเติบโตเพียง 8% เพราะ AI ปัดเศษตัวเลขผิดพลาด',
          en: 'The AI misquoted the numbers — revenue did not grow 12.5%. The internal report actually shows only 8% growth; the AI misread the figure.',
        },
        correct: false,
      },
      {
        id: 'bad-inference',
        label: {
          th: 'ตัวเลขทุกตัวถูกต้อง — แต่ข้อสรุปไม่สมเหตุสมผล สาขาโต 25% แต่รายได้โตแค่ 12.5% แปลว่ารายได้ต่อสาขา "ลดลง" 10%',
          en: 'Every number is right — but the conclusion does not follow. Stores grew 25% while revenue grew only 12.5%, so revenue per store FELL 10%.',
        },
        correct: true,
      },
      {
        id: 'missing-doc',
        label: {
          th: 'มีเอกสารสำคัญหายไปจากแฟ้มคดี — รายงานต้นทุนการเปิดสาขาใหม่ไม่ได้ถูกดึงมาด้วย ทำให้ประเมินกำไรจากการขยายสาขาไม่ได้',
          en: 'A key document is missing from the Case File — the new-store cost report was never retrieved, so profitability cannot be assessed.',
        },
        correct: false,
      },
    ],
    failureMode: { th: 'การให้เหตุผลที่ผิดพลาด (Flawed Reasoning)', en: 'Flawed reasoning' },
    checkNextTime: {
      th: 'ตัวเลขถูกครบทุกตัว ก็ยังสรุปผิดได้ แยกสองคำถามออกจากกันเสมอ: "ตัวเลขนี้จริงไหม" กับ "ตัวเลขนี้แปลว่าอย่างที่เขาสรุปจริงไหม"',
      en: 'Every number can be right and the conclusion still wrong. Keep two questions apart: is this figure true, and does this figure mean what they say it means?',
    },
    reveal: {
      th: '👀 สังเกตให้ดี: การค้นหาเอกสารครั้งนี้ "ครบถ้วน" ไม่มีเอกสารหายไปแม้แต่ชิ้นเดียว และตัวเลขทุกตัวที่ AI ยกมาก็ "ถูกต้องทั้งหมด" รายได้โต 12.5% จริง สาขาเพิ่มจาก 120 เป็น 150 จริง แล้วมันผิดตรงไหน? สาขาเพิ่มขึ้น 25% แต่รายได้เพิ่มแค่ 12.5% นั่นแปลว่ารายได้ "ต่อสาขา" ลดลงจาก 2.00 เหลือ 1.80 ล้านบาท — ลดลง 10% การเติบโตไม่ได้มาจากความสำเร็จ แต่มาจากการเปิดสาขาเพิ่มที่แต่ละสาขาทำได้แย่ลงกว่าเดิม ดังนั้น "เร่งเปิดสาขา" คือคำแนะนำที่ผิดพลาดที่สุด — และข้อมูลที่ AI ยกมาเองก็บอกอย่างนั้น บทเรียน: การตรวจสอบข้อเท็จจริง ไม่เหมือนกับการตรวจสอบการให้เหตุผล ถ้าคุณไล่เช็กทุกตัวเลข คำตอบนี้จะผ่านฉลุย นี่คือความผิดพลาดประเภทที่รอดสายตาคนตรวจได้บ่อยที่สุด — และเป็นจุดที่วิจารณญาณของมนุษย์ทดแทนไม่ได้จริง ๆ',
      en: '👀 Notice: the retrieval was CLEAN. Nothing was missing. And every number the AI quoted is CORRECT — revenue really did grow 12.5%, stores really did go from 120 to 150. So where is the failure? Stores grew 25% while revenue grew only 12.5%. That means revenue PER STORE fell from ฿2.00M to ฿1.80M — down 10%. The growth is not coming from success; it is coming from adding stores that each perform worse than the ones before. "Accelerate openings" is therefore precisely the wrong prescription — and the data the AI itself cited says so. Lesson: verifying the facts is not the same as verifying the inference. Fact-check every figure and this answer sails through. This is the class of error most likely to survive review — and the place where human judgment is genuinely irreplaceable.',
    },
  },

  // ── ⚫ CASE 5 — The goblin shark — THE AI IS CORRECT ───────────────────────
  {
    id: 'goblinshark',
    order: 5,
    difficulty: 'final',
    question: {
      th: 'ในปี 2026 นักวิทยาศาสตร์ถ่ายวิดีโอฉลามก็อบลินที่ยังมีชีวิตอยู่ในถิ่นอาศัยธรรมชาติใต้ทะเลลึกได้เป็นครั้งแรกจริงหรือไม่?',
      en: 'In 2026, did scientists really film a living goblin shark in its natural deep-sea habitat for the first time?',
    },
    storyboard: [
      {
        emoji: '🦈',
        caption: {
          en: 'A researcher asks about a deep-sea filming claim from this year.',
          th: 'นักวิจัยถามถึงข่าวการถ่ายวิดีโอใต้ทะเลลึกเมื่อปีนี้',
        },
      },
      {
        emoji: '🎥',
        caption: {
          en: 'The AI answers carefully, with the documents to back it.',
          th: 'AI ตอบอย่างระมัดระวัง พร้อมมีเอกสารอ้างอิงประกอบ',
        },
      },
      {
        emoji: '🤔',
        caption: {
          en: 'By now you have caught it four times. That is its own trap.',
          th: 'มาถึงตรงนี้ คุณจับผิดมันมาสี่ครั้งแล้ว ซึ่งนั่นก็เป็นกับดักในตัวมันเอง',
        },
      },
    ],
    aiAnswer: {
      th: 'จริงครับ ในปี 2026 ทีมวิจัยจาก University of Hawaiʻi at Mānoa ถ่ายวิดีโอฉลามก็อบลิน (goblin shark) ที่ยังมีชีวิตในถิ่นอาศัยธรรมชาติใต้ทะเลลึกได้เป็นครั้งแรก โดยพบสองตัว — ตัวหนึ่งใกล้ภูเขาใต้ทะเลแถบเกาะ Jarvis และอีกตัวที่ลาดร่องลึก Tonga Trench ซึ่งลึกกว่าที่เคยรู้จักของสายพันธุ์นี้ราว 700 เมตร งานวิจัยตีพิมพ์ใน Journal of Fish Biology',
      en: 'Yes. In 2026, a research team from the University of Hawaiʻi at Mānoa filmed a living goblin shark in its natural deep-sea habitat for the first time. Two individuals were observed — one near a seamount by Jarvis Island, another on the slope of the Tonga Trench, roughly 700m deeper than the species was known to live. The work was published in the Journal of Fish Biology.',
    },
    docs: [
      {
        filename: 'physorg_goblin_shark_report.html',
        kind: 'excerpt',
        found: true,
        fictional: false,
        title: {
          th: 'phys.org: รายงานงานวิจัยที่ตีพิมพ์ใน Journal of Fish Biology',
          en: 'phys.org — reporting on the study published in the Journal of Fish Biology',
        },
        body: {
          th: 'ทีมวิจัยจาก University of Hawaiʻi at Mānoa รายงานการพบฉลามก็อบลินที่มีชีวิตสองตัวในธรรมชาติ การพบที่ Tonga Trench สร้างสถิติความลึกใหม่ของอันดับ Lamniformes ทั้งอันดับ',
          en: 'A University of Hawaiʻi at Mānoa team reports two healthy goblin sharks observed in the wild. The Tonga Trench sighting establishes a new depth record for the entire order Lamniformes.',
        },
        sourceUrl: 'https://phys.org/news/2026-06-rare-deep-sea-goblin-sharks.html',
      },
      {
        filename: 'smithsonian_coverage.html',
        kind: 'headline',
        found: true,
        fictional: false,
        title: { th: 'Smithsonian Magazine: ฉลามก็อบลิน ถูกถ่ายภาพในถิ่นอาศัยเป็นครั้งแรก', en: 'Smithsonian Magazine: Elusive goblin shark filmed for the first time in its deep-sea habitat' },
        body: {
          th: 'ก่อนหน้านี้ ทุกครั้งที่มีการบันทึกภาพฉลามก็อบลินที่ยังมีชีวิต ล้วนเกิดขึ้นหลังจากมันติดเบ็ดและถูกนำขึ้นสู่ผิวน้ำ ซึ่งมันมักตายในเวลาไม่นาน',
          en: 'Until now, every confirmed observation of a live goblin shark came only after the animal was hooked and brought to the surface, where it typically died soon after.',
        },
        sourceUrl: 'https://www.smithsonianmag.com/smart-news/ugliest-shark-on-the-planet-see-the-elusive-goblin-shark-filmed-for-the-first-time-in-its-deep-sea-habitat-180988950/',
      },
      {
        filename: 'sciencedaily_report.html',
        kind: 'excerpt',
        found: true,
        fictional: false,
        title: { th: 'ScienceDaily: ฉลามก็อบลินหายาก ถูกถ่ายวิดีโอขณะมีชีวิตในทะเลลึก', en: 'ScienceDaily: Rare goblin shark filmed alive in the deep sea' },
        body: {
          th: 'ฉลามก็อบลินเป็น "ฟอสซิลมีชีวิต" ที่มีอายุสายพันธุ์ราว 125 ล้านปี',
          en: 'The goblin shark is a "living fossil" whose lineage dates back some 125 million years.',
        },
        sourceUrl: 'https://www.sciencedaily.com/releases/2026/07/260708022208.htm',
      },
    ],
    options: [
      {
        id: 'ai-correct',
        label: {
          th: 'AI ตอบถูกต้อง — เรื่องนี้เกิดขึ้นจริงทุกประการ ทั้งสัตว์ นักวิจัย สถานที่ที่ Jarvis Island และ Tonga Trench และงานตีพิมพ์',
          en: 'The AI is CORRECT — every part of this actually happened: the animal, the researchers, the Jarvis Island and Tonga Trench locations, and the journal.',
        },
        correct: true,
      },
      {
        id: 'invented-animal',
        label: {
          th: 'AI แต่งขึ้น — "ฉลามก็อบลิน" ไม่ใช่สัตว์ที่มีอยู่จริง ชื่อนี้มาจากนิยายทะเลลึกที่ถูกผสมกับภาพ CGI จนดูสมจริง',
          en: 'The AI made it up — the "goblin shark" is not real. The name comes from a deep-sea novel paired with realistic CGI images.',
        },
        correct: false,
      },
      {
        id: 'invented-detail',
        label: {
          th: 'สัตว์มีจริง แต่ AI แต่งรายละเอียดเรื่อง Tonga Trench ขึ้นมา ตัวที่พบจริงอยู่ใกล้ชายฝั่งญี่ปุ่นเท่านั้น ไม่มีสถิติความลึกใหม่',
          en: 'The animal is real, but the AI invented the Tonga Trench detail. The real sightings were near Japan, with no new depth record.',
        },
        correct: false,
      },
      {
        id: 'wrong-year',
        label: {
          th: 'เรื่องนี้เกิดขึ้นจริง แต่ไม่ใช่ปี 2026 — วิดีโอฉลามก็อบลินตัวแรกในถิ่นอาศัยจริงถ่ายไว้ตั้งแต่ปี 2019 โดยทีมญี่ปุ่น',
          en: 'It really happened, but not in 2026 — the first video of a living goblin shark in its habitat was actually filmed in 2019.',
        },
        correct: false,
      },
    ],
    failureMode: { th: 'ไม่มีความผิดพลาด — AI ตอบถูก', en: 'No failure — the AI is right' },
    checkNextTime: {
      th: 'การไม่เชื่อไว้ก่อน ไม่ใช่การตรวจสอบ ข้อนี้ AI ตอบถูกและเอกสารครบถ้วน สิ่งที่ต้องฝึกคือการ "ไปดูแหล่งที่มา" ไม่ใช่การ "ระแวงทุกคำตอบ" — คนที่ระแวงทุกข้อ ก็ตอบข้อนี้ผิดเหมือนกัน',
      en: 'Doubt is not verification. The AI was right here and the documents backed it up. The habit to build is checking the source, not distrusting by reflex — reflexive doubt got this one wrong too.',
    },
    reveal: {
      th: '🎯 คดีสุดท้าย: AI ตอบถูก ทุกคำ ฉลามก็อบลินมีจริง ทีมวิจัยจาก University of Hawaiʻi at Mānoa ถ่ายวิดีโอมันได้จริงในปี 2026 พบสองตัวจริง ที่ Jarvis Island และ Tonga Trench จริง และการพบที่ Tonga Trench ก็สร้างสถิติความลึกใหม่ของอันดับ Lamniformes จริง ตีพิมพ์ใน Journal of Fish Biology จริง สังเกตว่าการค้นหาเอกสาร "ครบถ้วน" — ไม่มีช่องว่างให้ AI ต้องเดา แล้วทำไมพวกเราส่วนใหญ่ถึงกาว่ามันมั่ว? เพราะผ่านมา 4 คดี เราถูกฝึกให้ "ไม่เชื่อ" และความไม่เชื่อแบบอัตโนมัติ ก็ขี้เกียจพอ ๆ กับความเชื่อแบบอัตโนมัติ นี่คือหัวใจของเวิร์กช็อปนี้: คิดกับ AI — อย่าแค่เชื่อมัน และอย่าแค่ปฏิเสธมัน',
      en: '🎯 The final case: the AI is RIGHT. Every word. The goblin shark is real. A University of Hawaiʻi at Mānoa team really did film it in 2026. Two individuals really were observed, near Jarvis Island and in the Tonga Trench. The Tonga sighting really did set a new depth record for the entire order Lamniformes. It really was published in the Journal of Fish Biology. Notice the retrieval was CLEAN — there was no gap for the AI to paper over. So why did most of us mark it false? Because four cases trained us to distrust — and reflexive doubt is exactly as lazy as reflexive trust. That is the whole point of this workshop: think WITH AI. Do not just trust it. And do not just doubt it either.',
    },
  },
]

export function getCase(id: string): DetectiveCase | undefined {
  return CASES.find((c) => c.id === id)
}

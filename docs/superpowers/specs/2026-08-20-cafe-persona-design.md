# Café Persona — design spec

**Date:** 2026-08-20 · **Replaces:** The Decision Room (KPI/shop simulator) on `/play` + `/biz`
**Working title:** Café Persona (ชื่อจริงให้ทีมตั้ง)

## 0. The pitch

A personality-typing game, not a scoring game. The audience are the owner of a café whose
customer base is *this room* — every question opens with one real figure from the room's own
registration survey, poses a business dilemma, and offers four defensible paths. No points, no
leaderboard, no winner. Each choice silently accumulates toward one of four decision-maker
personas; the finale reveals **your type** on your phone (MBTI-style card) and **the room's map**
on the projector (dots on a 2×2). The workshop's argument: *there is no 0 or 1 in deciding with
data — only different paths.* The engine enforces it: **no `correct` field exists anywhere in the
type system.**

Slot: 15–20 min. Written at 8 questions; trim after a live rehearsal (dropping questions is safe —
personas accumulate over whatever runs).

## 1. Personas

Two axes, four quadrants. **Axes and type labels are English** (framework language, like MBTI's
letters); everything conversational is Thai. Coffee names because the brewing method *is* the
decision style. All names are team-renameable without touching mechanics.

- Axis X: **GUT ↔ DATA** (what you trust)
- Axis Y: **MOVE FAST ↔ WAIT & SEE** (how fast you move)

| id | Quadrant | Label | Coffee | Thai archetype |
|---|---|---|---|---|
| `pioneer` | fast + gut | **THE PIONEER** | เอสเพรสโซ่ | นักบุกเบิก |
| `sprinter` | fast + data | **THE SPRINTER** | นิโทร | นักฉวยจังหวะ |
| `analyst` | slow + data | **THE ANALYST** | โคลด์บริว | นักวิเคราะห์ |
| `guardian` | slow + gut | **THE GUARDIAN** | พัวร์โอเวอร์ | ผู้พิทักษ์ |

(นักเชื่อมคน is not a quadrant; its people-flavor lives inside the PIONEER and GUARDIAN
descriptions.)

### Result card anatomy (phone, MBTI-style)

Emoji + English label / coffee + archetype / axis line (e.g. `DATA-DRIVEN × WAIT & SEE`) /
who-you-are (2–3 warm second-person Thai sentences) / **จุดแข็ง** / **ระวัง** (the loving flaw) /
**คู่หูที่เติมเต็ม** → always the *diagonal* type, reinforcing the closing line
*"ร้านที่ดีต้องมีครบทุกเมนู"*.

Draft card copy (team-editable, `content/persona.ts`):

- **PIONEER · เอสเพรสโซ่** — คุณคือคนที่กดช็อตแล้วเสิร์ฟเลย โลกของคุณหมุนเร็ว และคุณเชื่อว่าโอกาสไม่รอ
  ใคร เซนส์ของคุณคมเพราะประสบการณ์จริง ไม่ใช่เพราะเดา · จุดแข็ง: ได้ลงมือก่อนใคร สร้างโมเมนตัมเก่ง ·
  ระวัง: เร็วจนบางทีข้อมูลที่มีอยู่แล้วไม่ถูกเปิดอ่าน · คู่หู: THE ANALYST
- **SPRINTER · นิโทร** — คุณสกัดข้อมูลเก็บไว้ล่วงหน้าเหมือนโคลด์บริวในถัง พอจังหวะมาถึงคุณกดแท็ปเสิร์ฟ
  ทันที เร็วแต่ไม่มั่ว เพราะการบ้านทำมาแล้ว · จุดแข็ง: ทดลองเร็ว เรียนรู้เร็ว ปรับตัวไว · ระวัง:
  การทดลองที่เร็วเกินไปอาจวัดผลไม่ทันจบ · คู่หู: THE GUARDIAN
- **ANALYST · โคลด์บริว** — คุณไม่เชื่ออะไรง่าย ๆ จนกว่าตัวเลขจะพูด คุณยอมแช่ข้อมูล 18 ชั่วโมง
  เพื่อรสที่พลาดยาก การตัดสินใจของคุณอาจมาช้า แต่แทบไม่เคยต้องถอนคืน · จุดแข็ง: แม่นยำ พลาดยาก
  น่าเชื่อถือ · ระวัง: รอข้อมูลครบจนโอกาสหลุดมือ · คู่หู: THE PIONEER
- **GUARDIAN · พัวร์โอเวอร์** — คุณค่อย ๆ รินอย่างมีจังหวะ เชื่อในฝีมือ คุณภาพ และคนตรงหน้า
  คุณปกป้องสิ่งที่ร้านเป็นมากกว่าวิ่งตามทุกกระแส · จุดแข็ง: มั่นคง รักษาแก่นของทีมและแบรนด์ ·
  ระวัง: ระวังจนบางครั้งเสียจังหวะที่ควรขยับ · คู่หู: THE SPRINTER

## 2. Stage flow

```
lobby ──▶ [ ask ──▶ reveal ] × 8 ──▶ result
```

Host-paced (Space / on-screen controls, same facilitator token, same `/api/room/control`).
Back/advance/reset all work as today.

- **`lobby`** — title, QR, live player count. Reuses today's intro stage shell.
- **`ask`** — projector: the data hook (one survey figure, huge and colorful) + Thai scenario +
  choices A–D. Phones: the same four choices as tappable cards. Voting opens on stage entry.
  Soft 30s countdown, display-only: it nudges the room but **never auto-advances** — the host
  decides. Players can change their vote until reveal.
- **`reveal`** — voting closes. Projector: the room's split as four horizontal bars (counts +
  percent) + the authored **small-talk card**: one Thai paragraph honoring at least two paths.
  Phones: "รอฟังหน้าจอใหญ่" hold state showing which option you picked (no judgment styling).
- **`result`** — projector: the 2×2 map, English axes, one dot per player animated into their
  quadrant, count per type. Phones: your persona card. Zero-answer players get a graceful
  "มาสายไปนิด" state instead of a card.

## 3. Scoring & tie-break

Each choice carries exactly one `persona`. A player's tally is four counters; final type = the
max. Ties break by **axis lean**: every answer also contributes ±1 on each axis (fast/slow,
gut/data); the tied type matching the player's stronger absolute axis lean wins. If that still
ties (perfectly balanced player), precedence order `analyst > sprinter > guardian > pioneer` —
deterministic, documented, and rare at 8 questions. Missing answers simply don't contribute.

## 4. Data model — `content/persona.ts` (replaces `content/room.ts`)

```ts
type PersonaId = 'pioneer' | 'sprinter' | 'analyst' | 'guardian'

type Persona = {
  id: PersonaId
  label: string            // "THE ANALYST" — English
  coffee: string           // "โคลด์บริว"
  archetype: string        // "นักวิเคราะห์"
  emoji: string
  axis: { pace: 'fast' | 'slow'; trust: 'gut' | 'data' }
  description: string      // Thai, 2–3 sentences
  strength: string         // จุดแข็ง
  caution: string          // ระวัง
  partner: PersonaId       // diagonal
}

type Question = {
  id: string
  dataHook: { figure: string; caption: string }  // "15/18" + "ของคนในห้องนี้ขับรถมา"
  scenario: string                               // Thai dilemma, 1–2 sentences
  choices: [Choice, Choice, Choice, Choice]      // exactly one per persona (asserted)
  smallTalk: string                              // the reveal beat
}

type Choice = { label: string; persona: PersonaId }
```

**Data-hook honesty rule:** every `figure` is computed from `AUDIENCE`
(`content/audience.ts`) at module scope — never hand-typed — so re-running
`scripts/import-audience.ts` against a fresh CSV before the event updates every hook. A content
test walks each hook and re-derives it from `AUDIENCE`.

## 5. The eight questions (draft content, team-editable)

Figures below are from the current import (N=18); they self-update per §4. Choice order on
screen is shuffled per question in content (fixed, not runtime-random) so persona never maps to
letter position.

1. **Hook: 18/18 บอกว่า "รสชาติ" คือตัวตัดสินใจซื้อ.** Supplier ใหม่เสนอเมล็ดถูกลง 20%
   แต่รสต่างจากเดิมเล็กน้อย — เอาไง? · pioneer: ชิมเองแล้วตัดสินเลย เชื่อลิ้นตัวเอง · sprinter:
   สลับใช้ 1 สัปดาห์ ดูยอดขายจริง · analyst: จัด blind taste test เก็บคะแนนก่อนตัดสิน · guardian:
   ไม่เปลี่ยน รสชาติคือทั้งหมดของร้านเรา · smallTalk: ทั้งห้องพูดเป็นเสียงเดียวว่ารสชาติมาก่อน —
   คำถามจึงไม่ใช่ "ประหยัดไหม" แต่ "เสี่ยงกับแก่นของร้านแค่ไหน" ทุกทางเลือกกำลังจัดการความเสี่ยง
   ก้อนเดียวกัน ด้วยเครื่องมือคนละชิ้น
2. **Hook: 12/18 เลิกต่อคิวภายใน 10 นาที.** คิวหน้าร้านตอนเช้ายาว 15 นาที · pioneer:
   จ้างบาริสต้าเพิ่มพรุ่งนี้เลย · sprinter: เปิดพรีออเดอร์ผ่าน LINE วันนี้ วัดยอดใช้จริง · analyst:
   จับเวลาคิวทั้งสัปดาห์ หาคอขวดจริงก่อน · guardian: ยังไม่ขยาย เทรนทีมเดิมให้เร็วขึ้น ·
   smallTalk: ตัวเลขบอกว่าลูกค้าหายไปตรงนาทีที่ 10 — แต่ไม่ได้บอกว่า "เพราะอะไร" บางคนแก้ที่มือ
   บางคนแก้ที่ช่องทาง บางคนไปหาสาเหตุ ไม่มีใครผิด
3. **Hook: 13/18 จ่ายค่าเครื่องดื่มปกติ ฿50–100.** ตั้งราคาเมนู signature ใหม่ · pioneer: ฿120
   ไปเลย ของดีต้องกล้าตั้ง · sprinter: เปิดตัว ฿89 โปรสัปดาห์แรก แล้วปรับตามยอด · analyst:
   สำรวจ willingness-to-pay ก่อนตั้ง · guardian: อยู่ใน ฿50–100 ที่ลูกค้าเราอยู่จริง
4. **Hook: 8/18 — เครื่องดื่มแรกของวันคือ "น้ำเปล่า" (มากกว่ากาแฟ!).** เพิ่มเมนู non-coffee ไหม ·
   pioneer: เปิดไลน์เครื่องดื่มสุขภาพเลย · sprinter: ทำ pop-up เสาร์–อาทิตย์ วัดผลก่อน · analyst:
   ไปสัมภาษณ์ก่อน — ทำไมถึงเป็นน้ำเปล่า · guardian: โฟกัสเดิม เราคือร้านกาแฟ
5. **Hook: 15/18 ขับรถมา.** ห้องข้าง ๆ ว่าง — ทำที่จอดรถ หรือปล่อยผ่าน · pioneer: เซ็นเลย
   ที่จอดคือแต้มต่อ · sprinter: เช่าระยะสั้น 3 เดือน ทดลองก่อน · analyst: นับจำนวนรถที่วนแล้ว
   ไม่จอดต่อวันก่อนตัดสิน · guardian: ไม่เอา ภาระค่าเช่าเสี่ยงเกิน
6. **Hook: 8/18 ซื้อช่วง 7–9 โมงเช้า / 4 คน "ไม่ซื้อเลย".** ช่วงบ่ายร้านเงียบ · pioneer:
   จัด happy hour บ่ายพรุ่งนี้เลย · sprinter: ยิง flash promo บ่ายนี้ 14:00–16:00 ดูผลทันที ·
   analyst: ไปศึกษากลุ่ม "ไม่ซื้อเลย" — ตลาดใหม่หรือเปล่า · guardian: ลดชั่วโมงพนักงานช่วงบ่าย
   รักษากำไรไว้ก่อน
7. **Hook: 11/18 บอกว่า "ราคา" มีผล / 8/18 บอกว่า "โปรโมชัน" มีผล.** ร้านคู่แข่งเปิดฝั่งตรงข้าม
   ลด 50% ทั้งสัปดาห์ · pioneer: อัดโปรสวนกลับวันนี้ ให้ดังกว่า · sprinter: โปรเจาะจง —
   อัปไซส์ฟรีเฉพาะลูกค้าประจำสัปดาห์นี้ · analyst: ยังไม่ขยับ นับก่อนว่าลูกค้าประจำหายจริงกี่คน ·
   guardian: ไม่เล่นสงครามราคา ย้ำจุดแข็งเรื่องรสชาติ (18/18 ของห้องนี้เอง)
8. **Hook: 5/18 ตื่นก่อน 6 โมง.** เปิดร้านเร็วขึ้นเป็น 6:30 ไหม · pioneer: เปิดเลยจันทร์หน้า ·
   sprinter: ทดลองเปิดเช้า 2 สัปดาห์ เก็บตัวเลข · analyst: เอาข้อมูลเวลาตื่น × เวลาซื้อ
   มา cross ดูก่อน · guardian: เปิดเวลาเดิม ถนอมทีมไม่ให้ burnout

(smallTalk ข้อ 3–8 written at implementation, same register as 1–2.)

## 6. Store & API changes

Kept verbatim: routes `/play` `/biz`; endpoints `join` / `state` / `control` / `reset` (+ token
auth); seq-polling; process-global single-instance store; `PhoneBody`, `SlideFrame`,
`ResetButton`; the projector fit checker harness.

Rewritten inside `lib/room-store.ts` (same file, same globals):

- Stage machine: 12 authored stages → `lobby | ask(q) | reveal(q) | result` derived from
  `QUESTIONS` (advance/back walk the derived sequence).
- `/api/room/vote` body: `{ playerId, questionId, choiceIndex }`; re-vote allowed until reveal;
  rejected outside the matching `ask` stage.
- `/api/room/state` payload: phase, stage, `voteCount`, and — on reveal — that question's split;
  on result — the per-player persona (each phone receives only its own id's persona plus the
  room's quadrant counts; the projector receives all dots). Leaderboard fields deleted.

Deleted: `lib/room.ts` (simulator), `lib/pricing.ts`, KPI types in `lib/room-types.ts`,
`content/room.ts`, `content/room-labels.ts`, `components/room/Stages.tsx` + `stages.css`,
`Leaderboard`, `DataPanel`, `Bars`, `evidence.ts`, and their tests. `content/audience.ts` +
`scripts/import-audience.ts` survive as the data-hook source.

## 7. UI direction

**Bright, colorful, data-forward** (owner's call). Light warm-white ground (`#FFFDF7`-ish), dark
ink, and the four persona colors doubling as the entire data palette — every bar, dot, and choice
card uses its persona's color, so the color-coding teaches itself by the finale:

- PIONEER 🔥 warm red-orange · SPRINTER ⚡ amber-gold · ANALYST 🌊 cobalt blue · GUARDIAN 🌿 deep green

Data hooks render as oversized figures ("15/18") with the caption beneath — poster-sized, readable
from the back row. Reveal bars are thick, rounded, labeled with count + percent. The result map is
the visual finale: cream ground, hairline axes with English labels, persona-colored dots.
Height-budget typography (`min(clamp(...), Nvh)`) throughout; fit-checker walks every stage at
1366×768 and 1600×900. Single-theme (projector + event phones), colors painted explicitly.

## 8. Testing

- **Content:** each question has all four personas exactly once; hooks re-derive from `AUDIENCE`;
  every persona card complete; `partner` is always the diagonal.
- **Scoring:** tally, tie-break by axis lean, final-precedence determinism, partial-answer players.
- **Store:** vote gating per stage, re-vote, advance/back/reset walking the derived sequence,
  result payload privacy (a phone's state never contains another player's persona).
- **Components:** phone + projector stage rendering, Thai strings asserted from content.
- **Fit:** projector checker walks lobby → ask/reveal (q1, q8) → result at both resolutions,
  including the host-control visibility check.

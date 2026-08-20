# AI Detective v3 ("คดีเป็ดปากดี") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI Detective's 5-case / 4-option quiz with a 9-question / 2-button "ผ่าน–ตีกลับ" game in three acts, ending on a room-wide tally that sets up the host's Human-in-the-loop close.

**Architecture:** The server stays authoritative for clock, phase and score exactly as today — this is a content-shape and phase-machine change, not a transport change. `lib/game.ts` grows from 4 phases to 6, `lib/scoring.ts` swaps difficulty tiers for a streak multiplier, `lib/store.ts` keys answers by `questionId` and gains a per-player streak walk. The projector and phone re-render from the same polled state they already consume.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, TypeScript, Tailwind v4 (CSS-first, theme in `app/globals.css`), zod for content validation, vitest + @testing-library/react, playwright-core for the projector check.

**Spec:** `docs/superpowers/specs/2026-08-18-ai-detective-v3-design.md`

## Global Constraints

- **Thai only.** All player-facing copy is a plain `string`, never `{th, en}`. English appears only as `Act.nameEn`, a typographic subtitle on the act card. (spec §6b)
- **`ROUND_COUNT * MAX_SPEED_BONUS < BASE_POINTS`** — `9 * 10 = 90 < 100`. A test must assert it. (spec §4c)
- **No three consecutive `reject` questions.** Computed from content, never hardcoded. (spec §4d)
- **Speed bonus is never multiplied by the streak.** Doing so breaks the invariant above. (spec §4c)
- **`wrongPass` counts only `verdict === 'reject'` answered `pass`.** Rejecting a true answer is not counted. (spec §4e)
- The projector shows **top 5 only**; per-player rank lives on the phone. (spec §5a)
- Never read the wall clock inside `lib/game.ts` or `lib/scoring.ts` — `now` is always a parameter. (existing repo rule, `lib/room.ts` header)
- `FACILITATOR_TOKEN` guards every control route; unset means 403. Do not weaken. (README)
- The Decision Room (`app/biz`, `app/play`, `lib/room*.ts`, `lib/pricing.ts`, `lib/sim.ts`, `content/room*.ts`, `content/audience.ts`) is **out of bounds for every task in this plan.**

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/types.ts` *(modify)* | Add `Verdict`, `Question`, `Act` zod schemas + new `Phase`/`GameState`/`Answer`/`PublicGameState`. Keep `StoryPanel`/`Storyboard` — The Decision Room still imports them. |
| `content/questions.ts` *(create)* | The nine questions and three acts. The only file the facilitator edits. |
| `content/questions.test.ts` *(create)* | Content invariants, including the answer-key run check. |
| `lib/game.ts` *(rewrite)* | Pure phase machine: 6 phases, act boundaries, hold, expiry. |
| `lib/scoring.ts` *(rewrite)* | Flat base + streak multiplier + speed tiebreaker; one-pass player walk producing score **and** `wrongPass`. |
| `lib/store.ts` *(modify)* | Answers keyed by `questionId`, leaderboard, room tally, deterministic avatars. |
| `lib/avatars.ts` *(create)* | Deterministic `playerId → emoji`. Its own file so the store does not grow a second responsibility. |
| `app/api/answer/route.ts` *(modify)* | Accept `{playerId, questionId, verdict}`. |
| `app/api/control/route.ts` *(modify)* | Accept `start` \| `next` \| `hold`. |
| `app/api/stats/route.ts` *(modify)* | Top 5, room split, room `wrongPass` — TV-only payload. |
| `lib/stats.ts`, `app/dashboard/`, `app/reveal/` *(delete)* | The old stats payload and the two screens built on it. v3's projector reveal carries the split and the standings itself. |
| `app/page.tsx` *(rewrite)* | Phone: two buttons, per-phase panels. |
| `app/tv/page.tsx` *(rewrite)* | Projector: six phase renderers. |
| `components/game/*` | Retire `CaseFile`, `AnswerCards`, `Storyboard`, `Countdown`. Add `TimerBar`, `VerdictStamp`, `SplitBar`, `TopFive`, `ActCard`, `Tally`, `Podium`. |

---

## Task 1: Content types and the nine questions

**Files:**
- Modify: `lib/types.ts` (add after the existing `StoryboardSchema` block, ~line 36)
- Create: `content/questions.ts`
- Test: `content/questions.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `Verdict = 'pass' | 'reject'`; `Question = { id, act, order, ask, duckSays, highlight, verdict, truth, tell, needsCheck? }`; `Act = { n, nameTh, nameEn, body, atWork, chips }`; `QUESTIONS: Question[]` (source order), `ACTS: Act[]`, `getQuestion(id): Question | undefined`.

- [ ] **Step 1: Write the failing content test**

Create `content/questions.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { QUESTIONS, ACTS, getQuestion } from './questions'
import { QuestionSchema, ActSchema } from '@/lib/types'

describe('QUESTIONS', () => {
  it('has exactly 9 questions ordered 1..9 with unique ids', () => {
    expect(QUESTIONS).toHaveLength(9)
    expect([...QUESTIONS].map((q) => q.order).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(9)
  })

  it('every question is schema-valid (implies highlight is inside duckSays)', () => {
    for (const q of QUESTIONS) {
      const r = QuestionSchema.safeParse(q)
      expect(r.success, `${q.id}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
  })

  it('has three acts of three, and act numbers follow play order', () => {
    expect(ACTS).toHaveLength(3)
    for (const a of ACTS) {
      const r = ActSchema.safeParse(a)
      expect(r.success, `act ${a.n}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
    const byOrder = [...QUESTIONS].sort((x, y) => x.order - y.order)
    expect(byOrder.map((q) => q.act)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3])
  })

  it('has exactly three pass questions, at orders 2, 5 and 8', () => {
    const passes = QUESTIONS.filter((q) => q.verdict === 'pass').map((q) => q.order).sort((a, b) => a - b)
    expect(passes).toEqual([2, 5, 8])
  })

  // THE ANTI-GUESS INVARIANT (spec §4d). Computed from content — never hardcode the runs.
  it('never has three consecutive reject questions', () => {
    const byOrder = [...QUESTIONS].sort((x, y) => x.order - y.order)
    let run = 0
    let longest = 0
    for (const q of byOrder) {
      run = q.verdict === 'reject' ? run + 1 : 0
      longest = Math.max(longest, run)
    }
    expect(longest, 'a player tapping ตีกลับ every time would reach the ×3 multiplier').toBeLessThanOrEqual(2)
  })

  it('getQuestion finds by id and returns undefined otherwise', () => {
    expect(getQuestion(QUESTIONS[0].id)?.id).toBe(QUESTIONS[0].id)
    expect(getQuestion('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run content/questions.test.ts`
Expected: FAIL — `Failed to resolve import "./questions"`.

- [ ] **Step 3: Add the schemas to `lib/types.ts`**

Insert after the `StoryboardSchema` export (keep `StoryPanel`/`Storyboard` — The Decision Room imports them):

```ts
/** What the player is supposed to DO with this answer — not "is the duck right". */
export const VerdictSchema = z.enum(['pass', 'reject'])
export type Verdict = z.infer<typeof VerdictSchema>

const ActNumberSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])

/**
 * One question. Length caps are the projector budget, not style: `ask` renders at one size on a
 * 1366x768 screen and `duckSays` sits in a speech bubble beside a large duck. Exceeding them does
 * not wrap gracefully, it pushes the host's own controls off the bottom of the screen.
 */
export const QuestionSchema = z.object({
  id: z.string().min(1),
  act: ActNumberSchema,
  order: z.number().int().min(1).max(9),
  ask: z.string().min(1).max(80),
  duckSays: z.string().min(1).max(140),
  /** Exact substring of `duckSays`, marked on the reveal. The lie, or the load-bearing claim. */
  highlight: z.string().min(1),
  verdict: VerdictSchema,
  truth: z.string().min(1).max(220),
  tell: z.string().min(1).max(160),
  /** Facilitator note. NEVER rendered — it exists so the check list travels with the content. */
  needsCheck: z.string().optional(),
}).refine((q) => q.duckSays.includes(q.highlight), {
  message: 'highlight must be an exact substring of duckSays',
})
export type Question = z.infer<typeof QuestionSchema>

export const ActSchema = z.object({
  n: ActNumberSchema,
  nameTh: z.string().min(1),
  nameEn: z.string().min(1),
  body: z.string().min(1).max(220),
  /** The "ถ้าเป็นงานจริง" line. The host's closing rolls all three of these together. */
  atWork: z.string().min(1).max(160),
  chips: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
})
export type Act = z.infer<typeof ActSchema>
```

- [ ] **Step 4: Write `content/questions.ts`**

```ts
import type { Act, Question } from '@/lib/types'

/**
 * The nine questions. Thai only (spec §6b).
 *
 * TWO RULES BEFORE YOU EDIT THIS FILE:
 *  1. `verdict` is the CORRECT ACTION, not "is the duck right". They happen to coincide, but the
 *     player's buttons say ผ่าน/ตีกลับ, and the copy everywhere else must match the buttons.
 *  2. The three `pass` questions sit at orders 2, 5 and 8 so that no three `reject` questions are
 *     adjacent. Move one and `questions.test.ts` fails — that test is the anti-guess invariant
 *     (spec §4d), not a style check. Fix the arrangement, never the test.
 *
 * Act 3 uses REAL misattributions that happen in the world. Do not replace them with invented
 * journals or case numbers: the repo's content rule forbids fabricating evidence that imitates a
 * real outlet, and the real ones teach harder anyway.
 */
export const QUESTIONS: Question[] = [
  // ── Act 1 · ตอบเหมือนเพิ่งไปเปิดดูมา ───────────────────────────────
  {
    id: 'coffee-cups',
    act: 1,
    order: 1,
    ask: 'คนไทยดื่มกาแฟเฉลี่ยคนละกี่แก้วต่อปี?',
    duckSays: 'เฉลี่ย 340 แก้วต่อคนต่อปีครับ เพิ่มขึ้นจากเมื่อสิบปีก่อนพอสมควร',
    highlight: '340 แก้วต่อคนต่อปี',
    verdict: 'reject',
    truth: 'เป็ดไม่ได้บอกว่าใครสำรวจ ปีไหน วิธีไหน ตัวเลขเป๊ะๆ ที่ลอยมาเฉยๆ คือของที่มันประกอบขึ้นเอง',
    tell: 'ความเป๊ะที่ไม่มีที่มา ยิ่งเลขดูละเอียด ยิ่งต้องถามว่าใครนับ',
    needsCheck: 'ยืนยันว่า 340 ไม่บังเอิญตรงกับสถิติที่มีคนเผยแพร่จริง ถ้าตรงให้เปลี่ยนตัวเลข',
  },
  {
    id: 'banana-berry',
    act: 1,
    order: 2,
    ask: 'กล้วยจัดเป็นเบอร์รี่จริงหรือเปล่า?',
    duckSays: 'จริงครับ ทางพฤกษศาสตร์กล้วยเป็นเบอร์รี่ ส่วนสตรอว์เบอร์รี่ไม่ใช่',
    highlight: 'กล้วยเป็นเบอร์รี่ ส่วนสตรอว์เบอร์รี่ไม่ใช่',
    verdict: 'pass',
    truth: 'ถูกตามนิยามพฤกษศาสตร์ เบอร์รี่คือผลจากรังไข่เดียวที่มีเมล็ดอยู่ในเนื้อ ส่วนสตรอว์เบอร์รี่เป็นผลกลุ่ม',
    tell: 'ฟังดูเหมือนแกล้ง แต่เป็นนิยามที่นิ่งและตรวจสอบได้ ความรู้สึกว่าแปลกไม่ใช่หลักฐาน',
  },
  {
    id: 'most-populous',
    act: 1,
    order: 3,
    ask: 'ตอนนี้ประเทศไหนมีประชากรมากที่สุดในโลก?',
    duckSays: 'จีนครับ ประมาณ 1,400 ล้านคน มากที่สุดในโลก',
    highlight: 'จีนครับ',
    verdict: 'reject',
    truth: 'อินเดียแซงจีนไปตั้งแต่ปี 2023 คำตอบนี้เคยถูก และนั่นทำให้มันอันตรายกว่าคำตอบที่ผิดมาตลอด',
    tell: 'คำว่า “ตอนนี้” ถ้าคำตอบต้องสด แต่มันตอบด้วยของที่จำมา ก็คือคำตอบของเมื่อวาน',
  },

  // ── Act 2 · เชื่อคำถามของเรา ──────────────────────────────────────
  {
    id: 'tongue-map',
    act: 2,
    order: 4,
    ask: 'ทำไมปลายลิ้นถึงรับรสหวานได้ดีที่สุด?',
    duckSays: 'เพราะปุ่มรับรสหวานกระจุกอยู่ที่ปลายลิ้นครับ ส่วนรสขมอยู่โคนลิ้น',
    highlight: 'ปุ่มรับรสหวานกระจุกอยู่ที่ปลายลิ้น',
    verdict: 'reject',
    truth: 'ลิ้นทุกส่วนรับได้ทุกรส แผนที่ลิ้นเป็นความเข้าใจผิดที่ถูกหักล้างไปนานแล้ว คำถามผิดตั้งแต่แรก',
    tell: 'เป็ดไม่ได้แก้คำถามเรา มันรับคำถามมาแล้วสร้างคำอธิบายมารองรับ',
  },
  {
    id: 'hippo-danger',
    act: 2,
    order: 5,
    ask: 'ทำไมฮิปโปถึงอันตรายต่อคนมากกว่าสิงโต?',
    duckSays: 'เพราะฮิปโปหวงถิ่นมาก ตัวใหญ่ และวิ่งบนบกได้เร็วกว่าคนครับ',
    highlight: 'หวงถิ่นมาก ตัวใหญ่ และวิ่งบนบกได้เร็วกว่าคน',
    verdict: 'pass',
    truth: 'ถูกทั้งคำถามและคำตอบ ฮิปโปทำให้คนเสียชีวิตต่อปีมากกว่าสิงโต และเหตุผลที่มันยกมาก็ถูก',
    tell: 'ไม่มีตัวแยก และนั่นคือประเด็น ท่าเดิมไม่ได้แปลว่าคำตอบผิดเสมอ',
    needsCheck: 'เตรียมแหล่งอ้างอิงหนึ่งลิงก์ไว้ให้โฮสต์ เผื่อมีคนแย้งกลางห้อง',
  },
  {
    id: 'summer-distance',
    act: 2,
    order: 6,
    ask: 'ทำไมหน้าร้อนถึงร้อน เพราะโลกเข้าใกล้ดวงอาทิตย์ใช่ไหม?',
    duckSays: 'ใช่ครับ วงโคจรโลกเป็นวงรี ช่วงที่เข้าใกล้ดวงอาทิตย์ที่สุดเราจึงได้รับความร้อนมากขึ้น',
    highlight: 'ช่วงที่เข้าใกล้ดวงอาทิตย์ที่สุดเราจึงได้รับความร้อนมากขึ้น',
    verdict: 'reject',
    truth: 'ฤดูเกิดจากแกนโลกเอียง ไม่ใช่ระยะทาง และซีกโลกเหนืออยู่ในช่วงร้อนตอนที่โลกอยู่ไกลดวงอาทิตย์ที่สุดพอดี',
    tell: 'เราใส่ “ใช่ไหม” ลงไปในคำถาม แล้วมันตอบว่า “ใช่ครับ” ทันที',
  },

  // ── Act 3 · สวมชื่อคนอื่น ─────────────────────────────────────────
  {
    id: 'einstein-fish',
    act: 3,
    order: 7,
    ask: 'ไอน์สไตน์เคยพูดเรื่องตัดสินปลาจากการปีนต้นไม้จริงไหม?',
    duckSays: 'จริงครับ ไอน์สไตน์กล่าวไว้ว่าถ้าตัดสินปลาจากความสามารถในการปีนต้นไม้ ปลาก็จะคิดว่าตัวเองโง่ไปทั้งชีวิต',
    highlight: 'ไอน์สไตน์กล่าวไว้',
    verdict: 'reject',
    truth: 'ไม่มีหลักฐานว่าไอน์สไตน์เคยพูดประโยคนี้ เป็นคำคมที่ถูกสวมชื่อเขาภายหลังแล้วแพร่ต่อจนกลายเป็นของเขา',
    tell: 'คำคมยิ่งดัง ยิ่งถูกสวมชื่อคนดังง่าย ถามหาว่าพูดที่ไหน เมื่อไหร่ ถ้าตอบไม่ได้ก็คือไม่มี',
  },
  {
    id: 'great-wall-length',
    act: 3,
    order: 8,
    ask: 'กำแพงเมืองจีนยาวรวมทั้งหมดกี่กิโลเมตร?',
    duckSays: 'ประมาณ 21,000 กิโลเมตรครับ ถ้านับรวมทุกช่วงที่สร้างในทุกยุคเข้าด้วยกัน',
    highlight: 'ถ้านับรวมทุกช่วงที่สร้างในทุกยุคเข้าด้วยกัน',
    verdict: 'pass',
    truth: 'ถูก และครั้งนี้มันบอกเงื่อนไขของตัวเลขเอง ซึ่งต่างจากสองข้อที่โยนชื่อใหญ่มาแล้วจบ',
    tell: 'คำตอบที่บอกเงื่อนไขของตัวเองมาด้วย เชื่อได้มากกว่าคำตอบที่ยกชื่อใหญ่มาอ้างเฉยๆ',
    needsCheck: 'เตรียมแหล่งอ้างอิง 21,000 กม. เพราะคนอาจจำตัวเลขยุคหมิง (ราว 8,000 กม.) มาแย้ง',
  },
  {
    id: 'who-steps',
    act: 3,
    order: 9,
    ask: 'องค์การอนามัยโลกแนะนำให้เดินวันละกี่ก้าว?',
    duckSays: 'WHO แนะนำ 10,000 ก้าวต่อวันครับ เป็นเกณฑ์มาตรฐานด้านสุขภาพ',
    highlight: 'WHO แนะนำ 10,000 ก้าวต่อวัน',
    verdict: 'reject',
    truth: 'WHO ไม่เคยแนะนำเป็นจำนวนก้าว คำแนะนำจริงวัดเป็นนาทีต่อสัปดาห์ ส่วนเลข 10,000 ก้าว มาจากชื่อสินค้าเครื่องนับก้าวของญี่ปุ่นเมื่อปี 1965',
    tell: 'ตัวเลขจริง องค์กรจริง แต่ไม่ได้มาจากกันและกัน ทุกชิ้นส่วนตรวจสอบได้ ยกเว้นความเชื่อมโยง',
  },
]

/** Shown once every three questions. `atWork` is what the host's closing line is assembled from. */
export const ACTS: Act[] = [
  {
    n: 1,
    nameTh: 'ตอบเหมือนเพิ่งไปเปิดดูมา',
    nameEn: 'CONFIDENT · NEVER CHECKED',
    body: 'ข้อ 2 มันถูก เพราะเป็นนิยามที่ไม่เคยเปลี่ยน ส่วนอีกสองข้อมันตอบด้วยน้ำเสียงเดียวกันเป๊ะ ทั้งที่ข้อหนึ่งไม่มีใครนับ และอีกข้อความจริงเปลี่ยนไปแล้ว',
    atWork: 'ถ้าเป็นงานจริง คือตัวเลขในสไลด์ที่ตอบไม่ได้ว่าเอามาจากไหน ตอนลูกค้าถามกลางห้องประชุม',
    chips: ['ตัวเลขที่ไม่มีคนนับ', 'นิยามที่ไม่เคยเปลี่ยน', 'ความจริงที่หมดอายุ'],
  },
  {
    n: 2,
    nameTh: 'เชื่อคำถามของเรา',
    nameEn: 'IT BELIEVES YOUR PREMISE',
    body: 'สองข้อที่ผิด ไม่ได้ผิดที่คำตอบ แต่ผิดที่คำถาม เราใส่สิ่งที่ไม่จริงเข้าไปเอง แล้วมันก็สร้างคำอธิบายมารองรับให้เรียบร้อย',
    atWork: 'ถ้าเป็นงานจริง คือข้อสรุปที่เราอยากได้อยู่แล้ว แล้วให้ AI หาเหตุผลมารองรับ',
    chips: ['แผนที่ลิ้น', 'ฮิปโป', 'ฤดูกับระยะดวงอาทิตย์'],
  },
  {
    n: 3,
    nameTh: 'สวมชื่อคนอื่น',
    nameEn: 'IT PUTS WORDS IN REAL MOUTHS',
    body: 'มันเอาคำคมไปแปะชื่อไอน์สไตน์ และเอาตัวเลขไปแปะชื่อ WHO ทุกชิ้นส่วนมีอยู่จริง มีแค่ความเชื่อมโยงที่ไม่มี',
    atWork: 'ถ้าเป็นงานจริง คืออ้างชื่อองค์กรหรือคนดังผิดกลางห้องประชุม เสียความน่าเชื่อถือ ไม่ใช่แค่เสียงาน',
    chips: ['คำพูดไอน์สไตน์', 'กำแพงเมืองจีน', '10,000 ก้าวของ WHO'],
  },
]

const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]))
export function getQuestion(id: string): Question | undefined {
  return BY_ID.get(id)
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run content/questions.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts content/questions.ts content/questions.test.ts
git commit -m "feat(detective): the nine questions, Thai-only, in three acts"
```

---

## Task 2: Scoring — flat base, streak multiplier, speed as tiebreaker

**Files:**
- Rewrite: `lib/scoring.ts`
- Test: `lib/scoring.test.ts` (replace contents)

**Interfaces:**
- Consumes: `Question`, `Verdict` from Task 1; `QUESTIONS` from `content/questions`.
- Produces: `BASE_POINTS = 100`, `MAX_SPEED_BONUS = 10`, `MAX_STREAK_MULTIPLIER = 3`, `streakMultiplier(streak: number): number`, `speedBonus(elapsedMs: number): number`, `scoreAnswer(correct: boolean, streakAfter: number, elapsedMs: number): number`, `scorePlayer(answers: Answer[], questionsInOrder: Question[]): { total: number; wrongPass: number; correct: number }`.

- [ ] **Step 1: Write the failing tests**

Replace `lib/scoring.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  BASE_POINTS, MAX_SPEED_BONUS, MAX_STREAK_MULTIPLIER,
  scoreAnswer, scorePlayer, speedBonus, streakMultiplier,
} from './scoring'
import { QUESTION_COUNT, QUESTIONS_IN_ORDER } from './game'
import type { Answer } from './types'

const ans = (questionId: string, verdict: 'pass' | 'reject', elapsedMs = 15_000): Answer =>
  ({ playerId: 'p1', questionId, verdict, elapsedMs })

describe('the tiebreaker invariant', () => {
  // If this fails, a fast player can out-score someone who got one more question right,
  // in a workshop about not trusting snap judgments. Fix the constants, not the test.
  it('all the speed bonus in the game is worth less than one correct answer', () => {
    expect(QUESTION_COUNT * MAX_SPEED_BONUS).toBeLessThan(BASE_POINTS)
  })
})

describe('streakMultiplier', () => {
  it('is 1, 2, then 3 forever', () => {
    expect([1, 2, 3, 4, 9].map(streakMultiplier)).toEqual([1, 2, 3, 3, 3])
  })
  it('never exceeds the cap', () => {
    expect(streakMultiplier(99)).toBe(MAX_STREAK_MULTIPLIER)
  })
})

describe('speedBonus', () => {
  it('is capped, floored, and clamps hostile input', () => {
    expect(speedBonus(0)).toBe(MAX_SPEED_BONUS)
    expect(speedBonus(-999_999)).toBe(MAX_SPEED_BONUS)
    expect(speedBonus(15_000)).toBe(0)
    expect(speedBonus(999_999)).toBe(0)
  })
})

describe('scoreAnswer', () => {
  it('pays nothing for a wrong answer, however fast', () => {
    expect(scoreAnswer(false, 3, 0)).toBe(0)
  })
  it('multiplies the base but NOT the speed bonus', () => {
    // 100*3 + 10, never (100+10)*3 — multiplying the bonus breaks the invariant above.
    expect(scoreAnswer(true, 3, 0)).toBe(BASE_POINTS * 3 + MAX_SPEED_BONUS)
  })
})

describe('scorePlayer', () => {
  it('walks questions in play order and builds the streak', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, q.verdict, 15_000)) // all correct, no speed bonus
    const { total, correct } = scorePlayer(answers, qs)
    expect(correct).toBe(9)
    // ×1 + ×2 + ×3 seven times
    expect(total).toBe(BASE_POINTS * (1 + 2 + 3 * 7))
  })

  it('resets the streak on a wrong answer and on a missing one', () => {
    const qs = QUESTIONS_IN_ORDER
    const flip = (v: 'pass' | 'reject') => (v === 'pass' ? 'reject' : 'pass') as 'pass' | 'reject'
    // correct, correct, WRONG, correct → 100 + 200 + 0 + 100
    const answers = [
      ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict),
      ans(qs[2].id, flip(qs[2].verdict)), ans(qs[3].id, qs[3].verdict),
    ]
    expect(scorePlayer(answers, qs).total).toBe(100 + 200 + 0 + 100)

    // skipping question 3 entirely must also reset, not carry the streak across the gap
    const withGap = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict), ans(qs[3].id, qs[3].verdict)]
    expect(scorePlayer(withGap, qs).total).toBe(100 + 200 + 100)
  })

  it('counts wrongPass ONLY for approving something that should have been rejected', () => {
    const qs = QUESTIONS_IN_ORDER
    const rejects = qs.filter((q) => q.verdict === 'reject')
    const passes = qs.filter((q) => q.verdict === 'pass')
    const approvedEverything = qs.map((q) => ans(q.id, 'pass'))
    expect(scorePlayer(approvedEverything, qs).wrongPass).toBe(rejects.length)
    // rejecting a true answer is wrong, but it is NOT a wrongPass
    const rejectedEverything = qs.map((q) => ans(q.id, 'reject'))
    expect(scorePlayer(rejectedEverything, qs).wrongPass).toBe(0)
    expect(scorePlayer(rejectedEverything, qs).correct).toBe(rejects.length)
    expect(passes.length).toBe(3)
  })

  // THE ANTI-GUESS PAYOFF (spec §4d): tapping ตีกลับ nine times must never reach ×3.
  it('reports the streak standing at the end of the walk', () => {
    const qs = QUESTIONS_IN_ORDER
    expect(scorePlayer(qs.map((q) => ans(q.id, q.verdict)), qs).streak).toBe(9)
    const broken = [ans(qs[0].id, qs[0].verdict), ans(qs[1].id, qs[1].verdict === 'pass' ? 'reject' : 'pass')]
    expect(scorePlayer(broken, qs).streak).toBe(0)
  })

  it('never lets an always-reject player reach the ×3 multiplier', () => {
    const qs = QUESTIONS_IN_ORDER
    const answers = qs.map((q) => ans(q.id, 'reject'))
    const { total, correct } = scorePlayer(answers, qs)
    expect(correct).toBe(6)
    // six correct, longest streak 2: q1 100 | q3 100, q4 200 | q6 100, q7 200 | q9 100
    expect(total).toBe(800)
    expect(total).toBeLessThan(BASE_POINTS * (1 + 2 + 3 * 7))
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — `streakMultiplier` / `scorePlayer` / `QUESTIONS_IN_ORDER` are not exported yet.

- [ ] **Step 3: Rewrite `lib/scoring.ts`**

```ts
import type { Answer, Question } from './types'
import { QUESTION_COUNT, QUESTION_MS } from './game'

/**
 * Every question is worth the same. v2 had per-case difficulty tiers; v3 carries difficulty in the
 * ACT structure instead, and a second difficulty axis on top of that buys nothing but bookkeeping.
 */
export const BASE_POINTS = 100

/**
 * Speed is a TIEBREAKER ONLY.
 *
 * INVARIANT (enforced by test): QUESTION_COUNT * MAX_SPEED_BONUS < BASE_POINTS.
 * 9 * 10 = 90 < 100 — so even a perfect speed run cannot out-score one extra correct answer.
 * A workshop that teaches people not to trust snap judgments must not reward snap judgments.
 */
export const MAX_SPEED_BONUS = 10

/**
 * The anti-guess mechanic. Two buttons means a coin-flipper is right half the time; points alone
 * cannot tell thinking from flipping. Streaks can: P(3 correct in a row by guessing) is 12.5%,
 * and the answer key is arranged so an always-reject player never gets three in a row at all
 * (content/questions.test.ts).
 */
export const MAX_STREAK_MULTIPLIER = 3

/** @param streak consecutive correct answers INCLUDING the one being scored. */
export function streakMultiplier(streak: number): number {
  if (streak < 1) return 1
  return Math.min(streak, MAX_STREAK_MULTIPLIER)
}

/**
 * Soft target: answering slower than one full question window earns no bonus, and is never
 * punished. Pinned to QUESTION_MS rather than written as a literal — a retune of the question
 * window must move this with it, or the bonus range silently collapses.
 */
const SPEED_TARGET_MS = QUESTION_MS

export function speedBonus(elapsedMs: number): number {
  // elapsedMs is derived from server state, but clamp anyway: the invariant depends on the range.
  const clamped = Math.max(0, elapsedMs)
  const remaining = SPEED_TARGET_MS - clamped
  if (remaining <= 0) return 0
  return Math.round(MAX_SPEED_BONUS * (remaining / SPEED_TARGET_MS))
}

/** The speed bonus is added AFTER the multiplier, never multiplied by it. See MAX_SPEED_BONUS. */
export function scoreAnswer(correct: boolean, streakAfter: number, elapsedMs: number): number {
  if (!correct) return 0
  return BASE_POINTS * streakMultiplier(streakAfter) + speedBonus(elapsedMs)
}

export type PlayerScore = {
  total: number
  /** Approved an answer that should have been rejected. The room tally sums these (spec §4e). */
  wrongPass: number
  correct: number
  /** The streak standing at the end of the walk — what the phone shows live. */
  streak: number
}

/**
 * One player's whole game, in one pass.
 *
 * MUST walk `questionsInOrder`, not the answer array: the streak is a property of the play
 * sequence, and a missing answer has to break the streak exactly like a wrong one does. Iterating
 * the answers instead would silently carry a streak across a question the player never answered.
 *
 * Precondition: all answers belong to one player. Callers filter first.
 */
export function scorePlayer(answers: Answer[], questionsInOrder: Question[]): PlayerScore {
  const byQuestion = new Map(answers.map((a) => [a.questionId, a]))
  let total = 0
  let streak = 0
  let wrongPass = 0
  let correctCount = 0

  for (const q of questionsInOrder) {
    const a = byQuestion.get(q.id)
    if (!a) {
      streak = 0
      continue
    }
    if (q.verdict === 'reject' && a.verdict === 'pass') wrongPass++
    const correct = a.verdict === q.verdict
    if (!correct) {
      streak = 0
      continue
    }
    streak++
    correctCount++
    total += scoreAnswer(true, streak, a.elapsedMs)
  }

  return { total, wrongPass, correct: correctCount, streak }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL on the import of `QUESTION_COUNT`/`QUESTION_MS`/`QUESTIONS_IN_ORDER` from `./game` — those arrive in Task 3. This is expected; do **not** stub them here.

- [ ] **Step 5: Commit the scoring change alone**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat(detective): flat base points with a streak multiplier"
```

---

## Task 3: The phase machine

**Files:**
- Rewrite: `lib/game.ts`
- Modify: `lib/types.ts` (replace `Phase`, `GameState`, `Answer`)
- Test: `lib/game.test.ts` (replace contents)

**Interfaces:**
- Consumes: `QUESTIONS` from Task 1.
- Produces: `QUESTIONS_IN_ORDER: Question[]`, `QUESTION_COUNT = 9`, `QUESTIONS_PER_ACT = 3`, `QUESTION_MS = 15_000`, `REVEAL_MS = 12_000`, `LOBBY_STATE`, `startedState(now)`, `nextState(s, now)`, `toggleHold(s)`, `shouldExpire(s, now, activeCount, answeredCount)`, `remainingMs(s, now)`, `currentQuestion(s)`, `currentActIndex(s)`.

- [ ] **Step 1: Replace the state types in `lib/types.ts`**

Delete the old `Phase`, `GameState`, `Answer`, `PublicGameState` block and put in:

```ts
export type Player = { id: string; codename: string; joinedAt: number; spectator: boolean; avatar: string }
export type Answer = { playerId: string; questionId: string; verdict: Verdict; elapsedMs: number }

export type Phase = 'lobby' | 'question' | 'reveal' | 'actcard' | 'tally' | 'podium'

/** Server-authoritative. `phaseStartedAt`/`phaseDurationMs` are the ONLY clock. */
export type GameState = {
  phase: Phase
  /** 0-based index into QUESTIONS_IN_ORDER. On `actcard` it is the LAST question of that act. */
  qIndex: number
  phaseStartedAt: number
  /** 0 for untimed phases (lobby, actcard, tally, podium). */
  phaseDurationMs: number
  /** Host froze the reveal auto-advance. Only ever true during `reveal`. */
  holding: boolean
}

export type PublicGameState = {
  seq: number
  phase: Phase
  qIndex: number
  questionId: string | null
  /** 0-based act index, present on `actcard` only. */
  actIndex: number | null
  remainingMs: number
  answeredCount: number
  playerCount: number
  holding: boolean
  youAnswered?: boolean
  you?: {
    codename: string
    avatar: string
    spectator: boolean
    score: number
    rank: number
    streak: number
    wrongPass: number
  }
}
```

- [ ] **Step 2: Write the failing phase-machine test**

Replace `lib/game.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  LOBBY_STATE, QUESTION_COUNT, QUESTION_MS, REVEAL_MS, QUESTIONS_IN_ORDER,
  currentActIndex, currentQuestion, nextState, remainingMs, shouldExpire, startedState, toggleHold,
} from './game'
import type { GameState, Phase } from './types'

const T0 = 1_000_000

/** Walk the whole game with the host pressing Next on every untimed phase. */
function walk(): Phase[] {
  let s: GameState = startedState(T0)
  const seen: Phase[] = [s.phase]
  for (let i = 0; i < 100 && s.phase !== 'podium'; i++) {
    s = nextState(s, T0)
    seen.push(s.phase)
  }
  return seen
}

describe('the phase sequence', () => {
  it('runs 9 question/reveal pairs with an act card after every third', () => {
    const seen = walk()
    expect(seen.filter((p) => p === 'question')).toHaveLength(QUESTION_COUNT)
    expect(seen.filter((p) => p === 'reveal')).toHaveLength(QUESTION_COUNT)
    expect(seen.filter((p) => p === 'actcard')).toHaveLength(3)
    expect(seen.at(-3)).toBe('actcard')
    expect(seen.at(-2)).toBe('tally')
    expect(seen.at(-1)).toBe('podium')
  })

  it('puts the act cards after questions 3, 6 and 9 and nowhere else', () => {
    let s = startedState(T0)
    const cardAfter: number[] = []
    for (let i = 0; i < 100 && s.phase !== 'podium'; i++) {
      const prev = s
      s = nextState(s, T0)
      if (s.phase === 'actcard') cardAfter.push(prev.qIndex + 1)
    }
    expect(cardAfter).toEqual([3, 6, 9])
  })

  it('is terminal at podium', () => {
    const podium = { phase: 'podium', qIndex: 8, phaseStartedAt: T0, phaseDurationMs: 0, holding: false } as GameState
    expect(nextState(podium, T0 + 5000)).toEqual(podium)
  })

  it('exposes the act index on actcard and nowhere else', () => {
    let s = startedState(T0)
    while (s.phase !== 'actcard') s = nextState(s, T0)
    expect(currentActIndex(s)).toBe(0)
    expect(currentActIndex(startedState(T0))).toBeNull()
  })

  it('names the current question during question and reveal only', () => {
    const q = startedState(T0)
    expect(currentQuestion(q)?.id).toBe(QUESTIONS_IN_ORDER[0].id)
    expect(currentQuestion(nextState(q, T0))?.id).toBe(QUESTIONS_IN_ORDER[0].id) // reveal
    expect(currentQuestion(LOBBY_STATE)).toBeNull()
  })
})

describe('expiry', () => {
  it('ends a question on the timer', () => {
    const s = startedState(T0)
    expect(shouldExpire(s, T0 + QUESTION_MS - 1, 5, 0)).toBe(false)
    expect(shouldExpire(s, T0 + QUESTION_MS, 5, 0)).toBe(true)
  })

  it('ends a question early once every active player has answered', () => {
    const s = startedState(T0)
    expect(shouldExpire(s, T0 + 1, 5, 5)).toBe(true)
    expect(shouldExpire(s, T0 + 1, 5, 4)).toBe(false)
    expect(shouldExpire(s, T0 + 1, 0, 0)).toBe(false) // an empty room never auto-advances
  })

  it('auto-advances the reveal, which is what makes it feel rapid', () => {
    const reveal = nextState(startedState(T0), T0)
    expect(reveal.phase).toBe('reveal')
    expect(shouldExpire(reveal, T0 + REVEAL_MS, 5, 5)).toBe(true)
  })

  it('freezes the reveal while the host is holding', () => {
    const held = toggleHold(nextState(startedState(T0), T0))
    expect(held.holding).toBe(true)
    expect(shouldExpire(held, T0 + REVEAL_MS * 10, 5, 5)).toBe(false)
    expect(remainingMs(held, T0 + REVEAL_MS * 10)).toBe(0)
  })

  it('never expires an untimed phase', () => {
    let s = startedState(T0)
    while (s.phase !== 'actcard') s = nextState(s, T0)
    expect(shouldExpire(s, T0 + 60 * 60 * 1000, 5, 5)).toBe(false)
  })

  it('only ever holds on a reveal', () => {
    expect(toggleHold(startedState(T0)).holding).toBe(false)
    expect(toggleHold(LOBBY_STATE).holding).toBe(false)
  })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run lib/game.test.ts`
Expected: FAIL — the new exports do not exist.

- [ ] **Step 4: Rewrite `lib/game.ts`**

```ts
import type { GameState, Question } from './types'
import { ACTS, QUESTIONS } from '@/content/questions'

/** Play order. Everything downstream indexes into THIS, never into QUESTIONS' source order. */
export const QUESTIONS_IN_ORDER: Question[] = [...QUESTIONS].sort((a, b) => a.order - b.order)
export const QUESTION_COUNT = QUESTIONS_IN_ORDER.length
export const QUESTIONS_PER_ACT = QUESTION_COUNT / ACTS.length
export const ACT_COUNT = ACTS.length

/**
 * 15s. v2 ran 45-60s windows built for four long option labels and a Case File to read; v3 has one
 * question line and one duck sentence, and the room finishes in single digits. A window longer
 * than the reading buys dead air, not thought.
 */
export const QUESTION_MS = 15_000

/**
 * 12s, and it AUTO-ADVANCES. This is the beat that makes nine rounds feel rapid instead of nine
 * separate host presses. The host's escape hatch is `toggleHold`, not a per-reveal button.
 */
export const REVEAL_MS = 12_000

export const LOBBY_STATE: GameState = {
  phase: 'lobby', qIndex: 0, phaseStartedAt: 0, phaseDurationMs: 0, holding: false,
}

const questionState = (qIndex: number, now: number): GameState =>
  ({ phase: 'question', qIndex, phaseStartedAt: now, phaseDurationMs: QUESTION_MS, holding: false })

const untimed = (phase: GameState['phase'], qIndex: number, now: number): GameState =>
  ({ phase, qIndex, phaseStartedAt: now, phaseDurationMs: 0, holding: false })

export function startedState(now: number): GameState {
  return questionState(0, now)
}

/**
 * The successor of any phase. ONE function, used by both the host's Next and the lazy expiry tick,
 * so a timed advance and a host advance can never disagree about what comes next.
 */
export function nextState(s: GameState, now: number): GameState {
  switch (s.phase) {
    case 'lobby':
      return startedState(now)
    case 'question':
      return { phase: 'reveal', qIndex: s.qIndex, phaseStartedAt: now, phaseDurationMs: REVEAL_MS, holding: false }
    case 'reveal': {
      const finished = s.qIndex + 1
      // An act card closes every third question, including the last one.
      if (finished % QUESTIONS_PER_ACT === 0) return untimed('actcard', s.qIndex, now)
      return questionState(finished, now)
    }
    case 'actcard': {
      const next = s.qIndex + 1
      if (next >= QUESTION_COUNT) return untimed('tally', s.qIndex, now)
      return questionState(next, now)
    }
    case 'tally':
      return untimed('podium', s.qIndex, now)
    case 'podium':
      return s
  }
}

/** Host freeze for the reveal auto-advance. A no-op anywhere else — it must never skip a phase. */
export function toggleHold(s: GameState): GameState {
  if (s.phase !== 'reveal') return s
  return { ...s, holding: !s.holding }
}

export function remainingMs(s: GameState, now: number): number {
  if (s.phase !== 'question' && s.phase !== 'reveal') return 0
  if (s.holding) return 0
  return Math.max(0, s.phaseStartedAt + s.phaseDurationMs - now)
}

export function shouldExpire(s: GameState, now: number, activeCount: number, answeredCount: number): boolean {
  if (s.phase === 'question') {
    if (now >= s.phaseStartedAt + s.phaseDurationMs) return true
    return activeCount > 0 && answeredCount >= activeCount
  }
  if (s.phase === 'reveal') {
    if (s.holding) return false
    return now >= s.phaseStartedAt + s.phaseDurationMs
  }
  return false
}

export function currentQuestion(s: GameState): Question | null {
  if (s.phase !== 'question' && s.phase !== 'reveal') return null
  return QUESTIONS_IN_ORDER[s.qIndex] ?? null
}

export function currentActIndex(s: GameState): number | null {
  if (s.phase !== 'actcard') return null
  return Math.floor(s.qIndex / QUESTIONS_PER_ACT)
}
```

- [ ] **Step 5: Run the game and scoring tests together**

Run: `npx vitest run lib/game.test.ts lib/scoring.test.ts`
Expected: PASS both files. Task 2's tests come alive here because `QUESTION_COUNT` now exists.

- [ ] **Step 6: Commit**

```bash
git add lib/game.ts lib/game.test.ts lib/types.ts
git commit -m "feat(detective): six-phase machine with act cards, tally and hold"
```

---

## Task 4: Avatars

**Files:**
- Create: `lib/avatars.ts`
- Test: `lib/avatars.test.ts`

**Interfaces:**
- Produces: `AVATARS: readonly string[]`, `avatarFor(playerId: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { AVATARS, avatarFor } from './avatars'

describe('avatarFor', () => {
  it('is deterministic — the same player always gets the same face', () => {
    expect(avatarFor('abc-123')).toBe(avatarFor('abc-123'))
  })
  it('always returns one of the known avatars', () => {
    for (let i = 0; i < 200; i++) expect(AVATARS).toContain(avatarFor(`player-${i}`))
  })
  it('spreads across the set rather than collapsing to one', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => avatarFor(`player-${i}`)))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('handles an empty id without throwing', () => {
    expect(AVATARS).toContain(avatarFor(''))
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/avatars.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/avatars.ts`**

```ts
/**
 * Detective avatars, assigned at join from the playerId.
 *
 * Derived rather than chosen on purpose: a character-select step costs a screen and thirty seconds
 * of a workshop that has eight minutes, and buys nothing — the avatar exists so a player can find
 * themselves in the leaderboard and on the podium, not to express anything.
 */
export const AVATARS = ['🕵️', '🔍', '🎩', '🧢', '🥸', '🦉', '🧭', '🗝️', '🕯️', '📎'] as const

export function avatarFor(playerId: string): string {
  // FNV-1a. Deterministic across processes and restarts, which Math.random() would not be.
  let h = 0x811c9dc5
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return AVATARS[Math.abs(h) % AVATARS.length]
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/avatars.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/avatars.ts lib/avatars.test.ts
git commit -m "feat(detective): deterministic detective avatars"
```

---

## Task 5: Store — verdict answers, leaderboard, room tally

**Files:**
- Modify: `lib/store.ts`
- Test: `lib/store.test.ts` (extend)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces on `RoomStore`: `recordAnswer({playerId, questionId, verdict}, now): AnswerResult`, `next(now): void`, `hold(now): void`, `getLeaderboard(): LeaderboardEntry[]`, `getRoomWrongPass(): number`, `getSplit(questionId): {pass: number; reject: number}`.
  `LeaderboardEntry = { playerId; codename; avatar; score; wrongPass; rank }`.

- [ ] **Step 1: Write the failing store tests**

Append to `lib/store.test.ts`:

```ts
import { MemoryRoomStore } from './store'
import { QUESTIONS_IN_ORDER } from './game'

const T0 = 2_000_000

/** Drive a store to the question at `qIndex` with `n` players joined in the lobby. */
function roomAt(qIndex: number, n = 3) {
  const store = new MemoryRoomStore()
  const players = Array.from({ length: n }, (_, i) => store.join(`p${i}`, T0))
  store.startGame(T0)
  for (let i = 0; i < qIndex; i++) {
    store.next(T0) // question -> reveal
    store.next(T0) // reveal -> question or actcard
    if (store.getGameState().phase === 'actcard') store.next(T0)
  }
  return { store, players }
}

describe('recordAnswer', () => {
  it('accepts a verdict for the current question and is first-wins', () => {
    const { store, players } = roomAt(0)
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'pass' }, T0 + 500)).toBe('ok')
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'reject' }, T0 + 900)).toBe('duplicate')
    expect(store.getAnswers()[0].verdict).toBe('pass')
  })

  it('refuses an answer for a question the room has moved past', () => {
    const { store, players } = roomAt(1)
    const stale = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: players[0].id, questionId: stale.id, verdict: 'pass' }, T0)).toBe('closed')
  })

  it('refuses answers outside the question phase', () => {
    const { store, players } = roomAt(0)
    const q = QUESTIONS_IN_ORDER[0]
    store.next(T0) // -> reveal
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'pass' }, T0)).toBe('closed')
  })
})

describe('the room tally', () => {
  it('counts only approvals of answers that should have been rejected', () => {
    const store = new MemoryRoomStore()
    const a = store.join('a', T0)
    const b = store.join('b', T0)
    store.startGame(T0)
    for (const q of QUESTIONS_IN_ORDER) {
      store.recordAnswer({ playerId: a.id, questionId: q.id, verdict: 'pass' }, T0)   // approves everything
      store.recordAnswer({ playerId: b.id, questionId: q.id, verdict: 'reject' }, T0) // rejects everything
      store.next(T0)
      store.next(T0)
      if (store.getGameState().phase === 'actcard') store.next(T0)
    }
    const rejects = QUESTIONS_IN_ORDER.filter((q) => q.verdict === 'reject').length
    // player a contributes one wrongPass per reject question; player b contributes none
    expect(store.getRoomWrongPass()).toBe(rejects)
  })
})

describe('the leaderboard', () => {
  it('ranks by score and carries the avatar', () => {
    const { store, players } = roomAt(0, 2)
    const q = QUESTIONS_IN_ORDER[0]
    store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: q.verdict }, T0)
    store.recordAnswer({ playerId: players[1].id, questionId: q.id, verdict: q.verdict === 'pass' ? 'reject' : 'pass' }, T0)
    const board = store.getLeaderboard()
    expect(board[0].playerId).toBe(players[0].id)
    expect(board[0].rank).toBe(1)
    expect(board[1].rank).toBe(2)
    expect(board[0].avatar).toBeTruthy()
  })
})

describe('hold', () => {
  it('freezes the reveal and does not change the phase', () => {
    const { store } = roomAt(0)
    store.next(T0)
    expect(store.getGameState().phase).toBe('reveal')
    store.hold(T0)
    expect(store.getGameState().holding).toBe(true)
    store.tick(T0 + 60_000)
    expect(store.getGameState().phase).toBe('reveal')
    store.hold(T0)
    store.tick(T0 + 60_000)
    expect(store.getGameState().phase).not.toBe('reveal')
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run lib/store.test.ts`
Expected: FAIL — `next`, `hold`, `getRoomWrongPass`, `getLeaderboard` do not exist and `recordAnswer` still takes `caseId`.

- [ ] **Step 3: Apply the store changes**

In `lib/store.ts`:

1. Update imports:

```ts
import { avatarFor } from './avatars'
import { scorePlayer } from './scoring'
import {
  LOBBY_STATE, QUESTIONS_IN_ORDER, currentQuestion, nextState, remainingMs, shouldExpire,
  startedState, toggleHold, currentActIndex,
} from './game'
```

2. Replace the `RoomStore` interface members `recordAnswer`, `revealNow`, `nextRound` with:

```ts
export interface RoomStore {
  join(codename: string, now: number): Player
  recordAnswer(input: { playerId: string; questionId: string; verdict: Verdict }, now: number): AnswerResult
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
  getGameState(): GameState
  getSeq(): number
  tick(now: number): boolean
  startGame(now: number): void
  /** Advance one phase. The host's only forward control. */
  next(now: number): void
  /** Toggle the reveal freeze. No-op off a reveal. */
  hold(now: number): void
  getLeaderboard(): LeaderboardEntry[]
  getRoomWrongPass(): number
  getSplit(questionId: string): { pass: number; reject: number }
  getPublicState(now: number, playerId?: string): PublicGameState
}

export type LeaderboardEntry = {
  playerId: string
  codename: string
  avatar: string
  score: number
  wrongPass: number
  rank: number
}
```

3. `join` gains the avatar:

```ts
join(codename: string, now: number): Player {
  const id = randomUUID()
  const player: Player = { id, codename, joinedAt: now, avatar: avatarFor(id), spectator: this.game.phase !== 'lobby' }
  this.players.push(player)
  this.seq++
  this.persist()
  return player
}
```

4. `recordAnswer`, `answeredCountFor` and `tick` move from `caseId` to `questionId`:

```ts
private answeredCountFor(questionId: string | null): number {
  if (!questionId) return 0
  const active = new Set(this.activePlayers().map((p) => p.id))
  let n = 0
  for (const a of this.answers.values()) if (a.questionId === questionId && active.has(a.playerId)) n++
  return n
}

recordAnswer(input: { playerId: string; questionId: string; verdict: Verdict }, now: number): AnswerResult {
  const player = this.players.find((p) => p.id === input.playerId)
  if (!player) return 'unknown'
  if (player.spectator) return 'spectator'
  if (this.game.phase !== 'question') return 'closed'
  if (input.questionId !== currentQuestion(this.game)?.id) return 'closed'
  const key = `${input.playerId}:${input.questionId}`
  if (this.answers.has(key)) return 'duplicate'
  const elapsedMs = now - this.game.phaseStartedAt
  this.answers.set(key, { playerId: input.playerId, questionId: input.questionId, verdict: input.verdict, elapsedMs })
  this.seq++
  this.persist()
  return 'ok'
}

/** Lazily advance on expiry. Runs on every /api/state read, so it must stay cheap and only persist when it moves. */
tick(now: number): boolean {
  const active = this.activePlayers().length
  const answered = this.answeredCountFor(currentQuestion(this.game)?.id ?? null)
  if (!shouldExpire(this.game, now, active, answered)) return false
  this.game = nextState(this.game, now)
  this.seq++
  this.persist()
  return true
}

next(now: number): void {
  if (this.game.phase === 'lobby' || this.game.phase === 'podium') return
  this.game = nextState(this.game, now)
  this.seq++
  this.persist()
}

hold(now: number): void {
  const held = toggleHold(this.game)
  if (held === this.game) return
  // Restart the reveal clock on unhold so the room still gets a full beat after the host talks.
  this.game = held.holding ? held : { ...held, phaseStartedAt: now }
  this.seq++
  this.persist()
}
```

5. Add the derived read models:

```ts
/**
 * MUST filter by playerId. `scorePlayer` keys its walk on questionId alone and no longer throws on
 * a mixed-player array the way v2's `totalScore` did — hand it answers from two players and it
 * silently collapses them last-write-wins instead of failing. Every call site is responsible for
 * this filter; there is no guard underneath you.
 */
private answersFor(playerId: string): Answer[] {
  return [...this.answers.values()].filter((a) => a.playerId === playerId)
}

getLeaderboard(): LeaderboardEntry[] {
  const rows = this.activePlayers().map((p) => {
    const { total, wrongPass } = scorePlayer(this.answersFor(p.id), QUESTIONS_IN_ORDER)
    return { playerId: p.id, codename: p.codename, avatar: p.avatar, score: total, wrongPass, rank: 0 }
  })
  // Ties keep a stable order by codename so the board does not shuffle between polls.
  rows.sort((a, b) => b.score - a.score || a.codename.localeCompare(b.codename))
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

getRoomWrongPass(): number {
  return this.getLeaderboard().reduce((n, r) => n + r.wrongPass, 0)
}

getSplit(questionId: string): { pass: number; reject: number } {
  let pass = 0
  let reject = 0
  const active = new Set(this.activePlayers().map((p) => p.id))
  for (const a of this.answers.values()) {
    if (a.questionId !== questionId || !active.has(a.playerId)) continue
    if (a.verdict === 'pass') pass++
    else reject++
  }
  return { pass, reject }
}
```

6. `getPublicState` returns the new shape:

```ts
getPublicState(now: number, playerId?: string): PublicGameState {
  const q = currentQuestion(this.game)
  const pub: PublicGameState = {
    seq: this.seq,
    phase: this.game.phase,
    qIndex: this.game.qIndex,
    questionId: q?.id ?? null,
    actIndex: currentActIndex(this.game),
    remainingMs: remainingMs(this.game, now),
    answeredCount: this.answeredCountFor(q?.id ?? null),
    playerCount: this.activePlayers().length,
    holding: this.game.holding,
  }
  if (playerId !== undefined) {
    pub.youAnswered = q != null && this.answers.has(`${playerId}:${q.id}`)
    const me = this.players.find((p) => p.id === playerId)
    if (me) {
      const row = this.getLeaderboard().find((r) => r.playerId === playerId)
      const { correct } = scorePlayer(this.answersFor(playerId), QUESTIONS_IN_ORDER)
      pub.you = {
        codename: me.codename,
        avatar: me.avatar,
        spectator: me.spectator,
        score: row?.score ?? 0,
        rank: row?.rank ?? 0,
        streak,
        wrongPass: row?.wrongPass ?? 0,
      }
    }
  }
  return pub
}
```

`scorePlayer` already returns `streak` (Task 2), so read it from the same walk rather than
recomputing: destructure `const { correct, streak } = scorePlayer(...)` and set `pub.you.streak = streak`.
Do **not** pass `correct` as the streak — they are different numbers and coincide only on a perfect game.

7. `load()` must accept the new phases and drop stale snapshots:

```ts
const validPhases = new Set(['lobby', 'question', 'reveal', 'actcard', 'tally', 'podium'])
```

and in the answer-restore loop, skip entries lacking `questionId` so a `.room-state.json` written by v2 is discarded rather than half-loaded.

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run lib/ content/`
Expected: PASS. `app/` tests still fail — they are Tasks 6–8.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts lib/scoring.ts lib/scoring.test.ts
git commit -m "feat(detective): store keeps verdicts, streaks and the room tally"
```

---

## Task 6: API routes

**Files:**
- Modify: `app/api/answer/route.ts`, `app/api/control/route.ts`, `app/api/stats/route.ts`
- Modify: `app/tv/page.tsx` — **one line only**: it imports `type RoomStats` from `@/lib/stats`, which this task deletes. Replace that import with a local type declaration. Task 8 rewrites the rest of this file; do not touch anything else in it.
- Delete: `lib/stats.ts`, `lib/stats.test.ts`, `app/dashboard/` (page + test), `app/reveal/` (page + test)
- Test: `app/api/routes.test.ts` (update the AI Detective describes; leave the `/api/room/*` ones alone)

**Why those deletions belong to this task.** `/api/stats`'s payload changes shape here, and `lib/stats.ts` (`computeStats`, `RoomStats`) is the old shape. Its consumers are `/api/stats` itself, `app/dashboard/`, `app/reveal/` and `app/tv/`. Deleting the module in a later task would leave dangling imports across several commits; deleting it here, with its consumers, keeps every commit self-consistent.

`app/dashboard/` and `app/reveal/` are **deleted, not ported.** `/reveal` is v1 free-roam code nothing routes to. `/dashboard` was an optional second screen that existed to show the room split and standings the v2 projector had no space for — v3's reveal phase puts both on the projector itself (spec §5a), so the screen has no job left. A second screen silently rendering a stale payload shape is worse than no second screen.

**Interfaces:**
- Consumes: the store API from Task 5.
- Produces: `POST /api/answer {playerId, questionId, verdict}`; `POST /api/control {action: 'start'|'next'|'hold'}`; `GET /api/stats → {leaderboard: LeaderboardEntry[], split: {pass,reject} | null, roomWrongPass: number, playerCount: number}`.

- [ ] **Step 1: Write the failing route tests**

In `app/api/routes.test.ts`, replace the answer/control describes:

```ts
describe('POST /api/answer', () => {
  it('rejects a body without a verdict', async () => {
    const res = await answerPOST(new Request('http://localhost/api/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 'x', questionId: 'y' }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects a verdict that is not pass or reject', async () => {
    const res = await answerPOST(new Request('http://localhost/api/answer', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ playerId: 'x', questionId: 'y', verdict: 'maybe' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/control', () => {
  it('accepts start, next and hold', async () => {
    for (const action of ['start', 'next', 'hold']) {
      const res = await controlPOST(new Request('http://localhost/api/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
        body: JSON.stringify({ action }),
      }))
      expect(res.status, action).toBe(200)
    }
  })

  it('rejects the retired actions', async () => {
    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
      body: JSON.stringify({ action: 'reveal' }),
    }))
    expect(res.status).toBe(400)
  })

  it('still refuses without the token', async () => {
    const res = await controlPOST(new Request('http://localhost/api/control', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'next' }),
    }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/api/routes.test.ts`
Expected: FAIL — `hold` is rejected, `reveal` is accepted.

- [ ] **Step 3: Update the routes**

`app/api/answer/route.ts` — replace the destructure and validation:

```ts
const { playerId, questionId, verdict } = body as { playerId?: unknown; questionId?: unknown; verdict?: unknown }
if (typeof playerId !== 'string' || !playerId || typeof questionId !== 'string' || !questionId) {
  return NextResponse.json({ error: 'playerId and questionId are required' }, { status: 400 })
}
if (verdict !== 'pass' && verdict !== 'reject') {
  return NextResponse.json({ error: 'verdict must be "pass" or "reject"' }, { status: 400 })
}
const result = getStore().recordAnswer({ playerId, questionId, verdict }, Date.now())
```

`app/api/control/route.ts` — replace the action branch:

```ts
const action = (body as { action?: unknown })?.action
const now = Date.now()
const store = getStore()
if (action === 'start') store.startGame(now)
// One forward control for every phase. `hold` freezes a reveal and can never skip anything —
// cutting a beat short and skipping the teaching are different acts, and the host must not be
// able to do the second by accident on a laggy projector.
else if (action === 'next') store.next(now)
else if (action === 'hold') store.hold(now)
else return NextResponse.json({ error: 'action must be "start", "next" or "hold"' }, { status: 400 })
return NextResponse.json({ ok: true })
```

`app/api/stats/route.ts` — the TV's extra payload:

```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { currentQuestion } from '@/lib/game'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = getStore()
  const q = currentQuestion(store.getGameState())
  return NextResponse.json({
    // Top 5 only: 100 names do not fit a projector and never will (spec §5a).
    leaderboard: store.getLeaderboard().slice(0, 5),
    split: q ? store.getSplit(q.id) : null,
    roomWrongPass: store.getRoomWrongPass(),
    playerCount: store.getPlayers().filter((p) => !p.spectator).length,
  })
}
```

- [ ] **Step 4: Run the route tests**

Run: `npx vitest run app/api/routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git rm -r app/dashboard app/reveal
git rm lib/stats.ts lib/stats.test.ts
git add app/api/answer/route.ts app/api/control/route.ts app/api/stats/route.ts app/api/routes.test.ts app/tv/page.tsx
git commit -m "feat(detective): verdict answers, a start/next/hold control surface, and the end of the old stats payload"
```

---

## Task 7: Phone

**Files:**
- Rewrite: `app/page.tsx`
- Delete: `components/LangToggle.tsx`, `components/game/AnswerCards.tsx` + its test
  *(`app/reveal/` also imported `LangToggle`, but Task 6 already deleted it along with the old stats
  payload, so `app/page.tsx` is the last importer and this is safe.)*
- Test: `app/page.test.tsx` (replace contents)

**Interfaces:**
- Consumes: `PublicGameState` from Task 3, `POST /api/answer` from Task 6.
- Produces: nothing other tasks consume.

**The new phone renders no countdown.** The timer bar lives on the projector (spec 5a); a second
clock on the phone is duplicated state with its own drift. Do not import `components/game/Countdown`
— Task 8 deletes it.

**Before deleting `LangToggle`:** run `grep -rn "LangToggle\|lib/i18n" app components --include=*.tsx | grep -v "app/reveal"`. If The Decision Room turns out to import either, leave the file and delete only the import in `app/page.tsx`.

- [ ] **Step 1: Write the failing phone test**

Replace `app/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Page from './page'
import { QUESTIONS_IN_ORDER } from '@/lib/game'

const state = (over: Record<string, unknown> = {}) => ({
  seq: 1, phase: 'question', qIndex: 0, questionId: QUESTIONS_IN_ORDER[0].id,
  actIndex: null, remainingMs: 9000, answeredCount: 0, playerCount: 4, holding: false,
  you: { codename: 'เป็ดทอง', avatar: '🕵️', spectator: false, score: 0, rank: 1, streak: 0, wrongPass: 0 },
  ...over,
})

beforeEach(() => {
  // The real key, verified at app/page.tsx:12 — identity only, never game state.
  localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'เป็ดทอง' }))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(state()), {
    headers: { 'content-type': 'application/json' },
  })))
})

describe('the phone during a question', () => {
  it('shows exactly two choices and nothing else to tap', async () => {
    render(<Page />)
    expect(await screen.findByRole('button', { name: /ผ่าน/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('posts the verdict, not an option id', async () => {
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ตีกลับ/ }))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .find(([url]) => String(url).includes('/api/answer'))
    expect(call, 'no POST to /api/answer').toBeTruthy()
    expect(JSON.parse(String(call![1].body))).toMatchObject({
      playerId: 'p1', questionId: QUESTIONS_IN_ORDER[0].id, verdict: 'reject',
    })
  })

  it('has no language toggle — the game is Thai only', async () => {
    render(<Page />)
    await screen.findByRole('button', { name: /ผ่าน/ })
    expect(screen.queryByRole('button', { name: /EN|TH/i })).toBeNull()
  })
})

describe('the phone on an act card', () => {
  it('gives the player nothing to read, so they look up at the projector', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({ phase: 'actcard', actIndex: 0, questionId: null })),
      { headers: { 'content-type': 'application/json' } },
    )))
    render(<Page />)
    expect(await screen.findByText(/ดูจอใหญ่/)).toBeInTheDocument()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — the page still renders four answer cards and a language toggle.

- [ ] **Step 3: Rewrite `app/page.tsx`**

Keep the existing identity/localStorage helpers and the polling loop verbatim (they carry the
monotonic-`seq` guard and the offline answer queue — do not rewrite them). Replace only the render
branch and the answer submit:

```tsx
// Two buttons. Nothing else on the screen during a question — the question text is on the
// projector, and duplicating it here is what pushed v2's last option below the fold.
function QuestionPanel({ onPick, picked }: { onPick: (v: 'pass' | 'reject') => void; picked?: 'pass' | 'reject' }) {
  return (
    <div className="mt-auto flex flex-col gap-5">
      <button
        type="button"
        disabled={!!picked}
        onClick={() => onPick('pass')}
        className={`verdict-btn verdict-pass ${picked === 'pass' ? 'picked' : ''} ${picked && picked !== 'pass' ? 'dimmed' : ''}`}
      >
        ✓ ผ่าน
      </button>
      <button
        type="button"
        disabled={!!picked}
        onClick={() => onPick('reject')}
        className={`verdict-btn verdict-reject ${picked === 'reject' ? 'picked' : ''} ${picked && picked !== 'reject' ? 'dimmed' : ''}`}
      >
        ✕ ตีกลับ
      </button>
    </div>
  )
}
```

and the phase switch:

```tsx
{state.phase === 'question' && <QuestionPanel onPick={submit} picked={myVerdict} />}
{state.phase === 'reveal' && <RevealPanel you={state.you} correct={lastWasCorrect} />}
{state.phase === 'actcard' && <LookUpPanel />}   {/* 👀 ดูจอใหญ่ — no buttons, by design */}
{state.phase === 'tally' && <MyTallyPanel wrongPass={state.you?.wrongPass ?? 0} />}
{state.phase === 'podium' && <MyResultPanel you={state.you} />}
```

`submit` posts `{ playerId, questionId: state.questionId, verdict }` and keeps the existing retry
queue behaviour unchanged.

- [ ] **Step 4: Run the phone test**

Run: `npx vitest run app/page.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Delete the retired components and commit**

```bash
git rm components/game/AnswerCards.tsx components/game/AnswerCards.test.tsx components/LangToggle.tsx
git add app/page.tsx app/page.test.tsx
git commit -m "feat(detective): the phone is two buttons"
```

---

## Task 8: Projector

**Files:**
- Rewrite: `app/tv/page.tsx`
- Create: `components/game/TimerBar.tsx`, `VerdictStamp.tsx`, `SplitBar.tsx`, `TopFive.tsx`, `ActCard.tsx`, `Tally.tsx`, `Podium.tsx`
- Delete: `components/game/CaseFile.tsx` (+test), `components/game/Storyboard.tsx`, `components/game/Countdown.tsx` (+test), `components/CaseFileDoc.tsx` (+test), and the v1 cluster that imports them: `components/CaseScreen.tsx` (+test), `components/ResultScreen.tsx` (+test), `components/Retrieval.tsx` (+test), `lib/ai-answer.ts` (+test).
  `CaseScreen.tsx` imports both `CaseFileDoc` and `lib/ai-answer`, and nothing else imports `ai-answer` — verified. They go in one commit or the branch stays red.
- Test: `app/tv/tv.test.tsx` (replace contents)

**Interfaces:**
- Consumes: `PublicGameState`, `/api/stats` from Task 6, `ACTS`/`QUESTIONS_IN_ORDER` from Tasks 1/3.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing projector test**

Replace `app/tv/tv.test.tsx` with assertions for each phase. Keep them structural — jsdom performs
no layout, so **nothing here can check that a phase fits on screen.** That is `check:projector`'s
job in Task 9, and the test file should say so in a comment.

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import TV from './page'
import { QUESTIONS_IN_ORDER } from '@/lib/game'
import { ACTS } from '@/content/questions'

// jsdom does not lay out. These tests prove the right CONTENT renders per phase; whether it FITS
// on a 1366x768 projector is checked by `npm run check:projector` (a real browser) and nowhere else.

const q0 = QUESTIONS_IN_ORDER[0]
const stats = { leaderboard: [{ playerId: 'a', codename: 'หมูกรอบ', avatar: '🕵️', score: 300, wrongPass: 0, rank: 1 }], split: { pass: 7, reject: 3 }, roomWrongPass: 12, playerCount: 10 }

function mockFetch(state: Record<string, unknown>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(
    JSON.stringify(String(url).includes('/api/stats') ? stats : state),
    { headers: { 'content-type': 'application/json' } },
  )))
}
const base = { seq: 1, qIndex: 0, questionId: q0.id, actIndex: null, remainingMs: 9000, answeredCount: 7, playerCount: 10, holding: false }

describe('the projector', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('shows the question and the duck line during a question', async () => {
    mockFetch({ ...base, phase: 'question' })
    render(<TV />)
    expect(await screen.findByText(q0.ask)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(q0.highlight.slice(0, 10)))).toBeInTheDocument()
    expect(screen.getByText(/7/)).toBeInTheDocument() // answered count
  })

  it('shows the verdict, the truth, the room split and the top five on a reveal', async () => {
    mockFetch({ ...base, phase: 'reveal' })
    render(<TV />)
    expect(await screen.findByText(q0.verdict === 'reject' ? 'ตีกลับ' : 'ผ่าน')).toBeInTheDocument()
    expect(screen.getByText(q0.truth)).toBeInTheDocument()
    expect(await screen.findByText('หมูกรอบ')).toBeInTheDocument()
  })

  it('names the trick on an act card and carries the at-work line', async () => {
    mockFetch({ ...base, phase: 'actcard', actIndex: 0, questionId: null })
    render(<TV />)
    expect(await screen.findByText(ACTS[0].nameTh)).toBeInTheDocument()
    expect(screen.getByText(ACTS[0].nameEn)).toBeInTheDocument()
    expect(screen.getByText(ACTS[0].atWork)).toBeInTheDocument()
  })

  it('shows the room tally as one number', async () => {
    mockFetch({ ...base, phase: 'tally', questionId: null })
    render(<TV />)
    expect(await screen.findByText('12')).toBeInTheDocument()
  })

  it('shows the podium at the end', async () => {
    mockFetch({ ...base, phase: 'podium', questionId: null })
    render(<TV />)
    expect(await screen.findByText('หมูกรอบ')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/tv/tv.test.tsx`
Expected: FAIL — the page still renders the Case File and knows nothing about the new phases.

- [ ] **Step 3: Build the components and the phase switch**

Each component is presentational and takes plain props — no fetching inside them. Animation lives
in `app/globals.css` under a `@layer components` block next to the existing retro theme, keyed by
class (`.stamp-slam`, `.bar-grow`, `.row-slide`, `.block-rise`, `.hop-in`), each wrapped so
`prefers-reduced-motion: reduce` collapses the duration. Sizes use `min(clamp(px, vw, px), Nvh)` —
**the height cap is what binds on a projector**, per the README's known traps.

The `/tv` phase switch:

```tsx
{state.phase === 'lobby'    && <Lobby joinUrl={joinUrl} players={players} />}
{state.phase === 'question' && <QuestionStage state={state} question={question} />}
{state.phase === 'reveal'   && <RevealStage question={question} split={stats.split} top={stats.leaderboard} />}
{state.phase === 'actcard'  && <ActCard act={ACTS[state.actIndex ?? 0]} />}
{state.phase === 'tally'    && <Tally wrongPass={stats.roomWrongPass} decisions={stats.playerCount * QUESTION_COUNT} />}
{state.phase === 'podium'   && <Podium top={stats.leaderboard.slice(0, 3)} />}
```

Host controls stay pinned top-right in every phase and never move — `Start`, `Next`, `Hold`, plus
the existing `ResetButton`. `Hold` renders pressed while `state.holding` is true.

- [ ] **Step 4: Run the projector test**

Run: `npx vitest run app/tv/tv.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Delete the retired components and commit**

```bash
git rm components/game/CaseFile.tsx components/game/CaseFile.test.tsx \
       components/game/Storyboard.tsx components/game/Countdown.tsx components/game/Countdown.test.tsx \
       components/CaseFileDoc.tsx components/CaseFileDoc.test.tsx \
       components/CaseScreen.tsx components/CaseScreen.test.tsx \
       components/ResultScreen.tsx components/ResultScreen.test.tsx \
       components/Retrieval.tsx components/Retrieval.test.tsx \
       lib/ai-answer.ts lib/ai-answer.test.ts
git add app/tv/page.tsx app/tv/tv.test.tsx components/game/ app/globals.css
git commit -m "feat(detective): projector renders six phases with the tally and podium"
```

---

## Task 9: Retire v1/v2 leftovers, then prove it fits on a projector

**Files:**
- Delete: `content/cases.ts`, `content/cases.test.ts`
  *(`app/reveal/` went with Task 7; the `CaseScreen`/`ResultScreen`/`Retrieval`/`ai-answer` cluster went with Task 8 — both alongside the imports that would otherwise dangle.)*
- Modify: `README.md`, `docs/cases.md` → `docs/questions.md`

- [ ] **Step 1: Prove nothing imports them**

```bash
grep -rn "content/cases\|CaseScreen\|ResultScreen\|Retrieval\|ai-answer\|lib/stats\|LangToggle\|Countdown\|AnswerCards\|CaseFile" app components lib content scripts --include=*.ts --include=*.tsx | grep -v "\.test\."
```
Expected: no output. Any hit must be fixed before deleting.

- [ ] **Step 2: Delete and typecheck**

```bash
git rm content/cases.ts content/cases.test.ts
npx tsc --noEmit
```
Expected: clean. This is the **first point in the branch where `tsc --noEmit` is
expected to pass** — `Player.avatar` is declared in Task 3 and only populated in Task 5, so
intermediate commits are deliberately not type-clean. vitest strips types and stays green throughout.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all files pass. The Decision Room's files must be untouched — if any `content/room*` or
`lib/room*` test fails, something in this plan reached out of bounds; revert that change.

- [ ] **Step 4: Update `scripts/check-projector-fit.mjs` for the new phases**

The AI Detective walk currently drives `start` → `reveal` → `next`. Change it to drive
`start` then `next` repeatedly through all six phase kinds, sampling one `question`, one `reveal`,
one `actcard`, the `tally` and the `podium`. Keep `checkHostControl` — `/tv`'s `<main>` is
`min-h-screen overflow-hidden`, so a too-tall stage is **clipped, not scrolled**, and the height
metric reports a tidy ✓ while the host's own button is off the bottom of the screen.

- [ ] **Step 5: Run the projector check for real**

```bash
npm run build
FACILITATOR_TOKEN=dev-local-9f2c npm run start:lan &
FACILITATOR_TOKEN=dev-local-9f2c npm run check:projector
```
Expected: every phase clears 1600×900 **and** 1366×768, and the phone walk reaches both verdict
buttons at 390×844 without scrolling. If a phase overflows, shrink the type scale in
`app/globals.css` — do not delete content to make it fit without saying so.

Kill the server by port, never `pkill`: `lsof -ti:3000 | xargs kill -9` (macOS) or
`Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
(Windows). A stale server means every measurement comes from the old build and looks like a
catastrophic CSS bug.

- [ ] **Step 6: Rewrite the docs**

`README.md`'s AI Detective section: 9 questions not 5 cases, ผ่าน/ตีกลับ not A/B/C/D, `Start`/`Next`/`Hold`
not `Start`/`Close it`/`Next`, the 7:18 budget, and the fact that the host says the Human-in-the-loop
line on the `tally` phase. Replace `docs/cases.md` with `docs/questions.md` carrying the per-question
rationale and the three `needsCheck` items. Update `docs/question-design.md`'s AI Detective half.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(detective): retire the v1/v2 case flow and update the docs"
```

---

## Self-Review

**Spec coverage.** §1 → Tasks 1–8. §2 → Task 1 (acts) + Task 3 (act boundaries). §3 flow and host
controls → Task 3 + Task 6. §4a verdict → Tasks 1, 5. §4b streak → Task 2. §4c invariant → Task 2
Step 1. §4d answer key → Task 1 Step 1. §4e tally → Tasks 2, 5. §5a projector → Task 8. §5b phone →
Task 7. §5c avatars → Task 4. §6 content → Task 1. §6a integrity → `needsCheck` fields in Task 1.
§6b Thai-only → Task 1 types + Task 7 LangToggle deletion. §7 data model → Task 1. §8 tests → the
test step of every task, plus Task 9 Step 5 for layout. §9 code map → Tasks 6–9. §10 out of scope →
nothing in this plan builds any of it.

**Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N". Task 7 and Task 8 show the
new render branches rather than a full page listing, and both say explicitly which existing code to
keep verbatim — the polling loop and identity helpers in `app/page.tsx` are load-bearing and must
not be rewritten from scratch.

**Type consistency.** `Verdict`, `Question`, `Act` (Task 1) are used unchanged in Tasks 2–8.
`scorePlayer` returns `{total, wrongPass, correct, streak}` — `streak` is added in Task 5 Step 3
together with the test that covers it, so the signature is complete before `getPublicState` reads
it. `LeaderboardEntry` is defined in Task 5 and consumed in Tasks 6 and 8 with the same field names.
`QUESTION_MS` is defined in Task 3 and imported by Task 2's `SPEED_TARGET_MS`, which is why Task 2's
tests only go green at Task 3 Step 5 — called out in Task 2 Step 4 so it does not read as a failure.

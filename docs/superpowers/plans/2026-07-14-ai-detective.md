# AI Detective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Detective workshop app for MADT Expo (23 Aug 2026) — 5 hallucination cases with simulated RAG retrieval, a live projector dashboard, and a facilitator reveal deck, for ~20 concurrent laptop players on a LAN.

**Architecture:** A single Next.js (App Router) app served from the facilitator's laptop. Server state is one in-memory store behind a thin interface, mirrored to a JSON file so a crash doesn't lose the room. Players poll; no websockets. All case content lives in one bilingual TypeScript content file, decoupled from code. The AI's answer is pre-written and served through a `getAIAnswer()` seam so a live model can replace it later without touching the UI.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Vitest + @testing-library/react, Zod (content validation). No database. No auth.

## Global Constraints

- **Bilingual (th/en) everywhere.** Every player-facing string exists in both languages. Thai is the default.
- **No fabricated evidence imitating real outlets.** Case File documents are either real (with real source URLs) or plainly fictional (Case 4's NovaBrew). Never a mocked-up real publication.
- **Fabricated citations appear only as the AI's output, never as evidence** (Case 3), with obviously fictional party names, and are explicitly revealed as invented.
- **Speed bonus is a tiebreaker only.** Max total speed bonus across all 5 cases (75) MUST be strictly less than the smallest single-case base score (100). One extra correct answer always beats any speed advantage. This is an enforced invariant with a test.
- **Soft timer.** The app NEVER hard-cuts a player or auto-submits. The countdown is decorative.
- **No email capture. No accounts. No persistence across sessions.**
- **LAN-first.** Must run via `npm run dev -- -H 0.0.0.0` and be reachable at `http://<host-ip>:3000`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/types.ts` | All shared types + Zod schemas. Single source of truth. |
| `content/cases.ts` | The 5 cases, bilingual. The "CMS". No logic. |
| `lib/scoring.ts` | Pure scoring functions. No I/O. |
| `lib/codenames.ts` | Random detective codename generation (th/en). |
| `lib/ai-answer.ts` | The swap seam: `getAIAnswer(caseId, lang)`. Pre-written today, live model tomorrow. |
| `lib/store.ts` | Room state: players, answers. In-memory + JSON mirror, behind `RoomStore`. |
| `lib/stats.ts` | Derives dashboard stats (% fooled, leaderboard) from store state. Pure. |
| `lib/i18n.ts` | UI chrome strings (buttons, labels) in th/en. |
| `app/api/join/route.ts` | `POST` → register a codename, return player id. |
| `app/api/answer/route.ts` | `POST` → record one answer. Idempotent. |
| `app/api/stats/route.ts` | `GET` → dashboard/reveal payload. |
| `app/page.tsx` | Player flow: codename → cases → result. |
| `app/dashboard/page.tsx` | Projector: Stats Wall / Leaderboard, toggled by keypress. |
| `app/reveal/page.tsx` | Projector: facilitator arrow-keys through 5 reveals. |
| `components/Retrieval.tsx` | The retrieval animation. The star of the show. |
| `components/CaseFileDoc.tsx` | Renders one Case File document by type. |
| `components/LangToggle.tsx` | th/en switch, persisted to localStorage. |

---

## Task 1: Scaffold + types

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `vitest.config.ts`
- Create: `lib/types.ts`
- Test: `lib/types.test.ts`

**Interfaces:**
- Produces: `Lang`, `Difficulty`, `LocalizedText`, `CaseDoc`, `CaseOption`, `DetectiveCase`, `Player`, `Answer`, and Zod schema `DetectiveCaseSchema`.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --use-npm --yes
npm install zod
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"dev:lan": "next dev -H 0.0.0.0"
```

- [ ] **Step 3: Write the failing test** — `lib/types.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { DetectiveCaseSchema } from './types'

describe('DetectiveCaseSchema', () => {
  it('rejects a case whose options have no correct answer', () => {
    const bad = {
      id: 'c1', order: 1, difficulty: 'easy',
      question: { th: 'ถาม', en: 'q' },
      aiAnswer: { th: 'ตอบ', en: 'a' },
      docs: [],
      options: [
        { id: 'a', label: { th: 'ก', en: 'a' }, correct: false },
        { id: 'b', label: { th: 'ข', en: 'b' }, correct: false },
      ],
      reveal: { th: 'เฉลย', en: 'r' },
      failureMode: { th: 'โหมด', en: 'mode' },
    }
    expect(DetectiveCaseSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a case with more than one correct answer', () => {
    const bad = {
      id: 'c1', order: 1, difficulty: 'easy',
      question: { th: 'ถาม', en: 'q' },
      aiAnswer: { th: 'ตอบ', en: 'a' },
      docs: [],
      options: [
        { id: 'a', label: { th: 'ก', en: 'a' }, correct: true },
        { id: 'b', label: { th: 'ข', en: 'b' }, correct: true },
      ],
      reveal: { th: 'เฉลย', en: 'r' },
      failureMode: { th: 'โหมด', en: 'mode' },
    }
    expect(DetectiveCaseSchema.safeParse(bad).success).toBe(false)
  })
})
```

- [ ] **Step 4: Run it, verify it fails**

Run: `npx vitest run lib/types.test.ts`
Expected: FAIL — cannot resolve `./types`.

- [ ] **Step 5: Write `lib/types.ts`**

```ts
import { z } from 'zod'

export type Lang = 'th' | 'en'

export const LocalizedTextSchema = z.object({ th: z.string().min(1), en: z.string().min(1) })
export type LocalizedText = z.infer<typeof LocalizedTextSchema>

export const DifficultySchema = z.enum(['easy', 'medium', 'hard', 'expert', 'final'])
export type Difficulty = z.infer<typeof DifficultySchema>

/** A document in the Case File knowledge base. `found: false` is the retrieval gap. */
export const CaseDocSchema = z.object({
  filename: z.string().min(1),
  kind: z.enum(['headline', 'chart', 'screenshot', 'excerpt', 'table']),
  found: z.boolean(),
  title: LocalizedTextSchema,
  body: LocalizedTextSchema.optional(),
  sourceUrl: z.string().url().optional(),
  /** True for openly in-world/fictional evidence (Case 4). Rendered with a FICTIONAL badge. */
  fictional: z.boolean().default(false),
})
export type CaseDoc = z.infer<typeof CaseDocSchema>

export const CaseOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
  correct: z.boolean(),
})
export type CaseOption = z.infer<typeof CaseOptionSchema>

export const DetectiveCaseSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1).max(5),
  difficulty: DifficultySchema,
  question: LocalizedTextSchema,
  aiAnswer: LocalizedTextSchema,
  docs: z.array(CaseDocSchema),
  options: z.array(CaseOptionSchema).length(4),
  reveal: LocalizedTextSchema,
  failureMode: LocalizedTextSchema,
}).refine(
  (c) => c.options.filter((o) => o.correct).length === 1,
  { message: 'a case must have exactly one correct option' },
)
export type DetectiveCase = z.infer<typeof DetectiveCaseSchema>

export type Player = { id: string; codename: string; joinedAt: number }
export type Answer = { playerId: string; caseId: string; optionId: string; elapsedMs: number }
```

> Note: the two tests above use only 2 options, so `.length(4)` also fails them — that is fine and intended; both assertions still hold. The `.refine` is what guards the one-correct-answer invariant for real 4-option cases.

- [ ] **Step 6: Run tests, verify they pass**

Run: `npx vitest run lib/types.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app and shared types"
```

---

## Task 2: The five cases (content file)

**Files:**
- Create: `content/cases.ts`
- Test: `content/cases.test.ts`

**Interfaces:**
- Consumes: `DetectiveCase`, `DetectiveCaseSchema` from `lib/types.ts`.
- Produces: `export const CASES: DetectiveCase[]` (5 cases, ordered 1–5), `export function getCase(id: string): DetectiveCase | undefined`.

**Content integrity — read before writing:** Cases 1, 2, 3, 5 are real, sourced 2026 events; their `sourceUrl` values must be real links. Case 4 is openly fictional (`fictional: true`). Case 3's fabricated citation appears ONLY inside `aiAnswer` and uses obviously fictional party names.

- [ ] **Step 1: Write the failing test** — `content/cases.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { CASES, getCase } from './cases'
import { DetectiveCaseSchema } from '@/lib/types'

describe('CASES', () => {
  it('has exactly 5 cases ordered 1..5', () => {
    expect(CASES).toHaveLength(5)
    expect(CASES.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('every case is schema-valid (implies exactly one correct option, 4 options)', () => {
    for (const c of CASES) {
      const result = DetectiveCaseSchema.safeParse(c)
      expect(result.success, `case ${c.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true)
    }
  })

  it('every case is fully bilingual — no empty th or en strings', () => {
    const walk = (v: unknown): void => {
      if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>
        if (typeof o.th === 'string' || typeof o.en === 'string') {
          expect(o.th, 'missing th').toBeTruthy()
          expect(o.en, 'missing en').toBeTruthy()
        }
        Object.values(o).forEach(walk)
      }
    }
    CASES.forEach(walk)
  })

  it('cases 1-3 each have exactly one missing document (the retrieval gap)', () => {
    for (const c of CASES.filter((c) => c.order <= 3)) {
      expect(c.docs.filter((d) => !d.found)).toHaveLength(1)
    }
  })

  it('cases 4 and 5 retrieve cleanly — no missing documents', () => {
    for (const c of CASES.filter((c) => c.order >= 4)) {
      expect(c.docs.filter((d) => !d.found)).toHaveLength(0)
    }
  })

  it('case 5: the correct answer is that the AI is correct', () => {
    const c5 = CASES.find((c) => c.order === 5)!
    expect(c5.options.find((o) => o.correct)!.id).toBe('ai-correct')
  })

  it('every real (non-fictional) found document cites a source URL', () => {
    for (const c of CASES) {
      for (const d of c.docs.filter((d) => d.found && !d.fictional)) {
        expect(d.sourceUrl, `${c.id}/${d.filename}`).toBeTruthy()
      }
    }
  })

  it('getCase finds by id', () => {
    expect(getCase(CASES[0].id)!.order).toBe(1)
    expect(getCase('nope')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run content/cases.test.ts`
Expected: FAIL — cannot resolve `./cases`.

- [ ] **Step 3: Write `content/cases.ts`**

Write all five cases. Full content below — this is the deliverable, do not abbreviate it.

```ts
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
        label: { th: 'AI ตอบถูก — ยังไม่มีใครไปไกลกว่านั้นเลยตั้งแต่ปี 1972', en: 'The AI is correct — nobody has, since 1972' },
        correct: false,
      },
      {
        id: 'stale',
        label: {
          th: 'AI ตอบถูก "เมื่อปีที่แล้ว" — แต่มันไม่เคยดึงข้อมูลปี 2026 มาเลย ภารกิจ Artemis II ทำสำเร็จไปแล้ว',
          en: 'The AI was right last year — but it never retrieved anything from 2026. Artemis II already flew.',
        },
        correct: true,
      },
      {
        id: 'apollo-wrong',
        label: { th: 'AI จำผิด — ภารกิจสุดท้ายคือ Apollo 11 ไม่ใช่ Apollo 17', en: 'The AI misremembered — the last mission was Apollo 11, not Apollo 17' },
        correct: false,
      },
      {
        id: 'never-happened',
        label: { th: 'AI แต่งเรื่องขึ้นมา — มนุษย์ไม่เคยออกไปไกลกว่าวงโคจรระดับต่ำเลย', en: 'The AI fabricated it — humans have never left low Earth orbit at all' },
        correct: false,
      },
    ],
    failureMode: { th: 'ความรู้ที่ล้าสมัย (Stale Knowledge)', en: 'Stale knowledge' },
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
      { id: 'ai-correct', label: { th: 'AI ตอบถูกทั้งหมด', en: 'The AI is entirely correct' }, correct: false },
      {
        id: 'wrong-country',
        label: { th: 'ผิดประเทศ — นอร์เวย์ไม่ได้อันดับหนึ่ง', en: 'Wrong country — Norway did not top the table' },
        correct: false,
      },
      {
        id: 'invented-numbers',
        label: {
          th: 'ถูกประเทศ — แต่ตัวเลขถูกแต่งขึ้น ของจริงคือทอง 18 รวม 41 เหรียญ',
          en: 'Right country — but the numbers are invented. It was 18 gold, 41 total.',
        },
        correct: true,
      },
      {
        id: 'not-happened',
        label: { th: 'โอลิมปิกครั้งนี้ยังไม่เกิดขึ้น', en: 'These Olympics have not happened yet' },
        correct: false,
      },
    ],
    failureMode: { th: 'การแต่งตัวเลขที่เฉพาะเจาะจง (Fabricated Specifics)', en: 'Fabricated specifics' },
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
        title: { th: 'ABA Litigation News: "คดีปลอม บทลงโทษจริง — อันตรายของ AI"', en: 'ABA Litigation News: "Fake Cases, Real Sanctions: The Dangers of AI"' },
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
        title: { th: 'NPR: บทลงโทษเพิ่มขึ้นเรื่อย ๆ ขณะที่ AI แพร่เข้าสู่ระบบกฎหมาย', en: 'NPR: Penalties stack up as AI spreads through the legal system' },
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
      { id: 'ai-correct', label: { th: 'AI ตอบถูกทั้งหมด', en: 'The AI is entirely correct' }, correct: false },
      {
        id: 'claim-false',
        label: { th: 'ข้ออ้างเป็นเท็จ — ไม่เคยมีทนายความถูกลงโทษจริง', en: 'The claim is false — no lawyer has actually been punished' },
        correct: false,
      },
      {
        id: 'invented-source',
        label: {
          th: 'ข้ออ้าง "เป็นจริง" — แต่คดีที่ AI ยกมาอ้างนั้นไม่มีอยู่จริง มันแต่งแหล่งอ้างอิงขึ้นมาเอง',
          en: 'The claim is TRUE — but the case the AI cites does not exist. It invented its own source.',
        },
        correct: true,
      },
      {
        id: 'wrong-amount',
        label: { th: 'AI ผิดแค่จำนวนเงินค่าปรับเท่านั้น', en: 'The AI only got the fine amount wrong' },
        correct: false,
      },
    ],
    failureMode: { th: 'คำตอบถูก แต่แหล่งอ้างอิงถูกแต่งขึ้น (Fabricated Citation)', en: 'Right answer, invented source' },
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
      { id: 'ai-correct', label: { th: 'AI สรุปถูกต้อง — ควรเร่งขยายสาขา', en: 'The AI is correct — accelerate the expansion' }, correct: false },
      {
        id: 'numbers-wrong',
        label: { th: 'AI อ้างตัวเลขผิด — รายได้ไม่ได้โต 12.5%', en: 'The AI misquoted the numbers — revenue did not grow 12.5%' },
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
        label: { th: 'มีเอกสารสำคัญหายไปจากแฟ้มคดี', en: 'A key document is missing from the Case File' },
        correct: false,
      },
    ],
    failureMode: { th: 'การให้เหตุผลที่ผิดพลาด (Flawed Reasoning)', en: 'Flawed reasoning' },
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
    aiAnswer: {
      th: 'จริงครับ ในปี 2026 ทีมวิจัยจาก University of Hawaiʻi at Mānoa ถ่ายวิดีโอฉลามก็อบลิน (goblin shark) ที่ยังมีชีวิตในถิ่นอาศัยธรรมชาติใต้ทะเลลึกได้เป็นครั้งแรก โดยพบสองตัว — ตัวหนึ่งใกล้ภูเขาใต้ทะเลแถบเกาะ Jarvis และอีกตัวที่ลาดร่องลึก Tonga Trench ซึ่งลึกกว่าที่เคยรู้จักของสายพันธุ์นี้ราว 700 เมตร งานวิจัยตีพิมพ์ใน Journal of Fish Biology',
      en: 'Yes. In 2026, a research team from the University of Hawaiʻi at Mānoa filmed a living goblin shark in its natural deep-sea habitat for the first time. Two individuals were observed — one near a seamount by Jarvis Island, another on the slope of the Tonga Trench, roughly 700m deeper than the species was known to live. The work was published in the Journal of Fish Biology.',
    },
    docs: [
      {
        filename: 'journal_of_fish_biology_2026.pdf',
        kind: 'excerpt',
        found: true,
        fictional: false,
        title: { th: 'Journal of Fish Biology (2026) — งานวิจัยต้นฉบับ', en: 'Journal of Fish Biology (2026) — the original paper' },
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
        label: { th: '✅ AI ตอบถูกต้อง — เรื่องนี้เกิดขึ้นจริงทุกประการ', en: '✅ The AI is CORRECT — every part of this actually happened' },
        correct: true,
      },
      {
        id: 'invented-animal',
        label: { th: 'AI แต่งขึ้น — "ฉลามก็อบลิน" ไม่ใช่สัตว์ที่มีอยู่จริง', en: 'The AI made it up — the "goblin shark" is not a real animal' },
        correct: false,
      },
      {
        id: 'invented-detail',
        label: { th: 'สัตว์มีจริง แต่ AI แต่งรายละเอียดเรื่อง Tonga Trench ขึ้นมา', en: 'The animal is real, but the AI invented the Tonga Trench detail' },
        correct: false,
      },
      {
        id: 'wrong-year',
        label: { th: 'เรื่องนี้เกิดขึ้นจริง แต่ไม่ใช่ปี 2026', en: 'It really happened, but not in 2026' },
        correct: false,
      },
    ],
    failureMode: { th: 'ไม่มีความผิดพลาด — AI ตอบถูก', en: 'No failure — the AI is right' },
    reveal: {
      th: '🎯 คดีสุดท้าย: AI ตอบถูก ทุกคำ ฉลามก็อบลินมีจริง ทีมวิจัยจาก University of Hawaiʻi at Mānoa ถ่ายวิดีโอมันได้จริงในปี 2026 พบสองตัวจริง ที่ Jarvis Island และ Tonga Trench จริง และการพบที่ Tonga Trench ก็สร้างสถิติความลึกใหม่ของอันดับ Lamniformes จริง ตีพิมพ์ใน Journal of Fish Biology จริง สังเกตว่าการค้นหาเอกสาร "ครบถ้วน" — ไม่มีช่องว่างให้ AI ต้องเดา แล้วทำไมพวกเราส่วนใหญ่ถึงกาว่ามันมั่ว? เพราะผ่านมา 4 คดี เราถูกฝึกให้ "ไม่เชื่อ" และความไม่เชื่อแบบอัตโนมัติ ก็ขี้เกียจพอ ๆ กับความเชื่อแบบอัตโนมัติ นี่คือหัวใจของเวิร์กช็อปนี้: คิดกับ AI — อย่าแค่เชื่อมัน และอย่าแค่ปฏิเสธมัน',
      en: '🎯 The final case: the AI is RIGHT. Every word. The goblin shark is real. A University of Hawaiʻi at Mānoa team really did film it in 2026. Two individuals really were observed, near Jarvis Island and in the Tonga Trench. The Tonga sighting really did set a new depth record for the entire order Lamniformes. It really was published in the Journal of Fish Biology. Notice the retrieval was CLEAN — there was no gap for the AI to paper over. So why did most of us mark it false? Because four cases trained us to distrust — and reflexive doubt is exactly as lazy as reflexive trust. That is the whole point of this workshop: think WITH AI. Do not just trust it. And do not just doubt it either.',
    },
  },
]

export function getCase(id: string): DetectiveCase | undefined {
  return CASES.find((c) => c.id === id)
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run content/cases.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add content/
git commit -m "feat: add the five AI Detective cases (bilingual, sourced)"
```

---

## Task 3: Scoring

**Files:**
- Create: `lib/scoring.ts`
- Test: `lib/scoring.test.ts`

**Interfaces:**
- Consumes: `Difficulty`, `Answer` from `lib/types.ts`; `CASES` from `content/cases.ts`.
- Produces:
  - `BASE_POINTS: Record<Difficulty, number>`
  - `MAX_SPEED_BONUS: number`
  - `speedBonus(elapsedMs: number): number`
  - `scoreAnswer(difficulty: Difficulty, correct: boolean, elapsedMs: number): number`
  - `totalScore(answers: Answer[]): number`

**The invariant:** max total speed bonus (5 × 15 = 75) < min base points (100). One extra correct answer always outranks any speed advantage. This is tested, not assumed.

- [ ] **Step 1: Write the failing test** — `lib/scoring.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { BASE_POINTS, MAX_SPEED_BONUS, speedBonus, scoreAnswer, totalScore } from './scoring'
import type { Answer } from './types'

describe('speedBonus', () => {
  it('awards the max bonus for an instant answer', () => {
    expect(speedBonus(0)).toBe(MAX_SPEED_BONUS)
  })
  it('awards zero once the soft target has elapsed', () => {
    expect(speedBonus(90_000)).toBe(0)
    expect(speedBonus(500_000)).toBe(0)
  })
  it('never returns a negative bonus', () => {
    expect(speedBonus(10_000_000)).toBeGreaterThanOrEqual(0)
  })
})

describe('scoreAnswer', () => {
  it('awards nothing at all for a wrong answer, no matter how fast', () => {
    expect(scoreAnswer('final', false, 0)).toBe(0)
  })
  it('awards base + bonus for a correct answer', () => {
    expect(scoreAnswer('easy', true, 0)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })
  it('awards harder cases more base points', () => {
    expect(BASE_POINTS.final).toBeGreaterThan(BASE_POINTS.easy)
  })
})

describe('THE INVARIANT: speed can only ever break a tie', () => {
  it('the maximum total speed bonus is strictly less than the smallest base score', () => {
    const maxTotalBonus = 5 * MAX_SPEED_BONUS
    const minBase = Math.min(...Object.values(BASE_POINTS))
    expect(maxTotalBonus).toBeLessThan(minBase)
  })

  it('a slow player with one more correct answer always beats a fast player with fewer', () => {
    // Fast player: 4 correct, instantly, on the HARDEST cases.
    const fast = ['medium', 'hard', 'expert', 'final'] as const
    const fastScore = fast.reduce((s, d) => s + scoreAnswer(d, true, 0), 0)

    // Slow player: those same 4, maximally slow, PLUS the easiest case.
    const slowScore =
      fast.reduce((s, d) => s + scoreAnswer(d, true, 999_999), 0) +
      scoreAnswer('easy', true, 999_999)

    expect(slowScore).toBeGreaterThan(fastScore)
  })
})

describe('totalScore', () => {
  it('sums scored answers, ignoring answers to unknown cases', () => {
    const answers: Answer[] = [
      { playerId: 'p1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct
      { playerId: 'p1', caseId: 'olympics', optionId: 'ai-correct', elapsedMs: 0 }, // wrong
      { playerId: 'p1', caseId: 'ghost', optionId: 'x', elapsedMs: 0 },             // unknown case
    ]
    expect(totalScore(answers)).toBe(BASE_POINTS.easy + MAX_SPEED_BONUS)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/scoring.test.ts`
Expected: FAIL — cannot resolve `./scoring`.

- [ ] **Step 3: Write `lib/scoring.ts`**

```ts
import type { Answer, Difficulty } from './types'
import { getCase } from '@/content/cases'

/** Harder cases are worth more. The smallest value here bounds MAX_SPEED_BONUS — see below. */
export const BASE_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 150,
  hard: 200,
  expert: 250,
  final: 300,
}

/**
 * Speed is a TIEBREAKER ONLY.
 *
 * Invariant (enforced by test): 5 * MAX_SPEED_BONUS < min(BASE_POINTS).
 * 5 * 15 = 75 < 100. So even a perfectly fast player can never out-score a
 * slower player who got one more case right. A workshop that teaches people
 * not to trust snap judgments must not reward snap judgments.
 *
 * To make the leaderboard more aggressive, raise this — but keep the invariant.
 */
export const MAX_SPEED_BONUS = 15

/** Soft target per case. Answering slower than this simply earns no bonus — it is never punished. */
const SPEED_TARGET_MS = 90_000

export function speedBonus(elapsedMs: number): number {
  const remaining = SPEED_TARGET_MS - elapsedMs
  if (remaining <= 0) return 0
  return Math.round(MAX_SPEED_BONUS * (remaining / SPEED_TARGET_MS))
}

export function scoreAnswer(difficulty: Difficulty, correct: boolean, elapsedMs: number): number {
  if (!correct) return 0
  return BASE_POINTS[difficulty] + speedBonus(elapsedMs)
}

export function totalScore(answers: Answer[]): number {
  return answers.reduce((sum, a) => {
    const c = getCase(a.caseId)
    if (!c) return sum
    const correct = c.options.some((o) => o.id === a.optionId && o.correct)
    return sum + scoreAnswer(c.difficulty, correct, a.elapsedMs)
  }, 0)
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/scoring.test.ts`
Expected: PASS (8 tests), including both invariant tests.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.ts lib/scoring.test.ts
git commit -m "feat: scoring with speed-as-tiebreaker-only invariant"
```

---

## Task 4: Room store

**Files:**
- Create: `lib/store.ts`
- Test: `lib/store.test.ts`

**Interfaces:**
- Consumes: `Player`, `Answer` from `lib/types.ts`.
- Produces:
  - `interface RoomStore { join(codename: string): Player; recordAnswer(a: Answer): void; getPlayers(): Player[]; getAnswers(): Answer[]; reset(): void }`
  - `class MemoryRoomStore implements RoomStore` (constructor takes an optional `persistPath`)
  - `getStore(): RoomStore` — process-wide singleton, mirrors to `.room-state.json`.

**Why an interface:** the spec requires the store be swappable for a real database without touching callers.

- [ ] **Step 1: Write the failing test** — `lib/store.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRoomStore } from './store'

describe('MemoryRoomStore', () => {
  let store: MemoryRoomStore
  beforeEach(() => { store = new MemoryRoomStore() })

  it('joins a player and assigns a unique id', () => {
    const a = store.join('Detective Ramen')
    const b = store.join('นักสืบกาแฟ')
    expect(a.codename).toBe('Detective Ramen')
    expect(a.id).not.toBe(b.id)
    expect(store.getPlayers()).toHaveLength(2)
  })

  it('records an answer', () => {
    const p = store.join('D')
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('is idempotent — re-answering the same case overwrites, never duplicates', () => {
    const p = store.join('D')
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1000 })
    store.recordAnswer({ playerId: p.id, caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 2000 })
    const answers = store.getAnswers()
    expect(answers).toHaveLength(1)
    expect(answers[0].optionId).toBe('ai-correct')
  })

  it('keeps different players\' answers to the same case separate', () => {
    const p1 = store.join('A')
    const p2 = store.join('B')
    store.recordAnswer({ playerId: p1.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1 })
    store.recordAnswer({ playerId: p2.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 1 })
    expect(store.getAnswers()).toHaveLength(2)
  })

  it('resets', () => {
    store.join('D')
    store.reset()
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/store.test.ts`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Write `lib/store.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import type { Answer, Player } from './types'

export interface RoomStore {
  join(codename: string): Player
  recordAnswer(a: Answer): void
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
}

type Snapshot = { players: Player[]; answers: Answer[] }

export class MemoryRoomStore implements RoomStore {
  private players: Player[] = []
  /** Keyed `${playerId}:${caseId}` so a re-answer overwrites rather than duplicates. */
  private answers = new Map<string, Answer>()

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  join(codename: string): Player {
    const player: Player = { id: randomUUID(), codename, joinedAt: Date.now() }
    this.players.push(player)
    this.persist()
    return player
  }

  recordAnswer(a: Answer): void {
    this.answers.set(`${a.playerId}:${a.caseId}`, a)
    this.persist()
  }

  getPlayers(): Player[] { return [...this.players] }
  getAnswers(): Answer[] { return [...this.answers.values()] }

  reset(): void {
    this.players = []
    this.answers.clear()
    this.persist()
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, answers: this.getAnswers() }
    try {
      writeFileSync(this.persistPath, JSON.stringify(snap), 'utf8')
    } catch {
      // Persistence is a safety net, not a requirement. Never take the room down over it.
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Snapshot
      this.players = snap.players ?? []
      for (const a of snap.answers ?? []) this.answers.set(`${a.playerId}:${a.caseId}`, a)
    } catch {
      // No prior state (first run) — start empty.
    }
  }
}

/**
 * Process-wide singleton. Next dev-mode hot reload re-evaluates modules, so we
 * stash it on globalThis to keep the room alive across reloads.
 */
const globalForStore = globalThis as unknown as { __roomStore?: RoomStore }
export function getStore(): RoomStore {
  if (!globalForStore.__roomStore) {
    globalForStore.__roomStore = new MemoryRoomStore('.room-state.json')
  }
  return globalForStore.__roomStore
}
```

Add `.room-state.json` to `.gitignore`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts .gitignore
git commit -m "feat: in-memory room store with JSON mirror, behind RoomStore interface"
```

---

## Task 5: Stats derivation

**Files:**
- Create: `lib/stats.ts`
- Test: `lib/stats.test.ts`

**Interfaces:**
- Consumes: `Player`, `Answer` from `lib/types.ts`; `CASES` from `content/cases.ts`; `totalScore` from `lib/scoring.ts`.
- Produces:
  - `type CaseStat = { caseId: string; order: number; answered: number; fooled: number; fooledPct: number }`
  - `type LeaderboardRow = { codename: string; score: number; correct: number }`
  - `type RoomStats = { detectives: number; finished: number; caseStats: CaseStat[]; leaderboard: LeaderboardRow[] }`
  - `computeStats(players: Player[], answers: Answer[]): RoomStats`

**"Fooled" means:** the player picked a *wrong* option. For Cases 1–4 that means they were taken in by the hallucination; for Case 5 it means they wrongly flagged a *correct* AI. Both are "the AI's answer defeated you," which is what the projector number is claiming.

- [ ] **Step 1: Write the failing test** — `lib/stats.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { computeStats } from './stats'
import type { Player, Answer } from './types'

const p = (id: string, codename: string): Player => ({ id, codename, joinedAt: 0 })

describe('computeStats', () => {
  it('counts detectives', () => {
    const stats = computeStats([p('1', 'A'), p('2', 'B')], [])
    expect(stats.detectives).toBe(2)
  })

  it('counts a player as finished only when all 5 cases are answered', () => {
    const answers: Answer[] = ['artemis', 'olympics', 'citation', 'novabrew'].map((caseId) => ({
      playerId: '1', caseId, optionId: 'x', elapsedMs: 0,
    }))
    expect(computeStats([p('1', 'A')], answers).finished).toBe(0)

    answers.push({ playerId: '1', caseId: 'goblinshark', optionId: 'ai-correct', elapsedMs: 0 })
    expect(computeStats([p('1', 'A')], answers).finished).toBe(1)
  })

  it('computes % fooled per case — a wrong pick counts as fooled', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },      // correct
      { playerId: '2', caseId: 'artemis', optionId: 'ai-correct', elapsedMs: 0 }, // fooled
    ]
    const stat = computeStats([p('1', 'A'), p('2', 'B')], answers).caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(2)
    expect(stat.fooled).toBe(1)
    expect(stat.fooledPct).toBe(50)
  })

  it('reports 0% fooled for a case nobody has answered (never NaN)', () => {
    const stat = computeStats([], []).caseStats.find((c) => c.caseId === 'artemis')!
    expect(stat.answered).toBe(0)
    expect(stat.fooledPct).toBe(0)
  })

  it('returns all 5 cases in play order', () => {
    expect(computeStats([], []).caseStats.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('ranks the leaderboard by score, highest first', () => {
    const answers: Answer[] = [
      { playerId: '1', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 },       // A: correct (easy)
      { playerId: '2', caseId: 'goblinshark', optionId: 'ai-correct', elapsedMs: 0 }, // B: correct (final, worth more)
    ]
    const board = computeStats([p('1', 'A'), p('2', 'B')], answers).leaderboard
    expect(board[0].codename).toBe('B')
    expect(board[0].correct).toBe(1)
    expect(board[1].codename).toBe('A')
    expect(board[0].score).toBeGreaterThan(board[1].score)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run lib/stats.test.ts`
Expected: FAIL — cannot resolve `./stats`.

- [ ] **Step 3: Write `lib/stats.ts`**

```ts
import type { Answer, Player } from './types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from './scoring'

export type CaseStat = {
  caseId: string
  order: number
  answered: number
  fooled: number
  fooledPct: number
}

export type LeaderboardRow = { codename: string; score: number; correct: number }

export type RoomStats = {
  detectives: number
  finished: number
  caseStats: CaseStat[]
  leaderboard: LeaderboardRow[]
}

function isCorrect(a: Answer): boolean {
  const c = getCase(a.caseId)
  return !!c && c.options.some((o) => o.id === a.optionId && o.correct)
}

export function computeStats(players: Player[], answers: Answer[]): RoomStats {
  const caseStats: CaseStat[] = [...CASES]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const forCase = answers.filter((a) => a.caseId === c.id)
      const fooled = forCase.filter((a) => !isCorrect(a)).length
      return {
        caseId: c.id,
        order: c.order,
        answered: forCase.length,
        fooled,
        fooledPct: forCase.length === 0 ? 0 : Math.round((fooled / forCase.length) * 100),
      }
    })

  const leaderboard: LeaderboardRow[] = players
    .map((p) => {
      const mine = answers.filter((a) => a.playerId === p.id)
      return {
        codename: p.codename,
        score: totalScore(mine),
        correct: mine.filter(isCorrect).length,
      }
    })
    .sort((a, b) => b.score - a.score)

  const finished = players.filter(
    (p) => answers.filter((a) => a.playerId === p.id).length >= CASES.length,
  ).length

  return { detectives: players.length, finished, caseStats, leaderboard }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/stats.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts lib/stats.test.ts
git commit -m "feat: derive room stats (% fooled, leaderboard) from store state"
```

---

## Task 6: Codenames, i18n, and the AI-answer seam

**Files:**
- Create: `lib/codenames.ts`, `lib/i18n.ts`, `lib/ai-answer.ts`
- Test: `lib/codenames.test.ts`, `lib/ai-answer.test.ts`

**Interfaces:**
- Produces:
  - `randomCodename(lang: Lang): string`
  - `t(key: UIKey, lang: Lang): string` and `type UIKey`
  - `getAIAnswer(caseId: string, lang: Lang): Promise<string>` — **the swap seam.** Today it reads `aiAnswer` from the content file. Tomorrow it can call a live model. Callers must not care. It is `async` *today* precisely so that swapping in a network call later requires no caller changes.

- [ ] **Step 1: Write the failing tests**

`lib/codenames.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { randomCodename } from './codenames'

describe('randomCodename', () => {
  it('produces a Thai codename prefixed นักสืบ', () => {
    expect(randomCodename('th')).toMatch(/^นักสืบ/)
  })
  it('produces an English codename prefixed Detective', () => {
    expect(randomCodename('en')).toMatch(/^Detective /)
  })
  it('varies across many draws', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomCodename('en')))
    expect(seen.size).toBeGreaterThan(1)
  })
})
```

`lib/ai-answer.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { getAIAnswer } from './ai-answer'
import { CASES } from '@/content/cases'

describe('getAIAnswer (the swap seam)', () => {
  it('returns the pre-written answer in the requested language', async () => {
    const c = CASES[0]
    expect(await getAIAnswer(c.id, 'en')).toBe(c.aiAnswer.en)
    expect(await getAIAnswer(c.id, 'th')).toBe(c.aiAnswer.th)
  })
  it('throws on an unknown case rather than returning something plausible', async () => {
    await expect(getAIAnswer('nope', 'en')).rejects.toThrow(/unknown case/i)
  })
})
```

- [ ] **Step 2: Run them, verify they fail**

Run: `npx vitest run lib/codenames.test.ts lib/ai-answer.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the three modules**

`lib/codenames.ts`:
```ts
import type { Lang } from './types'

const NOUNS: Record<Lang, string[]> = {
  en: ['Ramen', 'Espresso', 'Mango', 'Neon', 'Midnight', 'Orchid', 'Falcon', 'Pixel',
       'Tuk-Tuk', 'Monsoon', 'Jasmine', 'Cobra', 'Lantern', 'Comet', 'Durian'],
  th: ['ราเมง', 'กาแฟ', 'มะม่วง', 'นีออน', 'เที่ยงคืน', 'กล้วยไม้', 'เหยี่ยว', 'พิกเซล',
       'ตุ๊กตุ๊ก', 'มรสุม', 'มะลิ', 'งูเห่า', 'โคมไฟ', 'ดาวหาง', 'ทุเรียน'],
}

export function randomCodename(lang: Lang): string {
  const pool = NOUNS[lang]
  const noun = pool[Math.floor(Math.random() * pool.length)]
  return lang === 'th' ? `นักสืบ${noun}` : `Detective ${noun}`
}
```

`lib/i18n.ts`:
```ts
import type { Lang } from './types'

const STRINGS = {
  appTitle:      { th: '🕵️ นักสืบ AI', en: '🕵️ AI Detective' },
  tagline:       { th: 'คิดกับ AI ไม่ใช่แค่เชื่อ AI', en: 'Think with AI, not just trust AI.' },
  enterCodename: { th: 'ตั้งชื่อรหัสนักสืบของคุณ', en: 'Choose your detective codename' },
  randomName:    { th: '🎲 สุ่มชื่อให้ฉัน', en: '🎲 Give me a codename' },
  startMission:  { th: 'เริ่มภารกิจ', en: 'Begin the mission' },
  caseFile:      { th: '📂 แฟ้มคดี', en: '📂 Case File' },
  retrieving:    { th: 'กำลังค้นหาจากแฟ้มคดี…', en: 'Retrieving from Case File…' },
  retrieved:     { th: 'พบเอกสาร', en: 'retrieved' },
  notFound:      { th: 'ไม่พบเอกสาร', en: 'NOT FOUND' },
  aiAnswer:      { th: '🤖 คำตอบของ AI', en: '🤖 AI Answer' },
  yourVerdict:   { th: '✅ คำตัดสินของคุณ', en: '✅ Your Verdict' },
  submit:        { th: 'ยืนยันคำตัดสิน', en: 'Commit to your verdict' },
  nextCase:      { th: 'คดีถัดไป →', en: 'Next case →' },
  finished:      { th: 'ปิดคดีครบทั้ง 5 คดีแล้ว', en: 'All 5 cases closed' },
  yourScore:     { th: 'คะแนนของคุณ', en: 'Your score' },
  waitReveal:    { th: 'รอการเฉลยพร้อมกันบนจอใหญ่', en: 'Wait for the group reveal on the big screen' },
  fictional:     { th: 'เอกสารสมมติ', en: 'FICTIONAL' },
  detectives:    { th: 'นักสืบ', en: 'Detectives' },
  finishedCount: { th: 'ไขคดีครบแล้ว', en: 'Finished' },
  fooledBy:      { th: 'ถูก AI หลอก', en: 'fooled by the AI' },
  leaderboard:   { th: 'อันดับนักสืบ', en: 'Leaderboard' },
  statsWall:     { th: 'สถิติห้อง', en: 'Stats Wall' },
  toggleHint:    { th: 'กด [L] เพื่อสลับมุมมอง', en: 'Press [L] to switch panels' },
} as const

export type UIKey = keyof typeof STRINGS

export function t(key: UIKey, lang: Lang): string {
  return STRINGS[key][lang]
}
```

`lib/ai-answer.ts`:
```ts
import type { Lang } from './types'
import { getCase } from '@/content/cases'

/**
 * THE SWAP SEAM.
 *
 * Today: returns the pre-written answer from the content file. This is deliberate —
 * the group reveal requires every player to have seen the SAME AI answer, and a live
 * model might also (correctly!) decline to hallucinate, causing the demo to no-show
 * in front of an audience.
 *
 * Tomorrow: replace the body with a real model call over a real vector store.
 * No caller changes required — which is why this is already async.
 */
export async function getAIAnswer(caseId: string, lang: Lang): Promise<string> {
  const c = getCase(caseId)
  if (!c) throw new Error(`unknown case: ${caseId}`)
  return c.aiAnswer[lang]
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run lib/codenames.test.ts lib/ai-answer.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/codenames.ts lib/i18n.ts lib/ai-answer.ts lib/codenames.test.ts lib/ai-answer.test.ts
git commit -m "feat: codenames, UI strings, and the swappable AI-answer seam"
```

---

## Task 7: API routes

**Files:**
- Create: `app/api/join/route.ts`, `app/api/answer/route.ts`, `app/api/stats/route.ts`, `app/api/reset/route.ts`
- Test: `app/api/routes.test.ts`

**Interfaces:**
- Consumes: `getStore` from `lib/store.ts`; `computeStats` from `lib/stats.ts`.
- Produces (HTTP contract the client depends on):
  - `POST /api/join` — body `{ codename: string }` → `200 { player: Player }` | `400 { error }`
  - `POST /api/answer` — body `{ playerId, caseId, optionId, elapsedMs }` → `200 { ok: true }` | `400 { error }`
  - `GET /api/stats` → `200 RoomStats`
  - `POST /api/reset` → `200 { ok: true }` (facilitator: clear the room between sessions)

- [ ] **Step 1: Write the failing test** — `app/api/routes.test.ts`

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { POST as join } from './join/route'
import { POST as answer } from './answer/route'
import { GET as stats } from './stats/route'
import { POST as reset } from './reset/route'

const post = (body: unknown) => new Request('http://x', { method: 'POST', body: JSON.stringify(body) })

describe('API routes', () => {
  beforeEach(async () => { await reset() })

  it('POST /api/join returns a player with an id', async () => {
    const res = await join(post({ codename: 'Detective Ramen' }))
    expect(res.status).toBe(200)
    const { player } = await res.json()
    expect(player.id).toBeTruthy()
    expect(player.codename).toBe('Detective Ramen')
  })

  it('POST /api/join rejects an empty codename', async () => {
    const res = await join(post({ codename: '   ' }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer records an answer that shows up in stats', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    const res = await answer(post({ playerId: player.id, caseId: 'artemis', optionId: 'stale', elapsedMs: 500 }))
    expect(res.status).toBe(200)

    const body = await (await stats()).json()
    const artemis = body.caseStats.find((c: { caseId: string }) => c.caseId === 'artemis')
    expect(artemis.answered).toBe(1)
    expect(artemis.fooled).toBe(0) // 'stale' is the correct option
  })

  it('POST /api/answer rejects an unknown case', async () => {
    const { player } = await (await join(post({ codename: 'D' }))).json()
    const res = await answer(post({ playerId: player.id, caseId: 'ghost', optionId: 'x', elapsedMs: 0 }))
    expect(res.status).toBe(400)
  })

  it('POST /api/answer rejects an unknown player', async () => {
    const res = await answer(post({ playerId: 'nobody', caseId: 'artemis', optionId: 'stale', elapsedMs: 0 }))
    expect(res.status).toBe(400)
  })

  it('GET /api/stats returns all five cases even with an empty room', async () => {
    const body = await (await stats()).json()
    expect(body.detectives).toBe(0)
    expect(body.caseStats).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run app/api/routes.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Write the routes**

`app/api/join/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  const { codename } = (await req.json()) as { codename?: string }
  const trimmed = (codename ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'codename required' }, { status: 400 })
  const player = getStore().join(trimmed.slice(0, 40))
  return NextResponse.json({ player })
}
```

`app/api/answer/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { getCase } from '@/content/cases'

export async function POST(req: Request) {
  const body = (await req.json()) as {
    playerId?: string; caseId?: string; optionId?: string; elapsedMs?: number
  }
  const { playerId, caseId, optionId } = body
  const elapsedMs = body.elapsedMs ?? 0

  if (!playerId || !caseId || !optionId) {
    return NextResponse.json({ error: 'playerId, caseId and optionId are required' }, { status: 400 })
  }

  const store = getStore()
  if (!store.getPlayers().some((p) => p.id === playerId)) {
    return NextResponse.json({ error: 'unknown player' }, { status: 400 })
  }

  const c = getCase(caseId)
  if (!c) return NextResponse.json({ error: 'unknown case' }, { status: 400 })
  if (!c.options.some((o) => o.id === optionId)) {
    return NextResponse.json({ error: 'unknown option' }, { status: 400 })
  }

  store.recordAnswer({ playerId, caseId, optionId, elapsedMs })
  return NextResponse.json({ ok: true })
}
```

`app/api/stats/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { computeStats } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = getStore()
  return NextResponse.json(computeStats(store.getPlayers(), store.getAnswers()))
}
```

`app/api/reset/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST() {
  getStore().reset()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run app/api/routes.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/
git commit -m "feat: join/answer/stats/reset API routes"
```

---

## Task 8: The retrieval animation

**Files:**
- Create: `components/Retrieval.tsx`, `components/CaseFileDoc.tsx`
- Test: `components/Retrieval.test.tsx`

**Interfaces:**
- Consumes: `CaseDoc`, `Lang` from `lib/types.ts`; `t` from `lib/i18n.ts`.
- Produces:
  - `<Retrieval docs={CaseDoc[]} lang={Lang} onComplete={() => void} />` — reveals each doc in sequence (~600ms apart), `✓ retrieved` or `✗ NOT FOUND`, then calls `onComplete`.
  - `<CaseFileDoc doc={CaseDoc} lang={Lang} />` — renders one document; shows a **FICTIONAL** badge when `doc.fictional`.

**This is the star of the show.** The `✗ NOT FOUND` line must be visually loud — it is the image the whole workshop turns on.

- [ ] **Step 1: Write the failing test** — `components/Retrieval.test.tsx`

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Retrieval } from './Retrieval'
import type { CaseDoc } from '@/lib/types'

const docs: CaseDoc[] = [
  { filename: 'found.pdf', kind: 'excerpt', found: true, fictional: false,
    title: { th: 'พบ', en: 'Found doc' } },
  { filename: 'missing.pdf', kind: 'excerpt', found: false, fictional: false,
    title: { th: 'หาย', en: 'Missing doc' } },
]

describe('Retrieval', () => {
  it('eventually lists every document filename', async () => {
    render(<Retrieval docs={docs} lang="en" onComplete={() => {}} />)
    await waitFor(() => expect(screen.getByText('found.pdf')).toBeInTheDocument(), { timeout: 4000 })
    await waitFor(() => expect(screen.getByText('missing.pdf')).toBeInTheDocument(), { timeout: 4000 })
  })

  it('marks the missing document NOT FOUND', async () => {
    render(<Retrieval docs={docs} lang="en" onComplete={() => {}} />)
    await waitFor(() => expect(screen.getByText(/NOT FOUND/i)).toBeInTheDocument(), { timeout: 4000 })
  })

  it('calls onComplete once every document has resolved', async () => {
    const onComplete = vi.fn()
    render(<Retrieval docs={docs} lang="en" onComplete={onComplete} />)
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1), { timeout: 6000 })
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run components/Retrieval.test.tsx`
Expected: FAIL — cannot resolve `./Retrieval`.

- [ ] **Step 3: Write the components**

`components/Retrieval.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import type { CaseDoc, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

const STEP_MS = 600

export function Retrieval({
  docs, lang, onComplete,
}: { docs: CaseDoc[]; lang: Lang; onComplete: () => void }) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    if (revealed >= docs.length) {
      const done = setTimeout(onComplete, STEP_MS)
      return () => clearTimeout(done)
    }
    const timer = setTimeout(() => setRevealed((n) => n + 1), STEP_MS)
    return () => clearTimeout(timer)
  }, [revealed, docs.length, onComplete])

  return (
    <div className="font-mono text-sm bg-black/60 border border-amber-900/40 rounded-lg p-4">
      <div className="text-amber-400 mb-3">🔍 {t('retrieving', lang)}</div>
      <ul className="space-y-1">
        {docs.slice(0, revealed).map((doc) => (
          <li key={doc.filename} className="flex items-center justify-between gap-4">
            <span className="text-neutral-300">{doc.filename}</span>
            {doc.found ? (
              <span className="text-emerald-400">✓ {t('retrieved', lang)}</span>
            ) : (
              <span className="text-red-500 font-bold animate-pulse">✗ {t('notFound', lang)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

`components/CaseFileDoc.tsx`:
```tsx
import type { CaseDoc, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

export function CaseFileDoc({ doc, lang }: { doc: CaseDoc; lang: Lang }) {
  if (!doc.found) return null

  return (
    <article className="bg-amber-50 text-neutral-900 rounded-md p-4 shadow-lg border-l-4 border-amber-700">
      <header className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold leading-snug">{doc.title[lang]}</h3>
        {doc.fictional && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide bg-neutral-800 text-amber-200 px-2 py-0.5 rounded">
            {t('fictional', lang)}
          </span>
        )}
      </header>
      {doc.body && (
        <pre className="whitespace-pre-wrap font-sans text-sm text-neutral-700">{doc.body[lang]}</pre>
      )}
      {doc.sourceUrl && (
        <a
          href={doc.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-blue-700 underline break-all"
        >
          {doc.sourceUrl}
        </a>
      )}
    </article>
  )
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run components/Retrieval.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add components/
git commit -m "feat: retrieval animation and Case File document rendering"
```

---

## Task 9: Player flow

**Files:**
- Create: `app/page.tsx`, `components/LangToggle.tsx`, `components/CaseScreen.tsx`, `components/CodenameScreen.tsx`, `components/ResultScreen.tsx`
- Modify: `app/layout.tsx` (title, dark theme body classes)

**Interfaces:**
- Consumes: `CASES` from `content/cases.ts`; `getAIAnswer`; `t`; `randomCodename`; `<Retrieval>`; `<CaseFileDoc>`; the API contract from Task 7.
- Produces: the player experience. No exports other tasks depend on.

**Behaviour:**
1. **Codename screen** — text input + `🎲` random button → `POST /api/join`, stash `playerId` and `codename` in `localStorage`.
2. **Case screen**, for each case in order: show question → `<Retrieval>` → then the AI answer → then the 4 options + Case File docs. Player selects one, hits Commit. `POST /api/answer` with `elapsedMs` measured from when the options first appeared.
3. **Buffer on failure:** if the POST fails, queue the answer in `localStorage` and retry on the next case and on mount. A wifi blip must never lose a run.
4. **No hard cut.** No auto-advance, no lockout.
5. **Result screen** — score, per-case correctness, and `waitReveal` copy pointing at the projector.
6. **Language toggle** — top-right, persisted to `localStorage`, flips everything live.

- [ ] **Step 1: Write `components/LangToggle.tsx`**

```tsx
'use client'
import type { Lang } from '@/lib/types'

export function LangToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <button
      onClick={() => onChange(lang === 'th' ? 'en' : 'th')}
      className="fixed top-4 right-4 z-50 rounded-full border border-amber-700/50 bg-black/60 px-4 py-1.5 text-sm text-amber-300 hover:bg-amber-900/30"
      aria-label="Toggle language"
    >
      {lang === 'th' ? 'EN' : 'ไทย'}
    </button>
  )
}
```

- [ ] **Step 2: Write `components/CodenameScreen.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { randomCodename } from '@/lib/codenames'

export function CodenameScreen({ lang, onJoin }: { lang: Lang; onJoin: (codename: string) => void }) {
  const [name, setName] = useState('')

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-4xl font-bold text-amber-300">{t('appTitle', lang)}</h1>
        <p className="mt-2 text-neutral-400">{t('tagline', lang)}</p>
      </div>

      <label className="block text-sm text-neutral-300">{t('enterCodename', lang)}</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        className="w-full rounded-md border border-amber-800/50 bg-black/50 px-4 py-3 text-lg text-amber-100 outline-none focus:border-amber-500"
      />

      <button
        onClick={() => setName(randomCodename(lang))}
        className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
      >
        {t('randomName', lang)}
      </button>

      <button
        disabled={!name.trim()}
        onClick={() => onJoin(name.trim())}
        className="rounded-md bg-amber-600 px-4 py-3 font-semibold text-black disabled:opacity-40"
      >
        {t('startMission', lang)}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Write `components/CaseScreen.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { DetectiveCase, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'
import { Retrieval } from './Retrieval'
import { CaseFileDoc } from './CaseFileDoc'
import { getAIAnswer } from '@/lib/ai-answer'

const DIFFICULTY_DOT: Record<string, string> = {
  easy: '🟢', medium: '🟡', hard: '🟠', expert: '🔴', final: '⚫',
}

export function CaseScreen({
  detectiveCase, lang, onCommit,
}: {
  detectiveCase: DetectiveCase
  lang: Lang
  onCommit: (optionId: string, elapsedMs: number) => void
}) {
  const [phase, setPhase] = useState<'retrieving' | 'deciding'>('retrieving')
  const [aiAnswer, setAIAnswer] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [shownAt, setShownAt] = useState(0)

  // Reset every time we move to a new case.
  useEffect(() => {
    setPhase('retrieving')
    setSelected(null)
    setAIAnswer('')
  }, [detectiveCase.id])

  useEffect(() => {
    getAIAnswer(detectiveCase.id, lang).then(setAIAnswer)
  }, [detectiveCase.id, lang])

  const onRetrievalComplete = () => {
    setPhase('deciding')
    setShownAt(Date.now())
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-sm uppercase tracking-widest text-amber-500">
        {DIFFICULTY_DOT[detectiveCase.difficulty]} Case {detectiveCase.order} / 5
      </div>
      <h2 className="mb-6 text-2xl font-semibold text-neutral-100">{detectiveCase.question[lang]}</h2>

      <Retrieval docs={detectiveCase.docs} lang={lang} onComplete={onRetrievalComplete} />

      {phase === 'deciding' && (
        <>
          <section className="mt-6 rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-4">
            <div className="mb-2 text-sm text-cyan-400">{t('aiAnswer', lang)}</div>
            <p className="leading-relaxed text-neutral-100">{aiAnswer}</p>
          </section>

          <section className="mt-6">
            <div className="mb-3 text-sm text-amber-400">{t('caseFile', lang)}</div>
            <div className="grid gap-3">
              {detectiveCase.docs.map((d) => (
                <CaseFileDoc key={d.filename} doc={d} lang={lang} />
              ))}
            </div>
          </section>

          <section className="mt-8">
            <div className="mb-3 text-sm text-amber-400">{t('yourVerdict', lang)}</div>
            <div className="grid gap-2">
              {detectiveCase.options.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o.id)}
                  className={`rounded-md border p-4 text-left transition ${
                    selected === o.id
                      ? 'border-amber-500 bg-amber-900/30 text-amber-100'
                      : 'border-neutral-700 bg-neutral-900/50 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {o.label[lang]}
                </button>
              ))}
            </div>

            <button
              disabled={!selected}
              onClick={() => onCommit(selected!, Date.now() - shownAt)}
              className="mt-6 w-full rounded-md bg-amber-600 px-4 py-3 font-semibold text-black disabled:opacity-40"
            >
              {t('submit', lang)}
            </button>
          </section>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `components/ResultScreen.tsx`**

```tsx
'use client'
import type { Answer, Lang } from '@/lib/types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from '@/lib/scoring'
import { t } from '@/lib/i18n'

export function ResultScreen({ answers, lang }: { answers: Answer[]; lang: Lang }) {
  const score = totalScore(answers)

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h2 className="text-3xl font-bold text-amber-300">{t('finished', lang)}</h2>
      <p className="mt-6 text-6xl font-bold text-amber-100">{score}</p>
      <p className="text-sm uppercase tracking-widest text-neutral-500">{t('yourScore', lang)}</p>

      <ul className="mt-10 space-y-2 text-left">
        {CASES.map((c) => {
          const mine = answers.find((a) => a.caseId === c.id)
          const correct = !!mine && getCase(c.id)!.options.some((o) => o.id === mine.optionId && o.correct)
          return (
            <li key={c.id} className="flex items-center gap-3 rounded-md border border-neutral-800 p-3">
              <span>{correct ? '✅' : '❌'}</span>
              <span className="text-neutral-300">Case {c.order}</span>
            </li>
          )
        })}
      </ul>

      <p className="mt-10 text-neutral-400">{t('waitReveal', lang)}</p>
    </div>
  )
}
```

- [ ] **Step 5: Write `app/page.tsx`** — orchestrates the flow, with the offline answer buffer.

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import type { Answer, Lang } from '@/lib/types'
import { CASES } from '@/content/cases'
import { CodenameScreen } from '@/components/CodenameScreen'
import { CaseScreen } from '@/components/CaseScreen'
import { ResultScreen } from '@/components/ResultScreen'
import { LangToggle } from '@/components/LangToggle'

const PENDING_KEY = 'aidet.pending'

export default function PlayerPage() {
  const [lang, setLang] = useState<Lang>('th')
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])

  useEffect(() => {
    const saved = localStorage.getItem('aidet.lang') as Lang | null
    if (saved) setLang(saved)
  }, [])

  const changeLang = (l: Lang) => {
    setLang(l)
    localStorage.setItem('aidet.lang', l)
  }

  /** Retry any answers that failed to reach the server. A wifi blip must not lose a run. */
  const flushPending = useCallback(async () => {
    const pending: Answer[] = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
    if (pending.length === 0) return
    const stillPending: Answer[] = []
    for (const a of pending) {
      try {
        const res = await fetch('/api/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(a),
        })
        if (!res.ok) stillPending.push(a)
      } catch {
        stillPending.push(a)
      }
    }
    localStorage.setItem(PENDING_KEY, JSON.stringify(stillPending))
  }, [])

  useEffect(() => { void flushPending() }, [flushPending])

  const join = async (codename: string) => {
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ codename }),
    })
    const { player } = await res.json()
    setPlayerId(player.id)
    localStorage.setItem('aidet.playerId', player.id)
  }

  const commit = async (optionId: string, elapsedMs: number) => {
    const answer: Answer = { playerId: playerId!, caseId: CASES[index].id, optionId, elapsedMs }
    setAnswers((prev) => [...prev, answer])
    setIndex((i) => i + 1) // advance immediately — the network must never block the player

    try {
      const res = await fetch('/api/answer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(answer),
      })
      if (!res.ok) throw new Error('bad status')
    } catch {
      const pending: Answer[] = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]')
      pending.push(answer)
      localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
    }
    void flushPending()
  }

  return (
    <main className="min-h-screen bg-neutral-950">
      <LangToggle lang={lang} onChange={changeLang} />
      {!playerId ? (
        <CodenameScreen lang={lang} onJoin={join} />
      ) : index < CASES.length ? (
        <CaseScreen detectiveCase={CASES[index]} lang={lang} onCommit={commit} />
      ) : (
        <ResultScreen answers={answers} lang={lang} />
      )}
    </main>
  )
}
```

- [ ] **Step 6: Update `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '🕵️ AI Detective — MADT',
  description: 'Think with AI, not just trust AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="bg-neutral-950 text-neutral-100 antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Run the app and play it end to end**

```bash
npm run dev
```

Open `http://localhost:3000`. Verify, by actually doing it:
- The codename screen accepts a typed name and the 🎲 button fills one in.
- Case 1 shows the retrieval animation, and `crewed_missions_2026.log` renders as a loud red `✗ NOT FOUND`.
- The AI answer appears only *after* retrieval finishes.
- Selecting an option and committing advances to Case 2.
- The language toggle flips everything, mid-case, without losing state.
- After Case 5, the result screen shows a score.

- [ ] **Step 8: Run the whole suite, then commit**

```bash
npx vitest run
git add -A
git commit -m "feat: player flow — codename, cases, retrieval, result, language toggle"
```

---

## Task 10: Dashboard (projector)

**Files:**
- Create: `app/dashboard/page.tsx`
- Test: `app/dashboard/dashboard.test.tsx`

**Interfaces:**
- Consumes: `GET /api/stats` (the `RoomStats` contract from Task 5/7); `t` from `lib/i18n.ts`.
- Produces: the projector view. Both panels ship; **`L` toggles** between Stats Wall and Leaderboard.

**Behaviour:** polls `/api/stats` every 2.5s. Large type — this is read from across a room.

- [ ] **Step 1: Write the failing test** — `app/dashboard/dashboard.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import DashboardPage from './page'

const STATS = {
  detectives: 12,
  finished: 5,
  caseStats: [
    { caseId: 'artemis', order: 1, answered: 10, fooled: 7, fooledPct: 70 },
    { caseId: 'olympics', order: 2, answered: 8, fooled: 4, fooledPct: 50 },
  ],
  leaderboard: [
    { codename: 'Detective Ramen', score: 450, correct: 3 },
    { codename: 'นักสืบกาแฟ', score: 300, correct: 2 },
  ],
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => STATS })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('shows the detective count on the stats wall', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
  })

  it('shows the % fooled per case', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('70%')).toBeInTheDocument())
  })

  it('switches to the leaderboard when L is pressed', async () => {
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'l' })
    await waitFor(() => expect(screen.getByText('Detective Ramen')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run app/dashboard/dashboard.test.tsx`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write `app/dashboard/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { RoomStats } from '@/lib/stats'
import { t } from '@/lib/i18n'

const POLL_MS = 2500

export default function DashboardPage() {
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [panel, setPanel] = useState<'wall' | 'board'>('wall')
  const lang = 'th' as const

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) setStats(await res.json())
      } catch { /* projector keeps showing the last good frame */ }
    }
    void load()
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l') setPanel((p) => (p === 'wall' ? 'board' : 'wall'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!stats) return <main className="min-h-screen bg-neutral-950" />

  return (
    <main className="min-h-screen bg-neutral-950 p-12 text-neutral-100">
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className="text-4xl font-bold text-amber-300">{t('appTitle', lang)}</h1>
        <span className="text-sm text-neutral-600">{t('toggleHint', lang)}</span>
      </header>

      {panel === 'wall' ? (
        <>
          <div className="mb-12 flex gap-16">
            <div>
              <div className="text-8xl font-bold text-amber-200">{stats.detectives}</div>
              <div className="text-sm uppercase tracking-widest text-neutral-500">{t('detectives', lang)}</div>
            </div>
            <div>
              <div className="text-8xl font-bold text-emerald-300">{stats.finished}</div>
              <div className="text-sm uppercase tracking-widest text-neutral-500">{t('finishedCount', lang)}</div>
            </div>
          </div>

          <div className="space-y-5">
            {stats.caseStats.map((c) => (
              <div key={c.caseId} className="flex items-center gap-6">
                <span className="w-24 shrink-0 text-lg text-neutral-400">Case {c.order}</span>
                <div className="h-8 flex-1 overflow-hidden rounded bg-neutral-800">
                  <div
                    className="h-full bg-gradient-to-r from-amber-600 to-red-600 transition-all duration-700"
                    style={{ width: `${c.fooledPct}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-2xl font-bold text-red-400">{c.fooledPct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-right text-sm uppercase tracking-widest text-neutral-500">
            {t('fooledBy', lang)}
          </p>
        </>
      ) : (
        <>
          <h2 className="mb-8 text-2xl text-amber-400">{t('leaderboard', lang)}</h2>
          <ol className="space-y-3">
            {stats.leaderboard.slice(0, 12).map((row, i) => (
              <li key={row.codename} className="flex items-center gap-6 rounded-lg border border-neutral-800 p-4">
                <span className="w-12 text-2xl font-bold text-neutral-600">{i + 1}</span>
                <span className="flex-1 text-2xl text-neutral-100">{row.codename}</span>
                <span className="text-sm text-neutral-500">{row.correct}/5</span>
                <span className="w-28 text-right text-3xl font-bold text-amber-300">{row.score}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run app/dashboard/dashboard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/
git commit -m "feat: projector dashboard with stats wall and leaderboard panels"
```

---

## Task 11: Reveal deck (facilitator)

**Files:**
- Create: `app/reveal/page.tsx`
- Test: `app/reveal/reveal.test.tsx`

**Interfaces:**
- Consumes: `CASES` from `content/cases.ts`; `GET /api/stats`.
- Produces: the facilitator's reveal deck. **← / → arrow keys** move between the 5 reveals.

**Each slide shows:** case number + difficulty, the question, the AI's answer, the named failure mode, the reveal text, and the **live "% of you believed the AI"** figure for that case.

- [ ] **Step 1: Write the failing test** — `app/reveal/reveal.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import RevealPage from './page'
import { CASES } from '@/content/cases'

const STATS = {
  detectives: 10, finished: 10,
  caseStats: CASES.map((c) => ({ caseId: c.id, order: c.order, answered: 10, fooled: 6, fooledPct: 60 })),
  leaderboard: [],
}

describe('RevealPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => STATS })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('starts on case 1 and shows its failure mode', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
  })

  it('shows the live % fooled for the current case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText('60%')).toBeInTheDocument())
  })

  it('advances to case 2 on ArrowRight', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText(CASES[1].failureMode.th)).toBeInTheDocument())
  })

  it('does not advance past the final case', async () => {
    render(<RevealPage />)
    await waitFor(() => expect(screen.getByText(CASES[0].failureMode.th)).toBeInTheDocument())
    for (let i = 0; i < 10; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText(CASES[4].failureMode.th)).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npx vitest run app/reveal/reveal.test.tsx`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write `app/reveal/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { CASES } from '@/content/cases'
import type { RoomStats } from '@/lib/stats'
import type { Lang } from '@/lib/types'
import { LangToggle } from '@/components/LangToggle'

const DIFFICULTY_DOT: Record<string, string> = {
  easy: '🟢', medium: '🟡', hard: '🟠', expert: '🔴', final: '⚫',
}

export default function RevealPage() {
  const [i, setI] = useState(0)
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [lang, setLang] = useState<Lang>('th')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) setStats(await res.json())
      } catch { /* keep the last good frame */ }
    }
    void load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, CASES.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const c = CASES[i]
  const stat = stats?.caseStats.find((s) => s.caseId === c.id)

  return (
    <main className="min-h-screen bg-neutral-950 p-16 text-neutral-100">
      <LangToggle lang={lang} onChange={setLang} />

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-baseline justify-between">
          <span className="text-xl uppercase tracking-widest text-amber-500">
            {DIFFICULTY_DOT[c.difficulty]} Case {c.order} / 5
          </span>
          <span className="rounded-full bg-red-950/60 px-4 py-1.5 text-lg text-red-300">
            {c.failureMode[lang]}
          </span>
        </div>

        <h2 className="mb-8 text-3xl font-semibold">{c.question[lang]}</h2>

        <section className="mb-8 rounded-lg border border-cyan-900/50 bg-cyan-950/30 p-6">
          <div className="mb-2 text-sm text-cyan-400">🤖 AI</div>
          <p className="text-xl leading-relaxed">{c.aiAnswer[lang]}</p>
        </section>

        {stat && stat.answered > 0 && (
          <div className="mb-8 flex items-center gap-6 rounded-lg border border-red-900/50 bg-red-950/20 p-6">
            <span className="text-7xl font-bold text-red-400">{stat.fooledPct}%</span>
            <span className="text-xl text-neutral-300">
              {lang === 'th' ? 'ของพวกคุณ ถูก AI หลอกในคดีนี้' : 'of you were defeated by the AI on this case'}
            </span>
          </div>
        )}

        <section className="rounded-lg border border-amber-800/50 bg-amber-950/20 p-6">
          <div className="mb-3 text-sm uppercase tracking-widest text-amber-400">
            {lang === 'th' ? '🎯 เฉลย' : '🎯 Reveal'}
          </div>
          <p className="whitespace-pre-wrap text-lg leading-relaxed text-neutral-200">{c.reveal[lang]}</p>
        </section>

        <div className="mt-10 text-center text-sm text-neutral-600">← → {lang === 'th' ? 'เปลี่ยนคดี' : 'change case'}</div>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run app/reveal/reveal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/reveal/
git commit -m "feat: facilitator reveal deck with live % fooled"
```

---

## Task 12: Run-day readiness

**Files:**
- Create: `README.md`
- Modify: `package.json` (confirm `dev:lan` script from Task 1)

**Goal:** the facilitator can run this on 23 Aug without a developer present.

- [ ] **Step 1: Run the full suite and confirm it is green**

```bash
npx vitest run
```
Expected: all tests pass across `lib/`, `content/`, `components/`, `app/`.

- [ ] **Step 2: Verify the LAN bind actually works**

```bash
npm run dev:lan
```

Then, **from a second device on the same network**, open `http://<host-ip>:3000`.

Find `<host-ip>` with:
```bash
ipconfig getifaddr en0
```

**This step is not optional and cannot be faked from localhost.** If the second device cannot load the page, the school wifi has **client isolation** and the workshop will fail on the day. The fallback is a phone hotspot — test that too.

- [ ] **Step 3: Write `README.md`**

```markdown
# 🕵️ AI Detective — MADT Expo, 23 Aug 2026

> Think with AI, not just trust AI.

## Run it

```bash
npm install
npm run dev:lan          # binds 0.0.0.0 so other laptops can reach it
ipconfig getifaddr en0   # your IP — players go to http://<that-ip>:3000
```

| URL | Who | What |
| --- | --- | --- |
| `http://<ip>:3000` | Players | Codename → 5 cases → score |
| `http://<ip>:3000/dashboard` | Projector | Stats Wall / Leaderboard — press **L** to switch |
| `http://<ip>:3000/reveal` | Projector | The reveal — **← →** to move between cases |

Clear the room between sessions:
```bash
curl -X POST http://localhost:3000/api/reset
```

## ⚠️ Before the day — test the network

The failure mode is **client isolation**: wifi that gives every laptop internet but blocks
laptop-to-laptop traffic. Your server becomes invisible and there is **no fix on the day**.

1. Put two laptops on the school wifi. Run the server on one. Open the URL on the other.
2. If it fails → run a **phone hotspot** and have all laptops join that. Test this too.

## Editing the cases

All content is in `content/cases.ts` — bilingual (th/en), no code changes needed.
`npx vitest run content/` validates every case (one correct option, both languages present,
real sources cited).

**Content rules:** never fabricate evidence imitating a real outlet. Real cases cite real URLs;
fictional evidence (NovaBrew) is flagged `fictional: true` and renders a FICTIONAL badge.

## Swapping in a live model later

`lib/ai-answer.ts` is the seam. It is already async. Replace its body with a real model call
and nothing else changes.

Note the tradeoff the pre-written answer is buying: the group reveal needs every player to have
seen the *same* AI answer, and a live model may also (correctly) refuse to hallucinate — leaving
you with no demo, in front of an audience.
```

- [ ] **Step 4: Commit**

```bash
git add README.md package.json
git commit -m "docs: run-day README with the client-isolation warning"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| §2 Architecture (Next.js, LAN, in-memory + JSON) | 1, 4, 12 |
| §2a Simulated RAG retrieval + swap seam | 6 (`ai-answer.ts`), 8 (`Retrieval.tsx`) |
| §2b 4-way choice, "AI is correct" always present | 2 (content), 9 (`CaseScreen`) |
| §2b Speed-as-tiebreaker-only invariant | 3 (tested explicitly) |
| §3 Dashboard, both panels, keypress toggle | 10 |
| §4 Soft timer, never hard-cuts | 9 (no auto-advance anywhere) |
| §5 Detective codename + random button | 6, 9 |
| §6 Bilingual + toggle | 2, 6, 9 |
| §7 Content integrity rules | 2 (enforced by tests: sources required, `fictional` badge) |
| §8 The five cases | 2 |
| §8a Retrieval gaps; clean retrieval on 4 & 5 | 2 (tested explicitly) |
| §9 Reveal deck with live % fooled | 11 |
| §10 Out of scope | nothing builds accounts/websockets/email |
| Answer buffering on wifi blip | 9 (`PENDING_KEY` flush) |

No gaps.

**Placeholder scan:** none. Every case is written out in full; every step has runnable code and an exact command.

**Type consistency:** `DetectiveCase`, `CaseDoc`, `Answer`, `Player`, `Lang`, `Difficulty`, `RoomStats`, `CaseStat`, `LeaderboardRow` are each defined once and used consistently. `getCase()`, `getAIAnswer()`, `computeStats()`, `totalScore()`, `scoreAnswer()`, `speedBonus()`, `randomCodename()`, `t()` keep the same names and signatures across every task that references them. The `content/cases.ts` case ids (`artemis`, `olympics`, `citation`, `novabrew`, `goblinshark`) and option ids (notably `ai-correct` and `stale`) are used verbatim in the tests in Tasks 3, 5, 7.

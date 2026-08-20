# Café Persona Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace The Decision Room's KPI/shop game on `/play` + `/biz` with a four-persona typing game — no points, no winner — while keeping the join/poll/control plumbing intact.

**Architecture:** The stage machine becomes `lobby → (ask → reveal) × 8 → result(done)`, derived from a `QUESTIONS` array. Each choice carries a `PersonaId`; the store tallies per-player answers and computes a final persona with a deterministic tie-break. The projector renders data-hook / split+small-talk / 2×2-map screens; the phone renders choices and, at the end, an MBTI-style persona card. **No `correct` field exists anywhere.**

**Tech Stack:** Next.js 16.2.10 App Router, React 19, TypeScript, Zod v4, Vitest + Testing Library (jsdom), qrcode.react (already a dependency).

**Spec:** `docs/superpowers/specs/2026-08-20-cafe-persona-design.md`

## Global Constraints

- **AGENTS.md binds:** read the relevant guide in `node_modules/next/dist/docs/` before writing any Next.js code.
- Branch: `build-cafe-persona`. Commit after every task.
- **Axes and persona labels are English** (`THE ANALYST`, `GUT ↔ DATA`, `MOVE FAST ↔ WAIT & SEE`); all conversational copy is Thai. UI strings keep the `LocalizedText {th, en}` shape (rendering uses `.th`; `en` is documentation), matching `content/room-labels.ts` today.
- **The data-hook honesty rule:** every `dataHook.figure` is computed from `AUDIENCE` (`content/audience.ts`) at module scope, never hand-typed. `content/persona.test.ts` re-derives each one.
- The vote timer is **display-only**: it never closes voting and never advances. Voting closes when the host advances to `reveal`.
- Untouched plumbing (do not edit): `app/api/room/join/route.ts`, `app/api/room/reset/route.ts`, `components/host/ResetButton.tsx`, `components/deck/SlideFrame.tsx`, `components/deck/Bilingual.tsx`, `lib/room-store.ts`'s persist/rename pattern, the `globalThis.__decisionRoomStore` key and `.decision-room-state.json` path, `content/audience.ts`, `scripts/import-audience.ts`.
- Store determinism: `now` is always passed in; no `Date.now()`/`Math.random()` inside `lib/`.
- Run `npx vitest run <file>` per task; `npx tsc --noEmit` and full `npx vitest run` in Task 9.
- CSS: `app/biz/deck.css` imports FIRST in `app/biz/page.tsx`, before component imports (`cssChunking: 'strict'` makes sheet order = import order). Keep specificity of new `stages.css` rules at or above the deck sheet's (0,2,0+).

## File Structure

| File | Fate | Responsibility |
|---|---|---|
| `lib/room-types.ts` | rewrite | Persona/Question zod schemas, `PersonaId`, `AXIS` map |
| `content/persona.ts` | create | `PERSONAS`, `QUESTIONS` (8), all copy |
| `content/persona.test.ts` | create | content validity + hook re-derivation |
| `lib/persona.ts` / `.test.ts` | create | pure scoring: tally, axis lean, `finalPersona` |
| `lib/room.ts` / `lib/room.test.ts` | rewrite | sequence machine over `SEQUENCE` |
| `lib/room-store.ts` / `lib/room-store.test.ts` | rewrite | players, votes, public state |
| `app/api/room/vote/route.ts`, `control/route.ts`, `state/route.ts`, `app/api/room/routes.test.ts` | modify | new vote body, `back` action, new payload |
| `content/room-labels.ts` | rewrite | `UI` + `PHONE` strings for the new flow |
| `components/room/PhoneBody.tsx` / `.test.tsx`, `app/play/page.tsx` / `page.test.tsx` | rewrite | phone screens incl. persona card |
| `components/room/Stages.tsx` / `.test.tsx`, `components/room/stages.css`, `components/room/phone.css` | rewrite | projector screens, bright palette |
| `lib/pricing.ts`, `lib/sim.ts`, `content/room.ts`, `content/room.test.ts`, `components/room/{Bars,DataPanel,Leaderboard}.tsx`, `components/room/evidence.ts`, + their tests | delete | dead with the KPI game |
| `scripts/check-projector-fit.mjs` | modify | new `/biz` walk |

---

### Task 1: Types and content — `lib/room-types.ts` + `content/persona.ts`

**Files:**
- Rewrite: `lib/room-types.ts` (keep only `LocalizedTextSchema` import usage pattern; KPI/stage schemas all go)
- Create: `content/persona.ts`, `content/persona.test.ts`
- Delete (now unreferenced by the new types): nothing yet — old files still compile against the old store until Task 4; the repo will not typecheck clean between Tasks 1–4, which is why `tsc` gates at Task 9, but each task's **own** vitest file must pass.

**Interfaces:**
- Produces: `PersonaId`, `PERSONA_IDS`, `AXIS`, `PersonaSchema`, `QuestionSchema`, `Persona`, `Question`, `Choice` (from `lib/room-types.ts`); `PERSONAS: Record<PersonaId, Persona>`, `QUESTIONS: Question[]` (from `content/persona.ts`).

- [ ] **Step 1: Rewrite `lib/room-types.ts`**

```ts
// Café Persona — framework types. Four decision-maker personas on two axes; a question offers
// exactly one choice per persona. There is deliberately NO `correct` field anywhere in this file:
// the game's argument is that there is no 0 or 1 in deciding with data, and the type system is
// where that argument is enforced.

import { z } from 'zod'

export const PERSONA_IDS = ['pioneer', 'sprinter', 'analyst', 'guardian'] as const
export const PersonaIdSchema = z.enum(PERSONA_IDS)
export type PersonaId = z.infer<typeof PersonaIdSchema>

/**
 * The two axes, as framework data rather than copy. Lives here (not content) because scoring's
 * tie-break (lib/persona.ts) needs it and must not import content.
 */
export const AXIS: Record<PersonaId, { pace: 'fast' | 'slow'; trust: 'gut' | 'data' }> = {
  pioneer:  { pace: 'fast', trust: 'gut' },
  sprinter: { pace: 'fast', trust: 'data' },
  analyst:  { pace: 'slow', trust: 'data' },
  guardian: { pace: 'slow', trust: 'gut' },
}

/** English axis labels — shown verbatim on the result map (spec: framework language is English). */
export const AXIS_LABELS = {
  pace: { fast: 'MOVE FAST', slow: 'WAIT & SEE' },
  trust: { gut: 'GUT', data: 'DATA' },
} as const

export const PersonaSchema = z.object({
  id: PersonaIdSchema,
  /** English, uppercase — "THE ANALYST". */
  label: z.string().min(1),
  /** Thai coffee name — "โคลด์บริว". */
  coffee: z.string().min(1),
  /** Thai archetype — "นักวิเคราะห์". */
  archetype: z.string().min(1),
  emoji: z.string().min(1),
  /** Who you are: 2–3 warm second-person Thai sentences (MBTI register). */
  description: z.string().min(1),
  strength: z.string().min(1),
  /** The loving flaw. */
  caution: z.string().min(1),
  /** MUST be the diagonal opposite — asserted in content/persona.test.ts. */
  partner: PersonaIdSchema,
})
export type Persona = z.infer<typeof PersonaSchema>

export const ChoiceSchema = z.object({
  /** Thai. The on-screen order of the tuple IS the A–D order — authored shuffled per question. */
  label: z.string().min(1),
  persona: PersonaIdSchema,
})
export type Choice = z.infer<typeof ChoiceSchema>

export const QuestionSchema = z.object({
  id: z.string().min(1),
  /** figure is COMPUTED from AUDIENCE, never hand-typed — content/persona.test.ts re-derives it. */
  dataHook: z.object({ figure: z.string().min(1), caption: z.string().min(1) }),
  scenario: z.string().min(1),
  choices: z.tuple([ChoiceSchema, ChoiceSchema, ChoiceSchema, ChoiceSchema]),
  /** The reveal beat: one Thai paragraph honoring at least two paths. */
  smallTalk: z.string().min(1),
})
export type Question = z.infer<typeof QuestionSchema>
```

- [ ] **Step 2: Write the failing content test** — `content/persona.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { AUDIENCE, bucketTotal } from '@/content/audience'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { AXIS, PERSONA_IDS, PersonaSchema, QuestionSchema } from '@/lib/room-types'

describe('personas', () => {
  it('has all four, valid, keyed by their own id', () => {
    for (const id of PERSONA_IDS) {
      const p = PERSONAS[id]
      expect(PersonaSchema.parse(p).id).toBe(id)
    }
  })

  it('partner is always the diagonal opposite', () => {
    for (const id of PERSONA_IDS) {
      const me = AXIS[id]
      const partner = AXIS[PERSONAS[id].partner]
      expect(partner.pace).not.toBe(me.pace)
      expect(partner.trust).not.toBe(me.trust)
    }
  })

  it('labels are English-uppercase framework names', () => {
    for (const id of PERSONA_IDS) expect(PERSONAS[id].label).toMatch(/^THE [A-Z]+$/)
  })
})

describe('questions', () => {
  it('there are eight, unique ids, all valid', () => {
    expect(QUESTIONS).toHaveLength(8)
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(8)
    for (const q of QUESTIONS) QuestionSchema.parse(q)
  })

  it('every question offers each persona exactly once', () => {
    for (const q of QUESTIONS) {
      expect(new Set(q.choices.map((c) => c.persona)).size).toBe(4)
    }
  })

  it('choice order varies across questions (no fixed persona→letter mapping)', () => {
    const orders = new Set(QUESTIONS.map((q) => q.choices.map((c) => c.persona).join(',')))
    expect(orders.size).toBeGreaterThan(1)
  })

  // The honesty rule: figures are re-derived from AUDIENCE, so a survey re-import updates them.
  it('data-hook figures derive from AUDIENCE', () => {
    const n = AUDIENCE.respondents
    expect(n).toBe(bucketTotal(AUDIENCE.queuePatience))
    const expected: Record<string, string> = {
      q1: `${AUDIENCE.mainFactor.taste}/${n}`,
      q2: `${AUDIENCE.queuePatience.under5 + AUDIENCE.queuePatience.under10}/${n}`,
      q3: `${AUDIENCE.spend['50to100']}/${n}`,
      q4: `${AUDIENCE.firstDrink.water}/${n}`,
      q5: `${AUDIENCE.arrivalMode.car}/${n}`,
      q6: `${AUDIENCE.buyTime['7to9']}/${n}`,
      q7: `${AUDIENCE.mainFactor.price}/${n}`,
      q8: `${AUDIENCE.wakeTime.before6}/${n}`,
    }
    for (const q of QUESTIONS) expect(q.dataHook.figure).toBe(expected[q.id])
  })
})
```

- [ ] **Step 3: Run it to fail** — `npx vitest run content/persona.test.ts` → FAIL (`content/persona.ts` missing)

- [ ] **Step 4: Write `content/persona.ts`** — full content, hooks computed:

```ts
// Café Persona — ALL authored content. Personas are team-renameable without touching mechanics;
// question copy is team-editable. dataHook figures are template-computed from AUDIENCE so a
// survey re-import (scripts/import-audience.ts) updates every hook — never hand-type a figure.

import { AUDIENCE } from '@/content/audience'
import type { Persona, PersonaId, Question } from '@/lib/room-types'

const N = AUDIENCE.respondents

export const PERSONAS: Record<PersonaId, Persona> = {
  pioneer: {
    id: 'pioneer', label: 'THE PIONEER', coffee: 'เอสเพรสโซ่', archetype: 'นักบุกเบิก', emoji: '🔥',
    description:
      'คุณคือคนที่กดช็อตแล้วเสิร์ฟเลย โลกของคุณหมุนเร็ว และคุณเชื่อว่าโอกาสไม่รอใคร ' +
      'เซนส์ของคุณคมเพราะประสบการณ์จริง ไม่ใช่เพราะเดา และพลังของคุณดึงคนทั้งทีมให้กล้าขยับตาม',
    strength: 'ได้ลงมือก่อนใคร สร้างโมเมนตัมเก่ง',
    caution: 'เร็วจนบางทีข้อมูลที่มีอยู่แล้วไม่ถูกเปิดอ่าน',
    partner: 'analyst',
  },
  sprinter: {
    id: 'sprinter', label: 'THE SPRINTER', coffee: 'นิโทร', archetype: 'นักฉวยจังหวะ', emoji: '⚡',
    description:
      'คุณสกัดข้อมูลเก็บไว้ล่วงหน้าเหมือนโคลด์บริวในถังนิโทร พอจังหวะมาถึงคุณกดแท็ปเสิร์ฟทันที ' +
      'เร็วแต่ไม่มั่ว เพราะการบ้านทำมาแล้ว คุณคือคนที่ทดลองเล็ก เรียนรู้ไว แล้วขยายผล',
    strength: 'ทดลองเร็ว เรียนรู้เร็ว ปรับตัวไว',
    caution: 'การทดลองที่เร็วเกินไปอาจวัดผลไม่ทันจบ',
    partner: 'guardian',
  },
  analyst: {
    id: 'analyst', label: 'THE ANALYST', coffee: 'โคลด์บริว', archetype: 'นักวิเคราะห์', emoji: '🌊',
    description:
      'คุณไม่เชื่ออะไรง่าย ๆ จนกว่าตัวเลขจะพูด คุณยอมแช่ข้อมูล 18 ชั่วโมงเพื่อรสที่พลาดยาก ' +
      'การตัดสินใจของคุณอาจมาช้ากว่าใคร แต่แทบไม่เคยต้องถอนคืน และทีมพึ่งความแม่นของคุณเสมอ',
    strength: 'แม่นยำ พลาดยาก น่าเชื่อถือ',
    caution: 'รอข้อมูลครบจนโอกาสหลุดมือ',
    partner: 'pioneer',
  },
  guardian: {
    id: 'guardian', label: 'THE GUARDIAN', coffee: 'พัวร์โอเวอร์', archetype: 'ผู้พิทักษ์', emoji: '🌿',
    description:
      'คุณค่อย ๆ รินอย่างมีจังหวะ เชื่อในฝีมือ คุณภาพ และคนตรงหน้า ' +
      'คุณปกป้องสิ่งที่ร้านเป็นมากกว่าวิ่งตามทุกกระแส และเป็นเหตุผลที่ลูกค้าเก่ากลับมาทุกวัน',
    strength: 'มั่นคง รักษาแก่นของทีมและแบรนด์',
    caution: 'ระวังจนบางครั้งเสียจังหวะที่ควรขยับ',
    partner: 'sprinter',
  },
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    dataHook: {
      figure: `${AUDIENCE.mainFactor.taste}/${N}`,
      caption: 'ของห้องนี้บอกว่า “รสชาติ” คือตัวตัดสินใจซื้อ',
    },
    scenario: 'ซัพพลายเออร์รายใหม่เสนอเมล็ดกาแฟถูกลง 20% แต่รสชาติต่างจากเดิมเล็กน้อย — เอายังไงดี?',
    choices: [
      { label: 'ชิมเองแล้วตัดสินเลย เชื่อลิ้นตัวเอง', persona: 'pioneer' },
      { label: 'สลับใช้ 1 สัปดาห์ ดูยอดขายจริง', persona: 'sprinter' },
      { label: 'จัด blind taste test เก็บคะแนนก่อนตัดสิน', persona: 'analyst' },
      { label: 'ไม่เปลี่ยน — รสชาติคือทั้งหมดของร้านเรา', persona: 'guardian' },
    ],
    smallTalk:
      'ทั้งห้องพูดเป็นเสียงเดียวว่ารสชาติมาก่อน — คำถามจึงไม่ใช่ “ประหยัดได้ไหม” แต่ “เสี่ยงกับแก่นของร้านแค่ไหน” ' +
      'ทุกทางเลือกบนจอกำลังจัดการความเสี่ยงก้อนเดียวกัน ด้วยเครื่องมือคนละชิ้น ไม่มีใครผิด',
  },
  {
    id: 'q2',
    dataHook: {
      figure: `${AUDIENCE.queuePatience.under5 + AUDIENCE.queuePatience.under10}/${N}`,
      caption: 'ของห้องนี้เลิกต่อคิวภายใน 10 นาที',
    },
    scenario: 'คิวหน้าร้านตอนเช้ายาวถึง 15 นาที ลูกค้าเริ่มเดินหนี — ทำยังไง?',
    choices: [
      { label: 'เปิดพรีออเดอร์ผ่าน LINE วันนี้ วัดยอดใช้จริง', persona: 'sprinter' },
      { label: 'จ้างบาริสต้าเพิ่มพรุ่งนี้เลย', persona: 'pioneer' },
      { label: 'ยังไม่ขยาย — เทรนทีมเดิมให้เร็วขึ้นก่อน', persona: 'guardian' },
      { label: 'จับเวลาคิวทั้งสัปดาห์ หาคอขวดจริงก่อนแก้', persona: 'analyst' },
    ],
    smallTalk:
      'ตัวเลขบอกว่าลูกค้าหายไปตรงนาทีที่ 10 — แต่ไม่ได้บอกว่า “เพราะอะไร” ' +
      'บางคนแก้ที่จำนวนมือ บางคนแก้ที่ช่องทาง บางคนไปตามหาสาเหตุก่อน ทางไหนก็เดินถึงคิวที่สั้นลงได้',
  },
  {
    id: 'q3',
    dataHook: {
      figure: `${AUDIENCE.spend['50to100']}/${N}`,
      caption: 'ของห้องนี้จ่ายค่าเครื่องดื่มแก้วละ ฿50–100',
    },
    scenario: 'ร้านกำลังจะเปิดตัวเมนู signature ใหม่ — ตั้งราคาที่เท่าไหร่ดี?',
    choices: [
      { label: 'อยู่ในกรอบ ฿50–100 ที่ลูกค้าเราอยู่จริง', persona: 'guardian' },
      { label: 'สำรวจก่อนว่าลูกค้ายอมจ่ายสูงสุดเท่าไหร่ แล้วค่อยตั้ง', persona: 'analyst' },
      { label: '฿120 ไปเลย ของดีต้องกล้าตั้ง', persona: 'pioneer' },
      { label: 'เปิดตัว ฿89 โปรสัปดาห์แรก แล้วปรับตามยอดขาย', persona: 'sprinter' },
    ],
    smallTalk:
      'ราคาไม่ใช่แค่ตัวเลข แต่เป็นข้อความที่ร้านส่งถึงลูกค้า — บางคนตั้งในกรอบเพื่อความชัวร์ ' +
      'บางคนตั้งเหนือกรอบเพื่อยกแบรนด์ และบางคนขอฟังข้อมูลก่อน ทุกทางมีเหตุผล ถ้ารู้ว่ากำลังแลกอะไรอยู่',
  },
  {
    id: 'q4',
    dataHook: {
      figure: `${AUDIENCE.firstDrink.water}/${N}`,
      caption: 'ของห้องนี้ เครื่องดื่มแก้วแรกของวันคือ “น้ำเปล่า” — มากกว่ากาแฟ',
    },
    scenario: 'ข้อมูลบอกว่าคนตื่นมาดื่มน้ำเปล่ามากกว่ากาแฟ — ร้านเราควรเพิ่มเมนู non-coffee ไหม?',
    choices: [
      { label: 'เปิดไลน์เครื่องดื่มสุขภาพเลย ตลาดมันมาแล้ว', persona: 'pioneer' },
      { label: 'โฟกัสเดิม — เราคือร้านกาแฟ อย่าเสียตัวตน', persona: 'guardian' },
      { label: 'ทำ pop-up เสาร์–อาทิตย์ วัดผลก่อนลงทุนจริง', persona: 'sprinter' },
      { label: 'ไปสัมภาษณ์ก่อน — ทำไมแก้วแรกถึงเป็นน้ำเปล่า', persona: 'analyst' },
    ],
    smallTalk:
      'ข้อมูลบอกว่า “น้ำเปล่า” ชนะกาแฟตอนเช้า — แต่ข้อมูลไม่เคยบอกว่าต้องทำอะไรต่อ ' +
      'บางคนเห็นตลาดใหม่ บางคนเห็นสัญญาณรบกวน และการถามต่อว่า “ทำไม” ก็เป็นการตัดสินใจแบบหนึ่งเหมือนกัน',
  },
  {
    id: 'q5',
    dataHook: {
      figure: `${AUDIENCE.arrivalMode.car}/${N}`,
      caption: 'ของห้องนี้ขับรถยนต์มา',
    },
    scenario: 'ห้องข้าง ๆ ร้านว่างพอดี เจ้าของตึกเสนอให้เช่าทำที่จอดรถ — เอาไหม?',
    choices: [
      { label: 'นับก่อน — วันหนึ่งมีรถวนแล้วไม่ได้จอดกี่คัน', persona: 'analyst' },
      { label: 'เซ็นเลย ที่จอดคือแต้มต่อที่คู่แข่งไม่มี', persona: 'pioneer' },
      { label: 'ขอเช่าระยะสั้น 3 เดือน ทดลองก่อน', persona: 'sprinter' },
      { label: 'ไม่เอา — ภาระค่าเช่าประจำเสี่ยงเกินไป', persona: 'guardian' },
    ],
    smallTalk:
      'ตึกข้าง ๆ ไม่ได้ว่างตลอดไป — โอกาสมีวันหมดอายุ แต่ค่าเช่าไม่มี ' +
      'คนที่รีบคว้าอาจได้แต้มต่อ คนที่ขอทดลองจ่ายค่าเรียนถูกกว่า และคนที่ปฏิเสธก็ปกป้องกระแสเงินสด ไม่มีคำตอบไหนฟรี',
  },
  {
    id: 'q6',
    dataHook: {
      figure: `${AUDIENCE.buyTime['7to9']}/${N}`,
      caption: 'ของห้องนี้ซื้อเครื่องดื่มช่วง 7–9 โมงเช้า — ช่วงบ่ายร้านแทบร้าง',
    },
    scenario: 'ยอดขายกระจุกตอนเช้า ช่วงบ่ายร้านเงียบมาก — จัดการยังไง?',
    choices: [
      { label: 'ยิง flash promo บ่ายนี้ 14:00–16:00 ดูผลทันที', persona: 'sprinter' },
      { label: 'ลดชั่วโมงพนักงานช่วงบ่าย รักษากำไรไว้ก่อน', persona: 'guardian' },
      { label: 'จัด happy hour ช่วงบ่ายตั้งแต่พรุ่งนี้เลย', persona: 'pioneer' },
      { label: 'ไปศึกษากลุ่มที่ “ไม่ซื้อเลย” — อาจเป็นตลาดใหม่ทั้งก้อน', persona: 'analyst' },
    ],
    smallTalk:
      'ช่วงเวลาที่เงียบคือกระจกสองด้าน — ด้านหนึ่งคือต้นทุนที่ต้องคุม อีกด้านคือตลาดที่ยังไม่ถูกปลุก ' +
      'ห้องนี้ต่างกันตรงที่หยิบด้านไหนขึ้นมาก่อน ไม่ใช่ใครเก่งกว่าใคร',
  },
  {
    id: 'q7',
    dataHook: {
      figure: `${AUDIENCE.mainFactor.price}/${N}`,
      caption: 'ของห้องนี้บอกว่า “ราคา” มีผลต่อการซื้อ',
    },
    scenario: 'ร้านคู่แข่งเปิดฝั่งตรงข้าม พร้อมโปรลด 50% ทั้งสัปดาห์ — สู้ยังไง?',
    choices: [
      { label: 'ไม่เล่นสงครามราคา — ย้ำจุดแข็งเรื่องรสชาติของเรา', persona: 'guardian' },
      { label: 'อัดโปรสวนกลับวันนี้ ให้ดังกว่า', persona: 'pioneer' },
      { label: 'ยังไม่ขยับ — นับก่อนว่าลูกค้าประจำหายไปจริงกี่คน', persona: 'analyst' },
      { label: 'โปรเจาะจง: อัปไซส์ฟรีเฉพาะลูกค้าประจำ สัปดาห์นี้เท่านั้น', persona: 'sprinter' },
    ],
    smallTalk:
      'ในสงครามราคา คนชนะมักไม่ใช่คนลดเยอะสุด แต่เป็นคนที่รู้ว่าลูกค้าตัวเองมาเพราะอะไร — ' +
      'ห้องนี้เองก็บอกว่ารสชาติมาก่อนราคา การสวนกลับ การเจาะจง หรือการนิ่ง จึงเป็นคนละวิธีปกป้องสิ่งเดียวกัน',
  },
  {
    id: 'q8',
    dataHook: {
      figure: `${AUDIENCE.wakeTime.before6}/${N}`,
      caption: 'ของห้องนี้ตื่นก่อน 6 โมงเช้า',
    },
    scenario: 'มีเสียงเรียกร้องให้ร้านเปิดเร็วขึ้นเป็น 6:30 — เปิดไหม?',
    choices: [
      { label: 'ทดลองเปิดเช้า 2 สัปดาห์ เก็บตัวเลขจริง', persona: 'sprinter' },
      { label: 'เอาข้อมูลเวลาตื่น × เวลาซื้อ มาไขว้ดูก่อนตัดสิน', persona: 'analyst' },
      { label: 'เปิดเลยจันทร์หน้า เจ้าแรกที่เปิดคือเจ้าที่ได้ลูกค้า', persona: 'pioneer' },
      { label: 'เปิดเวลาเดิม — ถนอมทีมไม่ให้ burnout', persona: 'guardian' },
    ],
    smallTalk:
      'ชั่วโมงเปิดร้านคือทรัพยากรที่แพงที่สุดของทีม — เปิดเพิ่มหนึ่งชั่วโมงคือพลังงานของคนทั้งร้าน ' +
      'คำถามจริงไม่ใช่ “จะมีลูกค้าไหม” แต่ “คุ้มกับสิ่งที่ทีมต้องจ่ายไหม” ซึ่งตอบได้ทั้งด้วยเซนส์และด้วยตัวเลข',
  },
]
```

- [ ] **Step 5: Run to pass** — `npx vitest run content/persona.test.ts` → PASS
- [ ] **Step 6: Commit** — `git add lib/room-types.ts content/persona.ts content/persona.test.ts && git commit -m "feat(persona): four personas on two axes, eight data-hooked questions"`

---

### Task 2: Scoring — `lib/persona.ts`

**Files:** Create `lib/persona.ts`, `lib/persona.test.ts`

**Interfaces:**
- Consumes: `PersonaId`, `PERSONA_IDS`, `AXIS` from `lib/room-types` (Task 1). Never imports content.
- Produces: `tally(answers: PersonaId[]): Record<PersonaId, number>`, `axisLean(answers: PersonaId[]): { pace: number; trust: number }` (fast/data positive), `finalPersona(answers: PersonaId[]): PersonaId | null`, `PRECEDENCE`.

- [ ] **Step 1: Write the failing tests** — `lib/persona.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import { axisLean, finalPersona, tally } from '@/lib/persona'

describe('tally', () => {
  it('counts each persona', () => {
    expect(tally(['analyst', 'analyst', 'pioneer'])).toEqual(
      { pioneer: 1, sprinter: 0, analyst: 2, guardian: 0 })
  })
})

describe('axisLean', () => {
  it('fast and data are positive', () => {
    // pioneer: fast+gut → pace +1, trust −1. analyst: slow+data → pace −1, trust +1.
    expect(axisLean(['pioneer'])).toEqual({ pace: 1, trust: -1 })
    expect(axisLean(['pioneer', 'analyst'])).toEqual({ pace: 0, trust: 0 })
    expect(axisLean(['sprinter', 'sprinter'])).toEqual({ pace: 2, trust: 2 })
  })
})

describe('finalPersona', () => {
  it('no answers → null (late joiner gets no card, not a fake one)', () => {
    expect(finalPersona([])).toBeNull()
  })

  it('clear max wins', () => {
    expect(finalPersona(['guardian', 'guardian', 'pioneer'])).toBe('guardian')
  })

  it('two-way tie breaks by the stronger axis lean', () => {
    // 2 analyst, 2 guardian, 1 pioneer. Tie analyst/guardian (both slow — pace can't split them).
    // trust: analyst +1×2, guardian −1×2, pioneer −1 → trust = −1; pace = −3.
    // |pace| 3 > |trust| 1 → stronger axis is pace, lean slow — both tied are slow, no split →
    // falls to precedence: analyst.
    expect(finalPersona(['analyst', 'analyst', 'guardian', 'guardian', 'pioneer'])).toBe('analyst')
    // 2 sprinter, 2 guardian, 1 analyst: sprinter fast+data, guardian slow+gut.
    // pace: +2−2−1 = −1; trust: +2−2+1 = +1. |pace| = |trust| → no stronger axis → precedence:
    // sprinter (analyst not tied).
    expect(finalPersona(['sprinter', 'sprinter', 'guardian', 'guardian', 'analyst'])).toBe('sprinter')
    // Stronger axis DOES split: 2 sprinter, 2 pioneer (both fast), 1 more data answer.
    // trust: +2−2+1 = +1; pace: +4−1 = +3 → pace stronger, both fast → no split → precedence:
    // sprinter. Now make trust stronger instead:
    // sprinter×2, pioneer×2, analyst×1, analyst adds slow so pace +3... use direct case:
    expect(finalPersona(['sprinter', 'sprinter', 'pioneer', 'pioneer', 'analyst'])).toBe('sprinter')
  })

  it('perfectly balanced player falls to fixed precedence', () => {
    expect(finalPersona(['pioneer', 'sprinter', 'analyst', 'guardian'])).toBe('analyst')
  })

  it('is a pure function of the multiset — order never matters', () => {
    const a = finalPersona(['pioneer', 'analyst', 'pioneer', 'guardian'])
    const b = finalPersona(['guardian', 'pioneer', 'analyst', 'pioneer'])
    expect(a).toBe(b)
    expect(a).toBe('pioneer')
  })
})
```

- [ ] **Step 2: Run to fail** — `npx vitest run lib/persona.test.ts` → FAIL (module missing)
- [ ] **Step 3: Implement `lib/persona.ts`**

```ts
// Café Persona — pure scoring. No I/O, no clock, no randomness, no content import: two players
// who answer alike ALWAYS type alike, and the tie-break is explainable on stage in one sentence.

import { AXIS, PERSONA_IDS } from './room-types'
import type { PersonaId } from './room-types'

/**
 * Fixed last-resort tie order. Documented, deterministic, and rare at 8 questions — it exists so
 * a perfectly balanced player still gets ONE card instead of a coin flip.
 */
export const PRECEDENCE: readonly PersonaId[] = ['analyst', 'sprinter', 'guardian', 'pioneer']

export function tally(answers: PersonaId[]): Record<PersonaId, number> {
  const t: Record<PersonaId, number> = { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 }
  for (const a of answers) t[a]++
  return t
}

/** fast → pace +1, slow → −1; data → trust +1, gut → −1. */
export function axisLean(answers: PersonaId[]): { pace: number; trust: number } {
  let pace = 0
  let trust = 0
  for (const a of answers) {
    pace += AXIS[a].pace === 'fast' ? 1 : -1
    trust += AXIS[a].trust === 'data' ? 1 : -1
  }
  return { pace, trust }
}

/**
 * Highest tally wins. Ties break by the player's STRONGER axis lean (the tied persona matching
 * that lean's direction); if the axes tie too, or the lean cannot split the tied set, the fixed
 * PRECEDENCE order decides. Empty answers → null: a late joiner gets a graceful no-card state,
 * never an invented type.
 */
export function finalPersona(answers: PersonaId[]): PersonaId | null {
  if (answers.length === 0) return null
  const t = tally(answers)
  const max = Math.max(...PERSONA_IDS.map((id) => t[id]))
  let tied = PERSONA_IDS.filter((id) => t[id] === max)
  if (tied.length === 1) return tied[0]

  const lean = axisLean(answers)
  const axis: 'pace' | 'trust' | null =
    Math.abs(lean.pace) > Math.abs(lean.trust) ? 'pace'
    : Math.abs(lean.trust) > Math.abs(lean.pace) ? 'trust'
    : null
  if (axis) {
    const want = axis === 'pace' ? (lean.pace > 0 ? 'fast' : 'slow') : (lean.trust > 0 ? 'data' : 'gut')
    const split = tied.filter((id) => AXIS[id][axis] === want)
    if (split.length >= 1) tied = split
  }
  return PRECEDENCE.find((id) => tied.includes(id))!
}
```

- [ ] **Step 4: Run to pass** — `npx vitest run lib/persona.test.ts` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(persona): deterministic tally, axis lean and tie-break"`

---

### Task 3: Stage machine — rewrite `lib/room.ts`

**Files:** Rewrite `lib/room.ts`, `lib/room.test.ts`

**Interfaces:**
- Consumes: `QUESTIONS` from `content/persona` (Task 1).
- Produces: `SEQUENCE: SeqStage[]` where `SeqStage = { kind: 'ask' | 'reveal'; questionIndex: number }`; `STAGE_COUNT`; `ASK_MS = 30_000`; `RoomState` (same `{ phase: 'lobby' | 'stage' | 'done'; stageIndex: number; stageStartedAt: number; votingClosedAt: number | null }` shape — `'done'` IS the result screen); `LOBBY_STATE`; `currentStage(state): SeqStage | null`; `currentQuestion(state): Question | null`; `askOpen(state): boolean`; `remainingMs(state, now): number`; `advance(state, now): RoomState`; `back(state, now): RoomState`.

- [ ] **Step 1: Rewrite `lib/room.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '@/content/persona'
import {
  ASK_MS, LOBBY_STATE, SEQUENCE, STAGE_COUNT, advance, askOpen, back, currentQuestion,
  currentStage, remainingMs,
} from '@/lib/room'

describe('SEQUENCE', () => {
  it('is ask,reveal per question, in question order', () => {
    expect(STAGE_COUNT).toBe(QUESTIONS.length * 2)
    QUESTIONS.forEach((_, i) => {
      expect(SEQUENCE[i * 2]).toEqual({ kind: 'ask', questionIndex: i })
      expect(SEQUENCE[i * 2 + 1]).toEqual({ kind: 'reveal', questionIndex: i })
    })
  })
})

describe('advance / back', () => {
  it('lobby → q1 ask → q1 reveal → … → done; done is terminal', () => {
    let s = advance(LOBBY_STATE, 1000)
    expect(currentStage(s)).toEqual({ kind: 'ask', questionIndex: 0 })
    expect(currentQuestion(s)?.id).toBe('q1')
    for (let i = 1; i < STAGE_COUNT; i++) s = advance(s, 1000 + i)
    expect(currentStage(s)).toEqual({ kind: 'reveal', questionIndex: QUESTIONS.length - 1 })
    s = advance(s, 9999)
    expect(s.phase).toBe('done')
    expect(advance(s, 10000)).toEqual(s)
  })

  it('back: stage 0 → lobby; done → last reveal; lobby stays lobby', () => {
    expect(back(LOBBY_STATE, 5).phase).toBe('lobby')
    const atFirst = advance(LOBBY_STATE, 1000)
    expect(back(atFirst, 2000).phase).toBe('lobby')
    let s = atFirst
    for (let i = 1; i <= STAGE_COUNT; i++) s = advance(s, 1000 + i)   // now done
    const b = back(s, 5000)
    expect(b.phase).toBe('stage')
    expect(currentStage(b)).toEqual({ kind: 'reveal', questionIndex: QUESTIONS.length - 1 })
  })

  it('back restarts the stage clock', () => {
    const s = advance(advance(LOBBY_STATE, 1000), 2000)
    expect(back(s, 7000).stageStartedAt).toBe(7000)
  })
})

describe('askOpen — the timer is display-only', () => {
  it('open on ask stages even after ASK_MS has elapsed; closed on reveal and off-stage', () => {
    const ask = advance(LOBBY_STATE, 1000)
    expect(askOpen(ask)).toBe(true)
    // The spec's soft countdown: elapsing changes NOTHING about voting.
    expect(remainingMs(ask, 1000 + ASK_MS + 5000)).toBe(0)
    expect(askOpen(ask)).toBe(true)
    const reveal = advance(ask, 2000)
    expect(askOpen(reveal)).toBe(false)
    expect(askOpen(LOBBY_STATE)).toBe(false)
  })

  it('remainingMs counts down from ASK_MS on ask, 0 on reveal, never negative', () => {
    const ask = advance(LOBBY_STATE, 1000)
    expect(remainingMs(ask, 1000)).toBe(ASK_MS)
    expect(remainingMs(ask, 11000)).toBe(ASK_MS - 10000)
    expect(remainingMs(advance(ask, 2000), 2000)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to fail** — `npx vitest run lib/room.test.ts` → FAIL
- [ ] **Step 3: Rewrite `lib/room.ts`**

```ts
// Café Persona — the host-driven stage machine. lobby → (ask → reveal) × N → done(result).
// Pure functions only: no I/O, no Math.random(), `now` always passed in. The store is the only
// caller that touches Date.now().

import { QUESTIONS } from '@/content/persona'
import type { Question } from './room-types'

export type SeqStage = { kind: 'ask' | 'reveal'; questionIndex: number }

export const SEQUENCE: SeqStage[] = QUESTIONS.flatMap((_, i) => [
  { kind: 'ask' as const, questionIndex: i },
  { kind: 'reveal' as const, questionIndex: i },
])
export const STAGE_COUNT = SEQUENCE.length

/**
 * The soft countdown, DISPLAY-ONLY (spec §2): it nudges the room but never closes voting and
 * never advances a stage. Voting closes when the host advances to the reveal — nothing else.
 */
export const ASK_MS = 30_000

export interface RoomState {
  /** `'done'` IS the result screen — the 2×2 map / persona cards. */
  phase: 'lobby' | 'stage' | 'done'
  stageIndex: number
  stageStartedAt: number
  /** Kept for snapshot-shape compatibility; always null in this game (no early close). */
  votingClosedAt: number | null
}

export const LOBBY_STATE: RoomState = {
  phase: 'lobby', stageIndex: 0, stageStartedAt: 0, votingClosedAt: null,
}

export function currentStage(state: RoomState): SeqStage | null {
  if (state.phase !== 'stage') return null
  return SEQUENCE[state.stageIndex] ?? null
}

export function currentQuestion(state: RoomState): Question | null {
  const stage = currentStage(state)
  if (!stage) return null
  return QUESTIONS[stage.questionIndex] ?? null
}

/** Votes are accepted exactly while the current stage is an `ask` — regardless of the clock. */
export function askOpen(state: RoomState): boolean {
  return currentStage(state)?.kind === 'ask'
}

/** Display only. 0 on reveal/lobby/done; never negative. The server owns the clock. */
export function remainingMs(state: RoomState, now: number): number {
  const stage = currentStage(state)
  if (!stage || stage.kind !== 'ask') return 0
  return Math.max(0, state.stageStartedAt + ASK_MS - now)
}

/** The host's forward lever. lobby → stage 0; last stage → done; done is terminal. */
export function advance(state: RoomState, now: number): RoomState {
  if (state.phase === 'done') return state
  if (state.phase === 'lobby') {
    return { phase: 'stage', stageIndex: 0, stageStartedAt: now, votingClosedAt: null }
  }
  const next = state.stageIndex + 1
  if (next >= STAGE_COUNT) {
    return { phase: 'done', stageIndex: state.stageIndex, stageStartedAt: now, votingClosedAt: null }
  }
  return { phase: 'stage', stageIndex: next, stageStartedAt: now, votingClosedAt: null }
}

/**
 * The host's rescue lever (a mis-tap in front of a room). done → last stage; stage 0 → lobby;
 * lobby stays. Restarts the stage clock — a re-entered ask gets its full soft countdown.
 * Safe with votes: answers key by question id and are never erased by navigation.
 */
export function back(state: RoomState, now: number): RoomState {
  if (state.phase === 'lobby') return state
  if (state.phase === 'done') {
    return { phase: 'stage', stageIndex: STAGE_COUNT - 1, stageStartedAt: now, votingClosedAt: null }
  }
  if (state.stageIndex === 0) return { ...LOBBY_STATE }
  return { phase: 'stage', stageIndex: state.stageIndex - 1, stageStartedAt: now, votingClosedAt: null }
}
```

- [ ] **Step 4: Run to pass** — `npx vitest run lib/room.test.ts` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(persona): ask/reveal stage machine with display-only countdown and host back"`

---

### Task 4: Store — rewrite `lib/room-store.ts`

**Files:** Rewrite `lib/room-store.ts`, `lib/room-store.test.ts`. Delete `lib/pricing.ts`, `lib/sim.ts`, `lib/pricing.test.ts`, `lib/sim.test.ts` (if present), `content/room.ts`, `content/room.test.ts` — the store was their last `lib/` importer; `components/room/*` still reference them until Tasks 7–8, so use `git rm` only for the `lib/` files here and `git rm` the content files in Task 8. Check first: `grep -rln "content/room'" app components lib`.

**Interfaces:**
- Consumes: Task 3's machine (`LOBBY_STATE`, `advance`, `back`, `askOpen`, `currentStage`, `currentQuestion`, `remainingMs`, `SEQUENCE`, `STAGE_COUNT`), Task 2's `finalPersona`, Task 1's `QUESTIONS`, `PersonaId`, `PERSONA_IDS`.
- Produces (consumed by routes and both UIs):

```ts
export type RoomPlayer = {
  id: string
  name: string
  /** questionId → choiceIndex (0–3). Never erased by host navigation. */
  answers: Record<string, number>
  joinedAt: number
}
export type VoteResult = 'ok' | 'unknown' | 'closed'
export type Split = { choiceIndex: number; count: number }[]

export type PublicRoomState = {
  seq: number
  phase: 'lobby' | 'stage' | 'done'
  stageIndex: number
  stageKind: 'ask' | 'reveal' | null
  questionId: string | null
  questionIndex: number | null
  votingOpen: boolean
  remainingMs: number
  playerCount: number
  /** Votes on the current question (ask AND reveal stages). */
  voteCount: number
  /** Present ONLY on reveal stages — phones must not see the split forming during ask. */
  split?: Split
  /** Present ONLY when phase === 'done'. `dots` is sorted by persona then anonymous — it can
   *  never be correlated with join order or names. */
  result?: { counts: Record<PersonaId, number>; dots: PersonaId[] }
  you?: {
    answeredCount: number
    /** This player's pick on the current question, or null. */
    pickedChoiceIndex: number | null
    /** null until phase === 'done' (no mid-game spoilers), and null for a zero-answer player. */
    persona: PersonaId | null
  }
}

export interface DecisionRoomStore {
  join(name: string, now: number, playerId?: string): RoomPlayer
  vote(input: { playerId: string; questionId: string; choiceIndex: number }, now: number): VoteResult
  advance(now: number): void
  back(now: number): void
  reset(): void
  getPlayers(): RoomPlayer[]
  getRoomState(): RoomState
  getSeq(): number
  getPublicState(now: number, playerId?: string): PublicRoomState
}
export function getRoomStore(): DecisionRoomStore
```

- [ ] **Step 1: Rewrite `lib/room-store.test.ts`.** Keep the existing file's structure (in-memory `MemoryDecisionRoomStore` with no persistPath; a tmp-dir store for persistence tests — copy the existing beforeEach/tmpdir pattern from the current file before deleting it). Cover, as separate `it` blocks with real assertions:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { QUESTIONS } from '@/content/persona'
import { MemoryDecisionRoomStore } from '@/lib/room-store'

const T = 1_000_000
let store: MemoryDecisionRoomStore
beforeEach(() => { store = new MemoryDecisionRoomStore() })

/** Host-advance to the ask stage of question index qi. */
function toAsk(qi: number) {
  store.advance(T)                                   // lobby → q0 ask
  for (let i = 0; i < qi * 2; i++) store.advance(T + i)
}

describe('vote gating', () => {
  it('accepts a vote only on the matching ask stage', () => {
    const p = store.join('A', T)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 0 }, T)).toBe('closed') // lobby
    toAsk(0)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 0 }, T)).toBe('ok')
    expect(store.vote({ playerId: p.id, questionId: 'q2', choiceIndex: 0 }, T)).toBe('closed') // wrong q
    store.advance(T)                                  // reveal
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 1 }, T)).toBe('closed')
  })
  it('rejects unknown player / out-of-range choiceIndex', () => {
    toAsk(0)
    expect(store.vote({ playerId: 'ghost', questionId: 'q1', choiceIndex: 0 }, T)).toBe('unknown')
    const p = store.join('A', T)
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 4 }, T)).toBe('closed')
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: -1 }, T)).toBe('closed')
    expect(store.vote({ playerId: p.id, questionId: 'q1', choiceIndex: 1.5 }, T)).toBe('closed')
  })
  it('re-vote replaces, never adds (last write wins)', () => { /* vote 0 then 2; advance to reveal; split shows one vote on 2, none on 0 */ })
  it('votes survive host back/forward navigation', () => { /* vote on q1 ask; back to lobby; advance again; you.pickedChoiceIndex is still the vote */ })
})

describe('split visibility', () => {
  it('split is absent during ask and lobby, present on reveal', () => { /* assert 'split' not in getPublicState during ask; present after advance */ })
  it('split counts every choice index including zeros, in order 0..3', () => { /* 3 players vote 0,0,2 → [{0:2},{1:0},{2:1},{3:0}] shape */ })
})

describe('result', () => {
  it('absent before done; present at done with counts + sorted anonymous dots', () => {
    // Walk two players through: A answers analyst-mapped choice on every question, B answers
    // pioneer-mapped choice. At done: counts.analyst===1, counts.pioneer===1, dots sorted
    // ['pioneer','analyst'] per PERSONA_IDS order — NOT join order.
  })
  it('you.persona is null mid-game, set at done, null for a zero-answer player', () => { /* ... */ })
  it('a phone frame never pairs another player with a persona', () => {
    // JSON.stringify(getPublicState(now, aId)) must not contain B's id or name anywhere.
  })
})

describe('lifecycle', () => {
  it('join is idempotent per playerId (rejoin, not a second player)', () => { /* same as old test */ })
  it('reset clears players and returns to lobby; seq stays monotonic', () => { /* seq after > seq before */ })
  it('persists and reloads mid-game (tmpdir path), including answers', () => { /* two stores, same path */ })
  it('a corrupt snapshot file falls back to a clean lobby, never throws', () => { /* write garbage first */ })
  it('reload drops answers whose questionId no longer exists in QUESTIONS', () => { /* hand-write snapshot with qid 'zzz' */ })
})
```

Fill every `/* ... */` body with concrete assertions — the comments above state exactly what each must assert. Use the persona→choiceIndex lookup `QUESTIONS[i].choices.findIndex((c) => c.persona === 'analyst')` rather than hard-coding indexes (the content's shuffled order must not leak into tests).

- [ ] **Step 2: Run to fail** — `npx vitest run lib/room-store.test.ts` → FAIL
- [ ] **Step 3: Rewrite `lib/room-store.ts`.** Start from the existing file — KEEP the header comment style, the `persist()`/`load()` temp-file+rename pattern, `isValidRoomState` (validate against the new `STAGE_COUNT`), the seq-monotonic reset comment, the global accessor with `__decisionRoomStore` + `.decision-room-state.json` + `isTestEnv`. Replace the game:

```ts
// Replaces: Kpi/choices/leaderboard/resolveStage/shopValue. Core methods:

vote(input: { playerId: string; questionId: string; choiceIndex: number }, now: number): VoteResult {
  const player = this.players.find((p) => p.id === input.playerId)
  if (!player) return 'unknown'
  const q = currentQuestion(this.room)
  if (!q || q.id !== input.questionId) return 'closed'
  if (!askOpen(this.room)) return 'closed'
  if (!Number.isInteger(input.choiceIndex) || input.choiceIndex < 0 || input.choiceIndex > 3) return 'closed'
  player.answers[input.questionId] = input.choiceIndex   // last write wins
  this.seq++; this.persist(); return 'ok'
}

advance(now: number): void { this.room = advance(this.room, now); this.seq++; this.persist() }
back(now: number): void { this.room = back(this.room, now); this.seq++; this.persist() }
// NOTE: no resolveStage, no `resolved` set, no Snapshot.resolvedStageIds — the tally is derived
// on demand from answers. Snapshot = { players, room, seq }.

private personaOf(p: RoomPlayer): PersonaId | null {
  const answers = Object.entries(p.answers)
    .map(([qid, idx]) => QUESTIONS.find((q) => q.id === qid)?.choices[idx]?.persona)
    .filter((x): x is PersonaId => !!x)
  return finalPersona(answers)
}

getPublicState(now: number, playerId?: string): PublicRoomState {
  const stage = currentStage(this.room)
  const q = currentQuestion(this.room)
  const votesOnQ = q ? this.players.filter((p) => q.id in p.answers) : []
  const pub: PublicRoomState = {
    seq: this.seq, phase: this.room.phase, stageIndex: this.room.stageIndex,
    stageKind: stage?.kind ?? null, questionId: q?.id ?? null,
    questionIndex: stage?.questionIndex ?? null,
    votingOpen: askOpen(this.room), remainingMs: remainingMs(this.room, now),
    playerCount: this.players.length, voteCount: votesOnQ.length,
  }
  if (stage?.kind === 'reveal' && q) {
    pub.split = [0, 1, 2, 3].map((i) => ({
      choiceIndex: i, count: votesOnQ.filter((p) => p.answers[q.id] === i).length,
    }))
  }
  if (this.room.phase === 'done') {
    const personas = this.players.map((p) => this.personaOf(p)).filter((x): x is PersonaId => !!x)
    const counts = { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 } as Record<PersonaId, number>
    for (const id of personas) counts[id]++
    // Sorted by PERSONA_IDS order: dots must not be correlatable with join order or names.
    pub.result = { counts, dots: PERSONA_IDS.flatMap((id) => Array(counts[id]).fill(id)) }
  }
  if (playerId !== undefined) {
    const me = this.players.find((p) => p.id === playerId)
    if (me) {
      pub.you = {
        answeredCount: Object.keys(me.answers).length,
        pickedChoiceIndex: q ? (me.answers[q.id] ?? null) : null,
        persona: this.room.phase === 'done' ? this.personaOf(me) : null,
      }
    }
  }
  return pub
}

// load(): validate each player: id string, name string, answers = object whose keys exist in
// QUESTIONS (by id) and values are integers 0–3; drop invalid entries, coerce joinedAt as today.
```

Then `git rm lib/pricing.ts lib/sim.ts content/... ` — **only** the `lib/` files whose remaining importers are components slated for Tasks 7–8; verify with `grep -rln "lib/pricing\|lib/sim" app components lib | grep -v test`.

- [ ] **Step 4: Run to pass** — `npx vitest run lib/room-store.test.ts lib/persona.test.ts lib/room.test.ts` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat(persona): store tallies answers, reveals splits, types the room at done"`

---

### Task 5: API routes

**Files:**
- Modify: `app/api/room/vote/route.ts` (body → `{ playerId, questionId, choiceIndex }`), `app/api/room/control/route.ts` (`ACTIONS = ['advance', 'back']`), `app/api/room/state/route.ts` (drop `leaderboard`), `app/api/room/routes.test.ts`
- Untouched: `join`, `reset` routes.

**Interfaces:**
- Consumes: store from Task 4.
- Produces: `POST /api/room/vote` body `{ playerId: string, questionId: string, choiceIndex: number }` → 200 `{ok:true}` / 400 unknown-player / 409 closed; `POST /api/room/control` body `{ action: 'advance' | 'back' }` + `x-facilitator-token`; `GET /api/room/state?playerId=` → `PublicRoomState` verbatim (no extra fields).

- [ ] **Step 1: Update `app/api/room/routes.test.ts`.** Rewrite the room-route describe blocks: vote validation (missing/wrong-typed `choiceIndex` → 400; non-integer → the store's 'closed' → 409), control accepts `back` and still 403s a bad token, state carries `split` only on reveal and never a `leaderboard` key (`expect('leaderboard' in json).toBe(false)`). Follow the existing test file's route-invocation pattern exactly (it imports route handlers and calls `POST(new Request(...))`).
- [ ] **Step 2: Run to fail** — `npx vitest run app/api/room/routes.test.ts`
- [ ] **Step 3: Update the three routes.** `vote/route.ts`: validate `typeof choiceIndex === 'number' && Number.isInteger(choiceIndex)` at the route (400 on shape errors; range stays the store's job → 409). `control/route.ts`: `const ACTIONS = ['advance', 'back'] as const` and dispatch `action === 'back' ? store.back(now) : store.advance(now)`. `state/route.ts`: return `NextResponse.json(store.getPublicState(now, playerId))` — the leaderboard spread goes.
- [ ] **Step 4: Run to pass**, then **Step 5: Commit** — `git commit -m "feat(persona): vote by choice index, host back action, leaderboard-free state"`

---

### Task 6: Labels — rewrite `content/room-labels.ts`

**Files:** Rewrite `content/room-labels.ts` (delete the audience/KPI label tables — `AUDIENCE_FIELD_LABELS`, trace labels, etc.; keep the `LocalizedText` shape). Delete `content/deck-strings.ts` + test **only if** `grep -rln "deck-strings" app components` shows no remaining importer after Task 8 — defer the `git rm` to Task 9's cleanup if unsure.

**Interfaces:**
- Produces `UI` and `PHONE` records; every key below is consumed by Tasks 7–8 by exact name:

```ts
export const UI = {
  title:        { th: 'Café Persona', en: 'Café Persona' },
  joinTitle:    { th: 'เข้าร่วมด้วยมือถือของคุณ', en: 'Join on your phone' },
  scanHint:     { th: 'สแกน หรือพิมพ์ที่อยู่นี้', en: 'Scan, or type the address' },
  inTheRoom:    { th: 'คนในห้องแล้ว', en: 'in the room' },
  questionOf:   { th: 'คำถามที่', en: 'Question' },           // "คำถามที่ 3/8"
  votesIn:      { th: 'ตอบแล้ว', en: 'answered' },
  roomPicked:   { th: 'ห้องนี้เลือก', en: 'the room picked' },
  smallTalkTitle: { th: 'คุยกันหน่อย', en: 'Let’s talk' },
  resultTitle:  { th: 'ห้องนี้ประกอบด้วย', en: 'This room is made of' },
  resultHint:   { th: 'ดูการ์ดของคุณบนมือถือ', en: 'See your card on your phone' },
  hostToken:    { th: 'รหัสผู้ดำเนินรายการ', en: 'Facilitator token' },
  advance:      { th: 'ถัดไป', en: 'Next' },
  backBtn:      { th: 'ย้อน', en: 'Back' },
  reset:        { th: 'เริ่มใหม่', en: 'Reset' },
  resetArmed:   { th: 'กดอีกครั้งเพื่อยืนยันเริ่มใหม่', en: 'Press again to confirm reset' },
  tokenWrong:   { th: 'รหัสไม่ถูกต้อง', en: 'Wrong token' },
  tokenMissing: { th: 'ใส่รหัสผู้ดำเนินรายการก่อน', en: 'Enter the facilitator token' },
  offline:      { th: 'ขาดการเชื่อมต่อ — ค้างภาพล่าสุดไว้', en: 'Offline — holding last frame' },
} as const

export const PHONE = {
  joinTitle:    { th: 'Café Persona', en: 'Café Persona' },
  joinBlurb:    { th: 'ตอบ 8 ข้อ แล้วดูว่าคุณเป็นกาแฟแก้วไหน', en: 'Answer 8 questions, find your coffee' },
  namePrompt:   { th: 'ชื่อเล่นของคุณ', en: 'Your nickname' },
  nameRequired: { th: 'ใส่ชื่อก่อนนะ', en: 'Name required' },
  joinButton:   { th: 'เข้าร่วม', en: 'Join' },
  joining:      { th: 'กำลังเข้าร่วม…', en: 'Joining…' },
  joinFailed:   { th: 'เข้าร่วมไม่สำเร็จ ลองอีกครั้ง', en: 'Join failed, try again' },
  waitHost:     { th: 'รอผู้ดำเนินรายการเริ่ม', en: 'Waiting for the host' },
  pickOne:      { th: 'คุณจะทำยังไง?', en: 'What do you do?' },
  picked:       { th: 'บันทึกแล้ว — เปลี่ยนใจได้จนกว่าจะเฉลย', en: 'Saved — change your mind until reveal' },
  watchScreen:  { th: 'ดูจอใหญ่ — คุยกันก่อน', en: 'Eyes on the big screen' },
  youPicked:    { th: 'คุณเลือก', en: 'You picked' },
  tooLate:      { th: 'ข้อนี้ปิดแล้ว รอข้อถัดไปนะ', en: 'This one is closed — next question soon' },
  roomReset:    { th: 'ห้องถูกรีเซ็ต — เข้าร่วมใหม่อีกครั้ง', en: 'The room was reset — join again' },
  yourType:     { th: 'คุณคือ', en: 'You are' },
  strength:     { th: 'จุดแข็ง', en: 'Strength' },
  caution:      { th: 'ระวัง', en: 'Watch out' },
  partner:      { th: 'คู่หูที่เติมเต็ม', en: 'Your complement' },
  lateJoiner:   { th: 'มาสายไปนิด — ไว้เจอกันรอบหน้า ลองคุยกับเพื่อนข้าง ๆ ว่าได้การ์ดอะไร',
                  en: 'A bit late — ask a neighbor what card they got' },
  offline:      { th: 'ขาดการเชื่อมต่อ…', en: 'Offline…' },
} as const
```

- [ ] **Step 1: Write it.** No dedicated test file (strings are asserted through component tests), but run `npx vitest run content/` to confirm nothing else broke.
- [ ] **Step 2: Commit** — `git commit -m "feat(persona): UI and phone strings for the persona flow"`

---

### Task 7: Phone — `components/room/PhoneBody.tsx` + `app/play/page.tsx`

**Read first:** `node_modules/next/dist/docs/` client-components guide (AGENTS.md). Keep `app/play/page.tsx`'s four reliability rules (header comment) — they are paid-for; only the vote payload and screens change.

**Files:** Rewrite `components/room/PhoneBody.tsx`, `components/room/PhoneBody.test.tsx`, `components/room/phone.css` (recolor to the bright palette, keep the `--phone-*` token structure and `.phone-root` scoping); modify `app/play/page.tsx` (vote signature: `vote(questionId: string, choiceIndex: number)`; `QueuedVote = { playerId; questionId; choiceIndex }`; notice-clearing keys off `questionId`+`stageKind` instead of `stageId`), `app/play/page.test.tsx`.

**Interfaces:**
- Consumes: `PublicRoomState` (Task 4) as `PhoneFrame`; `QUESTIONS`, `PERSONAS` from content; `PHONE` labels (Task 6).
- Produces: `PhoneBody({ name, frame, remainingMs, picked, onVote, notice, offline })` where `picked: number | null` and `onVote: (questionId: string, choiceIndex: number) => void`.

**Screens (branch on `frame.phase` first, then `stageKind` — same discipline as the old file):**
1. `lobby` → `PHONE.waitHost` holding screen.
2. `stage`+`ask` → `PHONE.pickOne`, question scenario, 4 tappable buttons (Thai labels from `QUESTIONS[frame.questionIndex].choices` **looked up by `frame.questionId`, never by index alone** — keep the old `stageById` skew comment and pattern as `questionById`). Buttons are NEUTRAL warm colors — persona colors on the phone mid-game would leak the choice→type mapping. Selected state ticks + `PHONE.picked`. Timer shown small from `remainingMs`; at 0 the label switches to `PHONE.watchScreen` but buttons stay enabled (display-only rule).
3. `stage`+`reveal` → `PHONE.watchScreen` + `PHONE.youPicked` + your choice's label (from `picked`/`you.pickedChoiceIndex`).
4. `done` with `you.persona` → the persona card: emoji, `label` (English, big), `coffee · archetype`, axis line from `AXIS_LABELS` (e.g. `DATA × WAIT & SEE`), `description`, `strength`/`caution` rows, `partner` chip naming `PERSONAS[partner].label`. Card background = that persona's color token.
5. `done` with `you.persona === null` → `PHONE.lateJoiner`.

- [ ] **Step 1: Rewrite `PhoneBody.test.tsx`** — one `it` per screen above, rendering `PhoneBody` with a hand-built frame and asserting the exact Thai strings from `PHONE`/content (import them — never retype). Plus: choice tap calls `onVote(questionId, index)`; ask-stage buttons carry NO persona-color class (assert `data-persona` attribute absent during ask, present on the done card).
- [ ] **Step 2: Run to fail. Step 3: Rewrite `PhoneBody.tsx` + `phone.css`. Step 4: Update `app/play/page.tsx` + its test** (vote queue keyed by `questionId`; keep rules 1–4 tests intact, adjust payload shapes). **Step 5: Run to pass** — `npx vitest run components/room/PhoneBody.test.tsx app/play/page.test.tsx`.
- [ ] **Step 6: Commit** — `git commit -m "feat(persona): phone flow — neutral choices, persona card at the end"`

---

### Task 8: Projector — `components/room/Stages.tsx` + `stages.css`

**Read first:** the Next.js docs note above, and `app/biz/page.tsx`'s header comment on CSS import order — deck.css stays first.

**Files:** Rewrite `components/room/Stages.tsx`, `components/room/Stages.test.tsx`, `components/room/stages.css`. Modify `app/biz/page.tsx` minimally: add a `ย้อน` (back) button next to advance posting `{action:'back'}`, and the `RoomFrame` fallback loses `tallies`/`leaderboard` (use the Task 4 shape: `{ seq:-1, phase:'lobby', stageIndex:0, stageKind:null, questionId:null, questionIndex:null, votingOpen:false, remainingMs:0, playerCount:0, voteCount:0 }`). Delete now-orphaned: `components/room/Bars.tsx`, `DataPanel.tsx` + test, `Leaderboard.tsx`, `evidence.ts`, and `git rm content/room.ts content/room.test.ts content/room-labels`-orphans deferred from Task 4 (verify with `grep -rln "content/room'" app components lib scripts`).

**Interfaces:**
- Consumes: `RoomFrame = PublicRoomState` (re-export from Stages.tsx — the `& { leaderboard }` intersection goes), `QUESTIONS`, `PERSONAS`, `AXIS_LABELS`, `UI`.
- Produces: `Stages({ frame, joinUrl, remainingMs })` — same prop contract as today, `/biz` keeps working.

**Views:**
1. **LobbyView** — `UI.title` hero, QR (`QRCodeSVG`, keep the client-only-is-the-diagnostic comment), `playerCount` + `UI.inTheRoom`.
2. **AskView** — top strip `UI.questionOf` `{questionIndex+1}/8` + countdown (mm:ss from `remainingMs`, display-only) + `voteCount` `UI.votesIn`; the data hook as the hero: `figure` at poster size (`min(clamp(64px, 10vw, 150px), 18vh)`), `caption` beneath; then `scenario`; then the four choices as A–D cards in a 2×2 grid — **neutral cream cards** (persona colors would leak the mapping; they first appear on the reveal split).
3. **RevealView** — the split as 4 horizontal bars, one per choice in A–D order: label, count, percent (of `voteCount`, guard `voteCount === 0` → all bars zero-width, never NaN), each bar in its choice's **persona color** (`data-persona={choice.persona}`); beneath, the small-talk card under `UI.smallTalkTitle`.
4. **ResultView** — `UI.resultTitle`; the 2×2 map: CSS grid with hairline center axes, `AXIS_LABELS` at the four edge midpoints (English, letter-spaced caps), each quadrant holding its persona's emoji+label+count and `result.dots` rendered as persona-colored dots flowing into their quadrant (`flex-wrap`, one `<span class="pp-dot" data-persona=…>` each — CSS handles up to ~60 dots per quadrant before wrapping tight); footer `UI.resultHint`.

**stages.css — the bright rewrite.** Replace the sheet wholesale. Single-theme (projector), every color painted explicitly:

```css
/* Café Persona — bright, colorful, poster-sized. Persona colors ARE the data palette. */
.room-root {
  --pp-bg: #FFFDF7; --pp-card: #FFFFFF; --pp-ink: #23201A; --pp-muted: #6B6459;
  --pp-line: #E8E2D4;
  --pp-pioneer: #E4572E; --pp-sprinter: #E9A820; --pp-analyst: #2667C9; --pp-guardian: #2E7D4F;
  background: var(--pp-bg); color: var(--pp-ink);
}
[data-persona='pioneer']  { --pp-accent: var(--pp-pioneer); }
[data-persona='sprinter'] { --pp-accent: var(--pp-sprinter); }
[data-persona='analyst']  { --pp-accent: var(--pp-analyst); }
[data-persona='guardian'] { --pp-accent: var(--pp-guardian); }
```

Height-budget typography throughout — every font-size and vertical margin uses `min(clamp(px, vw, px), Nvh)` (the deck's existing convention; copy real values from the current sheet as starting points). Bars: `height: min(7vh, 56px); border-radius: 12px; background: var(--pp-accent)`. Dots: `width: min(2.2vh, 18px); aspect-ratio: 1; border-radius: 50%; background: var(--pp-accent)`. Keep `.room-host` / `.room-alert` / `.room-story`-equivalent rules that `app/biz/page.tsx` still classes against — grep the page for class names before deleting any rule.

- [ ] **Step 1: Rewrite `Stages.test.tsx`** — per view: lobby renders QR + count; ask renders figure `"18/18"`-style (compute from `AUDIENCE` in the test), scenario, all four choice labels, NO persona attribute on choice cards; reveal renders the four labels + counts + `smallTalk` text + `data-persona` on bars; reveal with `voteCount: 0` renders without NaN (`expect(screen.queryByText(/NaN/)).toBeNull()`); result renders all four `PERSONAS[..].label`, the counts, and `AXIS_LABELS` strings (`'GUT'`, `'DATA'`, `'MOVE FAST'`, `'WAIT & SEE'`).
- [ ] **Step 2: fail → Step 3: implement → Step 4: pass** — `npx vitest run components/room/Stages.test.tsx`.
- [ ] **Step 5: Delete the orphans** (`git rm` list above) and re-run `npx vitest run components/ app/`.
- [ ] **Step 6: Commit** — `git commit -m "feat(persona): projector — data-hook ask, split-bar reveal, 2x2 result map"`

---

### Task 9: Repo-wide cleanup and gates

**Files:** whatever the greps surface; no new code.

- [ ] **Step 1:** `grep -rln "shopValue\|SHOP_VALUE_WEIGHTS\|Leaderboard\|simulate\|Kpi\|deck-strings\|content/room'" app components lib content scripts docs --include='*.ts' --include='*.tsx'` — delete or fix every hit (docs hits: update `docs/question-design.md`'s Decision Room half to point at the spec; do not rewrite it wholesale).
- [ ] **Step 2:** `npx tsc --noEmit` → clean.
- [ ] **Step 3:** `npx vitest run` → ALL tests pass (expect ~old count minus deleted suites plus new ones).
- [ ] **Step 4:** `npm run build` → succeeds.
- [ ] **Step 5: Commit** — `git commit -m "chore(persona): remove the KPI game's last remnants"`

---

### Task 10: Projector fit + eyeball pass

**Files:** Modify `scripts/check-projector-fit.mjs` (the `/biz` walk), screenshots to scratchpad.

- [ ] **Step 1:** Update the `/biz` walk: reset → lobby → advance to q1 ask → q1 reveal → advance ×14 to q8 reveal → result; measure at **1366×768 and 1600×900**; keep `checkHostControl` in the walk. The walk advances via `POST /api/room/control` with the dev token (`FACILITATOR_TOKEN=madt2026 npm run dev`).
- [ ] **Step 2:** Run it: `node scripts/check-projector-fit.mjs`. Every stage passes both resolutions.
- [ ] **Step 3:** Screenshot q1 ask, q1 reveal, and result at 1366×768 into the scratchpad and LOOK at them — the fit checker cannot see clipped Thai diacritics, covered content, or fixed-chrome overlap (this repo's history proves it). Fix what the eyeball finds.
- [ ] **Step 4:** Phone spot-check at 390×844: join → vote → reveal → persona card.
- [ ] **Step 5: Commit** — `git commit -m "test(persona): fit-checker walks the persona flow"`

---

## Self-review notes

- Spec §3 tie-break, §4 honesty rule, §2 display-only timer, privacy test, zero-answer player, back action, bright palette §7, fit walk §8 — each maps to a task above (2, 1, 3, 4, 4, 3+5, 8, 10).
- Deletion order is staggered deliberately: `lib/` orphans die in Task 4, component orphans in Task 8, stragglers in Task 9 — the repo only has to typecheck clean at Task 9's gate; each task's own vitest file must pass throughout.
- `votingClosedAt` survives in `RoomState` purely so `isValidRoomState` and old snapshots stay shape-compatible; it is always `null` and nothing reads it.

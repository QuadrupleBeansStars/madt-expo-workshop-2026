# Data in Business Deck — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 15-minute, phone-interactive web deck for MADT Expo that teaches data value, data strategy, and monetization through one dataset the room generates about itself.

**Architecture:** A parallel surface inside the existing Next.js app. New content model, slide machine, store, API namespace (`/api/deck/*`), and two routes (`/biz`, `/biz/tv`). Mirrors AI Detective's server-owned-state + polling-follower pattern but does **not** modify any AI Detective file.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zod 4, Tailwind v4 (CSS-first, theme in `app/globals.css`), Vitest + Testing Library.

## Global Constraints

- **Do not modify any AI Detective file.** Specifically off-limits: `lib/game.ts`, `lib/store.ts`, `lib/types.ts`, `lib/stats.ts`, `lib/scoring.ts`, `content/cases.ts`, `app/page.tsx`, `app/tv/`, `app/dashboard/`, `app/api/{state,join,answer,control,reset}/`. Additive-only exception: `lib/i18n.ts` (append keys, change none).
- **All user-facing copy is bilingual** `{ th, en }` via the existing `LocalizedTextSchema` from `lib/types.ts`.
- **Server owns all state.** Clients never derive phase, timing, or tallies.
- **Persistence file:** `.deck-state.json` (already covered by `.gitignore`'s `.room-state.json`? NO — must be added; see Task 3 Step 7).
- **Host control reuses `FACILITATOR_TOKEN`** with the exact guard from `app/api/control/route.ts:5-12`.
- **No scoring, no leaderboard, no codenames.** Identity exists only to deduplicate votes.
- **Percentages are suppressed below n=5**; counts always shown. (Spec §4.)
- Run `npm test` (vitest) after every task. Type-check with `npx tsc --noEmit`.

---

### Task 1: Deck content model and the ten slides

**Files:**
- Create: `lib/deck-types.ts`
- Create: `content/deck.ts`
- Test: `content/deck.test.ts`

**Interfaces:**
- Consumes: `LocalizedTextSchema`, `LocalizedText` from `lib/types.ts` (existing).
- Produces: `Slide`, `PollSlide`, `VoteSlide`, `RevealSlide`, `ContentSlide`, `DeckOption`, `SlideSchema`, `DeckPhase`, `DeckState`, `DeckVote`, `Tally`, `PublicDeckState` from `lib/deck-types.ts`; `DECK: Slide[]` from `content/deck.ts`.

- [ ] **Step 1: Write `lib/deck-types.ts`**

```ts
import { z } from 'zod'
import { LocalizedTextSchema } from './types'

export const DeckOptionSchema = z.object({
  id: z.string().min(1),
  label: LocalizedTextSchema,
})
export type DeckOption = z.infer<typeof DeckOptionSchema>

/** Hook question. No correct answer — the point is the aggregate. */
export const PollSlideSchema = z.object({
  kind: z.literal('poll'),
  id: z.string().min(1),
  prompt: LocalizedTextSchema,
  options: z.array(DeckOptionSchema).min(3).max(4),
  durationMs: z.number().int().positive(),
})
export type PollSlide = z.infer<typeof PollSlideSchema>

/** Beat question. `bestOptionId` structures the reveal; it is NOT scored. */
export const VoteSlideSchema = z.object({
  kind: z.literal('vote'),
  id: z.string().min(1),
  prompt: LocalizedTextSchema,
  options: z.array(DeckOptionSchema).min(3).max(4),
  durationMs: z.number().int().positive(),
  bestOptionId: z.string().min(1),
})
export type VoteSlide = z.infer<typeof VoteSlideSchema>

export const RevealSlideSchema = z.object({
  kind: z.literal('reveal'),
  id: z.string().min(1),
  /** id of the poll/vote slide whose results this reveals. */
  forSlideId: z.string().min(1),
  headline: LocalizedTextSchema,
  body: LocalizedTextSchema,
  lesson: LocalizedTextSchema,
})
export type RevealSlide = z.infer<typeof RevealSlideSchema>

export const ContentSlideSchema = z.object({
  kind: z.literal('content'),
  id: z.string().min(1),
  headline: LocalizedTextSchema,
  bullets: z.array(LocalizedTextSchema).min(1),
})
export type ContentSlide = z.infer<typeof ContentSlideSchema>

export const SlideSchema = z.discriminatedUnion('kind', [
  PollSlideSchema, VoteSlideSchema, RevealSlideSchema, ContentSlideSchema,
])
export type Slide = z.infer<typeof SlideSchema>

export type DeckPhase = 'lobby' | 'slide' | 'done'

/** Server-authoritative. `slideStartedAt` + the slide's durationMs are the ONLY clock. */
export type DeckState = {
  phase: DeckPhase
  slideIndex: number
  slideStartedAt: number
  /** Set when the host closes voting early; null while the timer governs. */
  votingClosedAt: number | null
}

export type DeckPlayer = { id: string; joinedAt: number }
export type DeckVote = { playerId: string; slideId: string; optionId: string }

export type Tally = { optionId: string; count: number }

export type PublicDeckState = {
  seq: number
  phase: DeckPhase
  slideIndex: number
  slideId: string | null
  votingOpen: boolean
  remainingMs: number
  playerCount: number
  /** Votes cast on the current slide. */
  voteCount: number
  tallies: Tally[]
  /** Present only when the request carried a playerId. optionId, or null if not yet voted. */
  youVoted?: string | null
}
```

- [ ] **Step 2: Write the failing content test `content/deck.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { DECK } from './deck'
import { SlideSchema } from '@/lib/deck-types'

describe('deck content', () => {
  it('is ten slides: 3 polls, 3 votes, 3 reveals, 1 content', () => {
    expect(DECK).toHaveLength(10)
    const count = (k: string) => DECK.filter((s) => s.kind === k).length
    expect(count('poll')).toBe(3)
    expect(count('vote')).toBe(3)
    expect(count('reveal')).toBe(3)
    expect(count('content')).toBe(1)
  })

  it('every slide passes its schema', () => {
    for (const slide of DECK) {
      expect(() => SlideSchema.parse(slide)).not.toThrow()
    }
  })

  it('slide ids are unique', () => {
    const ids = DECK.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every reveal points at a real earlier slide that accepts votes', () => {
    for (const [i, slide] of DECK.entries()) {
      if (slide.kind !== 'reveal') continue
      const target = DECK.findIndex((s) => s.id === slide.forSlideId)
      expect(target, `${slide.id} -> ${slide.forSlideId}`).toBeGreaterThanOrEqual(0)
      expect(target).toBeLessThan(i)
      expect(['poll', 'vote']).toContain(DECK[target].kind)
    }
  })

  it('every vote slide has a bestOptionId matching one of its options', () => {
    for (const slide of DECK) {
      if (slide.kind !== 'vote') continue
      expect(slide.options.map((o) => o.id)).toContain(slide.bestOptionId)
    }
  })

  it('option ids are unique within a slide', () => {
    for (const slide of DECK) {
      if (slide.kind !== 'poll' && slide.kind !== 'vote') continue
      const ids = slide.options.map((o) => o.id)
      expect(new Set(ids).size, slide.id).toBe(ids.length)
    }
  })

  it('every localized string is non-empty in both languages', () => {
    const check = (t: { th: string; en: string }, where: string) => {
      expect(t.th.trim(), `${where}.th`).not.toBe('')
      expect(t.en.trim(), `${where}.en`).not.toBe('')
    }
    for (const slide of DECK) {
      if (slide.kind === 'poll' || slide.kind === 'vote') {
        check(slide.prompt, `${slide.id}.prompt`)
        slide.options.forEach((o) => check(o.label, `${slide.id}.${o.id}`))
      } else if (slide.kind === 'reveal') {
        check(slide.headline, `${slide.id}.headline`)
        check(slide.body, `${slide.id}.body`)
        check(slide.lesson, `${slide.id}.lesson`)
      } else {
        check(slide.headline, `${slide.id}.headline`)
        slide.bullets.forEach((b, i) => check(b, `${slide.id}.bullet${i}`))
      }
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run content/deck.test.ts`
Expected: FAIL — `Failed to resolve import "./deck"`.

- [ ] **Step 4: Write `content/deck.ts`**

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run content/deck.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/deck-types.ts content/deck.ts content/deck.test.ts
git commit -m "feat(deck): slide content model and the ten-slide deck"
```

---

### Task 2: Slide machine

**Files:**
- Create: `lib/deck.ts`
- Test: `lib/deck.test.ts`

**Interfaces:**
- Consumes: `DECK` from `content/deck.ts`; all types from `lib/deck-types.ts`.
- Produces: `SLIDES`, `SLIDE_COUNT`, `LOBBY_DECK_STATE`, `currentSlide(state)`, `slideAt(index)`, `acceptsVotes(slide)`, `votingOpen(state, now)`, `remainingMs(state, now)`, `startedDeckState(now)`, `nextSlideState(state, now)`, `backSlideState(state, now)`, `closeVotingState(state, now)`, `tally(votes, slideId, slide)`, `MIN_N_FOR_PERCENT`, `showPercentages(total)`.

- [ ] **Step 1: Write the failing test `lib/deck.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import {
  SLIDES, SLIDE_COUNT, LOBBY_DECK_STATE, currentSlide, slideAt, acceptsVotes,
  votingOpen, remainingMs, startedDeckState, nextSlideState, backSlideState,
  closeVotingState, tally, MIN_N_FOR_PERCENT, showPercentages,
} from './deck'
import type { DeckState, DeckVote } from './deck-types'

const at = (index: number, startedAt = 1000, closedAt: number | null = null): DeckState =>
  ({ phase: 'slide', slideIndex: index, slideStartedAt: startedAt, votingClosedAt: closedAt })

describe('deck machine', () => {
  it('SLIDES is the deck in order', () => {
    expect(SLIDE_COUNT).toBe(10)
    expect(SLIDES[0].id).toBe('hook-transport')
    expect(SLIDES[SLIDE_COUNT - 1].id).toBe('close')
  })

  it('lobby has no current slide', () => {
    expect(currentSlide(LOBBY_DECK_STATE)).toBeNull()
  })

  it('slideAt returns null out of range', () => {
    expect(slideAt(-1)).toBeNull()
    expect(slideAt(SLIDE_COUNT)).toBeNull()
    expect(slideAt(0)?.id).toBe('hook-transport')
  })

  it('only poll and vote slides accept votes', () => {
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'poll')!)).toBe(true)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'vote')!)).toBe(true)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'reveal')!)).toBe(false)
    expect(acceptsVotes(SLIDES.find((s) => s.kind === 'content')!)).toBe(false)
  })

  it('start moves lobby to slide 0', () => {
    const s = startedDeckState(5000)
    expect(s.phase).toBe('slide')
    expect(s.slideIndex).toBe(0)
    expect(s.slideStartedAt).toBe(5000)
    expect(s.votingClosedAt).toBeNull()
  })

  it('voting is open on a poll until its duration elapses', () => {
    const s = at(0, 1000)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(votingOpen(s, 1000)).toBe(true)
    expect(votingOpen(s, 1000 + dur - 1)).toBe(true)
    expect(votingOpen(s, 1000 + dur)).toBe(false)
  })

  it('voting is never open on reveal or content slides', () => {
    const revealIndex = SLIDES.findIndex((s) => s.kind === 'reveal')
    expect(votingOpen(at(revealIndex), 1000)).toBe(false)
    const contentIndex = SLIDES.findIndex((s) => s.kind === 'content')
    expect(votingOpen(at(contentIndex), 1000)).toBe(false)
  })

  it('host closing voting shuts it immediately', () => {
    const s = closeVotingState(at(0, 1000), 1200)
    expect(s.votingClosedAt).toBe(1200)
    expect(votingOpen(s, 1201)).toBe(false)
  })

  it('remainingMs is 0 once voting closes and never negative', () => {
    const s = at(0, 1000)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(remainingMs(s, 1000)).toBe(dur)
    expect(remainingMs(s, 1000 + dur + 9999)).toBe(0)
    expect(remainingMs(at(SLIDES.findIndex((x) => x.kind === 'content')), 1000)).toBe(0)
  })

  it('next advances and resets the voting clock', () => {
    const s = nextSlideState(at(0, 1000, 1200), 9000)
    expect(s.slideIndex).toBe(1)
    expect(s.slideStartedAt).toBe(9000)
    expect(s.votingClosedAt).toBeNull()
  })

  it('next past the last slide goes to done and stays there', () => {
    const last = at(SLIDE_COUNT - 1)
    const done = nextSlideState(last, 9000)
    expect(done.phase).toBe('done')
    expect(nextSlideState(done, 9500).phase).toBe('done')
  })

  it('back steps one slide and does not go below zero', () => {
    expect(backSlideState(at(2), 9000).slideIndex).toBe(1)
    expect(backSlideState(at(0), 9000).slideIndex).toBe(0)
  })

  it('back from done returns to the last slide', () => {
    const done = nextSlideState(at(SLIDE_COUNT - 1), 9000)
    const back = backSlideState(done, 9500)
    expect(back.phase).toBe('slide')
    expect(back.slideIndex).toBe(SLIDE_COUNT - 1)
  })

  it('tally counts votes for the slide only, in option order, including zeros', () => {
    const slide = SLIDES[0]
    const votes: DeckVote[] = [
      { playerId: 'a', slideId: 'hook-transport', optionId: 'train' },
      { playerId: 'b', slideId: 'hook-transport', optionId: 'train' },
      { playerId: 'c', slideId: 'hook-transport', optionId: 'walk' },
      { playerId: 'd', slideId: 'hook-wake', optionId: '6to8' },
    ]
    expect(tally(votes, 'hook-transport', slide)).toEqual([
      { optionId: 'walk', count: 1 },
      { optionId: 'train', count: 2 },
      { optionId: 'car', count: 0 },
      { optionId: 'moto', count: 0 },
    ])
  })

  it('tally of a non-voting slide is empty', () => {
    const content = SLIDES.find((s) => s.kind === 'content')!
    expect(tally([], 'close', content)).toEqual([])
  })

  it('percentages are suppressed below the n=5 floor', () => {
    expect(MIN_N_FOR_PERCENT).toBe(5)
    expect(showPercentages(0)).toBe(false)
    expect(showPercentages(4)).toBe(false)
    expect(showPercentages(5)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/deck.test.ts`
Expected: FAIL — `Failed to resolve import "./deck"`.

- [ ] **Step 3: Write `lib/deck.ts`**

```ts
import { DECK } from '@/content/deck'
import type { DeckState, DeckVote, Slide, Tally } from './deck-types'

export const SLIDES: Slide[] = DECK
export const SLIDE_COUNT = SLIDES.length

/**
 * Small rooms are the expo norm. Below this many votes we show raw counts only —
 * "67%" from three people reads as a real statistic and is not one. Spec §4.
 */
export const MIN_N_FOR_PERCENT = 5
export function showPercentages(total: number): boolean {
  return total >= MIN_N_FOR_PERCENT
}

export const LOBBY_DECK_STATE: DeckState = {
  phase: 'lobby', slideIndex: 0, slideStartedAt: 0, votingClosedAt: null,
}

export function slideAt(index: number): Slide | null {
  return SLIDES[index] ?? null
}

export function currentSlide(state: DeckState): Slide | null {
  if (state.phase !== 'slide') return null
  return slideAt(state.slideIndex)
}

export function acceptsVotes(slide: Slide): boolean {
  return slide.kind === 'poll' || slide.kind === 'vote'
}

function durationOf(slide: Slide): number {
  return slide.kind === 'poll' || slide.kind === 'vote' ? slide.durationMs : 0
}

/**
 * Voting is open while the slide accepts votes, the host has not closed it,
 * and the per-slide timer has not elapsed. The timer closes VOTING only — it
 * never advances the deck. Advancing is always the host's action. Spec §3.3.
 */
export function votingOpen(state: DeckState, now: number): boolean {
  const slide = currentSlide(state)
  if (!slide || !acceptsVotes(slide)) return false
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return false
  return now < state.slideStartedAt + durationOf(slide)
}

export function remainingMs(state: DeckState, now: number): number {
  const slide = currentSlide(state)
  if (!slide || !acceptsVotes(slide)) return 0
  if (state.votingClosedAt !== null && now >= state.votingClosedAt) return 0
  return Math.max(0, state.slideStartedAt + durationOf(slide) - now)
}

export function startedDeckState(now: number): DeckState {
  return { phase: 'slide', slideIndex: 0, slideStartedAt: now, votingClosedAt: null }
}

export function closeVotingState(state: DeckState, now: number): DeckState {
  return { ...state, votingClosedAt: now }
}

export function nextSlideState(state: DeckState, now: number): DeckState {
  if (state.phase === 'done') return state
  const next = state.slideIndex + 1
  if (next >= SLIDE_COUNT) {
    return { phase: 'done', slideIndex: state.slideIndex, slideStartedAt: now, votingClosedAt: null }
  }
  return { phase: 'slide', slideIndex: next, slideStartedAt: now, votingClosedAt: null }
}

export function backSlideState(state: DeckState, now: number): DeckState {
  if (state.phase === 'done') {
    return { phase: 'slide', slideIndex: SLIDE_COUNT - 1, slideStartedAt: now, votingClosedAt: null }
  }
  const prev = Math.max(0, state.slideIndex - 1)
  return { phase: 'slide', slideIndex: prev, slideStartedAt: now, votingClosedAt: null }
}

/** Counts in the slide's own option order, zeros included so bars never reflow. */
export function tally(votes: DeckVote[], slideId: string, slide: Slide): Tally[] {
  if (!acceptsVotes(slide)) return []
  const counts = new Map<string, number>(slide.options.map((o) => [o.id, 0]))
  for (const v of votes) {
    if (v.slideId !== slideId) continue
    const n = counts.get(v.optionId)
    if (n !== undefined) counts.set(v.optionId, n + 1)
  }
  return slide.options.map((o) => ({ optionId: o.id, count: counts.get(o.id)! }))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/deck.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/deck.ts lib/deck.test.ts
git commit -m "feat(deck): slide machine with host-driven advance and vote tallying"
```

---

### Task 3: Deck store

**Files:**
- Create: `lib/deck-store.ts`
- Test: `lib/deck-store.test.ts`
- Modify: `.gitignore` (add `.deck-state.json`)

**Interfaces:**
- Consumes: everything from `lib/deck.ts` and `lib/deck-types.ts`.
- Produces: `DeckStore` interface, `MemoryDeckStore` class, `VoteResult` type, `getDeckStore()`.

`MemoryDeckStore` methods: `join(now): DeckPlayer`, `recordVote({playerId, slideId, optionId}, now): VoteResult`, `getPlayers(): DeckPlayer[]`, `getVotes(): DeckVote[]`, `getDeckState(): DeckState`, `getSeq(): number`, `start(now)`, `next(now)`, `back(now)`, `closeVoting(now)`, `reset()`, `getPublicState(now, playerId?): PublicDeckState`.

`VoteResult = 'ok' | 'unknown' | 'closed'`.

- [ ] **Step 1: Write the failing test `lib/deck-store.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryDeckStore } from './deck-store'
import { SLIDES, SLIDE_COUNT } from './deck'

const T0 = 1_000_000

describe('deck store', () => {
  let store: MemoryDeckStore
  beforeEach(() => { store = new MemoryDeckStore() })

  it('starts in lobby with nobody', () => {
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(s.slideId).toBeNull()
    expect(s.tallies).toEqual([])
  })

  it('join is anonymous and returns a stable id', () => {
    const a = store.join(T0)
    const b = store.join(T0)
    expect(a.id).not.toBe(b.id)
    expect(store.getPublicState(T0).playerCount).toBe(2)
  })

  it('late joiners are full participants, not spectators', () => {
    store.start(T0)
    const late = store.join(T0 + 500)
    const r = store.recordVote({ playerId: late.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 600)
    expect(r).toBe('ok')
  })

  it('rejects votes from unknown players', () => {
    store.start(T0)
    expect(store.recordVote({ playerId: 'nope', slideId: SLIDES[0].id, optionId: 'walk' }, T0)).toBe('unknown')
  })

  it('rejects votes for a slide that is not current', () => {
    const p = store.join(T0)
    store.start(T0)
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[1].id, optionId: '6to8' }, T0)).toBe('closed')
  })

  it('rejects votes once voting has closed', () => {
    const p = store.join(T0)
    store.start(T0)
    const dur = SLIDES[0].kind === 'poll' ? SLIDES[0].durationMs : 0
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + dur)).toBe('closed')
  })

  it('is last-write-wins: changing your mind replaces your vote', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'train' }, T0 + 20)
    const s = store.getPublicState(T0 + 30, p.id)
    expect(s.voteCount).toBe(1)
    expect(s.youVoted).toBe('train')
    expect(s.tallies.find((t) => t.optionId === 'train')!.count).toBe(1)
    expect(s.tallies.find((t) => t.optionId === 'walk')!.count).toBe(0)
  })

  it('youVoted is null before voting and absent without a playerId', () => {
    const p = store.join(T0)
    store.start(T0)
    expect(store.getPublicState(T0, p.id).youVoted).toBeNull()
    expect(store.getPublicState(T0).youVoted).toBeUndefined()
  })

  it('host can close voting early', () => {
    const p = store.join(T0)
    store.start(T0)
    store.closeVoting(T0 + 5)
    expect(store.getPublicState(T0 + 6).votingOpen).toBe(false)
    expect(store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 7)).toBe('closed')
  })

  it('next and back move the deck and are reflected publicly', () => {
    store.start(T0)
    store.next(T0 + 100)
    expect(store.getPublicState(T0 + 100).slideIndex).toBe(1)
    store.back(T0 + 200)
    expect(store.getPublicState(T0 + 200).slideIndex).toBe(0)
  })

  it('votes survive going back to an earlier slide', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.next(T0 + 100)
    store.back(T0 + 200)
    expect(store.getPublicState(T0 + 200, p.id).youVoted).toBe('walk')
  })

  it('reaches done after the last slide', () => {
    store.start(T0)
    for (let i = 0; i < SLIDE_COUNT; i++) store.next(T0 + 100 + i)
    expect(store.getPublicState(T0 + 999).phase).toBe('done')
  })

  it('start is a no-op unless in lobby', () => {
    store.start(T0)
    store.next(T0 + 10)
    store.start(T0 + 20)
    expect(store.getPublicState(T0 + 20).slideIndex).toBe(1)
  })

  it('reset clears players, votes and returns to lobby', () => {
    const p = store.join(T0)
    store.start(T0)
    store.recordVote({ playerId: p.id, slideId: SLIDES[0].id, optionId: 'walk' }, T0 + 10)
    store.reset()
    const s = store.getPublicState(T0 + 20)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(store.getVotes()).toEqual([])
  })

  it('seq increases monotonically on every mutation', () => {
    const seqs = [store.getSeq()]
    store.join(T0); seqs.push(store.getSeq())
    store.start(T0); seqs.push(store.getSeq())
    store.next(T0 + 1); seqs.push(store.getSeq())
    store.reset(); seqs.push(store.getSeq())
    for (let i = 1; i < seqs.length; i++) expect(seqs[i]).toBeGreaterThan(seqs[i - 1])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/deck-store.test.ts`
Expected: FAIL — `Failed to resolve import "./deck-store"`.

- [ ] **Step 3: Write `lib/deck-store.ts`**

```ts
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { DeckPlayer, DeckState, DeckVote, PublicDeckState } from './deck-types'
import {
  LOBBY_DECK_STATE, backSlideState, closeVotingState, currentSlide, nextSlideState,
  remainingMs, startedDeckState, tally, votingOpen,
} from './deck'

export type VoteResult = 'ok' | 'unknown' | 'closed'

export interface DeckStore {
  join(now: number): DeckPlayer
  recordVote(input: { playerId: string; slideId: string; optionId: string }, now: number): VoteResult
  getPlayers(): DeckPlayer[]
  getVotes(): DeckVote[]
  getDeckState(): DeckState
  getSeq(): number
  start(now: number): void
  next(now: number): void
  back(now: number): void
  closeVoting(now: number): void
  reset(): void
  getPublicState(now: number, playerId?: string): PublicDeckState
}

type Snapshot = { players: DeckPlayer[]; votes: DeckVote[]; deck: DeckState; seq: number }

export class MemoryDeckStore implements DeckStore {
  private players: DeckPlayer[] = []
  /** Keyed `${playerId}:${slideId}`. Last-write-wins: changing your mind is harmless here. */
  private votes = new Map<string, DeckVote>()
  private deck: DeckState = LOBBY_DECK_STATE
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  join(now: number): DeckPlayer {
    // No spectator concept: with no scoring, a late joiner just votes on the current slide.
    const player: DeckPlayer = { id: randomUUID(), joinedAt: now }
    this.players.push(player)
    this.seq++
    this.persist()
    return player
  }

  recordVote(input: { playerId: string; slideId: string; optionId: string }, now: number): VoteResult {
    if (!this.players.some((p) => p.id === input.playerId)) return 'unknown'
    const slide = currentSlide(this.deck)
    if (!slide || slide.id !== input.slideId) return 'closed'
    if (!votingOpen(this.deck, now)) return 'closed'
    if (slide.kind !== 'poll' && slide.kind !== 'vote') return 'closed'
    if (!slide.options.some((o) => o.id === input.optionId)) return 'closed'
    this.votes.set(`${input.playerId}:${input.slideId}`, {
      playerId: input.playerId, slideId: input.slideId, optionId: input.optionId,
    })
    this.seq++
    this.persist()
    return 'ok'
  }

  getPlayers(): DeckPlayer[] { return this.players.map((p) => ({ ...p })) }
  getVotes(): DeckVote[] { return [...this.votes.values()].map((v) => ({ ...v })) }
  getDeckState(): DeckState { return { ...this.deck } }
  getSeq(): number { return this.seq }

  start(now: number): void {
    if (this.deck.phase !== 'lobby') return
    this.deck = startedDeckState(now)
    this.seq++
    this.persist()
  }

  next(now: number): void {
    if (this.deck.phase === 'lobby') return
    this.deck = nextSlideState(this.deck, now)
    this.seq++
    this.persist()
  }

  back(now: number): void {
    if (this.deck.phase === 'lobby') return
    this.deck = backSlideState(this.deck, now)
    this.seq++
    this.persist()
  }

  closeVoting(now: number): void {
    if (this.deck.phase !== 'slide') return
    this.deck = closeVotingState(this.deck, now)
    this.seq++
    this.persist()
  }

  reset(): void {
    this.players = []
    this.votes.clear()
    this.deck = LOBBY_DECK_STATE
    this.seq++
    this.persist()
  }

  getPublicState(now: number, playerId?: string): PublicDeckState {
    const slide = currentSlide(this.deck)
    const votes = this.getVotes()
    const tallies = slide ? tally(votes, slide.id, slide) : []
    const pub: PublicDeckState = {
      seq: this.seq,
      phase: this.deck.phase,
      slideIndex: this.deck.slideIndex,
      slideId: slide?.id ?? null,
      votingOpen: votingOpen(this.deck, now),
      remainingMs: remainingMs(this.deck, now),
      playerCount: this.players.length,
      voteCount: tallies.reduce((n, t) => n + t.count, 0),
      tallies,
    }
    if (playerId !== undefined) {
      pub.youVoted = slide ? (this.votes.get(`${playerId}:${slide.id}`)?.optionId ?? null) : null
    }
    return pub
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, votes: this.getVotes(), deck: this.deck, seq: this.seq }
    try {
      const tmpPath = `${this.persistPath}.${randomUUID()}.tmp`
      writeFileSync(tmpPath, JSON.stringify(snap), 'utf8')
      renameSync(tmpPath, this.persistPath)
    } catch (err) {
      console.error('[deck-store] persist() failed — deck state may not survive a restart:', err)
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Partial<Snapshot>
      if (!Array.isArray(snap.players) || !Array.isArray(snap.votes)) {
        throw new Error('persisted deck snapshot has an unexpected shape')
      }
      this.players = snap.players.filter((p) => p && typeof p.id === 'string')
      for (const v of snap.votes) {
        if (!v || typeof v !== 'object' || !v.playerId || !v.slideId || !v.optionId) continue
        this.votes.set(`${v.playerId}:${v.slideId}`, v)
      }
      const validPhases = new Set(['lobby', 'slide', 'done'])
      this.deck = snap.deck && validPhases.has(snap.deck.phase as string)
        ? (snap.deck as DeckState) : LOBBY_DECK_STATE
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.votes.clear()
      this.deck = LOBBY_DECK_STATE
      this.seq = 0
    }
  }
}

const globalForDeck = globalThis as unknown as { __deckStore?: DeckStore }
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
export function getDeckStore(): DeckStore {
  if (!globalForDeck.__deckStore) {
    globalForDeck.__deckStore = isTestEnv ? new MemoryDeckStore() : new MemoryDeckStore('.deck-state.json')
  }
  return globalForDeck.__deckStore
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/deck-store.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Add the state file to `.gitignore`**

Append after the existing `.room-state.json` line:

```
.deck-state.json
```

- [ ] **Step 6: Verify it is ignored**

Run: `git check-ignore -v .deck-state.json`
Expected: prints the matching `.gitignore` line. If it prints nothing, the entry is wrong — fix before committing.

- [ ] **Step 7: Commit**

```bash
git add lib/deck-store.ts lib/deck-store.test.ts .gitignore
git commit -m "feat(deck): server-owned deck store with last-write-wins votes"
```

---

### Task 4: Deck API routes

**Files:**
- Create: `app/api/deck/state/route.ts`
- Create: `app/api/deck/join/route.ts`
- Create: `app/api/deck/vote/route.ts`
- Create: `app/api/deck/control/route.ts`
- Create: `app/api/deck/reset/route.ts`
- Test: `app/api/deck/routes.test.ts`

**Interfaces:**
- Consumes: `getDeckStore()` from `lib/deck-store.ts`.
- Produces: HTTP contract — `GET /api/deck/state?playerId=` → `PublicDeckState`; `POST /api/deck/join` → `{player}`; `POST /api/deck/vote` → `{ok:true}` | 400 | 409; `POST /api/deck/control` `{action:'start'|'next'|'back'|'closeVoting'}` → `{ok:true}` | 400 | 403; `POST /api/deck/reset` → `{ok:true}` | 403.

- [ ] **Step 1: Write the failing test `app/api/deck/routes.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getState } from './state/route'
import { POST as postJoin } from './join/route'
import { POST as postVote } from './vote/route'
import { POST as postControl } from './control/route'
import { POST as postReset } from './reset/route'
import { getDeckStore } from '@/lib/deck-store'
import { SLIDES } from '@/lib/deck'

const TOKEN = 'test-token'
const req = (url: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(url, body === undefined
    ? { headers }
    : { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers })

describe('deck API', () => {
  beforeEach(() => {
    process.env.FACILITATOR_TOKEN = TOKEN
    getDeckStore().reset()
  })
  afterEach(() => { vi.unstubAllEnvs() })

  it('state returns lobby initially', async () => {
    const res = await getState(req('http://localhost/api/deck/state'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.phase).toBe('lobby')
  })

  it('join returns a player id', async () => {
    const res = await postJoin(req('http://localhost/api/deck/join', {}))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(typeof body.player.id).toBe('string')
  })

  it('control requires the facilitator token', async () => {
    const res = await postControl(req('http://localhost/api/deck/control', { action: 'start' }))
    expect(res.status).toBe(403)
  })

  it('control rejects an unknown action', async () => {
    const res = await postControl(
      req('http://localhost/api/deck/control', { action: 'explode' }, { 'x-facilitator-token': TOKEN }),
    )
    expect(res.status).toBe(400)
  })

  it('control start then next advances the deck', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'next' }, h))
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.slideIndex).toBe(1)
  })

  it('control back steps the deck backwards', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'next' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'back' }, h))
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.slideIndex).toBe(0)
  })

  it('vote succeeds while open and appears in tallies', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    const player = (await (await postJoin(req('http://localhost/api/deck/join', {}))).json()).player
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: player.id, slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(200)
    const body = await (await getState(req(`http://localhost/api/deck/state?playerId=${player.id}`))).json()
    expect(body.youVoted).toBe('walk')
    expect(body.voteCount).toBe(1)
  })

  it('vote after closeVoting returns 409', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    const player = (await (await postJoin(req('http://localhost/api/deck/join', {}))).json()).player
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    await postControl(req('http://localhost/api/deck/control', { action: 'closeVoting' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: player.id, slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(409)
  })

  it('vote with a missing field returns 400', async () => {
    const res = await postVote(req('http://localhost/api/deck/vote', { playerId: 'x' }))
    expect(res.status).toBe(400)
  })

  it('vote with malformed JSON returns 400', async () => {
    const res = await postVote(req('http://localhost/api/deck/vote', 'not json'))
    expect(res.status).toBe(400)
  })

  it('vote from an unknown player returns 400', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    const res = await postVote(req('http://localhost/api/deck/vote', {
      playerId: 'ghost', slideId: SLIDES[0].id, optionId: 'walk',
    }))
    expect(res.status).toBe(400)
  })

  it('reset requires the token and returns to lobby', async () => {
    const h = { 'x-facilitator-token': TOKEN }
    await postControl(req('http://localhost/api/deck/control', { action: 'start' }, h))
    expect((await postReset(req('http://localhost/api/deck/reset', {}))).status).toBe(403)
    expect((await postReset(req('http://localhost/api/deck/reset', {}, h))).status).toBe(200)
    const body = await (await getState(req('http://localhost/api/deck/state'))).json()
    expect(body.phase).toBe('lobby')
  })

  it('control is disabled entirely when no token is configured', async () => {
    delete process.env.FACILITATOR_TOKEN
    const res = await postControl(req('http://localhost/api/deck/control', { action: 'start' }))
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/api/deck/routes.test.ts`
Expected: FAIL — cannot resolve `./state/route`.

- [ ] **Step 3: Write `app/api/deck/state/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

export async function GET(req: Request) {
  const playerId = new URL(req.url).searchParams.get('playerId') ?? undefined
  return NextResponse.json(getDeckStore().getPublicState(Date.now(), playerId))
}
```

- [ ] **Step 4: Write `app/api/deck/join/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

/** Anonymous join: opening /biz is the whole handshake. No codename by design. */
export async function POST() {
  return NextResponse.json({ player: getDeckStore().join(Date.now()) })
}
```

- [ ] **Step 5: Write `app/api/deck/vote/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const { playerId, slideId, optionId } = body as
    { playerId?: unknown; slideId?: unknown; optionId?: unknown }
  if (typeof playerId !== 'string' || !playerId ||
      typeof slideId !== 'string' || !slideId ||
      typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, slideId and optionId are required' }, { status: 400 })
  }

  const result = getDeckStore().recordVote({ playerId, slideId, optionId }, Date.now())
  switch (result) {
    case 'ok':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'closed':
      return NextResponse.json({ error: 'voting is not open for this slide' }, { status: 409 })
  }
}
```

- [ ] **Step 6: Write `app/api/deck/control/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

const ACTIONS = ['start', 'next', 'back', 'closeVoting'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: Request) {
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'control is disabled: FACILITATOR_TOKEN is not set' }, { status: 403 })
  }
  if (req.headers.get('x-facilitator-token') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const action = (body as { action?: unknown })?.action
  if (typeof action !== 'string' || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: `action must be one of ${ACTIONS.join(', ')}` }, { status: 400 })
  }

  const now = Date.now()
  const store = getDeckStore()
  if (action === 'start') store.start(now)
  else if (action === 'next') store.next(now)
  else if (action === 'back') store.back(now)
  else store.closeVoting(now)

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Write `app/api/deck/reset/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getDeckStore } from '@/lib/deck-store'

export async function POST(req: Request) {
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'reset is disabled: FACILITATOR_TOKEN is not set' }, { status: 403 })
  }
  if (req.headers.get('x-facilitator-token') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  getDeckStore().reset()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run app/api/deck/routes.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 9: Commit**

```bash
git add app/api/deck
git commit -m "feat(deck): API namespace for state, join, vote and host control"
```

---

### Task 5: Live result bar chart

**Files:**
- Create: `components/deck/ResultBars.tsx`
- Test: `components/deck/ResultBars.test.tsx`

**REQUIRED SKILL:** Invoke the `dataviz` skill before writing this component. Take the palette and bar-form guidance from it; do not invent colors.

**Interfaces:**
- Consumes: `Tally` from `lib/deck-types.ts`; `showPercentages` from `lib/deck.ts`; `LocalizedText`, `Lang` from `lib/types.ts`.
- Produces: `ResultBars` React component.

```ts
type ResultBarsProps = {
  tallies: Tally[]
  labels: { id: string; label: LocalizedText }[]
  lang: Lang
  /** Renders this option in the emphasis color. Used on reveal slides. */
  highlightOptionId?: string
}
```

- [ ] **Step 1: Write the failing test `components/deck/ResultBars.test.tsx`**

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultBars } from './ResultBars'
import type { Tally } from '@/lib/deck-types'

const labels = [
  { id: 'walk', label: { th: 'เดินมา', en: 'Walked' } },
  { id: 'train', label: { th: 'BTS / MRT', en: 'BTS / MRT' } },
  { id: 'car', label: { th: 'รถยนต์', en: 'Car' } },
]

describe('ResultBars', () => {
  it('renders every option even at zero votes', () => {
    const tallies: Tally[] = labels.map((l) => ({ optionId: l.id, count: 0 }))
    render(<ResultBars tallies={tallies} labels={labels} lang="en" />)
    expect(screen.getByText('Walked')).toBeDefined()
    expect(screen.getByText('BTS / MRT')).toBeDefined()
    expect(screen.getByText('Car')).toBeDefined()
  })

  it('shows counts but NOT percentages below the n=5 floor', () => {
    const tallies: Tally[] = [
      { optionId: 'walk', count: 1 }, { optionId: 'train', count: 2 }, { optionId: 'car', count: 0 },
    ]
    render(<ResultBars tallies={tallies} labels={labels} lang="en" />)
    expect(screen.getByTestId('count-train').textContent).toContain('2')
    expect(screen.queryByTestId('pct-train')).toBeNull()
  })

  it('shows percentages at or above the n=5 floor', () => {
    const tallies: Tally[] = [
      { optionId: 'walk', count: 1 }, { optionId: 'train', count: 3 }, { optionId: 'car', count: 1 },
    ]
    render(<ResultBars tallies={tallies} labels={labels} lang="en" />)
    expect(screen.getByTestId('pct-train').textContent).toContain('60')
  })

  it('handles a single option taking 100%', () => {
    const tallies: Tally[] = [
      { optionId: 'walk', count: 0 }, { optionId: 'train', count: 6 }, { optionId: 'car', count: 0 },
    ]
    render(<ResultBars tallies={tallies} labels={labels} lang="en" />)
    expect(screen.getByTestId('pct-train').textContent).toContain('100')
    expect(screen.getByTestId('pct-walk').textContent).toContain('0')
  })

  it('renders Thai labels when lang is th', () => {
    const tallies: Tally[] = labels.map((l) => ({ optionId: l.id, count: 0 }))
    render(<ResultBars tallies={tallies} labels={labels} lang="th" />)
    expect(screen.getByText('เดินมา')).toBeDefined()
  })

  it('marks the highlighted option', () => {
    const tallies: Tally[] = labels.map((l) => ({ optionId: l.id, count: 1 }))
    render(<ResultBars tallies={tallies} labels={labels} lang="en" highlightOptionId="train" />)
    expect(screen.getByTestId('bar-train').getAttribute('data-highlight')).toBe('true')
    expect(screen.getByTestId('bar-walk').getAttribute('data-highlight')).toBe('false')
  })

  it('does not divide by zero when there are no votes', () => {
    const tallies: Tally[] = labels.map((l) => ({ optionId: l.id, count: 0 }))
    expect(() => render(<ResultBars tallies={tallies} labels={labels} lang="en" />)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/deck/ResultBars.test.tsx`
Expected: FAIL — cannot resolve `./ResultBars`.

- [ ] **Step 3: Invoke the dataviz skill, then implement `components/deck/ResultBars.tsx`**

Requirements the tests pin down:
- One row per entry in `labels`, in `labels` order — never sorted by count, or bars would reorder mid-vote and the room would lose track.
- `data-testid` attributes: `bar-<optionId>`, `count-<optionId>`, and `pct-<optionId>` (the last rendered **only** when `showPercentages(total)` is true).
- `data-highlight="true" | "false"` on each bar row.
- Guard the percentage math against `total === 0`.
- Bar width is `count / max(1, total) * 100%`, with a CSS transition so bars grow as votes land.
- Projector-legible: large type, high contrast, readable from the back of a room.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/deck/ResultBars.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add components/deck/ResultBars.tsx components/deck/ResultBars.test.tsx
git commit -m "feat(deck): live result bars with an n=5 percentage floor"
```

---

### Task 6: i18n strings for the deck

**Files:**
- Modify: `lib/i18n.ts` (append keys only — change no existing key)
- Test: `lib/i18n.test.ts` (extend)

**Interfaces:**
- Produces: new keys usable via the existing `t(key, lang)` helper.

- [ ] **Step 1: Add a failing test to `lib/i18n.test.ts`**

Append inside the existing top-level `describe`:

```ts
  it('has deck strings in both languages', () => {
    const keys = [
      'deckTitle', 'deckJoinPrompt', 'deckWaiting', 'deckVoteReceived',
      'deckChangeVote', 'deckVotingClosed', 'deckStart', 'deckNext',
      'deckBack', 'deckCloseVoting', 'deckLesson', 'deckPeopleIn', 'deckVotes',
    ] as const
    for (const k of keys) {
      expect(t(k, 'th'), `${k}.th`).toBeTruthy()
      expect(t(k, 'en'), `${k}.en`).toBeTruthy()
      expect(t(k, 'th')).not.toBe(t(k, 'en'))
    }
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run lib/i18n.test.ts`
Expected: FAIL — TypeScript error or falsy value for `deckTitle`.

- [ ] **Step 3: Append the keys to the `STRINGS` object in `lib/i18n.ts`**

Add before the closing brace of `STRINGS`. Do not modify any existing entry:

```ts
  deckTitle:        { th: 'ข้อมูลกับธุรกิจ', en: 'Data in Business' },
  deckJoinPrompt:   { th: 'เข้าร่วมด้วยมือถือของคุณที่', en: 'Join on your phone at' },
  deckWaiting:      { th: 'รอผู้ดำเนินรายการเริ่ม…', en: 'Waiting for the host to start…' },
  deckVoteReceived: { th: '✓ บันทึกคำตอบแล้ว', en: '✓ Vote received' },
  deckChangeVote:   { th: 'เปลี่ยนใจได้ กดใหม่ได้เลย', en: 'Changed your mind? Just tap again' },
  deckVotingClosed: { th: 'ปิดโหวตแล้ว', en: 'Voting closed' },
  deckStart:        { th: '▶ เริ่ม', en: '▶ Start' },
  deckNext:         { th: 'ถัดไป →', en: 'Next →' },
  deckBack:         { th: '← ย้อนกลับ', en: '← Back' },
  deckCloseVoting:  { th: 'ปิดโหวต', en: 'Close voting' },
  deckLesson:       { th: '💡 บทเรียน', en: '💡 Lesson' },
  deckPeopleIn:     { th: 'คนในห้อง', en: 'people in the room' },
  deckVotes:        { th: 'โหวตแล้ว', en: 'votes' },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify no AI Detective string changed**

Run: `git diff lib/i18n.ts`
Expected: only additions (`+` lines). If any `-` line appears other than the closing brace shifting, revert it.

- [ ] **Step 6: Commit**

```bash
git add lib/i18n.ts lib/i18n.test.ts
git commit -m "feat(deck): bilingual strings for the deck surfaces"
```

---

### Task 7: Phone surface

**Files:**
- Create: `app/biz/page.tsx`
- Test: `app/biz/biz.test.tsx`

**Interfaces:**
- Consumes: `PublicDeckState`, `Slide` types; `SLIDES` from `lib/deck.ts`; `t` from `lib/i18n.ts`.
- Produces: the `/biz` route.

Behaviour:
1. On mount, read `playerId` from `localStorage['deck.playerId']`. If absent, `POST /api/deck/join` and store the returned id.
2. Poll `GET /api/deck/state?playerId=<id>` every 1000ms while `votingOpen`, else 2000ms.
3. Drop any response whose `seq` is lower than the last seen (monotonic guard), and keep the last good frame on a fetch or parse error.
4. Render by phase: `lobby` → waiting message; `slide` with a poll/vote → prompt + option buttons; `slide` with reveal/content → "look at the big screen"; `done` → thank-you.
5. Tapping an option `POST`s to `/api/deck/vote`. On `200`, show `deckVoteReceived` plus `deckChangeVote`. On `409`, show `deckVotingClosed`.
6. When `votingOpen` is false, option buttons are disabled.

- [ ] **Step 1: Write the failing test `app/biz/biz.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BizPage from './page'
import { SLIDES } from '@/lib/deck'

const state = (over: Record<string, unknown> = {}) => ({
  seq: 1, phase: 'slide', slideIndex: 0, slideId: SLIDES[0].id,
  votingOpen: true, remainingMs: 20000, playerCount: 3, voteCount: 0,
  tallies: [], youVoted: null, ...over,
})

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true, status: 200, json: async () => handler(String(url), init),
  })))
}

describe('/biz phone surface', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('joins once and stores the player id', async () => {
    mockFetch((url) => url.includes('/join') ? { player: { id: 'p1', joinedAt: 0 } } : state())
    render(<BizPage />)
    await waitFor(() => expect(localStorage.getItem('deck.playerId')).toBe('p1'))
  })

  it('shows the waiting message in lobby', async () => {
    mockFetch((url) => url.includes('/join')
      ? { player: { id: 'p1', joinedAt: 0 } }
      : state({ phase: 'lobby', slideId: null }))
    render(<BizPage />)
    await waitFor(() => expect(screen.getByText(/Waiting for the host|รอผู้ดำเนินรายการ/)).toBeDefined())
  })

  it('renders the current poll options', async () => {
    mockFetch((url) => url.includes('/join') ? { player: { id: 'p1', joinedAt: 0 } } : state())
    render(<BizPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Walked|เดินมา/ })).toBeDefined())
  })

  it('posts a vote when an option is tapped', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(String(url))
      return {
        ok: true, status: 200,
        json: async () => String(url).includes('/join')
          ? { player: { id: 'p1', joinedAt: 0 } } : state(),
      }
    }))
    render(<BizPage />)
    const btn = await screen.findByRole('button', { name: /Walked|เดินมา/ })
    await userEvent.click(btn)
    await waitFor(() => expect(calls.some((c) => c.includes('/api/deck/vote'))).toBe(true))
  })

  it('shows the received state when the server says you voted', async () => {
    mockFetch((url) => url.includes('/join')
      ? { player: { id: 'p1', joinedAt: 0 } }
      : state({ youVoted: 'walk' }))
    render(<BizPage />)
    await waitFor(() => expect(screen.getByText(/Vote received|บันทึกคำตอบแล้ว/)).toBeDefined())
  })

  it('disables options once voting is closed', async () => {
    mockFetch((url) => url.includes('/join')
      ? { player: { id: 'p1', joinedAt: 0 } }
      : state({ votingOpen: false }))
    render(<BizPage />)
    const btn = await screen.findByRole('button', { name: /Walked|เดินมา/ })
    await waitFor(() => expect(btn.hasAttribute('disabled')).toBe(true))
  })

  it('ignores a state frame with a lower seq', async () => {
    let n = 0
    mockFetch((url) => {
      if (url.includes('/join')) return { player: { id: 'p1', joinedAt: 0 } }
      n++
      return n === 1 ? state({ seq: 5, slideIndex: 0 }) : state({ seq: 2, slideIndex: 5, slideId: SLIDES[5].id })
    })
    render(<BizPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Walked|เดินมา/ })).toBeDefined())
    await new Promise((r) => setTimeout(r, 1200))
    expect(screen.getByRole('button', { name: /Walked|เดินมา/ })).toBeDefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/biz/biz.test.tsx`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Implement `app/biz/page.tsx`**

A `'use client'` component meeting the behaviours listed above and the test expectations. Reuse the polling/monotonic-seq/last-good-frame approach already used in `app/page.tsx` — read that file first and follow its structure. Option buttons must expose their label as accessible text so `getByRole('button', { name })` resolves.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/biz/biz.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add app/biz/page.tsx app/biz/biz.test.tsx
git commit -m "feat(deck): phone surface with anonymous join and vote-change"
```

---

### Task 8: TV surface

**Files:**
- Create: `app/biz/tv/page.tsx`
- Test: `app/biz/tv/tv.test.tsx`

**Interfaces:**
- Consumes: `ResultBars`; `SLIDES`, `slideAt` from `lib/deck.ts`; `t` from `lib/i18n.ts`.
- Produces: the `/biz/tv` route.

Behaviour:
1. Host-token box (top-right), persisted to `localStorage['deck.hostToken']` — mirror `app/tv/page.tsx`'s implementation, including showing that the token is required before Start works.
2. Lobby: title, join URL built from `window.location.origin + '/biz'`, a QR code of it (`qrcode.react`, already a dependency), and the live `playerCount`.
3. Slide rendering by kind:
   - `poll` / `vote` — prompt, countdown, live `ResultBars`, and `voteCount` / `playerCount`.
   - `reveal` — headline, body, `deckLesson` label + lesson, and `ResultBars` for `forSlideId` with `highlightOptionId` set to that slide's `bestOptionId` when it is a `vote`.
   - `content` — headline and bullets.
4. Controls: **Start** (lobby only), **Back**, **Close voting** (only while `votingOpen`), **Next**. All `POST /api/deck/control` with the token header. A `403` surfaces a visible "check your host token" error.
5. `done`: closing screen.

- [ ] **Step 1: Write the failing test `app/biz/tv/tv.test.tsx`**

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BizTvPage from './page'
import { SLIDES } from '@/lib/deck'

const revealIndex = SLIDES.findIndex((s) => s.kind === 'reveal')
const contentIndex = SLIDES.findIndex((s) => s.kind === 'content')

const state = (over: Record<string, unknown> = {}) => ({
  seq: 1, phase: 'slide', slideIndex: 0, slideId: SLIDES[0].id,
  votingOpen: true, remainingMs: 20000, playerCount: 4, voteCount: 2,
  tallies: [
    { optionId: 'walk', count: 1 }, { optionId: 'train', count: 1 },
    { optionId: 'car', count: 0 }, { optionId: 'moto', count: 0 },
  ],
  ...over,
})

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: status < 400, status, json: async () => body })))
}

describe('/biz/tv', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('shows the join URL and player count in lobby', async () => {
    mockFetch(state({ phase: 'lobby', slideId: null, tallies: [] }))
    render(<BizTvPage />)
    await waitFor(() => expect(screen.getByText(/\/biz/)).toBeDefined())
    expect(screen.getByText(/4/)).toBeDefined()
  })

  it('renders a poll prompt with live bars', async () => {
    mockFetch(state())
    render(<BizTvPage />)
    await waitFor(() => expect(screen.getByText(/How did you get here|เดินทางมาที่นี่/)).toBeDefined())
    expect(screen.getByTestId('bar-walk')).toBeDefined()
  })

  it('renders a reveal with its lesson', async () => {
    const reveal = SLIDES[revealIndex]
    mockFetch(state({ slideIndex: revealIndex, slideId: reveal.id, votingOpen: false }))
    render(<BizTvPage />)
    await waitFor(() => {
      if (reveal.kind !== 'reveal') throw new Error('fixture drift: expected a reveal slide')
      expect(screen.getByText(reveal.lesson.en)).toBeDefined()
    })
  })

  it('renders the closing content slide bullets', async () => {
    const close = SLIDES[contentIndex]
    mockFetch(state({ slideIndex: contentIndex, slideId: close.id, votingOpen: false, tallies: [] }))
    render(<BizTvPage />)
    await waitFor(() => {
      if (close.kind !== 'content') throw new Error('fixture drift: expected a content slide')
      expect(screen.getByText(close.bullets[0].en)).toBeDefined()
    })
  })

  it('saves the host token to localStorage as it is typed', async () => {
    mockFetch(state({ phase: 'lobby', slideId: null, tallies: [] }))
    render(<BizTvPage />)
    const input = await screen.findByRole('textbox')
    await userEvent.type(input, 'secret')
    await waitFor(() => expect(localStorage.getItem('deck.hostToken')).toBe('secret'))
  })

  it('hides Close voting when voting is already closed', async () => {
    mockFetch(state({ votingOpen: false }))
    render(<BizTvPage />)
    await waitFor(() => expect(screen.queryByRole('button', { name: /Close voting|ปิดโหวต/ })).toBeNull())
  })

  it('surfaces a visible error when control returns 403', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) =>
      String(url).includes('/control')
        ? { ok: false, status: 403, json: async () => ({ error: 'forbidden' }) }
        : { ok: true, status: 200, json: async () => state() },
    ))
    render(<BizTvPage />)
    const next = await screen.findByRole('button', { name: /Next|ถัดไป/ })
    await userEvent.click(next)
    await waitFor(() => expect(screen.getByText(/token/i)).toBeDefined())
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run app/biz/tv/tv.test.tsx`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Implement `app/biz/tv/page.tsx`**

Read `app/tv/page.tsx` first and mirror its host-token handling, polling, and QR usage. Note the AI Detective TV renders Thai headings in the `Press Start 2P` pixel font, which has no Thai glyphs and renders them small and baseline-misaligned; for this deck, use the pixel font for **Latin/numeric** display text only and a Thai-capable font for prompts and body copy.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run app/biz/tv/tv.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add app/biz/tv/page.tsx app/biz/tv/tv.test.tsx
git commit -m "feat(deck): TV surface with QR lobby, live bars and host controls"
```

---

### Task 9: Full-suite check and LAN playthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the whole suite and the type-checker**

```bash
npm test
npx tsc --noEmit
```

Expected: all tests pass (168 existing + ~71 new); `tsc` exits 0 with no output.

- [ ] **Step 2: Confirm no AI Detective file was modified**

```bash
git diff --stat main..HEAD -- lib/game.ts lib/store.ts lib/types.ts lib/stats.ts \
  lib/scoring.ts content/cases.ts app/page.tsx app/tv app/dashboard \
  app/api/state app/api/join app/api/answer app/api/control app/api/reset
```

Expected: **empty output.** Any output is a Global Constraints violation — revert those changes.

- [ ] **Step 3: Build and start on the LAN**

```bash
npm run build
npm run start:lan
ipconfig getifaddr en0
```

- [ ] **Step 4: Drive a full playthrough over the LAN IP, not localhost**

Using Playwright against `http://<lan-ip>:3000`, with at least two phone contexts:

1. Open `/biz/tv`, enter the host token, confirm the QR and join URL render.
2. Join from two phone contexts; confirm `playerCount` reaches 2 on the TV.
3. Start; vote from both phones on slide 0; confirm bars move on the TV.
4. Change one phone's vote; confirm the tally shifts and `voteCount` stays 2.
5. Close voting; confirm both phones disable and a further vote returns 409.
6. Step Next through all ten slides; confirm every slide kind renders.
7. Press Back once; confirm earlier votes are still shown.
8. Confirm zero console errors on every surface.

**This must run against the LAN IP.** Testing only on localhost is what hid the `allowedDevOrigins` hydration failure in AI Detective — the pages render but nothing is clickable, and localhost never reproduces it.

- [ ] **Step 5: Add the deck to the README**

Add `/biz` and `/biz/tv` to the URL table, with a short section describing the 15-minute workshop and noting that both workshops run from the same server.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: add the Data in Business deck to the run guide"
```

---

## Notes for the implementer

- **The `bestOptionId` is not a score.** It selects which bar to highlight on the reveal. Do not add scoring, a leaderboard, or per-player results — the spec rules them out (§6), and they would undercut the collective-result payoff.
- **Bars never reorder.** Always render in the slide's option order. Sorting by count makes bars swap places mid-vote and the room loses the thread.
- **The n=5 floor is deliberate.** Expo crowds are small; "67%" from three people is not a statistic. Counts always show.
- **The ฿ figures in `content/deck.ts` are illustrative** and were flagged for the facilitator to sanity-check against real Bangkok café economics. If asked to change them, only `content/deck.ts` needs editing.

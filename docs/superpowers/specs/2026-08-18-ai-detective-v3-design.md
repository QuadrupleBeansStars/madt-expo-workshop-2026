# AI Detective — "คดีเป็ดปากดี" Design Spec (v3)

**Workshop:** MADT Expo, **23 August 2026**
**Format:** ~8 minutes, **~100 concurrent players** on their own phones, one projector in the room
**Key message:** *เราเชื่อ AI ได้ไม่ถึง 100% — ยังต้องมีคนคอยตรวจ (Human in the loop)*

> **Supersedes** `2026-07-17-ai-detective-kahoot-design.md` for **interaction, content, and the
> closing beat**. It does **not** supersede that spec's infrastructure: §2 (architecture), §2a (the
> authoritative clock), §2e (network risk), §3 (offline asset bundling) carry over **unchanged and
> are still binding**. The Decision Room (`/biz`, `/play`) is **untouched by this spec**.
>
> The room grew from ~20 players to ~100, and the 3 Aug run-through plus this redesign found the
> real problem: **four long Thai option labels cannot be read inside one answer window.** Players
> guessed or copied their neighbour. v3 removes reading from the critical path.

---

## 1. What changes, in one table

| | v2 (shipped) | v3 (this spec) |
| --- | --- | --- |
| Answer | 4 option cards, long labels | **2 buttons: ผ่าน / ตีกลับ** |
| Player's role | นักสืบจับผิดเป็ด | **คนที่ตรวจงานของเป็ดก่อนปล่อยผ่าน** |
| Rounds | 5 cases, 45–60 s | **9 questions, 15 s**, in 3 acts of 3 |
| Evidence | Case File on the projector | **removed** — the duck's one sentence is the whole case |
| Lesson | per case (`failureMode` + `checkNextTime`) | **per act** (one card every 3 questions) |
| Anti-guess | none needed (1-in-4) | **streak multiplier** (1-in-2 needs it) |
| Ending | final leaderboard | **room tally → host's closing → podium** |
| Content | 5 bilingual cases | **9 Thai-only questions**, general knowledge |

**Carried over unchanged:** the server-authoritative store and its JSON persistence, the
authoritative clock, `FACILITATOR_TOKEN` on all control routes, ~1 s polling with the
monotonic-sequence guard, offline font bundling, `npm run check:projector`.

---

## 2. Concept

The duck is **the player's assistant**, not an opponent. It sends over 9 answers; the player's job
is to check each one before letting it out. Two buttons, 15 seconds, no reading beyond one question
line and one duck sentence.

Every act is **one trick, three times**. The room catches the pattern by the second or third
question on its own; the act card then only has to **give it a name**. The lesson arrives after the
feeling, never before it.

**The whole design exists to make one closing sentence land.** The host never says "Human in the
loop" until the end — at which point it is not a new term to memorise, it is *the name of what the
room has been doing for nine rounds.*

---

## 3. Game flow

```
lobby
  → q1 → reveal1 → q2 → reveal2 → q3 → reveal3 → ACT CARD 1
  → q4 → reveal4 → q5 → reveal5 → q6 → reveal6 → ACT CARD 2
  → q7 → reveal7 → q8 → reveal8 → q9 → reveal9 → ACT CARD 3
  → ROOM TALLY → PODIUM → done
```

| Phase | Duration | Advances by |
| --- | --- | --- |
| `question` | **15 s** | server timer, **or** early once every active player has answered |
| `reveal` | **12 s** | **auto** — this is what makes it feel rapid |
| `actcard` | untimed | **host** (they talk over it, ~30 s) |
| `tally` | untimed | **host** (they deliver the closing line here) |
| `podium` | untimed | **host** ends the session |

**Host controls: `Start`, `Next`, `Hold`.** `Hold` freezes the reveal auto-advance so a host can
comment on a question that surprised the room — it is the one escape hatch, and it never skips a
phase.

> **AMENDED 2026-08-18, final whole-branch review.** This spec originally said "`Next` only does
> something on the three untimed phases (`actcard`, `tally`, `podium`)" — i.e. two separate v2
> controls, `revealNow` (during `question`) and `nextRound` (during `reveal`), would stay separate
> in v3 and a plain `Next` would be inert everywhere else.
>
> **What shipped instead: `Next` is universal.** `lib/store.ts#next` calls the phase machine's
> `nextState` unconditionally (guarded only against `lobby`/`podium`, which have their own forward
> paths), so one press ends whichever phase is current — `question`, `reveal`, or an untimed one —
> exactly the way `revealNow` and `nextRound` each did in v2, now as one function instead of two.
>
> **Why the ruling went the other way, not the code:** `scripts/check-projector-fit.mjs` has to
> walk all nine questions, nine reveals, three act cards, the tally and the podium — in a real
> browser, without waiting out real 15s/12s clocks — to measure every phase at both projector
> shapes before every workshop. A `Next` that is inert during `question`/`reveal` gives that script
> no way to close either early; it would have to either wait out real timers (turning a pre-flight
> check into a multi-minute one) or grow a second, timer-bypassing code path that only the check
> script uses — untested by the very host controls it exists to protect. A universal `Next` needs
> no such fork: the check script drives the room with the SAME control the host's own finger uses.
>
> **What this costs, and where it is paid:** a universal `Next` reopens the double-tap hazard on
> `question`/`reveal` that v2 never had (two quick presses could skip a question's whole answer
> window). The cost is paid with a **server-side guard** (`lib/store.ts#next`, constant
> `NEXT_GUARD_MS` in `lib/game.ts`): a `next` inside `NEXT_GUARD_MS` of the previous successful
> advance is a true no-op. The client's disabled Next button (`app/tv/page.tsx`) is feedback layered
> on top, not the guarantee — it is per-tab state that a refresh, a second `/tv` tab, or a slow POST
> all defeat on their own, and a laptop screen plus a projector, both open, is a real configuration
> on the day.

Budget: 9×15 s + 9×12 s + 3×30 s + 45 s + 60 s = **7:18**. The three act cards and the tally
are where the host talks; anything beyond those allowances is on top.

---

## 4. Answering and scoring

### 4a. The verdict

Each question carries `verdict: 'pass' | 'reject'` — the **correct action**, not "is the duck
right". A player is correct when their button matches the verdict. First-answer-wins, server-timed,
exactly as v2.

### 4b. Streak multiplier — the anti-guess mechanic

With two buttons, a guesser is right 50% of the time. Points alone cannot separate thinking from
coin-flipping, so:

| Consecutive correct | Multiplier |
| --- | --- |
| 1st | ×1 |
| 2nd | ×2 |
| 3rd and beyond | ×3 |

`BASE_POINTS = 100`, flat (there is no per-question difficulty tier in v3). A wrong answer scores 0
**and resets the streak to zero.** A missed answer counts as wrong for the streak.

**No penalty points.** The room is mixed-age strangers; a scoring system that punishes makes people
stop pressing, and a silent room teaches nothing.

### 4c. The speed bonus stays a tiebreaker only

Carried over from v2's `lib/scoring.ts`, with the invariant re-derived for 9 rounds:

> **INVARIANT:** `ROUND_COUNT * MAX_SPEED_BONUS < BASE_POINTS`
> `9 * 10 = 90 < 100` ✓

So a perfectly fast player can never out-score a slower player who got one more question right.
`MAX_SPEED_BONUS = 10`. The bonus is **not** multiplied by the streak — multiplying it would break
the invariant above, which a test must assert.

### 4d. Why the answer key is what it is

`pass` sits at **questions 2, 5, and 8**. This is load-bearing, not cosmetic:

> **INVARIANT:** no three consecutive `reject` questions.

A player who taps ตีกลับ every time gets 6 of 9 right but **never reaches ×3**, so they cannot beat
anyone who is actually thinking. A test computes the longest `reject` run from the content and fails
above 2.

The `pass` questions must also **sound suspicious** (see §6). A `pass` question that sounds obviously
true traps nobody, and question 5 in particular exists to catch the player who over-corrected into
rejecting everything — *ระแวงทุกอย่างไม่ใช่การคิด มันแค่เดาอีกทิศ.*

### 4e. The room tally

One counter, computed at `tally`:

```
wrongPass = count of (player, question) pairs where
            question.verdict === 'reject' AND player pressed ผ่าน
```

**Only wrong passes count** — rejecting a true answer is not counted. The closing line is about
letting bad information out, not about being too strict, and the number on screen must mean exactly
what the host says it means.

Each phone shows the same figure for that player alone. The projector shows the room total plus the
denominator (`playerCount × 9`).

---

## 5. Surfaces

### 5a. Projector (`/tv`)

| Phase | On screen |
| --- | --- |
| `question` | Timer bar pinned to the top edge (**a bar, not digits** — readable from the back row) · question number + act pips · **streak chip** · the question line · duck + speech bubble · "N/100 ตรวจแล้ว" |
| `reveal` | Verdict stamp slamming in at ~7° · what is actually true · **the room split bar** (X% กดผ่าน / Y% ตีกลับ) · **TOP 5 leaderboard** sliding in |
| `actcard` | The trick's Thai name (large) + English (small) · what just happened three times · three chips naming the three subjects · **"ถ้าเป็นงานจริง" line** |
| `tally` | One number, full screen, plus the framed line *"ถ้านี่เป็นงานจริง — คือข้อมูลผิด N ชิ้นที่ถูกส่งออกไปในชื่อของเรา"* |
| `podium` | Blocks rise 3 → 2 → 1, avatars drop in after their block, confetti |

**Top 5 only.** 100 names do not fit and never will; the projector shows the top of the room and the
phone carries each player's own rank. This is a hard constraint on the leaderboard component.

### 5b. Phone (`/`)

| Phase | On screen |
| --- | --- |
| `question` | Question line + **two full-width buttons**: `✓ ผ่าน` (green) / `✕ ตีกลับ` (red). Nothing else. |
| `reveal` | ถูก/ผิด · points earned · **"อันดับ N จาก 100"** |
| `actcard` | 👀 **ดูจอใหญ่** — deliberately nothing to read, so nobody is looking down during the lesson |
| `tally` | "X ครั้งที่คุณกดผ่านให้คำตอบที่ผิด" |
| `podium` | Own rank + own wrong-pass count |

**Both buttons must be reachable without scrolling at 390×844.** v2 cleared this by 4 px; v3's phone
screen is far lighter, but `npm run check:projector`'s phone walk still gates it.

### 5c. Avatars

Assigned at join, **deterministically from `playerId`** — no character-select step. They appear in
the leaderboard rows and on the podium so a player can find themselves.

---

## 6. Content — the nine questions

Thai general knowledge. No question requires knowing anything about AI. Difficulty comes from
choosing **things people are confident they know, where the confident belief is wrong** — never from
obscurity. Every reveal must be understandable in one sentence.

### Act 1 — ตอบเหมือนเพิ่งไปเปิดดูมา · *CONFIDENT · NEVER CHECKED*
*Tell: ข้อมูลนี้เปลี่ยนได้ไหม และมันบอกที่มาหรือเปล่า*

| # | ถาม | เป็ดตอบ | ต้อง | ที่จริง |
| --- | --- | --- | --- | --- |
| 1 | คนไทยดื่มกาแฟเฉลี่ยคนละกี่แก้วต่อปี | "เฉลี่ย 340 แก้วต่อคนต่อปี" | **ตีกลับ** | ความเป๊ะที่ไม่มีที่มา ไม่ระบุว่าใครสำรวจ ปีไหน |
| 2 | กล้วยจัดเป็นเบอร์รี่จริงหรือเปล่า | "จริง กล้วยเป็นเบอร์รี่ สตรอว์เบอร์รี่ไม่ใช่" | **ผ่าน** | ถูกตามนิยามพฤกษศาสตร์ — ฟังดูเหมือนแกล้ง แต่เป็นนิยามที่นิ่ง |
| 3 | ตอนนี้ประเทศไหนมีประชากรมากที่สุด | "จีน ประมาณ 1,400 ล้านคน" | **ตีกลับ** | อินเดียแซงตั้งแต่ปี 2023 — คำตอบที่**เคยถูก** |

**ถ้าเป็นงานจริง:** ตัวเลขในสไลด์ที่ตอบไม่ได้ว่าเอามาจากไหน ตอนลูกค้าถามกลางห้องประชุม

### Act 2 — เชื่อคำถามของเรา · *IT BELIEVES YOUR PREMISE*
*Tell: มันไม่เคยแก้คำถามเรา — ความผิดอยู่ในคำถาม ไม่ใช่คำตอบ*

| # | ถาม | เป็ดตอบ | ต้อง | ที่จริง |
| --- | --- | --- | --- | --- |
| 4 | ทำไมปลายลิ้นถึงรับรสหวานได้ดีที่สุด | "เพราะปุ่มรับรสหวานกระจุกที่ปลายลิ้น" | **ตีกลับ** | แผนที่ลิ้นเป็นความเข้าใจผิด ลิ้นทุกส่วนรับได้ทุกรส |
| 5 | ทำไมฮิปโปอันตรายต่อคนมากกว่าสิงโต | "หวงถิ่นมาก ตัวใหญ่ วิ่งบนบกเร็วกว่าคน" | **ผ่าน** | คำถามถูก คำตอบถูก — ท่าเดิมไม่ได้แปลว่าผิดเสมอ |
| 6 | ทำไมหน้าร้อนถึงร้อน เพราะโลกเข้าใกล้ดวงอาทิตย์ใช่ไหม | "ใช่ วงโคจรเป็นวงรี…" | **ตีกลับ** | ฤดูเกิดจากแกนโลกเอียง และซีกโลกเหนือร้อนตอนโลกอยู่**ไกล**ที่สุดพอดี |

**ถ้าเป็นงานจริง:** ข้อสรุปที่เราอยากได้อยู่แล้ว แล้วให้ AI หาเหตุผลมารองรับ

### Act 3 — สวมชื่อคนอื่น · *IT PUTS WORDS IN REAL MOUTHS*
*Tell: ทุกชิ้นส่วนมีอยู่จริง มีแค่ความเชื่อมโยงที่ไม่มี*

| # | ถาม | เป็ดตอบ | ต้อง | ที่จริง |
| --- | --- | --- | --- | --- |
| 7 | ไอน์สไตน์เคยพูดเรื่อง "ตัดสินปลาจากการปีนต้นไม้" จริงไหม | "จริง ไอน์สไตน์กล่าวไว้ว่า…" | **ตีกลับ** | ไม่มีหลักฐานว่าเขาเคยพูด เป็นคำคมที่ถูกสวมชื่อภายหลัง |
| 8 | กำแพงเมืองจีนยาวรวมกี่กิโลเมตร | "ประมาณ 21,000 กม. ถ้านับรวมทุกยุค" | **ผ่าน** | ถูก — และ**มันบอกเงื่อนไขเอง** ซึ่งเป็นสัญญาณที่ดี |
| 9 | องค์การอนามัยโลกแนะนำให้เดินวันละกี่ก้าว | "WHO แนะนำ 10,000 ก้าวต่อวัน" | **ตีกลับ** | WHO ไม่เคยแนะนำเป็นจำนวนก้าว เลขนี้มาจากชื่อสินค้าเครื่องนับก้าวญี่ปุ่นปี 1965 |

**ถ้าเป็นงานจริง:** อ้างชื่อองค์กรหรือคนดังผิดกลางห้องประชุม — **เสียความน่าเชื่อถือ ไม่ใช่แค่เสียงาน**

### 6a. Content integrity rules (tightened from v1 §7)

- **Never fabricate a source that imitates a real outlet, journal, or case number.** v3 satisfies
  this by construction: act 3 uses **real misattributions that actually happen in the world**, which
  teaches harder than an invented journal and forges nothing.
- Every `reject` question's `truth` must be **checkable by a member of the audience on their phone
  within a minute.** If it cannot be checked on the spot, it cannot be defended on stage.
- Facilitator verification list, carried in the content file as `needsCheck` and **not rendered**:
  - **Q1** — confirm 340 does not coincide with a real published figure; change the number if it does.
  - **Q5** — have one citation ready for the hippo claim in case someone challenges it.
  - **Q8** — have one citation ready for 21,000 km; someone will quote the Ming-era ~8,000 km figure.

### 6b. Language — **DECIDED: Thai only**

Confirmed 2026-08-18. All player-facing copy is **Thai**, with English used only for an act's
subtitle name (`nameEn`, e.g. *IT BELIEVES YOUR PREMISE*) as a typographic accent on the act card.

Consequences, all intended:

- `Question` and `Act` fields are **plain `string`**, not `LocalizedText`. No `th`/`en` pairs.
- **`LangToggle` is removed from the phone** and `lib/i18n.ts` is no longer used by AI Detective.
  Both stay in the tree only if The Decision Room needs them — check before deleting.
- The content tests drop every "both languages present" assertion inherited from v1/v2.

Rationale: the reading budget is the whole point of v3, and The Decision Room already ships
Thai-only. Adding English later would mean re-deciding the schema, so this is a real fork, taken
deliberately.

---

## 7. Data model

Replaces `content/cases.ts`. Proposed `content/questions.ts`:

```ts
export type Verdict = 'pass' | 'reject'

export type Question = {
  id: string
  act: 1 | 2 | 3
  order: number          // 1..9, unique, matches play order
  ask: string            // ONE line. The projector renders it at one size.
  duckSays: string       // ONE sentence.
  highlight: string      // exact substring of duckSays, marked on reveal
  verdict: Verdict       // the CORRECT ACTION, not "is the duck right"
  truth: string          // what is actually true — the reveal body
  tell: string           // how you would have caught it
  needsCheck?: string    // facilitator note, never rendered
}

export type Act = {
  n: 1 | 2 | 3
  nameTh: string
  nameEn: string
  body: string           // what just happened three times
  atWork: string         // the "ถ้าเป็นงานจริง" line — feeds the closing
  chips: [string, string, string]   // the three subjects of this act
}
```

`StoryPanel` / `Storyboard` are **not used** by v3 — the storyboard strip is dropped along with the
Case File. The types stay in `lib/types.ts` because The Decision Room still uses them.

---

## 8. Tests (write these first)

Content, in `content/questions.test.ts`:

1. exactly 9 questions; `order` values are exactly 1..9; ids unique
2. exactly 3 acts, exactly 3 questions each, acts match order ranges
3. exactly 3 `pass` verdicts, at orders **2, 5, 8**
4. **longest run of consecutive `reject` ≤ 2** (§4d) — computed from content, not hardcoded
5. every `highlight` is a substring of its `duckSays`
6. `ask` and `duckSays` are within their length caps (the projector budget)
7. every question has non-empty `truth` and `tell`
8. every act has non-empty `atWork`

Scoring, in `lib/scoring.test.ts`:

9. `ROUND_COUNT * MAX_SPEED_BONUS < BASE_POINTS` (§4c)
10. streak multiplier is 1, 2, 3, 3, 3… and resets to 0 on a wrong or missed answer
11. speed bonus is **not** multiplied by the streak
12. a player who answers `reject` on all 9 never reaches a ×3 multiplier

Store, in `lib/store.test.ts`:

13. `wrongPass` counts only `verdict === 'reject'` answered `ผ่าน` (§4e)
14. phase machine walks lobby → 9×(question, reveal) with act cards after orders 3, 6, 9 → tally → podium → done
15. `Hold` freezes reveal auto-advance and never changes phase

Layout: `npm run check:projector` must pass at 1600×900 **and** 1366×768 for all five phase types,
and the phone walk must reach both buttons without scrolling at 390×844.

---

## 9. Code that changes

| File | What happens |
| --- | --- |
| `content/cases.ts` | replaced by `content/questions.ts` |
| `lib/game.ts` | new phase machine (5 phase kinds, act boundaries, hold) |
| `lib/scoring.ts` | flat base + streak multiplier; invariant re-derived for 9 rounds |
| `lib/store.ts` | streak state per player, `wrongPass` tally, avatar assignment |
| `lib/types.ts` | `Question` / `Act`; `StoryPanel` kept for The Decision Room |
| `app/page.tsx` | two buttons; remove `AnswerCards` and `LangToggle` (§6b) |
| `app/tv/page.tsx` | five phase renderers; remove `CaseFile` |
| `components/game/` | `CaseFile`, `AnswerCards`, `Storyboard` retired; add `Stamp`, `SplitBar`, `ActCard`, `Tally`, `Podium` |
| `app/api/*` | unchanged shapes except the answer payload carries a verdict button, not an option id |

Already-dead v1 code (`app/reveal/`, `components/CaseScreen.tsx`, `components/ResultScreen.tsx`,
`components/Retrieval.tsx`) is deleted in this pass — v3 is the point at which nothing references it.

`lib/sim.ts`, `lib/pricing.ts`, `content/room*.ts`, `app/biz`, `app/play` — **untouched.**

---

## 10. Out of scope (YAGNI)

- Websockets/SSE — 1 s polling is invisible at this room size and is already hardened
- Mid-game join — sessions are scheduled and seated; latecomers spectate, as in v2
- Character select — avatars are derived from `playerId`
- Per-question difficulty tiers — the acts carry difficulty; a second axis buys nothing
- Persisting results between sessions — the room resets and that is the whole story

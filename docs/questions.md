# The nine questions — what each one teaches

Reference for the team. Everything here is transcribed from
[`content/questions.ts`](../content/questions.ts), which is the single source of truth. If you edit
a question, edit it there and update this file.

> **Looking for *why* a question is built the way it is, or wanting to change one?** That is
> [`docs/question-design.md`](question-design.md) — the design intent for both workshops, with the
> knob to turn and the thing not to break for each question. This file is the facts; that one is
> the argument.

---

## The arc

Nine questions, three acts of three, each act closing on an untimed **act card** that names the
trick the room has just felt three times. Verdict is the **correct action** — ✓ ผ่าน (let it
through) or ✕ ตีกลับ (send it back) — not "is the duck right"; the two happen to coincide on every
question (see `content/questions.ts`'s own header comment), but the copy everywhere else — the
phone's buttons, the reveal's `truthLabel` — is written against the action, never against "was the
AI wrong," so it still reads correctly on a hypothetical future question where they diverge.

**Question 1's job is to catch the room out, not to warm it up.** v3 opened on `coffee-cups` — an
invented statistic with no source, deliberately easy, so the room would dare to press a button. It
worked, and the cost was that players entered the game feeling they could spot a fake, which is the
wrong posture for a workshop about not trusting an answer because it sounds confident. v3.1 opens
on `most-populous` instead: nearly everyone approves it, because everyone learned that China is the
most populous country and nothing prompts you to re-check a fact that settled years ago. The duck
is not lying there — it is answering with something that *was* true until 2023, which is act 1's
trick in its sharpest form, and the correction is checkable on a phone in ten seconds, so the doubt
it creates is earned rather than asserted. `coffee-cups` keeps every word it had and moves to 3.

The swap was safe by construction and the test suite proves it without being edited: both questions
are `reject` and both are in act 1, so the three `pass` positions stay at 2/5/8, the
no-three-consecutive-`reject` rule still holds, and no act boundary moves.

| Act | # | id | ถาม (question) | ต้อง (verdict) |
|---|---|---|---|---|
| 1 — ตอบเหมือนเพิ่งไปเปิดดูมา | 1 | `most-populous` | ตอนนี้ประเทศไหนมีประชากรมากที่สุดในโลก? | **ตีกลับ** |
| 1 | 2 | `banana-berry` | กล้วยจัดเป็นเบอร์รี่จริงหรือเปล่า? | **ผ่าน** |
| 1 | 3 | `coffee-cups` | คนไทยดื่มกาแฟเฉลี่ยคนละกี่แก้วต่อปี? | **ตีกลับ** |
| 2 — เชื่อคำถามของเรา | 4 | `tongue-map` | ทำไมปลายลิ้นถึงรับรสหวานได้ดีที่สุด? | **ตีกลับ** |
| 2 | 5 | `hippo-danger` | ทำไมฮิปโปถึงอันตรายต่อคนมากกว่าสิงโต? | **ผ่าน** |
| 2 | 6 | `summer-distance` | ทำไมหน้าร้อนถึงร้อน เพราะโลกเข้าใกล้ดวงอาทิตย์ใช่ไหม? | **ตีกลับ** |
| 3 — สวมชื่อคนอื่น | 7 | `einstein-fish` | ไอน์สไตน์เคยพูดเรื่องตัดสินปลาจากการปีนต้นไม้จริงไหม? | **ตีกลับ** |
| 3 | 8 | `great-wall-length` | กำแพงเมืองจีนยาวรวมทั้งหมดกี่กิโลเมตร? | **ผ่าน** |
| 3 | 9 | `who-steps` | องค์การอนามัยโลกแนะนำให้เดินวันละกี่ก้าว? | **ตีกลับ** |

**Why `pass` sits at 2, 5, and 8, exactly:** a player who taps ตีกลับ every time gets 6 of 9 right
but never strings together three correct answers in a row, so they can never reach the streak's ×3
multiplier (`lib/scoring.ts`) and cannot beat anyone who is actually reading the question.
`content/questions.test.ts` also asserts the *longest run of consecutive `reject` questions is ≤2* —
computed from the content, not hardcoded — so moving a `pass` question is a test failure, not a
style choice.

## A note on the evidence

v3 carries no Case File, no retrieval manifest, no `found: false` flag — that entire mechanic left
with v2. What each question shows the room is the duck's **one sentence** (`duckSays`) and, on
reveal, `truth` (what is actually correct) and `tell` (how you would have caught it, on your own,
without a projector). Content rule, unchanged from v1/v2 and tightened in the spec: **never
fabricate a source that imitates a real outlet, journal, or case number.** Act 3 satisfies this by
construction — it uses real misattributions that actually happen in the world (a quote pinned on
Einstein, a Great Wall length, a WHO step count) rather than inventing a fourth kind.

## Facilitator verification — the three `needsCheck` items

Declared in `content/questions.ts`, **never rendered anywhere in the UI**. These are the claims
worth having a citation ready for if someone in the room pushes back — read them before you
facilitate, not during.

- **Q3 (`coffee-cups`)** — confirm 340 (แก้วต่อคนต่อปี) does not coincide with a real published
  figure for Thai coffee consumption; change the number if it does. The question's whole point is
  that the figure is *invented*, so it must not accidentally turn out to be true.
- **Q5 (`hippo-danger`)** — have one citation ready for the hippo-vs-lion human-fatality claim. This
  is the act's `pass` question — the AI is right here — so a challenge from the room is a chance to
  back up a correct answer, not defend a wrong one.
- **Q8 (`great-wall-length`)** — have one citation ready for the ~21,000km figure (the length
  counting every dynasty's construction). Someone will quote the Ming-era figure (~8,000km) — that
  number is also real, it just answers a narrower question than the one asked.

---

## Act 1 — ตอบเหมือนเพิ่งไปเปิดดูมา (CONFIDENT · NEVER CHECKED)

*Tell: ข้อมูลนี้เปลี่ยนได้ไหม และมันบอกที่มาหรือเปล่า*

**สรุปของ Act (act card's `body`):** ข้อ 2 มันถูก เพราะเป็นนิยามที่ไม่เคยเปลี่ยน ส่วนอีกสองข้อมันตอบด้วยน้ำเสียงเดียวกันเป๊ะ ทั้งที่ข้อหนึ่งไม่มีใครนับ และอีกข้อความจริงเปลี่ยนไปแล้ว

### 1. `most-populous` — ตีกลับ

**ถาม:** ตอนนี้ประเทศไหนมีประชากรมากที่สุดในโลก?
**เป็ดตอบ:** "จีนครับ ประมาณ 1,400 ล้านคน มากที่สุดในโลก"
**ที่จริง:** อินเดียแซงจีนไปตั้งแต่ปี 2023 คำตอบนี้เคยถูก และนั่นทำให้มันอันตรายกว่าคำตอบที่ผิดมาตลอด
**เคล็ดลับ (tell):** คำว่า "ตอนนี้" ถ้าคำตอบต้องสด แต่มันตอบด้วยของที่จำมา ก็คือคำตอบของเมื่อวาน

*Gloss: stale knowledge stated with the same confidence as current knowledge — nothing on screen
signals "this used to be true." This is the opener (v3.1): the room approves it almost to a person,
and the reveal is the first thing that happens to them. See "Question 1's job", above.*

### 2. `banana-berry` — ผ่าน

**ถาม:** กล้วยจัดเป็นเบอร์รี่จริงหรือเปล่า?
**เป็ดตอบ:** "จริงครับ ทางพฤกษศาสตร์กล้วยเป็นเบอร์รี่ ส่วนสตรอว์เบอร์รี่ไม่ใช่"
**ที่จริง:** ถูกตามนิยามพฤกษศาสตร์ เบอร์รี่คือผลจากรังไข่เดียวที่มีเมล็ดอยู่ในเนื้อ ส่วนสตรอว์เบอร์รี่เป็นผลกลุ่ม
**เคล็ดลับ (tell):** ฟังดูเหมือนแกล้ง แต่เป็นนิยามที่นิ่งและตรวจสอบได้ ความรู้สึกว่าแปลกไม่ใช่หลักฐาน

*Gloss: the act's `pass` — genuinely correct, and it sounds like the kind of "well actually" trivia
that primes people to distrust it anyway. That instinct is exactly what this question measures.*

### 3. `coffee-cups` — ตีกลับ

**ถาม:** คนไทยดื่มกาแฟเฉลี่ยคนละกี่แก้วต่อปี?
**เป็ดตอบ:** "เฉลี่ย 340 แก้วต่อคนต่อปีครับ เพิ่มขึ้นจากเมื่อสิบปีก่อนพอสมควร"
**ที่จริง:** เป็ดไม่ได้บอกว่าใครสำรวจ ปีไหน วิธีไหน ตัวเลขเป๊ะๆ ที่ลอยมาเฉยๆ คือของที่มันประกอบขึ้นเอง
**เคล็ดลับ (tell):** ความเป๊ะที่ไม่มีที่มา ยิ่งเลขดูละเอียด ยิ่งต้องถามว่าใครนับ
`needsCheck`: ยืนยันว่า 340 ไม่บังเอิญตรงกับสถิติที่มีคนเผยแพร่จริง ถ้าตรงให้เปลี่ยนตัวเลข

*Gloss: a suspiciously precise number with no cited source, no year, no methodology — the tell is
the precision itself, not the number's plausibility.*

**Act card's `atWork`:** ถ้าเป็นงานจริง คือตัวเลขในสไลด์ที่ตอบไม่ได้ว่าเอามาจากไหน ตอนลูกค้าถามกลางห้องประชุม

---

## Act 2 — เชื่อคำถามของเรา (IT BELIEVES YOUR PREMISE)

*Tell: มันไม่เคยแก้คำถามเรา — ความผิดอยู่ในคำถาม ไม่ใช่คำตอบ*

**สรุปของ Act (act card's `body`):** สองข้อที่ผิด ไม่ได้ผิดที่คำตอบ แต่ผิดที่คำถาม เราใส่สิ่งที่ไม่จริงเข้าไปเอง แล้วมันก็สร้างคำอธิบายมารองรับให้เรียบร้อย

### 4. `tongue-map` — ตีกลับ

**ถาม:** ทำไมปลายลิ้นถึงรับรสหวานได้ดีที่สุด?
**เป็ดตอบ:** "เพราะปุ่มรับรสหวานกระจุกอยู่ที่ปลายลิ้นครับ ส่วนรสขมอยู่โคนลิ้น"
**ที่จริง:** ลิ้นทุกส่วนรับได้ทุกรส แผนที่ลิ้นเป็นความเข้าใจผิดที่ถูกหักล้างไปนานแล้ว คำถามผิดตั้งแต่แรก
**เคล็ดลับ (tell):** เป็ดไม่ได้แก้คำถามเรา มันรับคำถามมาแล้วสร้างคำอธิบายมารองรับ

*Gloss: the classic debunked "tongue map." The question itself assumes something false, and the
duck answers the false premise instead of correcting it.*

### 5. `hippo-danger` — ผ่าน

**ถาม:** ทำไมฮิปโปถึงอันตรายต่อคนมากกว่าสิงโต?
**เป็ดตอบ:** "เพราะฮิปโปหวงถิ่นมาก ตัวใหญ่ และวิ่งบนบกได้เร็วกว่าคนครับ"
**ที่จริง:** ถูกทั้งคำถามและคำตอบ ฮิปโปทำให้คนเสียชีวิตต่อปีมากกว่าสิงโต และเหตุผลที่มันยกมาก็ถูก
**เคล็ดลับ (tell):** ไม่มีตัวแยก และนั่นคือประเด็น ท่าเดิมไม่ได้แปลว่าคำตอบผิดเสมอ

`needsCheck`: เตรียมแหล่งอ้างอิงหนึ่งลิงก์ไว้ให้โฮสต์ เผื่อมีคนแย้งกลางห้อง

*Gloss: the act's `pass` — same confident tone as questions 4 and 6, nothing wrong in either the
question or the answer. Exists so "watch for the leading question" doesn't harden into "distrust
every question."*

### 6. `summer-distance` — ตีกลับ

**ถาม:** ทำไมหน้าร้อนถึงร้อน เพราะโลกเข้าใกล้ดวงอาทิตย์ใช่ไหม?
**เป็ดตอบ:** "ใช่ครับ วงโคจรโลกเป็นวงรี ช่วงที่เข้าใกล้ดวงอาทิตย์ที่สุดเราจึงได้รับความร้อนมากขึ้น"
**ที่จริง:** ฤดูเกิดจากแกนโลกเอียง ไม่ใช่ระยะทาง และซีกโลกเหนืออยู่ในช่วงร้อนตอนที่โลกอยู่ไกลดวงอาทิตย์ที่สุดพอดี
**เคล็ดลับ (tell):** เราใส่ "ใช่ไหม" ลงไปในคำถาม แล้วมันตอบว่า "ใช่ครับ" ทันที

*Gloss: a leading question answered with agreement on reflex — the most direct illustration of the
act's whole lesson.*

**Act card's `atWork`:** ถ้าเป็นงานจริง คือข้อสรุปที่เราอยากได้อยู่แล้ว แล้วให้ AI หาเหตุผลมารองรับ

---

## Act 3 — สวมชื่อคนอื่น (IT PUTS WORDS IN REAL MOUTHS)

*Tell: ทุกชิ้นส่วนมีอยู่จริง มีแค่ความเชื่อมโยงที่ไม่มี*

**สรุปของ Act (act card's `body`):** มันเอาคำคมไปแปะชื่อไอน์สไตน์ และเอาตัวเลขไปแปะชื่อ WHO ทุกชิ้นส่วนมีอยู่จริง มีแค่ความเชื่อมโยงที่ไม่มี

### 7. `einstein-fish` — ตีกลับ

**ถาม:** ไอน์สไตน์เคยพูดเรื่องตัดสินปลาจากการปีนต้นไม้จริงไหม?
**เป็ดตอบ:** "จริงครับ ไอน์สไตน์กล่าวไว้ว่าถ้าตัดสินปลาจากความสามารถในการปีนต้นไม้ ปลาก็จะคิดว่าตัวเองโง่ไปทั้งชีวิต"
**ที่จริง:** ไม่มีหลักฐานว่าไอน์สไตน์เคยพูดประโยคนี้ เป็นคำคมที่ถูกสวมชื่อเขาภายหลังแล้วแพร่ต่อจนกลายเป็นของเขา
**เคล็ดลับ (tell):** คำคมยิ่งดัง ยิ่งถูกสวมชื่อคนดังง่าย ถามหาว่าพูดที่ไหน เมื่อไหร่ ถ้าตอบไม่ได้ก็คือไม่มี

*Gloss: Einstein is real, fish are real, the quote is real (as a quote that exists and circulates) —
only the attribution is invented.*

### 8. `great-wall-length` — ผ่าน

**ถาม:** กำแพงเมืองจีนยาวรวมทั้งหมดกี่กิโลเมตร?
**เป็ดตอบ:** "ประมาณ 21,000 กิโลเมตรครับ ถ้านับรวมทุกช่วงที่สร้างในทุกยุคเข้าด้วยกัน"
**ที่จริง:** ถูก และครั้งนี้มันบอกเงื่อนไขของตัวเลขเอง ซึ่งต่างจากสองข้อที่โยนชื่อใหญ่มาแล้วจบ
**เคล็ดลับ (tell):** คำตอบที่บอกเงื่อนไขของตัวเองมาด้วย เชื่อได้มากกว่าคำตอบที่ยกชื่อใหญ่มาอ้างเฉยๆ

`needsCheck`: เตรียมแหล่งอ้างอิง 21,000 กม. เพราะคนอาจจำตัวเลขยุคหมิง (ราว 8,000 กม.) มาแย้ง

*Gloss: the act's `pass`. The self-qualification ("if you count every era's construction together")
is itself the tell — an answer that states its own scope is more trustworthy than one that doesn't.*

### 9. `who-steps` — ตีกลับ

**ถาม:** องค์การอนามัยโลกแนะนำให้เดินวันละกี่ก้าว?
**เป็ดตอบ:** "WHO แนะนำ 10,000 ก้าวต่อวันครับ เป็นเกณฑ์มาตรฐานด้านสุขภาพ"
**ที่จริง:** WHO ไม่เคยแนะนำเป็นจำนวนก้าว คำแนะนำจริงวัดเป็นนาทีต่อสัปดาห์ ส่วนเลข 10,000 ก้าว มาจากชื่อสินค้าเครื่องนับก้าวของญี่ปุ่นเมื่อปี 1965
**เคล็ดลับ (tell):** ตัวเลขจริง องค์กรจริง แต่ไม่ได้มาจากกันและกัน ทุกชิ้นส่วนตรวจสอบได้ ยกเว้นความเชื่อมโยง

*Gloss: the closing question, and the purest version of the act's lesson — 10,000 is a real number,
WHO is a real organization, and the two have never been connected by WHO itself.*

**Act card's `atWork`:** ถ้าเป็นงานจริง คืออ้างชื่อองค์กรหรือคนดังผิดกลางห้องประชุม เสียความน่าเชื่อถือ ไม่ใช่แค่เสียงาน

---

## Editing

All content lives in `content/questions.ts`, Thai only, no code changes needed.

```bash
npx vitest run content/
```

validates the whole file: exactly 9 questions with unique ids and `order` 1..9; exactly 3 acts of 3,
with act numbers following play order; exactly 3 `pass` verdicts, at orders 2, 5, and 8; the longest
run of consecutive `reject` questions is ≤2 (computed from content); every `highlight` is a real
substring of its `duckSays`; and every question and act satisfies its schema's length caps
(`ask` ≤80 chars, `duckSays` ≤140, `truth` ≤220, `tell` ≤160, an act's `body`/`atWork` ≤220/160).

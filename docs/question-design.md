# What each question is doing to the player

For the team. [`docs/questions.md`](questions.md) is the *reference* — sources, facts, the answer
key's rationale, the facilitator `needsCheck` notes. **This file is the intent**: what we are trying
to make a player feel and think at each question, why they fall for it, and which knob to turn if
you want to change it.

If you disagree with a question, this is the file to argue with. Every section ends with **where to
edit** and **what not to break** — the second one matters more, because most of these questions have
one load-bearing property and a lot of cosmetic text around it.

> Facts come from `content/questions.ts`, `content/persona.ts` and `lib/`. If you change those, change
> this.

---

## The one idea behind both workshops

We are not testing whether people know things. We are testing **whether they check**, and building
the reflex to check in a room where being wrong is free and funny.

That means the questions are designed so that:

- **Reading carefully beats knowing the subject.** Everything needed is on screen.
- **The confident-sounding answer is usually the trap.** That is the whole point.
- **Speed never wins.** Both scoring systems are built so a fast wrong answer loses to a slow right
  one. A workshop that teaches people not to trust snap judgments must not reward snap judgments.

---

# Workshop 1 — AI Detective

Nine questions in three acts of three, each a **15-second** answer window followed by a **12-second,
auto-advancing** reveal. The room reads the question and the duck's one-sentence answer together on
the projector; the phone holds nothing but the question line and two buttons —
**✓ ผ่าน (let it through) / ✕ ตีกลับ (send it back)**. v3 dropped the storyboard and the evidence
panel entirely: the duck's sentence is the whole case, and the checking happens in the room's head,
not on a screen. `docs/questions.md` has the facts (sources, the exact `truth`/`tell` text, the
three facilitator `needsCheck` notes) — this section is why each one is shaped the way it is.

## The arc is the lesson, not any single question

| Act | Name | # | Question | Verdict | What we do to the player |
|---|---|---|---|---|---|
| 1 | ตอบเหมือนเพิ่งไปเปิดดูมา — CONFIDENT · NEVER CHECKED | 1 | most-populous | ตีกลับ | An answer that *was* true, stated as if it still is |
| | | 2 | banana-berry | **ผ่าน** | Sounds like a trick; is a stable definition |
| | | 3 | coffee-cups | ตีกลับ | A precise number with no source |
| 2 | เชื่อคำถามของเรา — IT BELIEVES YOUR PREMISE | 4 | tongue-map | ตีกลับ | Accepts a false premise baked into the question |
| | | 5 | hippo-danger | **ผ่าน** | Same confident tone — nothing wrong this time |
| | | 6 | summer-distance | ตีกลับ | "…ใช่ไหม?" answered "ใช่" on reflex |
| 3 | สวมชื่อคนอื่น — IT PUTS WORDS IN REAL MOUTHS | 7 | einstein-fish | ตีกลับ | A real quote, pinned on the wrong real person |
| | | 8 | great-wall-length | **ผ่าน** | Right, and it states its own caveat |
| | | 9 | who-steps | ตีกลับ | Real number, real org, invented link between them |

**Question 1 is chosen to be got wrong.** v3 opened on `coffee-cups`, which is easy on purpose so
the room would dare to press a button at all; the side effect was that players started the game
believing they could spot a fake. v3.1 opens on `most-populous`, which nearly everyone approves —
the duck is not lying, it is answering with something that was true until 2023 — so the very first
reveal is the one that lands. The knob: if a room disengages in round one, swapping the two `order`
values back is a two-field change and breaks no invariant (both are `reject`, both are act 1).

**Acts 1 and 2 each teach the same shape twice** — two `reject` questions bracketing one `pass` — so
the room learns "check anyway," not "always reject." A player who taps ตีกลับ on reflex every time
gets 6 of 9 right but never reaches the streak's ×3 multiplier (see Scoring, below) and cannot beat
anyone who is actually reading. **Act 3 is the hardest**, because every individual component of the
wrong answer is real; only the connection between them is invented — there is no missing document to
spot, no tell to fall back on, just the claim itself.

If you are tempted to make an act easier by moving its `pass` question off orders 2/5/8, or by
letting three `reject` questions run in a row, understand you are removing the part of the workshop
that stops the game from being beatable by a coin flip — `content/questions.test.ts` enforces both
and will fail loudly.

## Act 1 — ตอบเหมือนเพิ่งไปเปิดดูมา · CONFIDENT · NEVER CHECKED

**What we are doing to them:** three answers delivered in exactly the same confident tone — one
invented from nothing (a precise number no one is cited as counting), one a stable textbook fact
dressed up to sound like a trick, and one an answer that was true and no longer is. The tone gives
no signal; only the content does.

**Why they fall for it:** fluency reads as competence. A specific number, a settled-sounding
definition, and a globally-known "fact" all come out of the duck the same way — and question 3 in
particular exploits that most people's mental model of "the world's most populous country" is a few
years stale.

**Leave with:** ask *"how recent is this, and who counted?"* before trusting anything with a number
or a "currently" attached to it.

**Where to edit:** `content/questions.ts` → questions with `act: 1`.
**Do not break:** question 2 (banana-berry) must stay the act's `pass` — it is what stops the room
from learning "reject everything that sounds odd." It is the one `pass` question of the three (2, 5,
8) with no `needsCheck` note, deliberately: 5 and 8 carry number claims worth having a citation ready
for; 2 is a closed definitional fact that does not need one. Question 1 also carries a `needsCheck`,
for a different reason — see `docs/questions.md`.

## Act 2 — เชื่อคำถามของเรา · IT BELIEVES YOUR PREMISE

**What we are doing to them:** two of the three answers are wrong not because the *answer* is wrong,
but because the *question* smuggled in something false — a debunked "tongue map," and "isn't summer
heat caused by Earth being closer to the sun?" The duck never pushes back on the premise; it just
answers it.

**Why they fall for it:** the room is reading the duck's answer for correctness and skipping the
question for the same thing. A false premise dressed as a simple question is easy to wave through.

**The one that doesn't fit the pattern:** hippo-danger (question 5) is the same confident tone with
nothing wrong in the question *or* the answer — it exists so "watch for the leading question" does
not harden into "distrust every question," the same anti-heuristic role v2's case 5 played alone.

**Leave with:** a conclusion someone already wanted is not evidence for it — check what you handed
the AI, not just what it handed back.

**Where to edit:** `content/questions.ts` → questions with `act: 2`.
**Do not break:** hippo-danger must stay `pass` and must stay unremarkable. If it starts sounding
like a trap, it stops doing its job.

## Act 3 — สวมชื่อคนอื่น · IT PUTS WORDS IN REAL MOUTHS

**What we are doing to them:** every individual fact in these three answers is real — Einstein
existed, the Great Wall exists, WHO is a real organization, 10,000 is a real number attached to a
real 1965 Japanese pedometer. **Only the link between the real pieces is invented.**

**Why they fall for it:** by act 3 the room is checking "is this component true?" — is Einstein real,
is 21,000km a real-sounding figure — and passing once each component clears, without checking
whether the components actually connect the way the duck claims they do.

**Content rule, load-bearing:** these are **real misattributions that happen in the world**, not
invented ones. The repo-wide rule against fabricating evidence that imitates a real outlet applies
here in the opposite direction: don't invent a fourth kind of misattribution when three real ones
already exist and teach harder than fiction would.

**Leave with:** "every piece checks out" is not the same claim as "the connection checks out." Ask
where you would find the thing that *links* the real facts, not just the facts themselves.

**Where to edit:** `content/questions.ts` → questions with `act: 3`.
**Do not break:** great-wall-length must stay the act's `pass`, and it must keep stating its own
condition (*"ถ้านับรวมทุกช่วงที่สร้างในทุกยุค"*) — that self-qualification is itself part of the
lesson: an answer that states its own scope is more trustworthy than one that doesn't.

## The act card

Every third question closes on an untimed **act card** instead of a reveal — one per act, not one
per question. Three fields carry the lesson:

- **`nameTh` / `nameEn`** — the trick's name, so the room has a handle for it. `nameEn` is set in
  mono/uppercase as a typographic accent, not a translation — v3 is Thai-only for every other piece
  of player-facing copy; `Question` and `Act` are plain `string` fields, not `LocalizedText` pairs.
- **`body`** — what just happened three times, named now that the room has already felt it.
- **`atWork`** — the *"ถ้าเป็นงานจริง"* line: what this failure mode costs outside a workshop. All
  three `atWork` lines feed the host's closing beat at the tally (see `docs/questions.md`).

Unlike v2's per-case `checkNextTime`, there is no per-question take-home instruction — `tell` (in
`content/questions.ts`) covers that role now, one line per question, read together with `truth` on
the reveal. The lesson that used to live on every reveal now lives once per act, on the act card.

**Where to edit:** `content/questions.ts` → `ACTS`. **Required by schema** — an act cannot ship
without `body`, `atWork`, and all three `chips`.

## Scoring, and why it is shaped this way

`lib/scoring.ts`. **Flat `BASE_POINTS = 100`** — there is no per-question difficulty tier in v3,
unlike v2's rising 100→300. In its place is a **streak multiplier**: ×1 on the first correct answer
in a row, ×2 on the second, ×3 on the third and every one after; a wrong or missed answer resets it
to zero. With two buttons a guesser is right about half the time, but a guesser's streak breaks
constantly — the multiplier, not the raw points, is what separates checking from coin-flipping at
50/50 odds.

Speed adds **at most 10 points** and is **not** multiplied by the streak — multiplying it would let
a fast guesser out-score a slower, correct player, which the invariant below forbids:
`ROUND_COUNT * MAX_SPEED_BONUS < BASE_POINTS` → `9 × 10 = 90 < 100`. **A perfectly fast player can
never out-score a slower player who got one more question right.** Speed is a tiebreaker, nothing
more.

If you want speed to matter more, that is a real design conversation — but changing
`MAX_SPEED_BONUS` alone will fail the test on purpose. That test is the argument.

---

# Workshop 2 — Café Persona

The Decision Room (three KPI rounds, a simulator, a leaderboard) was **replaced on 20 Aug 2026**
by Café Persona — a four-persona typing game with no points and no winner. Its design intent,
per-question rationale and every knob to turn live in:

- Spec: [`docs/superpowers/specs/2026-08-20-cafe-persona-design.md`](superpowers/specs/2026-08-20-cafe-persona-design.md)
- Content (all copy, team-editable): [`content/persona.ts`](../content/persona.ts)
- Validation: `npx vitest run content/persona.test.ts lib/persona.test.ts`

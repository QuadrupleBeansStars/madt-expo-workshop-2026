# What each question is doing to the player

For the team. [`docs/cases.md`](cases.md) is the *reference* — sources, facts, distractor summaries.
**This file is the intent**: what we are trying to make a player feel and think at each question,
why they fall for it, and which knob to turn if you want to change it.

If you disagree with a question, this is the file to argue with. Every section ends with **where to
edit** and **what not to break** — the second one matters more, because most of these questions have
one load-bearing property and a lot of cosmetic text around it.

> Facts come from `content/cases.ts`, `content/room.ts` and `lib/`. If you change those, change this.

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

Five cases, 45–60 seconds each. The room reads the storyboard, the question, the AI's confident
answer and the Case File together on the projector; phones only hold four answer cards.

## The arc is the lesson, not any single case

| # | Case | Points | Time | What we do to the player |
|---|---|---|---|---|
| 1 | Artemis II | 100 | 45s | Teach them the missing document is the tell |
| 2 | Milan-Cortina medals | 150 | 50s | Same tell — reward the habit, build confidence |
| 3 | The fake citation | 200 | 60s | Same tell, harder: the *claim* is true, the *source* is fake |
| 4 | NovaBrew | 250 | 60s | **Take the tell away.** Nothing is missing and it is still wrong |
| 5 | The goblin shark | 300 | 60s | **Punish the habit we just built.** Nothing is missing and it is right |

**Cases 1–3 deliberately train a heuristic. Cases 4–5 deliberately break it.**

That is the design. A player who leaves with "look for the missing document" has learned a trick
that fails in the real world; a player who leaves having *had* that trick fail on them, in public,
in front of 200 people, has learned something that sticks. If you are tempted to make case 4 or 5
easier, understand you are removing the part of the workshop that does the actual work.

## Case 1 — Artemis II (easy, 45s)

**What we are doing to them:** giving an answer that is *fluent, specific, and was true last year*.
There is nothing sloppy about it — a crew list, a date, a confident "No."

**Why they fall for it:** it agrees with what most people in the room already believe. Nobody has a
2026 spaceflight fact ready. The AI sounds like the room's own memory, so checking feels unnecessary.

**The way out:** the Case File lists `crewed_missions_2026.log` as **NOT FOUND**. The one document
that covers the period in question is the one that was never retrieved.

**The distractor doing hidden work:** *"Humans never left low Earth orbit."* That is the
reflexive-skeptic option. It exists in every case, and picking it is the mirror-image failure to
believing the AI. We are measuring both.

**Leave with:** ask *"how recent is your information?"* before trusting anything time-sensitive.

**Where to edit:** `content/cases.ts` → `id: 'artemis'`.
**Do not break:** exactly one doc with `found: false`, and it must be the one that would have caught
the error. If the missing document is irrelevant, the case teaches nothing.

## Case 2 — Milan-Cortina medals (medium, 50s)

**What we are doing to them:** getting the *shape* of the answer right and the *numbers* wrong.
Norway really did top the table. Only the figures are invented — and they are invented in exactly
the slot the missing document would have filled.

**Why they fall for it:** the answer passes the sniff test. Checking a number is boring work, and
"Norway won" is the part their brain was actually checking.

**Leave with:** the right shape is not the right numbers. Plausible ≠ verified.

**Where to edit:** `content/cases.ts` → `id: 'olympics'`.
**Do not break:** the invented numbers must stay *close* to the real ones (16/38 vs 18/41). Make
them wildly wrong and the case becomes trivial — the whole difficulty is that they look fine.

## Case 3 — The fake citation (hard, 60s)

**What we are doing to them:** telling the truth and citing a source that does not exist.
*Hendricks v. Meridian Logistics Corp.* is fabricated. The claim it supports — lawyers really have
been sanctioned for AI-invented case law — is completely true.

**Why they fall for it:** a specific case number reads as *proof*. It is the most authoritative-
looking thing on the screen, and it is the only invented thing on the screen.

**This is the hardest case for the right reason:** players must hold "the answer is correct" and
"the evidence is fake" in their head at the same time. Most people's verification instinct collapses
those into one judgment.

**Leave with:** open the link. A true claim and an invented source live happily in the same answer.

**Where to edit:** `content/cases.ts` → `id: 'citation'`.
**Do not break:** the fabricated case must *not* imitate a real, checkable citation of a real firm
or judge. Inventing `Hendricks v. Meridian Logistics Corp.` is fine — it is obviously fictional on
inspection. Naming a real person is not.

## Case 4 — NovaBrew (expert, 60s)

**What we are doing to them:** removing the tell. **The retrieval is complete — nothing is missing —
and every number the AI quotes is correct.** The error is in the inference: revenue grew 12.5% while
store count grew 25%, so revenue *per store* fell. "Growth" is doing a lot of work in that sentence.

**Why they fall for it:** by now the room has a routine — scan the Case File, find the gap, win.
There is no gap. Players who are running the routine instead of thinking answer fastest and wrong.

**Leave with:** every number can be right and the conclusion still wrong. "Is this figure true?" and
"does this figure mean what they say?" are two different questions.

**Where to edit:** `content/cases.ts` → `id: 'novabrew'`.
**Do not break:** every doc stays `found: true`, and NovaBrew stays `fictional: true` (it renders a
FICTIONAL badge — it is an invented company and the screen says so). If you add a missing document
here you have deleted the case's only purpose.

## Case 5 — The goblin shark (final, 300 points, 60s)

**What we are doing to them:** telling the truth, backing it with three real sources, and letting
four cases of accumulated suspicion do the rest.

**Why they get it wrong:** we trained them. A room primed to distrust the machine flags a true answer
on reflex — and this is worth triple the first case, so it decides the leaderboard.

**Why it closes the workshop:** the lesson is not "AI lies." It is **"verify, don't just doubt."**
A player who learned "distrust the AI" fails this exactly as badly as one who believed everything.
That symmetry is the closing line.

**Leave with:** doubt is not verification. The habit is checking the source, not distrusting by
reflex.

**Where to edit:** `content/cases.ts` → `id: 'goblinshark'`.
**Do not break:** this case must stay last, must stay the highest-scoring, and the AI must stay
**right**. If you make case 5 another wrong answer, the workshop's conclusion becomes "never trust
AI," which is both false and useless advice for people about to go use it at work.

## The teaching panel (new)

Every reveal now carries two lines beside the standings:

- **ข้อนี้ทดสอบอะไร** — the name of the trick, so the room has a handle for it (`failureMode`)
- **ครั้งหน้าให้เช็กอะไร** — the take-home instruction (`checkNextTime`)

`checkNextTime` is the only text in the workshop meant to be useful *outside* the room. Write it as
an **instruction**, not a summary of what happened — a test fails if it turns out to be a substring
of `reveal`.

The panel heading is deliberately neutral. "What fooled you" reads well on cases 1–4 and is nonsense
on case 5, where nothing fooled anyone. One heading has to carry both.

**Where to edit:** `content/cases.ts` → `checkNextTime` on each case. **Required by schema** — a new
case cannot ship without one.

## Scoring, and why it is shaped this way

`lib/scoring.ts`. Base points rise with difficulty (100 → 300). Speed adds **at most 15 points**, and
the invariant `5 × 15 < 100` is enforced by a test: **a perfectly fast player who gets one more case
wrong can never beat a slower player who got it right.** Speed is a tiebreaker, nothing more.

If you want speed to matter more, that is a real design conversation — but changing `MAX_SPEED_BONUS`
alone will fail the test on purpose. That test is the argument.

---

# Workshop 2 — The Decision Room

Three decisions, 40–45 seconds each. Every player runs their own cafe; the KPIs carry across rounds.

## Round 1 — Price one cup (45s) — *this one is decided by the room's own data*

**What we are doing to them:** a competitor puts a ฿45 sign up across the road. Every instinct says
match it. **The data on screen — the room's own registration answers — says holding at ฿85 wins.**

**The numbers, from 18 real responses:**

| Price | Buyers (of 120) | Profit |
|---|---|---|
| ฿45 | 120 | ฿2,760 |
| ฿65 | 113 | ฿4,719 |
| **฿85** | **113** | **฿6,979** |
| ฿120 | 27 | ฿786 |

**The beat the host says out loud:** dropping ฿85 → ฿45 wins **7 customers** and costs **฿4,219**.

**Why it works:** 13 of 18 people said they normally spend ฿50–100, so almost nobody was priced out
at ฿85 in the first place. And 18 named *taste* as their main factor against 11 for *price* — the
discount was aimed at the wrong thing. **This is the answer to the question the team raised: why
cutting price doesn't buy the customers you think it does.**

**Honesty constraint — say this out loud:** ฿85 is the best price *on the board*, not the optimal
price. The survey's highest band tops out at ฿100, so the model cannot see past it. Claiming ฿85 is
optimal overstates what 18 answers support.

**Where to edit:** `content/room.ts` → `decide-price`; the model is `lib/pricing.ts`.
**Do not break:** two tests assert the winning price is unchanged across the whole plausible cost
range and every footfall, but **does** move when the spend answers move. Those tests are what let a
host say "your own answers decided this." Without them it is a claim the code cannot support.

## Round 2 — How do you defend the shop? (40s) — *hand-tuned*

**What we are doing to them:** offering the four things a real cafe owner would consider, ranked by
what the room actually said matters.

| Option | Score | Why |
|---|---|---|
| Beat them on taste | **1,560** | 18 people named taste — the most-cited factor |
| Run a promotion | 440 | 8 named promotions; buys volume, costs margin |
| Race them on speed | −160 | 6 named convenience, and speed here costs satisfaction |
| Match their price | −320 | 11 named price, but discounting every cup is how you lose money |

**The trap:** *price* is the second-most-named factor in the data, so matching feels evidence-based.
It still comes last, because "people care about price" and "cutting price is the right move" are
different claims. Same lesson as round 1, arrived at from the other direction.

**Where to edit:** `content/room.ts` → `decide-defend`, the `fx` values.
**Be honest about this one:** the **ordering** is grounded in the `mainFactor` counts. The
**magnitudes** are my hand-chosen guesses. If they feel wrong to someone who runs a shop, they
probably are — this is the most adjustable thing in either workshop.

## Round 3 — ฿20,000, where does it go? (45s) — *hand-tuned*

**What we are doing to them:** making the boring recurring investment beat the exciting one-off.

| Option | Score | Why |
|---|---|---|
| A better grinder | **3,000** | Cuts waste every single day, forever |
| A loyalty card | 1,680 | Recurring, and satisfaction is weighted heavily |
| A marketing campaign | 740 | Big revenue, one month, then it stops |
| A year of deeper stock | **−460** | **The trap** |

**The deliberate trap:** deeper stock sounds prudent — you never sell out. It scores worst because
**waste subtracts** from shop value, and stock you don't sell is waste. Players who pick it are
optimising for never running out instead of for the money.

**Leave with:** the money is in the decision that repeats, not the one that ships once.

**Where to edit:** `content/room.ts` → `decide-invest`.
**Do not break:** the grinder must stay ahead of the campaign — that ordering *is* the workshop's
closing lesson, and the `fx` values are tuned against the exact weights in `SHOP_VALUE_WEIGHTS`.
Reweighting scoring silently flips the ending.

## Scoring

`shopValue()` in `lib/room-store.ts`, weights in `lib/room-types.ts`:
`revenue ×0.2 + profit ×1 + satisfaction ×20 − waste ×1`.

**Waste subtracts.** That inversion is what makes round 3's trap work and what stops a player
winning by pushing every bar upward.

---

# If you want to change something

| You want to… | Edit | What breaks if you're careless |
|---|---|---|
| Reword a question, answer or lesson | `content/cases.ts`, `content/room.ts` | Copy tests check figures quoted in prose still match the model |
| Change a take-home lesson | `checkNextTime` in `content/cases.ts` | Must not be a substring of `reveal`; required on every case |
| Make a case easier | Its evidence, **not** its failure mode | Cases 4 and 5 lose their entire purpose if you restore the "missing document" tell |
| Retune round 2 or 3 | `fx` in `content/room.ts` | Round 3's grinder must stay ahead of the campaign |
| Change how much speed matters | `lib/scoring.ts` | A test enforces that speed can never overturn a correct answer |
| Change timings | `lib/game.ts` | Currently 45/50/60/60/60s — the team's own band |
| Add a sixth case | `content/cases.ts` | Schema requires `checkNextTime`; the projector check must be re-run |

**After any content edit, run both:**

```bash
npx vitest run
npm run build && FACILITATOR_TOKEN=<token> npm run start:lan &
FACILITATOR_TOKEN=<token> npm run check:projector
```

The second one is not optional. Longer text is the single most common way to push the host's own
buttons off the bottom of a projector, and no unit test can see it — jsdom performs no layout.

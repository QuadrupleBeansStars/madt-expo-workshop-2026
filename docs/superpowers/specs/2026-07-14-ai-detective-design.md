# AI Detective — Design Spec

**Workshop:** MADT Expo, **23 August 2026**
**Format:** ~10 minutes, ~20 concurrent players, laptops
**Key message:** *Think with AI, not just trust AI.*

---

## 1. Concept

Players take the role of an **AI Detective**. Each of 5 Cases presents a question, an AI's
answer, and a **Case File** (evidence). The player decides whether the AI's answer is
**sound** or a **hallucination**, then picks the correct answer. After play, the facilitator
runs a group reveal on a projector, showing what fraction of the room each AI answer fooled.

Difficulty ramps 🟢 → ⚫, and — critically — **each case teaches a different failure mode**,
so players leave with a checklist rather than a vague "AI is sometimes wrong."

---

## 2. Architecture

A single Next.js app, run from the facilitator's laptop (`npm run dev`), reachable by players
on the school network at `http://<host-ip>:3000`.

Three surfaces:

| Route | Audience | Purpose |
| --- | --- | --- |
| `/` | Players (laptops) | Codename → 5 cases → personal result |
| `/dashboard` | Projector | Live room stats. Two panels, toggled by keypress. |
| `/reveal` | Projector, facilitator-driven | Arrow-key through the 5 reveals, with live "% fooled" |

**State:** a single in-memory store on the server, mirrored to a JSON file on disk so a crash
mid-session doesn't lose the room. At 20 players this is the right call, not a compromise. The
store sits behind one thin interface so swapping in a real database later is contained.

**Resilience:** players' answers are buffered in their own browser (`localStorage`) and replayed
on reconnect, so a wifi blip doesn't destroy a run. The dashboard polls every 2–3s; no websockets.

### Network risk (must be tested before the day)

The failure mode is **client isolation** — school wifi that permits internet access but blocks
laptop-to-laptop traffic, which makes the server invisible to players and is unfixable on the day.

**Mitigation, both required:**
1. Test on-site beforehand: two laptops on the school wifi, server on one, open the URL on the other.
2. Keep a **phone hotspot fallback**: if isolation is on, all laptops join the hotspot instead.

---

## 2a. The RAG retrieval mechanic (the heart of the game)

Each case is not merely a pre-written AI answer. The player watches the AI **retrieve** from the
Case File knowledge base, sees the retrieval **come up short**, and then watches the AI paper over
the gap rather than admit it.

```
🔍 RETRIEVING FROM CASE FILE…
   doc_1_medal_table.pdf      ✓ retrieved
   doc_2_nbc_report.html      ✓ retrieved
   doc_3_norway_breakdown.pdf ✗ NOT FOUND

🤖 AI ANSWER
   "Norway topped the table with 16 golds and 38 medals total…"
```

This teaches the **mechanism**, not just the symptom: hallucination is what a model does when the
context it needs is missing and it has been trained to produce fluent answers rather than admit
ignorance. Seeing `✗ NOT FOUND` and then reading a confident number *about the missing document* is
the single most instructive image in the workshop.

**Simulated, not live (decision).** The retrieval UI is real and visible; the AI's answer is
**pre-written**. Rationale:

- **Determinism.** The reveal is a *group* reveal on a projector. If 20 players each got a slightly
  different generated answer, the facilitator can no longer say "here is exactly what the AI got
  wrong" — everyone saw a different wrong thing, and the shared moment fractures.
- **Reliability.** Modern models are increasingly willing to say *"the case file doesn't contain
  that."* A live hallucination trap may simply **fail to spring** — in front of prospective students.
- **Honesty.** Rigging a live model's prompt to suppress "I don't know" would produce a hallucination
  on cue, but a workshop about AI credibility cannot afford a rigged demo that leaks.

**Swappable.** The answer layer sits behind a single `getAIAnswer(case, lang)` interface. Replacing
the pre-written answer with a live model call later is a contained, one-module change. The team may
revisit this; the architecture does not have to.

---

## 2b. Player mechanic and scoring

**Per case: one 4-way multiple choice.** One option is **always "The AI is correct."**

This is load-bearing. A Trust/Hallucination binary breaks on this case set: Case 5's AI *is* correct,
and Cases 2 and 3 are only *partially* wrong ("right country, invented numbers"; "true claim, fake
source"). A binary makes those answers arguable — the worst possible outcome for something being
revealed on a projector. The 4-way choice gives every case **exactly one defensible answer**.

**Scoring: accuracy, plus a small speed bonus.**

- Correct answers score points, weighted by difficulty (harder cases are worth more).
- A speed bonus applies **only as a tiebreaker**: it is deliberately capped so that it can separate
  two players with equal accuracy, but **can never let a fast-wrong player outrank a slow-right one.**
- Rationale: the leaderboard needs separation, but a workshop teaching people *not to trust snap
  judgments* must not reward snap judgments. The cap is a single tunable constant.
- This preserves the soft timer: careful thinking is never punished.

---

## 3. Dashboard (both panels ship; choose live)

- **Stats Wall** — detective count, cases solved, a live "% fooled" bar per case.
- **Leaderboard** — ranked codenames by score.

Both read the same data. A keypress toggles between them; the choice is made on the day.

---

## 4. Timing: soft, never hard

5 cases in ~8 minutes is ~95s/case, which is not enough for the harder cases. Therefore the app
**never hard-cuts a player**. A countdown shows for tension; the dashboard shows "14 of 20
detectives finished"; the facilitator calls time when the room is mostly done. Nobody is yanked
out of Case 4 mid-thought.

---

## 5. Identity

**Detective codename** — typed, or generated by a "random codename" button (e.g. *Detective Ramen*,
*นักสืบกาแฟ*). No email capture: it adds friction and a salesy smell at a welcoming booth.

---

## 6. Language

Thai and English, toggled by one button in the corner, flipping everything instantly, remembered
per player. All case content is authored bilingually in a **single content file**, so content work
and app work proceed in parallel and non-engineers can edit cases without touching code.

---

## 7. Content integrity rules (non-negotiable)

A workshop about misinformation cannot itself traffic in fabricated evidence.

1. **No fake evidence imitating real outlets.** No mocked-up Bangkok Post headlines, no invented
   screenshots of real publications. Such a mockup gets photographed and shared out of context, and
   if a visitor spots it, the entire message collapses.
2. **Real cases must be verifiable.** Cases 1, 2, 3 and 5 are built on genuine, sourced 2026 events,
   with real links in the Case File. They were researched with live search — *not written from
   memory*, since recalling specifics from a fixed training cutoff is precisely the failure mode
   this workshop teaches players to distrust.
3. **Crafted cases are openly in-world.** Case 4's evidence comes from a plainly fictional company.
   It cannot be mistaken for reporting.
4. **Fabricated citations appear only as the AI's output, never as evidence** (Case 3), and are
   explicitly revealed as invented.

---

## 8. The five cases

Each teaches a distinct failure mode.

### 🟢 Case 1 — Artemis II — *stale knowledge*

- **Question:** Has any human traveled beyond low Earth orbit since 1972?
- **AI Answer:** *"No. The last humans to travel beyond low Earth orbit were the Apollo 17 crew in December 1972."*
- **Verdict:** **Hallucination** (stale).
- **Truth:** Artemis II launched **1 April 2026** and splashed down **10 April 2026** off San Diego.
  Crew: Reid Wiseman, Victor Glover, Christina Koch (NASA), Jeremy Hansen (CSA). First humans beyond
  low Earth orbit since 1972.
- **Case File:** NASA Artemis II mission blog; CNN/CBS splashdown coverage.
- **Lesson:** The answer *was* true. Fluency is not freshness — check the date on the knowledge.
- **Sources:** nasa.gov/blogs/missions/2026/04/10/..., cbsnews.com, cnn.com

### 🟡 Case 2 — Milan-Cortina medal table — *fabricated specifics*

- **Question:** Who topped the medal table at the Milan-Cortina 2026 Winter Olympics?
- **AI Answer:** names Norway but reports **incorrect medal counts** (fluent, specific, wrong).
- **Verdict:** **Partially hallucinated** — right country, invented numbers.
- **Truth (final):** Norway 18G / 12S / 11B = **41** (a Winter Games record); USA 12/12/9 = 33;
  Italy 10/6/14 = 30; Germany 8/10/8 = 26; Japan 5/7/12 = 24.
- **Case File:** official medal table; NBC Olympics final medal count.
- **Lesson:** The most dangerous wrong answer is the one shaped exactly like a right one. Numbers
  must be read, not vibed.

### 🟠 Case 3 — The fake citation — *right answer, invented source*

- **Question:** Have lawyers actually been punished for submitting AI-invented case law?
- **AI Answer:** *"Yes"* — followed by a specific case name and docket number **that does not exist**.
- **Verdict:** **Hallucination in the source, not the claim.**
- **Truth:** The claim is correct. Real 2026 sanctions include the Sixth Circuit sanctioning two
  attorneys **$15,000 each** over 24+ fake citations (*Whiting v. City of Athens*); a New York court
  sanctioning an attorney and his firm **$10,500**; roughly **$145K** in Q1 2026 penalties; and
  1,200+ tracked instances worldwide. But the case the AI cites is not among them — it invented it.
- **Case File:** ABA *Litigation News*; NPR; Sixth Circuit appellate coverage; NY Daily Record.
- **Lesson:** **Correct ≠ trustworthy.** A right answer with a fake source is still a failure — and
  it's the failure that ends careers. Deliciously recursive: a hallucination case about hallucinations.

### 🔴 Case 4 — Right numbers, wrong conclusion — *reasoning failure* (crafted, in-world)

- **Setup:** Q1 2026 results for **"NovaBrew"**, a plainly fictional coffee chain. The Case File is
  an in-world internal report — clearly fictional on its face, so it cannot be mistaken for reporting.

- **Case File data:**

  | Metric | Q4 2025 | Q1 2026 | Change |
  | --- | --- | --- | --- |
  | Stores | 120 | 150 | **+25%** |
  | Total revenue | ฿240M | ฿270M | **+12.5%** |
  | Revenue per store | ฿2.00M | ฿1.80M | **−10%** |

- **AI Answer:** *"NovaBrew had a strong quarter. Revenue grew 12.5% to ฿270M while the chain expanded
  from 120 to 150 stores. The expansion is clearly driving growth — NovaBrew should accelerate store
  openings."*

- **Verdict:** **Hallucinated reasoning.** Every single number the AI quotes is **correct**.
- **The flaw:** Revenue grew 12.5% while store count grew **25%** — so revenue *per store* **fell 10%**.
  Growth isn't coming from success; it's coming from adding stores that each perform worse than the
  ones before. "Accelerate openings" is precisely the wrong prescription, and the data the AI itself
  cited says so.
- **Lesson:** Verifying the facts is not the same as verifying the *inference*. Fact-checking every
  figure would pass this answer with flying colours. This is the class of error most likely to survive
  review — and the one where a human's judgment is genuinely irreplaceable.

### ⚫ Case 5 — The goblin shark — *the AI is correct*

- **AI Answer:** *"In 2026, researchers filmed a living goblin shark in its natural deep-sea habitat
  for the first time."*
- **Verdict:** **TRUE.** The AI is right.
- **Truth:** A University of Hawaiʻi at Mānoa team published in the *Journal of Fish Biology* two
  wild sightings — one near a seamount by Jarvis Island, one on the slope of the **Tonga Trench**.
  The Tonga sighting was ~700m deeper than the species was known to live, setting a **new depth
  record for the entire order Lamniformes**. Every prior live observation came only after the animal
  was hooked and brought to the surface, where it soon died. The goblin shark is a 125-million-year-old
  living fossil.
- **Case File:** Smithsonian Magazine; phys.org; Gizmodo; ScienceDaily; the *Journal of Fish Biology* paper.
- **Why it closes the workshop:** It sounds *exactly* like a hallucination — an absurd name, a
  grandiose superlative, a suspiciously cinematic milestone. After four cases of catching the machine
  out, most of the room will mark it false **on reflex**. That reflex is the lesson: reflexive cynicism
  is just as lazy as reflexive trust. **Think with AI — don't just trust it, and don't just doubt it.**

### Optional swap-in: 2026 World Cup

The final falls ~19 July 2026, five weeks before the expo, so the result will be stable and it will be
the most-discussed event in the world. It is **deliberately not baked into the spec**, because its
answer did not exist at authoring time. If wanted, it becomes a one-line content-file edit after the
final — which is precisely why content is decoupled from code.

---

## 8a. Retrieval gap and answer options, per case

Every case's Case File is a small set of retrievable documents. In four of the five, **one document
is missing** — and the AI's hallucination is precisely the shape of that hole. In Case 5, **nothing
is missing**, which is why the AI is right — and which is the tell an alert player can spot.

| Case | Retrieved | Missing (the gap) | The AI's hallucination fills… | Correct option |
| --- | --- | --- | --- | --- |
| 1 🟢 | Apollo-era mission records | **2026 mission logs** | …the gap with pre-1972 knowledge | *"Correct in 1972 — but the AI never retrieved anything from 2026"* |
| 2 🟡 | Medal table, NBC report | **Norway detail sheet** | …the gap with invented medal counts | *"Right country — the numbers are invented"* |
| 3 🟠 | News on real sanctions | **The case-law database** | …the gap with a fabricated citation | *"The claim is true — the source is invented"* |
| 4 🔴 | Full NovaBrew financials *(nothing missing!)* | — | …nothing. The **reasoning** is what fails. | *"Every number is right — the conclusion doesn't follow"* |
| 5 ⚫ | Full paper, news coverage *(nothing missing!)* | — | …nothing. The AI is **correct**. | *"The AI is correct"* |

**Note the deliberate structure of the back half.** Cases 4 and 5 both retrieve *cleanly* — no gaps.
That's the point. By Case 4, players have learned "look for the missing document," and that heuristic
**stops working**: Case 4 has complete evidence and still fails, because the flaw is in the inference,
not the retrieval. And Case 5 has complete evidence and *doesn't* fail — punishing the player who has
now learned to distrust reflexively.

The five cases therefore teach, in order: *check the date* → *check the numbers* → *check the source*
→ *check the reasoning* → **and then check yourself.**

---

## 9. Reveal deck

For each case, the facilitator's slide shows: the AI's answer, the verdict, **the specific evidence
that catches it**, the named failure mode, and the **live "% of you believed the AI"** figure pulled
from actual play. This is where the workshop's emotional payoff lives.

Closing summary maps the five cases onto the four objectives: Critical Thinking, AI Hallucination,
Overreliance on AI, Human-AI Collaboration.

---

## 10. Out of scope (YAGNI)

- Accounts, auth, persistence across sessions
- Websockets / synchronized phone flipping during play
- Email capture
- Admin CMS (the content file *is* the CMS)

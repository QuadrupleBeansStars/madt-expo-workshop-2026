# The five cases — what each one teaches

Reference for the team. Everything here is transcribed from [`content/cases.ts`](../content/cases.ts),
which is the single source of truth. If you edit a case, edit it there and update this file.

> `docs/walkthrough.html` §05 covers the same arc at a higher level, for the demo. This file is the
> detailed per-case reference: sources, distractor design, and the real-vs-invented boundary.
>
> **Looking for *why* a case is built the way it is, or wanting to change one?** That is
> [`docs/question-design.md`](question-design.md) — the design intent for both workshops, with the
> knob to turn and the thing not to break for each question. This file is the facts; that one is
> the argument.

---

## The arc

Each case teaches one distinct failure mode, so players leave with a checklist rather than a vague
"AI is sometimes wrong." **The order matters, and the back half deliberately breaks the habit the
front half builds.**

| # | Case | Failure mode | Retrieval | Difficulty |
|---|------|--------------|-----------|------------|
| 1 | 🟢 Artemis II | Stale knowledge | 1 doc missing | easy |
| 2 | 🟡 Milan-Cortina medals | Fabricated specifics | 1 doc missing | medium |
| 3 | 🟠 The fake citation | Right answer, invented source | 1 doc missing | hard |
| 4 | 🔴 NovaBrew | Flawed reasoning | **nothing missing** | expert |
| 5 | ⚫ The goblin shark | **No failure — the AI is right** | **nothing missing** | final |

Cases 1–3 train players to hunt for the missing document. Case 4 retrieves cleanly and is *still*
wrong — the flaw is in the reasoning, not the retrieval — so the heuristic they just learned stops
working. Case 5 retrieves cleanly and *isn't* wrong, and a room primed by four cases to distrust the
machine will flag a true answer on reflex.

**The arc reads:** check the date → check the numbers → check the source → check the reasoning →
**then check yourself.** That last one is the closing line of the workshop.

---

## A note on the evidence

Every case shows the audience a "Case File" of retrieved documents. Two things to keep straight,
because they are the teaching content and mislabeling them inverts the lesson:

- **Real evidence cites a real URL.** Cases 1, 2, 3, and 5 use real sources, linked below.
- **Fictional evidence is flagged** `fictional: true` in the data and renders a FICTIONAL badge on
  screen. Only NovaBrew (Case 4) is fictional — it is an invented company, and the UI says so.
- **A document with `found: false` is the gap** — the thing the AI never retrieved. In cases 1–3,
  the missing document is precisely the one that would have caught the error. That is the point.

Content rule when editing: **never fabricate evidence that imitates a real outlet.**

---

## 🟢 Case 1 — Artemis II

**Question:** Has any human traveled beyond low Earth orbit since 1972?

**What the AI says:** No — the last were the Apollo 17 crew in December 1972; every crewed mission
since has stayed in low Earth orbit.

**Correct answer:** *"The AI was right last year — but it never retrieved anything from 2026.
Artemis II already flew, crewed by Wiseman, Glover, Koch, and Hansen."*

**Why it fails:** The answer was true until April 2026. Artemis II launched 1 April 2026 and
splashed down 10 April 2026, carrying Reid Wiseman, Victor Glover, Christina Koch (NASA) and Jeremy
Hansen (CSA) — the first humans beyond low Earth orbit since 1972. The AI never retrieved a single
2026 document. **It answered from what it knew, not from what it found.**

**The missing document:** `crewed_missions_2026.log`

**Sources:**
- [NASA — Apollo 17](https://www.nasa.gov/mission/apollo-17/)
- [NASA — International Space Station](https://www.nasa.gov/international-space-station/)

**The distractors:**
| Option | Why it's wrong |
|---|---|
| "The AI is correct" | The trap for anyone who doesn't check the dates on the evidence. |
| "Last mission was Apollo 11, not 17" | Factually false; tests whether players read the retrieved doc. |
| "Humans never left low Earth orbit" | Over-correction — reflexive total disbelief. |

**Lesson:** Fluency is not freshness. Always check the date on the knowledge.

---

## 🟡 Case 2 — Milan-Cortina medal table

**Question:** Which country topped the medal table at Milan-Cortina 2026, and with how many medals?

**What the AI says:** Norway, with 16 gold and 38 total, followed by the United States and Germany.

**Correct answer:** *"Right country — but the numbers are invented. It was actually 18 gold and 41
total, a new record, and third place was Italy, not Germany."*

**Why it fails:** The AI got the *shape* right and the *numbers* wrong. Notice which document was
missing: Norway's medal breakdown — and the numbers the AI invented are exactly the numbers that
document would have contained.

**The missing document:** `norway_medal_breakdown.pdf`

**Sources:**
- [Olympics.com — Milano Cortina 2026 medals](https://www.olympics.com/en/milano-cortina-2026/medals)
- [NBC Olympics — final medal count](https://www.nbcolympics.com/news/final-medal-count-2026-milan-cortina-winter-olympics-and-paralympics)

**The distractors:**
| Option | Why it's wrong |
|---|---|
| "Entirely correct, matches the IOC announcement" | Sounds authoritative; the retrieved table contradicts it. |
| "Wrong country — it was the USA" | Plausible-sounding, but the evidence clearly says Norway. |
| "The Olympics were postponed to 2027" | Total-fabrication option, for the reflexively skeptical. |

**Lesson:** The most dangerous wrong answer is the one shaped exactly like a right one. Numbers must
be read, not vibed.

---

## 🟠 Case 3 — The fake citation

**Question:** Have lawyers actually been punished for submitting AI-invented case law?

**What the AI says:** Yes — citing *Hendricks v. Meridian Logistics Corp.*, No. 24-CV-8871
(N.D. Cal. 2026), a $22,000 fine over nine non-existent cases.

**Correct answer:** *"The claim is TRUE — but the case the AI cites does not exist. It invented its
own source instead of the real Whiting v. City of Athens sanctions."*

⚠️ **Keep this straight when facilitating:**
- ***Hendricks v. Meridian Logistics Corp.* does not exist.** The party names, docket number, court,
  and fine amount are all the AI's invention. It is the fabrication the case is about.
- **The underlying claim is true, and the real sanctions are real.** Sixth Circuit: $15,000 each
  against two attorneys in *Whiting v. City of Athens*. A New York court: $10,500 against an attorney
  and his firm. ~$145K levied in Q1 2026. 1,200+ tracked instances.

**Why it fails:** The missing document is the case-law database. The AI had no way to check whether
its own citation existed — **so it invented one rather than admit it did not know.**

**The missing document:** `federal_case_law_database.db` (docket lookup)

**Sources:**
- [ABA Litigation News — fake cases, real sanctions](https://www.americanbar.org/groups/litigation/resources/litigation-news/2026/fake-cases-real-sanctions-dangers-ai/)
- [NPR — penalties stack up as AI spreads through the legal system](https://www.npr.org/2026/04/03/nx-s1-5761454/penalties-stack-up-ai-spreads-through-legal-system)
- [NY Daily Record — attorney and firm sanctioned over AI fake citations](https://nydailyrecord.com/2026/06/26/new-york-attorney-law-firm-sanctioned-ai-fake-citations/)

**The distractors:**
| Option | Why it's wrong |
|---|---|
| "Entirely correct — the docket is on file" | The specific trap: the claim is true, so the citation feels true too. |
| "The claim is false — no lawyer was punished" | Wrong in the other direction; the retrieved docs disprove it. |
| "Only the fine amount is wrong" | Near-miss option — concedes a small error to protect the fake case name. |

**Lesson:** Correct ≠ trustworthy. A right answer with a fake source is still a failure — and it is
the failure that has ended careers over 1,200 times.

---

## 🔴 Case 4 — NovaBrew

> **NovaBrew is a fictional company.** Its documents are flagged `fictional: true` and render a
> FICTIONAL badge on screen. Say so out loud if anyone asks.

**Question:** Based on NovaBrew's Q1 2026 results — is the AI's conclusion sound?

**What the AI says:** Strong quarter. Revenue grew 12.5% to ฿270M while the chain expanded from 120
to 150 stores. The expansion is clearly driving growth — NovaBrew should accelerate store openings.

**The data it was given:**
| Metric | Q4 2025 | Q1 2026 | Change |
|---|---|---|---|
| Stores | 120 | 150 | +25% |
| Total revenue | ฿240M | ฿270M | +12.5% |
| Revenue per store | ฿2.00M | ฿1.80M | **−10%** |

**Correct answer:** *"Every number is right — but the conclusion does not follow. Stores grew 25%
while revenue grew only 12.5%, so revenue per store FELL 10%."*

**Why it fails:** The retrieval was **clean** — nothing missing — and every number the AI quoted is
**correct**. The growth isn't coming from success; it's coming from adding stores that each perform
worse than the ones before. "Accelerate openings" is therefore precisely the wrong prescription, and
the data the AI itself cited says so.

**The distractors:**
| Option | Why it's wrong |
|---|---|
| "Correct — accelerate, revenue grew four quarters straight" | Endorses the AI; the trap for anyone who only fact-checked figures. |
| "The AI misquoted — growth was 8%, not 12.5%" | Tempting because players expect a number error by now. There isn't one. |
| "A key document is missing" | **The heuristic trap.** Cases 1–3 taught this move; here retrieval is complete. |

**Lesson:** Verifying the facts is not the same as verifying the inference. Fact-check every figure
and this answer sails through. This is the class of error most likely to survive review — and the
place where human judgment is genuinely irreplaceable.

---

## ⚫ Case 5 — The goblin shark

**Question:** In 2026, did scientists really film a living goblin shark in its natural deep-sea
habitat for the first time?

**What the AI says:** Yes — a University of Hawaiʻi at Mānoa team filmed two individuals, one near a
seamount by Jarvis Island and one on the slope of the Tonga Trench, roughly 700m deeper than the
species was known to live. Published in the *Journal of Fish Biology*.

**Correct answer:** *"The AI is CORRECT — every part of this actually happened."*

**Why there's no failure:** All of it is real — the animal, the researchers, both locations, the new
depth record for the entire order Lamniformes, and the journal. Retrieval was clean; there was no gap
for the AI to paper over.

**Sources:**
- [phys.org — rare deep-sea goblin sharks](https://phys.org/news/2026-06-rare-deep-sea-goblin-sharks.html)
- [Smithsonian Magazine — goblin shark filmed in its habitat](https://www.smithsonianmag.com/smart-news/ugliest-shark-on-the-planet-see-the-elusive-goblin-shark-filmed-for-the-first-time-in-its-deep-sea-habitat-180988950/)
- [ScienceDaily — rare goblin shark filmed alive](https://www.sciencedaily.com/releases/2026/07/260708022208.htm)

**The distractors** — note that all three are the *kinds of error* the previous four cases taught
players to expect:
| Option | Which earlier case's habit it exploits |
|---|---|
| "The goblin shark isn't real, it's CGI" | Case 3 — invented entity. |
| "Real animal, but the Tonga Trench detail is invented" | Case 2 — fabricated specifics. |
| "Real, but it happened in 2019, not 2026" | Case 1 — stale/wrong date. |

**Lesson:** So why do most rooms mark this false? Because four cases trained them to distrust — and
**reflexive doubt is exactly as lazy as reflexive trust.** That is the whole point of the workshop:
think *with* AI. Don't just trust it. And don't just doubt it either.

---

## Editing

All content lives in `content/cases.ts`, bilingual (th/en), no code changes needed.

```bash
npx vitest run content/
```

validates every case: exactly one correct option, one "the AI is correct" option, both languages
present, and real sources cited.

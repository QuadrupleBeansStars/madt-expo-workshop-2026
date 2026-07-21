# Data in Business — Interactive Deck Design Spec

**Workshop:** MADT Expo, **23 August 2026**
**Format:** 15 minutes, phones + one projector, drop-in expo audience
**Audience:** Mixed — mostly students/prospective students, some working professionals
**Key message:** *Data isn't valuable because you have it. It's valuable when someone will pay to
change a decision because of it.*

> Sibling to `2026-07-17-ai-detective-kahoot-design.md`. Shares the room-state *pattern* and some
> primitives, but is a **separate surface** — see §3. AI Detective code paths are not modified.

---

## 1. Concept

The room builds a dataset about itself in 90 seconds, then spends 12 minutes discovering that it is
worth nothing until exactly one person with one decision appears.

Three questions on phones produce **arrival time + arrival mode + morning beverage** — which is,
not coincidentally, the input to a café's morning staffing decision. That single dataset then
carries all three topics as three lenses rather than three mini-lectures:

| Topic | Lens on the same dataset |
| --- | --- |
| Data in business | What is it worth? (฿0, until someone acts on it) |
| Data strategy | Which decision does it actually change? (staffing — and only staffing) |
| Monetization | How do you charge for it? (the recurring decision, not the data) |

**Why one dataset:** at 15 minutes, each vote+reveal cycle costs ~3–4 min. Three separate scenarios
would spend the entire budget on setup. Reusing one object makes each beat land in seconds because
the context is already loaded.

---

## 2. The deck

Ten slides: three hook polls, three vote/reveal pairs, one close. Timings are targets, not enforced
— the host advances manually (§3.3).

### Hook — 0:00–2:00

Three `poll` slides, ~25s each. No correct answers. Results animate on the projector as votes land.

1. **How did you get here today?** — walked / BTS-MRT / car / motorbike
2. **What time did you wake up?** — before 6 / 6–8 / 8–10 / after 10
3. **What did you drink first today?** — coffee / tea / water / nothing

Closing line on slide 3's chart: *"Congratulations. You just built a dataset. It took 90 seconds and
cost nothing. What's it worth?"*

### Beat 1 — Data in business — 2:00–5:00

`vote`: **What is this dataset worth?**
`฿0` · `฿2,000` · `฿200,000` · `Depends who's buying`

`reveal`: "Depends who's buying" earns partial credit, then gets sharpened — it depends who has a
**decision** to make. Right now it is worth ฿0, because nobody here has done anything differently
because of it. The café downstairs must decide how many staff to roster at 7am tomorrow.

**Lesson:** raw data is a cost, not an asset.

*Design note:* the sharp answer is rewarded and then pushed past. This is the mechanism for serving
students and professionals in one room — nobody is wrong, but nobody is finished either.

### Beat 2 — Data strategy — 5:00–9:00

`vote`: **You run that café. Which decision does this data actually change?**
`What's on the menu` · `How many staff at 7am` · `Where to open branch #2` · `What to charge`

`reveal`: Only **staffing**. Wake time + arrival mode gives the shape of the morning rush. The other
three require data you do not have and cannot derive from this.

**Lesson:** strategy is matching data you can collect to a decision you actually control. Most "data
strategy" fails by collecting branch-location-shaped data to answer a staffing-shaped question.

### Beat 3 — Monetization — 9:00–13:00

`vote`: **The café wants it. How do you charge?**
`Sell the dataset once, ฿5,000` · `Monthly rush forecast, ฿3,000/mo` · `Free, take 5% of the uplift`

`reveal`: The obvious option is the worst. Sell once and you have handed over the asset; they never
need you again. Next week's rush is different — **data depreciates, but the decision recurs
forever.** The revenue share is the sophisticated answer: you are paid in proportion to value
actually created.

**Lesson:** monetize the recurring decision, not the one-time data.

### Close — 13:00–15:00

`content`, with the room's own charts still visible:

1. **Data in business** — raw data is a cost, not an asset
2. **Data strategy** — find the decision first, collect backwards
3. **Monetization** — sell the recurring decision, not the one-time data

---

## 2a. Content rules

- **Denominate every reveal in decisions and money.** The hook is the only privacy-adjacent moment
  and is played as empowerment ("you built this"), never as exposure ("look what you gave away").
  Privacy is a good workshop; it is not *this* workshop, and mixing the two costs the through-line.
- **Beat 3 carries three options, not four.** An earlier draft had a fourth ("open your own café").
  Cut: the beat is really one idea (one-time vs. recurring) and a fourth option dilutes it for a
  mostly-student room.
- **The ฿ figures are illustrative.** ฿5,000 / ฿3,000 / 5% should be sanity-checked against real
  Bangkok café economics before the day. They need to feel plausible, not be defensible.
- Bilingual TH/EN throughout, matching AI Detective's `LocalizedText` convention.

---

## 3. Architecture

### 3.1 A parallel surface, not a refactor

The AI Detective engine is coupled to its content shape: `lib/game.ts` imports `CASES` directly,
durations are keyed by `Difficulty`, and the phase machine is hardcoded to `investigate → reveal`
across five homogeneous scored rounds. This deck is heterogeneous and unscored. Generalizing that
engine means surgery on verified code that ships in one month.

**Decision: build alongside it.** ~200 lines of duplication in exchange for zero regression risk to
a working, tested, already-pushed app.

| | |
| --- | --- |
| **New** | `content/deck.ts`, `lib/deck.ts`, `app/api/deck/*`, `app/biz`, `app/biz/tv`, `.deck-state.json` |
| **Shared** | `lib/i18n.ts` (extended), host-token guard, `Countdown`, the `MemoryRoomStore` pattern |
| **Untouched** | every AI Detective code path |

Both workshops run from the same server on the same laptop; only the URL differs.

### 3.2 Surfaces

| Route | Device | Purpose |
| --- | --- | --- |
| `/biz/tv` | Projector | The deck. Current slide + live result chart + host controls (Next, Back, Close voting) |
| `/biz` | Phone | Current question + tap to answer + "answer received" state |

`/biz` is the join URL; the TV lobby shows it as a QR code, reusing AI Detective's lobby pattern.

### 3.3 State and control

```ts
type DeckPhase = 'lobby' | 'slide' | 'done'
type DeckState = { phase: DeckPhase; slideIndex: number; votingClosedAt: number | null }
```

Simpler than the round machine because **slides carry their own behaviour** — whether they accept
answers and for how long is a property of the slide, not of the phase.

**Host-driven advance, always.** The per-slide timer only *closes voting*; it never advances the
deck. The host presses **Next**. This is a deliberate departure from AI Detective's auto-advance:
on an expo floor people wander up mid-session and ask questions mid-slide, and the facilitator needs
to hold a slide without the deck moving on underneath them. **Back** is available for the same
reason.

Server owns state; TV and phones are followers that poll `/api/deck/state` (~1s live, ~2s idle),
reusing AI Detective's monotonic-sequence guard, last-good-frame fallback, and shape validation.

### 3.4 Three deliberate departures from AI Detective

1. **No codenames.** Opening `/biz` joins you anonymously with a generated id. Identity exists only
   to deduplicate votes. A codename screen costs ~30s of a 15-minute session for no benefit here.
2. **No scoring, no leaderboard.** Hook polls have no right answer; the beats have a *best* answer
   used only to structure the reveal. Competition would pull attention from the collective result,
   which is the entire point.
3. **Late joiners are full participants, not spectators.** AI Detective locks the roster at Start to
   keep scoring fair. With no scoring, anyone arriving mid-deck simply votes on the current slide.
   This matches expo drop-in traffic.

### 3.5 Vote handling

- One vote per `(playerId, slideId)`; **last write wins** (unlike AI Detective's first-wins, since
  there is no speed bonus to protect and changing your mind is harmless).
- Votes arriving after voting closes are rejected with `409`, matching the existing answer contract.
- Aggregation is computed server-side and returned with state, so the TV never derives counts.

### 3.6 The live chart

The one genuinely new UI component: a horizontal bar chart, one bar per option, animating as votes
arrive, readable from the back of a room. Percentages and counts both shown. Must hold its layout
when an option label wraps, and when one option takes 100%.

Build it with the `dataviz` skill for palette and form; do not hand-roll colors.

---

## 4. Failure modes and mitigations

| Risk | Mitigation |
| --- | --- |
| Nobody votes (small/shy crowd) | Every slide renders correctly at n=0; reveals never say "X% of you" unless n ≥ 5. Host can advance without votes. |
| One loud person answers for the room | Charts show counts alongside percentages, so n=3 is visibly n=3. |
| Wifi client isolation | Same failure and same fallback as AI Detective (phone hotspot). Test in advance. |
| Deck drifts into a privacy talk | §2a content rule; reveals are written in decisions and money. |
| Runs long | The close is `content`-only and can be delivered verbally; Beat 3's reveal is the last essential beat. |
| Runs short | Host holds on Beat 2's reveal — the richest discussion prompt. |

---

## 5. Testing

Mirrors AI Detective's approach (vitest, 22 files / 168 tests as of this writing):

- **Content validation** (`content/deck.test.ts`): every slide has both languages; every `poll`/`vote`
  has 3–4 options with unique ids; every `reveal` references a real preceding slide; slide ids unique.
- **Slide machine** (`lib/deck.test.ts`): next/back at boundaries, voting-open predicate per slide
  kind, voting-closed timing, aggregation math including the n=0 and single-option-100% cases.
- **API contract**: join is idempotent; vote is last-write-wins; vote after close returns 409;
  control endpoints 403 without the facilitator token.
- **Rendering**: TV renders each slide kind at n=0 and with votes; chart holds layout with long
  labels and at 100%.

A full 10-slide playthrough driven by Playwright over the **LAN IP** (not localhost) before the day —
this is what caught the `allowedDevOrigins` hydration failure in AI Detective.

---

## 6. Out of scope

- Scoring, leaderboards, per-player results
- Persisting results between sessions or exporting them
- Any change to AI Detective behaviour
- Presenter notes / speaker view (the deck is simple enough to run from the slide itself)

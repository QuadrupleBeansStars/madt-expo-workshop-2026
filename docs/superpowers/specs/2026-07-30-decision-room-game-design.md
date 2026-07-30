# The Decision Room — design spec

**Workshop:** Data in Business, MADT Expo, 23 Aug 2026. Fifteen minutes.
**Supersedes** the interactive parts of `2026-07-21-data-strategy-workshop-design.md`. That spec's
visual language (§6) and bilingual rule (§2a) still govern. Its poll/vote slide model does not.

---

## 1. What changed and why

Four decisions from the project owner reshape the earlier design:

1. **The warm-up polls move to event registration.** Attendees answer five questions weeks ahead
   (`docs/registration-questions.md`). The dataset exists before the room sits down.
2. **Participation becomes a game.** Attendees run a cafe, decide with their own data, and compete
   on profit.
3. **Teaching interleaves with play** — teach, play, teach, play — rather than sitting in a block
   before or after.
4. **Outcomes are computed, not scripted.** A choice's result is derived from the audience's own
   registration answers.

Nobody is told that raw data is a cost. They discover it when their own data either does or does not
answer the question in front of them.

## 2. One flow, not two windows

An earlier draft had the teaching deck and the game as separate windows. **Interleaving kills that
idea**: alternating six or more times in fifteen minutes means six alt-tabs, and every switch is a
chance to land on the wrong screen in front of an audience.

Instead: **one host-driven sequence of typed stages**, on one route.

| Stage kind | Phones | What the room sees |
|---|---|---|
| `intro` | joining | Title, QR, player count |
| `data` | holding | A dashboard of the audience's own registration data |
| `decide` | **voting** | The question, the data that bears on it, a live timer |
| `outcome` | holding | What each choice did, why, and the leaderboard |
| `close` | holding | The three takeaways |

Teaching does not live in its own stage kind. **The `outcome` stage is the teaching**, because the
lesson is the payoff of the decision they just made. That is what makes it seamless: there is nothing
to switch to.

| Surface | Route | Driven by |
|---|---|---|
| Room view | `/biz` | Host, explicit advance + arrow keys |
| Player view | `/play` | The player's own phone |

One Next.js app, one server, one LAN address, one QR code. Phones join once, at the start, and
follow the host for the rest of the session.

## 3. The registration data is a swappable module

Registration answers arrive as a CSV after this is built. They enter the system at exactly one
place: `content/audience.ts`, which exports aggregate counts in a fixed shape.

```ts
export type AudienceAggregate = {
  respondents: number
  arrivalMode: Record<'walk' | 'train' | 'car' | 'moto', number>
  wakeTime: Record<'before6' | '6to8' | '8to10' | 'after10', number>
  firstDrink: Record<'coffee' | 'tea' | 'water' | 'nothing', number>
  buyTime: Record<'before7' | '7to9' | '9to11' | 'after11' | 'never', number>
  queuePatience: Record<'under3' | '3to5' | '5to10' | 'any', number>
}
```

Until real data lands the module holds **clearly-labelled placeholder figures**, and the UI renders a
`PLACEHOLDER DATA` badge wherever they appear. The badge is driven by an exported flag, not by a
hand-edited component, so shipping placeholders unnoticed is not possible.

`scripts/import-audience.ts` converts the registration CSV into this module. Swapping in real data
is: run the script, clear the flag, re-run the tests. Nothing else reads the CSV.

**Sampling honesty is a feature.** Registrants are not attendees; expect 50–70% turnout. The intro
names this out loud — a dataset describing a room that never showed up is the best unscripted
teaching moment available, and it costs nothing to build.

## 4. The simulator

This is the heart of the build, and the reason outcomes feel earned.

**It is not machine learning, and must never be described as such on screen.** There is no outcome
variable in the registration data to train against — five facts per person, no results. What the
data supports is a simulation: treat the respondents as the cafe's customer population and play
their stated behaviour forward against the player's choice.

```
arrivals per time bucket        ← buyTime (B4)
who buys at all                 ← firstDrink (B3), buyTime ≠ never
capacity = baristas × service rate × bucket minutes
wait time                       ← queue depth ÷ capacity
who walks out                   ← wait > their stated patience (B5)

profit = served × ticket − baristas × wage − waste
```

Four properties this must have:

- **Deterministic.** The same choice always yields the same result. No randomness anywhere. Tests
  stay stable, and two players who choose alike are ranked alike — which matters when the room can
  see the leaderboard.
- **Explainable to a named person.** The simulator returns not just a number but the chain that
  produced it, so the room can be told *"someone told us they'd wait three minutes. You staffed two
  baristas. They left at 7:14."* An unexplainable outcome teaches nothing.
- **Traceable to a question.** Every input maps to a registration question the audience personally
  answered. Nothing is invented to make the maths work.
- **Total.** Every choice must produce a defensible result, including deliberately bad ones. No
  choice may crash or return a degenerate score.

Economic constants — ticket price, wage, service rate, waste cost — live in one exported record with
a comment explaining each. They are the workshop's tuning knobs and the owner should be able to sanity
check them without reading code.

## 5. The game

### 5.1 Each player runs their own cafe

Every player holds their own KPI state, mutated by their own choices, carried across all rounds. This
is the core mechanical difference from the earlier deck, which only ever tallied a room.

```ts
type Kpi = { revenue: number; profit: number; satisfaction: number; waste: number }
```

`revenue`, `profit`, `satisfaction` rise as they improve; `waste` (unsold stock, ฿) is **inverted** —
lower is better. Inverting one metric is deliberate: a player who pushes every bar upward loses,
which is the workshop's argument compressed into a scoreboard.

`shopValue()` is the weighted sum, and the leaderboard ranks it. Ranking is what turns a poll into a
game; it is the reason anyone leans forward.

### 5.2 The fifteen minutes

| Time | Stage | Teaching beat |
|---|---|---|
| 0:00 | `intro` — join | — |
| 1:00 | `data` — this is you | You are the dataset |
| 2:30 | `decide` — how many baristas at 7am? | — |
| 3:30 | `outcome` + board | **Data is a cost until it changes a decision** |
| 5:00 | `data` — a competitor opens next door | — |
| 6:00 | `decide` — defend on speed or quality? | — |
| 7:00 | `outcome` + board | **Data depreciates — 7am's answer is not noon's** |
| 8:30 | `decide` — where does the last ฿20k go? | — |
| 9:30 | `outcome` + final board | **Sell the recurring decision, not the one-time data** |
| 11:00 | `close` — archetypes, three takeaways | — |

Roughly four minutes of slack. **Round 2 is the designated cut** if running long; rounds are
self-contained so dropping it needs no code change.

### 5.3 The three decisions

**Round 1 — Staffing.** *How many baristas at 7am?* The registration data is exactly sufficient.
Understaffing loses customers to the queue; overstaffing burns profit. The lesson lands because the
data worked, and the room feels it work.

**Round 2 — The twist.** A competitor opens next door with a shorter queue. `queuePatience` now means
something different than it did five minutes ago. Defend on speed, or on quality?

**Round 3 — Investment.** A fixed budget across three options with different KPI profiles: equipment
that cuts waste, marketing that lifts revenue thinly, or loyalty that compounds. The option that wins
on `shopValue()` is the recurring one, not the largest one-off.

### 5.4 Outcome

Final leaderboard plus an archetype per player from their strongest KPI — Operator, Grower, Host,
Efficient. Each archetype is flattery with a sting: it names the failure mode of that strategy.

## 6. What survives from the existing build

Honest accounting, since six tasks are already committed on `build-data-deck`.

**Survives as-is:** the visual foundation (`app/biz/deck.css`, `components/deck/Bilingual.tsx`,
`SlideFrame.tsx`), the bilingual chrome strings, and the store's persistence approach — atomic
temp-file-and-rename with corrupt-file fallback, now proven by tests.

**Survives with edits:** the stage machine in `lib/deck.ts`. Collapsing to one flow was what saved
it — host-driven advance, the server-owned clock, and voting-window logic all fit the new stage kinds
directly. `RevealSlide` and `ContentSlide` carry over as the basis for `outcome` and `close`.

**Rebuilt:** the vote layer. The room-level tally in `lib/deck-store.ts` and `app/api/deck/{join,vote}`
were built for aggregate polling. Their patterns carry — the monotonic `seq` guard, fail-closed token
auth, the exhaustive-switch vote result — but the code is rebuilt around per-player KPI state.

**Retires:** the three hook polls and three beat votes in `content/deck.ts`. The beats survive as
teaching, delivered through `outcome` stages.

## 7. Non-negotiables carried forward

- Both languages render at once — English headline, Thai subline. **No language toggle.** No
  component takes a `lang` prop.
- Never use `Press Start 2P` anywhere in this workshop. It has no Thai glyphs.
- Do not modify any AI Detective file. `lib/game.ts`, `lib/store.ts`, `lib/i18n.ts`,
  `content/cases.ts`, `app/page.tsx`, `app/tv/`, `app/dashboard/`,
  `app/api/{state,join,answer,control,reset}/` are off-limits without exception.
- `FACILITATOR_TOKEN` gates every host control and fails closed when unset. It is currently the
  public string `madt2026` and **must be changed before 23 Aug** — owner's task.
- Phones must work over the venue LAN by IP. `allowedDevOrigins` in `next.config.ts` is what makes
  that possible; do not remove it.

## 8. Deferred

**Persona clustering.** Unsupervised segmentation of the registration data into two or three
customer types would be honest and would make a good reveal, but it is not load-bearing and fifteen
minutes has no room for it. Revisit only if the slot grows.

## 9. Risks

**Fifteen minutes is binding.** Three rounds with timed voting and leaderboards is roughly eleven
minutes. Round 2 is the designated cut.

**Turnout is unknown.** A thin dataset makes sparse charts. The placeholder module makes this
testable at any N before the day.

**The economic constants are guesses until reviewed.** Ticket price, wage, and service rate decide
whether any choice is obviously right, which would flatten the game. They need one pass from someone
who knows Thai cafe economics, and they are isolated in one file to make that easy.

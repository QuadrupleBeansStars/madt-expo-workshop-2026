# The Decision Room — design spec

**Workshop:** Data in Business, MADT Expo, 23 Aug 2026. Fifteen minutes.
**Supersedes** the interactive parts of `2026-07-21-data-strategy-workshop-design.md`. That spec's
visual language (§6) and bilingual rule (§2a) still govern. Its poll/vote slide model does not.

---

## 1. What changed and why

Three decisions from the project owner reshape the earlier design:

1. **The warm-up polls move to event registration.** Attendees answer five questions weeks ahead
   (`docs/registration-questions.md`). The dataset exists before the room sits down.
2. **The slide deck no longer takes votes.** It is pure presentation, driven by the host.
3. **All participation happens in a separate game**, in its own window, where attendees run a cafe
   and compete on the outcome.

The teaching now rides on the game rather than sitting beside it. Nobody is told that raw data is a
cost; they discover it when their own registration data fails to answer the question in front of
them.

## 2. Two surfaces, one server

| Surface | Route | Who drives it | Phones |
|---|---|---|---|
| Teaching deck | `/biz` | Host, arrow keys | Not connected |
| Game — room view | `/biz/game` | Host, explicit stage advance | Connected |
| Game — player view | `/play` | The player | This is the phone |

**One Next.js app, one server, one LAN address, one QR code.** This is the load-bearing constraint.
Two separate apps would force sixty people to re-join partway through a fifteen-minute session, and
that is where live sessions die. The host switches windows; the audience does nothing.

While the host is on a teaching slide, the game is simply not advancing. Phones show a holding
state pointing at the big screen. No phone action is ever required to follow a window switch.

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

Until the real data lands, the module holds **clearly-labelled placeholder figures** and the UI
renders a `PLACEHOLDER DATA` badge wherever they appear. The badge is driven by an exported flag,
not by a hand-edited component, so removing it is impossible to forget.

A script, `scripts/import-audience.ts`, converts the registration CSV into this module. Swapping in
real data is: run the script, delete the flag, re-run the tests. Nothing else in the codebase reads
the CSV.

**Sampling honesty is a feature, not an embarrassment.** Registrants are not attendees; expect
50–70% turnout. The deck names this out loud — a dataset describing a room that never showed up is
the best unscripted teaching moment available, and it costs nothing to build.

## 4. The game

### 4.1 Each player runs their own cafe

This is the core mechanical difference from the earlier deck, which only ever tallied a room. Every
player holds their own KPI state, mutated by their own choices, carried across all rounds.

```ts
type Kpi = { revenue: number; profit: number; satisfaction: number; waste: number }
```

`revenue`, `profit`, `satisfaction` rise as they improve; `waste` (unsold stock, ฿) is **inverted**
— lower is better. Inverting one KPI is deliberate: a player who optimizes every bar upward loses,
which is the whole argument of the workshop compressed into a scoreboard.

Score is a weighted sum, `shopValue()`, shown as a leaderboard after each round. Ranking players is
what converts a poll into a game; it is the reason anyone leans forward.

### 4.2 Three rounds

Each round is: **data on screen → decision on phones → outcome + leaderboard.** Rounds are
self-contained, so the host can drop round 2 on the day without touching code.

**Round 1 — Staffing.** *How many baristas at 7am?* The registration data (`buyTime`,
`queuePatience`, `firstDrink`) is exactly sufficient to answer this. Understaffing loses customers
to the queue; overstaffing burns profit.

→ **Teaching beat: strategy is matching data you can collect to a decision you control.** It lands
because the data worked here, and the audience feels it work.

**Round 2 — The twist.** New information arrives that reframes round 1: a competitor opens next
door with a shorter queue. Now `queuePatience` means something different than it did five minutes
ago. The decision is whether to defend on speed or on quality.

→ **Teaching beat: data depreciates. The answer that was right at 7am is not right at noon.**

**Round 3 — Investment.** A fixed budget across three options with different KPI profiles: equipment
that cuts waste, marketing that lifts revenue thinly, or loyalty that compounds slowly. The option
that wins on `shopValue()` is the recurring one, not the largest one-off gain.

→ **Teaching beat: monetize the recurring decision, not the one-time data.**

### 4.3 Outcome

Final leaderboard plus an archetype per player derived from their strongest KPI — Operator, Grower,
Host, Efficient. The archetype is flattery with a sting: each carries the failure mode of that
strategy.

## 5. What survives from the existing build

Honest accounting, because six tasks are already committed on `build-data-deck`.

**Survives as-is:** the visual foundation (`app/biz/deck.css`, `components/deck/Bilingual.tsx`,
`SlideFrame.tsx`), the bilingual chrome strings, `RevealSlide` and `ContentSlide` in the content
model, and the store's persistence approach — atomic temp-file-and-rename with corrupt-file
fallback, now proven by tests.

**Relocates:** the vote layer. `PollSlide` and `VoteSlide`, the room-level tally in
`lib/deck-store.ts`, and `app/api/deck/{join,vote}` were built for a deck that no longer votes.
Their patterns carry over to the game store — the monotonic `seq` guard, fail-closed token auth, the
exhaustive-switch vote result — but the code is rebuilt around per-player KPI state rather than
adapted.

**Retires:** the three hook polls and three beat votes in `content/deck.ts`. The beats survive as
teaching, delivered through game outcomes instead of slides.

## 6. Non-negotiables carried forward

- Both languages render at once — English headline, Thai subline. **No language toggle.** No
  component takes a `lang` prop.
- Never use `Press Start 2P` anywhere in this workshop. It has no Thai glyphs.
- Do not modify any AI Detective file. `lib/game.ts`, `lib/store.ts`, `lib/i18n.ts`,
  `content/cases.ts`, `app/page.tsx`, `app/tv/`, `app/dashboard/`, `app/api/{state,join,answer,control,reset}/`
  are off-limits without exception.
- `FACILITATOR_TOKEN` gates every host control and fails closed when unset. It is currently the
  public string `madt2026` and **must be changed before 23 Aug** — owner's task, tracked outside
  this spec.
- Phones must work over the venue LAN by IP. `allowedDevOrigins` in `next.config.ts` is what makes
  that possible; do not remove it.

## 7. Risks

**Fifteen minutes is the binding constraint.** Three rounds with timed voting and leaderboards is
roughly eleven minutes, leaving four for framing and close. There is no slack. Round 2 is the
designated cut.

**Turnout is unknown.** If far fewer people register than attend, the dataset is thin and the charts
look sparse. The placeholder module makes this testable ahead of time at any N.

**Window switching is a live risk.** Rehearse it. The mitigation is architectural — shared server,
so a mis-timed switch costs seconds rather than a re-join — but it still wants practice.

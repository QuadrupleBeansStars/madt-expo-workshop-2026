# The Decision Room — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fifteen-minute workshop where attendees run a cafe, decide using data they themselves
supplied at registration, and are ranked on the profit their decisions actually produce.

**Architecture:** One Next.js route (`/biz`) renders a host-driven sequence of typed stages; phones
join once at `/play` and follow. A deterministic simulator computes each choice's outcome from the
audience's registration answers, so results are earned rather than scripted. Server owns all state;
clients poll and never compute the clock.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Zod v4, Tailwind v4 (CSS-first),
Vitest + Testing Library (jsdom).

**Spec:** `docs/superpowers/specs/2026-07-30-decision-room-game-design.md`

## Global Constraints

- **Do NOT modify any AI Detective file.** Off-limits without exception: `lib/game.ts`,
  `lib/store.ts`, `lib/types.ts`, `lib/stats.ts`, `lib/scoring.ts`, `lib/i18n.ts`,
  `content/cases.ts`, `app/page.tsx`, `app/tv/`, `app/dashboard/`,
  `app/api/{state,join,answer,control,reset}/`.
- **Both languages render at once** — English headline, Thai subline. There is NO language toggle.
  No component takes a `lang` prop.
- **Never use `Press Start 2P`** in this workshop. It has no Thai glyphs.
- **Visual language** is a sibling of `~/Desktop/MADT-IS/pitch/index.html`, NOT AI Detective.
- **The simulator is never called ML, AI, or a model on any user-facing surface.** It is a
  simulation over the audience's own answers. See spec §4.
- **The simulator is deterministic.** No `Math.random()`, no `Date.now()` inside outcome
  computation. Same input, same output, always.
- `FACILITATOR_TOKEN` gates every host control and **fails closed when unset** — return 403, never
  fall open. No host/origin check may be used for authorization (see the note in
  `app/api/reset/route.ts` for why).
- **Accepted duplication (decided by the project owner):** the game store's `persist()`/`load()`
  intentionally duplicate `MemoryRoomStore`'s. Do not flag; do not refactor.
- Reuse without modification: `app/biz/deck.css`, `components/deck/Bilingual.tsx`,
  `components/deck/SlideFrame.tsx`, `content/deck-strings.ts`.

---

### Task 1: Audience data module

**Files:**
- Create: `content/audience.ts`
- Test: `content/audience.test.ts`

**Interfaces:**
- Produces: `AudienceAggregate` type, `AUDIENCE: AudienceAggregate`, `IS_PLACEHOLDER: boolean`,
  and `bucketTotal(rec: Record<string, number>): number`.

The registration CSV does not exist yet. This module is the single seam where it will enter, so
everything downstream can be built and tested now.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { AUDIENCE, IS_PLACEHOLDER, bucketTotal } from './audience'

describe('audience aggregate', () => {
  it('every bucket sums to the respondent count', () => {
    expect(bucketTotal(AUDIENCE.arrivalMode)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.wakeTime)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.firstDrink)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.buyTime)).toBe(AUDIENCE.respondents)
    expect(bucketTotal(AUDIENCE.queuePatience)).toBe(AUDIENCE.respondents)
  })

  it('has no negative counts', () => {
    const all = [AUDIENCE.arrivalMode, AUDIENCE.wakeTime, AUDIENCE.firstDrink,
                 AUDIENCE.buyTime, AUDIENCE.queuePatience]
    for (const rec of all) for (const v of Object.values(rec)) expect(v).toBeGreaterThanOrEqual(0)
  })

  it('flags itself as placeholder until real data lands', () => {
    expect(typeof IS_PLACEHOLDER).toBe('boolean')
  })
})
```

- [ ] **Step 2: Run it, confirm it fails** — `npx vitest run content/audience.test.ts`

- [ ] **Step 3: Implement**

Export the `AudienceAggregate` type exactly as in spec §3. Set `respondents: 180` and fill each
bucket with plausible figures that **sum to exactly 180**. Shape them so the workshop has a story:
a real morning peak in `buyTime.7to9`, and a `queuePatience` distribution weighted toward
`under3`/`3to5` so understaffing genuinely costs customers.

Set `IS_PLACEHOLDER = true` with a comment naming what clears it.

- [ ] **Step 4: Run tests, confirm pass**

- [ ] **Step 5: Commit** — `feat(room): audience aggregate with placeholder registration data`

---

### Task 2: The CSV import script

**Files:**
- Create: `scripts/import-audience.ts`
- Test: `scripts/import-audience.test.ts`

**Interfaces:**
- Consumes: the `AudienceAggregate` shape from Task 1.
- Produces: `parseAudienceCsv(csv: string): AudienceAggregate` — pure, exported, testable. The
  file-writing wrapper is a thin `main()` around it.

Keep parsing pure and separate from I/O so it can be tested without a filesystem.

- [ ] **Step 1: Write the failing test**

Cover: a well-formed CSV with 3 rows produces correct counts; unknown option labels raise a clear
error naming the row and column (silent miscounting on the day would be much worse than a crash
now); an empty CSV raises; a row missing a column raises.

- [ ] **Step 2: Run it, confirm it fails**

- [ ] **Step 3: Implement**

Map the exact option labels from `docs/registration-questions.md` to the bucket keys. The
registration team may return Thai or English labels — accept both, since you cannot control which
the form exports.

- [ ] **Step 4: Run tests, confirm pass**

- [ ] **Step 5: Commit** — `feat(room): CSV import for registration answers`

---

### Task 3: The simulator

**This is the most important task in the plan.** Read spec §4 in full before starting.

**Scope — read this first.** Only **round 1 (staffing)** is simulated. Rounds 2 and 3 apply fixed
KPI deltas per option, as the reference prototype does. This is deliberate: round 1 is where "your
own data decided this" has to land, and it is the only decision the registration questions can
actually resolve. Round 2 turns on price sensitivity and round 3 on capital allocation — neither is
in the five questions, so simulating them would mean inventing inputs, which is exactly the
dishonesty this workshop argues against. Do not build `simulateDefend` or `simulateInvest`.

**Files:**
- Create: `lib/sim.ts`
- Test: `lib/sim.test.ts`

**Interfaces:**
- Consumes: `AUDIENCE` from Task 1.
- Produces:
  ```ts
  export type SimConstants = {
    ticketBaht: number          // average spend per customer
    baristaWageBaht: number     // per shift, per barista
    servedPerBaristaPerMin: number
    wastePerUnsoldBaht: number
  }
  export const CONSTANTS: SimConstants

  export type SimTrace = {
    arrivals: number            // customers who wanted to buy
    capacity: number            // how many could be served
    served: number
    lostToQueue: number         // walked out — wait exceeded stated patience
    waitMinutes: number
  }
  export type SimResult = {
    revenue: number; profit: number; satisfaction: number; waste: number
    trace: SimTrace
  }
  export function simulateStaffing(baristas: number, a: AudienceAggregate): SimResult
  ```

`trace` is not diagnostic clutter — it is what the outcome screen renders to explain *why* a choice
scored as it did. Do not omit it.

- [ ] **Step 1: Write the failing tests**

These are the properties that matter; write them all before implementing.

```ts
describe('simulateStaffing', () => {
  it('is deterministic — same input, same output', () => {
    expect(simulateStaffing(2, AUDIENCE)).toEqual(simulateStaffing(2, AUDIENCE))
  })

  it('more baristas serve at least as many customers', () => {
    for (const n of [1, 2, 3, 4]) {
      expect(simulateStaffing(n + 1, AUDIENCE).trace.served)
        .toBeGreaterThanOrEqual(simulateStaffing(n, AUDIENCE).trace.served)
    }
  })

  it('profit is not monotonic in staffing — overstaffing costs money', () => {
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, AUDIENCE).profit)
    const best = profits.indexOf(Math.max(...profits))
    expect(best).toBeGreaterThan(0)                  // understaffing is not optimal
    expect(best).toBeLessThan(profits.length - 1)    // nor is maximum staffing
  })

  it('the winning choice wins by a visible margin', () => {
    // An interior optimum is not enough: [10, 11, 10.5, 10, 9] passes the test above
    // and is an unreadable flat curve on a projector. The room must be able to SEE
    // that one answer beat the next-best one.
    const profits = [1, 2, 3, 4, 5].map((n) => simulateStaffing(n, AUDIENCE).profit)
    const sorted = [...profits].sort((a, b) => b - a)
    expect(sorted[0]).toBeGreaterThan(sorted[1] * 1.15)   // best beats runner-up by >15%
    expect(sorted[0]).toBeGreaterThan(sorted[4] * 2)      // best is at least double the worst
  })

  it('served + lostToQueue never exceeds arrivals', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const t = simulateStaffing(n, AUDIENCE).trace
      expect(t.served + t.lostToQueue).toBeLessThanOrEqual(t.arrivals)
    }
  })

  it('returns a defensible result for every legal choice, including bad ones', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const r = simulateStaffing(n, AUDIENCE)
      expect(Number.isFinite(r.profit)).toBe(true)
      expect(r.revenue).toBeGreaterThanOrEqual(0)
      expect(r.trace.served).toBeGreaterThanOrEqual(0)
    }
  })

  it('nobody is lost to the queue when capacity exceeds arrivals', () => {
    const r = simulateStaffing(20, AUDIENCE)
    expect(r.trace.lostToQueue).toBe(0)
  })
})
```

> **The non-monotonic profit test is the one that matters most.** If profit rises with every extra
> barista, the game has one obviously-correct answer and the workshop is dead. That test failing
> means the constants need tuning, not that the test is wrong.

- [ ] **Step 2: Run them, confirm they fail**

- [ ] **Step 3: Implement**

Follow the model in spec §4. Derive arrivals in the morning peak from `buyTime`, restrict to people
who actually buy (`firstDrink.coffee` plus non-`never` `buyTime`), compute capacity from baristas and
the service rate, derive a wait from queue depth over capacity, and drop the share of the
`queuePatience` distribution whose stated tolerance is below that wait.

`satisfaction` falls with wait time. `waste` rises when capacity is prepped for customers who never
get served.

**No randomness. No wall-clock reads.** Tune `CONSTANTS` until the non-monotonic test passes with a
clear interior optimum — that optimum is the game's answer.

- [ ] **Step 4: Run tests, confirm pass**

- [ ] **Step 5: Commit** — `feat(room): deterministic staffing simulator over audience data`

---

### Task 4: Stage content model and the stage list

**Files:**
- Create: `lib/room-types.ts`, `content/room.ts`
- Test: `content/room.test.ts`
- Read for reference (do not modify): `lib/deck-types.ts`

**Interfaces:**
- Produces: `Stage` discriminated union over `kind`, and `STAGES: Stage[]`.

Stage kinds are `intro`, `data`, `decide`, `outcome`, `close` (spec §2). Model them as Zod schemas
in a discriminated union on `kind`, following the existing style in `lib/deck-types.ts`.

`decide` stages carry `options` (2–4), a `durationMs`, and a **resolution**: either
`{ resolve: 'simulate-staffing' }` (round 1 only) or `{ resolve: 'fixed', fx: Partial<Kpi> }` per
option (rounds 2 and 3). See Task 3's scope note for why only one round is simulated. Model the
resolution as a discriminated union so a stage cannot claim both.

`outcome` stages carry `forStageId`, plus `lesson` — the teaching beat, which is the whole reason
this stage kind exists.

**Design constraint on the round 3 options.** At least one option must raise `revenue` *and* raise
`waste`. Without that, waste only ever rises from overstaffing — which already suppresses profit —
so it is redundant with profit rather than a real trade-off, and spec §5.1's claim that a player
who maximises every bar loses becomes unreachable. The marketing option is the natural home for
this: more customers drawn in, more stock prepped, more of it thrown away.

Every user-facing string is `LocalizedText` (`{ th, en }`), both rendered at once.

- [ ] **Step 1: Write the failing test**

Assert: every stage id is unique; every `outcome.forStageId` names a real `decide` stage; every
`decide` has 2–4 options with unique ids; every localized string has non-empty `th` and `en`; the
sequence contains exactly three `decide` stages; exactly one stage resolves via
`simulate-staffing` and every other `decide` supplies `fx` for all its options; at least one round
3 option has both positive `revenue` and positive `waste` in its `fx`.

**Assert the whole time budget, not just the voting slice.** Sum `durationMs` across decide stages
*plus* a stated allowance per non-decide stage (put the allowance in a named constant —
`ALLOWANCE_MS` — with a comment that it is the host's talking time). The total must come in under
fifteen minutes. Guarding only the voting slice leaves the real timing risk unguarded, and timing
is the constraint most likely to break this workshop on the day.

- [ ] **Step 2: Run it, confirm it fails**

- [ ] **Step 3: Implement**

Write the stages per spec §5.2 and §5.3. Copy all Thai and English copy **verbatim** from the spec
where given; where the spec gives only intent, write both languages and keep them equivalent in
meaning, not word-for-word.

- [ ] **Step 4: Run tests, confirm pass**

- [ ] **Step 5: Commit** — `feat(room): stage model and the fifteen-minute sequence`

---

### Task 5: Stage machine

**Files:**
- Create: `lib/room.ts`
- Test: `lib/room.test.ts`
- Read for reference: `lib/deck.ts` — its host-advance and clock logic is the basis for this.

**Interfaces:**
- Consumes: `STAGES` from Task 4.
- Produces: `STAGE_COUNT`, `LOBBY_STATE`, `remainingMs(s, now)`, `votingOpen(s, now)`,
  `advance(s, now)`, `currentStage(s)`, `acceptsVotes(stage): stage is DecideStage`.

`acceptsVotes` **must be a type predicate**, not a `boolean` — the stage union has no shared
`options` field, so a boolean return fails to narrow and breaks `tsc` at every call site. This
exact bug cost a review cycle on the previous build.

The server owns the clock. `remainingMs` derives from `stageStartedAt + durationMs` and is never
computed on a client. The timer closes voting; **it never advances the stage** — only the host does
that.

- [ ] **Step 1: Write the failing tests**

Cover: advance moves through every stage and stops at the last; `remainingMs` is 0 outside `decide`;
voting closes at the boundary (`stageStartedAt + durationMs` is exclusive); an early host close
shuts voting immediately; `acceptsVotes` narrows correctly for each stage kind.

- [ ] **Step 2: Run them, confirm they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): stage machine with host-driven advance`

---

### Task 6: Game store with per-player KPI

**Files:**
- Create: `lib/room-store.ts`
- Test: `lib/room-store.test.ts`
- Read for reference (DO NOT MODIFY): `lib/store.ts`, `lib/deck-store.ts`

**Interfaces:**
- Consumes: `simulateStaffing` (Task 3), the stage machine (Task 5).
- Produces: `getRoomStore()`, and a store exposing `join`, `vote`, `advance`, `reset`,
  `getPublicState(now, playerId?)`, `getLeaderboard()`.

Each player carries `{ id, name, kpi: Kpi, choices: Record<stageId, optionId>, joinedAt }`. KPI
state is **per player and carried across rounds** — this is the mechanical difference from the deck
store, which only tallied a room.

When a `decide` stage closes, resolve every player's choice and apply the result to their KPI. The
stage's resolution decides how: `simulate-staffing` runs the choice through `simulateStaffing`
(round 1 only); `fixed` applies the option's `fx` deltas (rounds 2 and 3). Players who did not vote
take the first option's outcome, so the leaderboard never has holes.

`shopValue(kpi)` is the weighted sum used for ranking. **`waste` is inverted** — it subtracts.

Persistence follows `lib/deck-store.ts` exactly: atomic temp-file write then rename, corrupt-file
fallback to a clean state, and a monotonic `seq` bumped on every mutation. Per the Global
Constraints, the duplication with `MemoryRoomStore` is accepted and must not be refactored.

- [ ] **Step 1: Write the failing tests**

Cover: join is idempotent per player id; a re-vote replaces rather than adds (`voteCount` must not
rise); KPI carries across two rounds; non-voters get the default outcome; `shopValue` ranks a
low-waste player above an otherwise-identical high-waste one; `seq` rises on every mutation and never
falls; persist/load round-trips; a corrupt state file falls back cleanly rather than wedging.

> The persist/load tests are not optional. That exact path shipped a critical wedge bug in the
> sibling store, which is why it is called out here.

- [ ] **Step 2: Run them, confirm they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): per-player KPI store resolved through the simulator`

---

### Task 7: API routes

**Files:**
- Create: `app/api/room/{state,join,vote,control,reset}/route.ts`
- Test: `app/api/room/routes.test.ts`

**Interfaces:**
- Consumes: `getRoomStore()` from Task 6.

`GET /api/room/state?playerId=…` returns the public state plus, when `playerId` is present, that
player's own KPI, rank, and current-stage vote. `POST /api/room/join` takes a display name.
`POST /api/room/vote` takes `{ playerId, stageId, optionId }`. `control` and `reset` require the
facilitator token.

Every route handler takes `(req: Request)` even when unused — a handler declared with no parameter
while its test passes a `Request` fails `tsc` with TS2554, which vitest will not catch. Prefix with
`_req` if genuinely unused.

Auth **fails closed**: unset `FACILITATOR_TOKEN` returns 403. Do not add a host or origin check —
read the comment in `app/api/reset/route.ts` for why it cannot work here.

The vote result switch must be **exhaustive over the result union**, so that adding a variant later
is a compile error rather than a 500 at the venue.

- [ ] **Step 1: Write the failing tests** — happy paths, 403 on unset token, 403 on wrong token,
      400 on malformed body, 409 on a vote after close.
- [ ] **Step 2: Run them, confirm they fail**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): API namespace for state, join, vote and host control`

---

### Task 8: Data dashboard components

**Files:**
- Create: `components/room/DataPanel.tsx`, `components/room/Bars.tsx`,
  `components/room/PlaceholderBadge.tsx`
- Test: `components/room/DataPanel.test.tsx`

**Interfaces:**
- Consumes: `AUDIENCE`, `IS_PLACEHOLDER` (Task 1); `deck.css` and `Bilingual.tsx` (existing).

Renders the audience's registration data as bars. Pure SVG or CSS — **no charting library**, matching
the reference deck's approach.

`PlaceholderBadge` renders when and only when `IS_PLACEHOLDER` is true. Test both branches; this is
the guard that stops placeholder figures reaching the venue unnoticed.

Both languages at once. No `lang` prop anywhere.

- [ ] **Step 1: Write the failing test** — bars render one row per bucket with correct proportional
      widths; the badge appears iff `IS_PLACEHOLDER`; Thai and English both present in the DOM.
- [ ] **Step 2: Run it, confirm it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): audience data panel with placeholder guard`

---

### Task 9: Room view

**Files:**
- Create: `app/biz/page.tsx`, `components/room/Stages.tsx`, `components/room/Leaderboard.tsx`
- Test: `components/room/Stages.test.tsx`
- Read for reference: `~/Desktop/MADT-IS/pitch/index.html` (visual language),
  `app/tv/page.tsx` (polling and QR patterns only — do not modify it)

The big screen. Polls `/api/room/state`, renders the current stage by kind, and gives the host an
advance control gated behind the facilitator token. Arrow keys advance.

Follow the polling discipline already proven in this repo: a monotonic `seq` guard, and keep the last
good frame on a transient fetch failure rather than blanking the screen.

The `outcome` stage renders the simulator's `trace` as the explanation — arrivals, served, lost to
the queue, and why — then the lesson, then the leaderboard. **This stage is the teaching**; give it
the most design attention.

Show the join QR and URL during `intro`. The QR is computed client-side, so its absence is the tell
that hydration has failed — see the LAN section of `README.md`.

- [ ] **Step 1: Write the failing test** — each stage kind renders its distinctive elements;
      the seq guard drops a stale frame; a fetch failure keeps the previous frame.
- [ ] **Step 2: Run it, confirm it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): room view with stage rendering and leaderboard`

---

### Task 10: Player view

**Files:**
- Create: `app/play/page.tsx`, `components/room/PhoneBody.tsx`
- Test: `components/room/PhoneBody.test.tsx`

The phone. Join with a display name, then follow the host: during `decide`, big tappable option
buttons and a timer; during every other stage, a holding screen pointing at the big screen plus the
player's own KPI and rank.

**Learn from the AI Detective bug:** if the server no longer recognises a player id — because the
room was reset — the phone must detect this from the state poll and return to the join screen
immediately. Do not wait for a failed vote to discover it; that strands players on a dead screen and
then ejects them mid-round.

Queue a vote locally and retry if the network drops. Never re-queue a vote the server rejected with
409 (round closed).

- [ ] **Step 1: Write the failing test** — join flow; option tap posts once; timer expiry disables
      options; **an unknown-player state response returns to the join screen**; a 409 is not retried.
- [ ] **Step 2: Run it, confirm it fails**
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run tests, confirm pass**
- [ ] **Step 5: Commit** — `feat(room): player view with reset recovery`

---

### Task 11: Full check and LAN playthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** `npx vitest run` — full suite green, no regressions in the AI Detective tests.
- [ ] **Step 2:** `npx tsc --noEmit` — clean.
- [ ] **Step 3:** `grep -ri "press start" app/biz app/play components/room` — must return nothing.
- [ ] **Step 4:** Verify no AI Detective file is in the branch diff:
      `git diff --stat main...HEAD -- lib/store.ts lib/game.ts lib/i18n.ts content/cases.ts app/page.tsx app/tv app/dashboard`
      must be empty.
- [ ] **Step 5:** Build and run over the LAN (`npm run build && npm run start:lan`). With a real
      phone on the venue-like network: join, play all three rounds, confirm the leaderboard updates
      and the outcome traces render. **Reset mid-session and confirm the phone returns to join.**
- [ ] **Step 6: Delete the superseded deck build.** `content/deck.ts`, `lib/deck.ts`,
      `lib/deck-types.ts`, `lib/deck-store.ts`, and `app/api/deck/` implement the poll-and-tally
      model this plan replaces. Nothing in the room build imports them. Delete them and their tests
      in one commit, so the final review sees a coherent branch rather than two competing designs.
      **Keep** `app/biz/deck.css`, `components/deck/Bilingual.tsx`, `components/deck/SlideFrame.tsx`,
      and `content/deck-strings.ts` — those are live. Confirm with `npx vitest run` and
      `npx tsc --noEmit` after deleting.
- [ ] **Step 7:** Update `README.md` with the room's URLs, the host token note, and the
      run-day sequence.
- [ ] **Step 8: Commit** — `docs: run-day instructions for The Decision Room`

---

## Post-plan, owner-owned

These are not implementation tasks; they need the project owner.

1. **Change `FACILITATOR_TOKEN`** from the public `madt2026` before 23 Aug.
2. **Sanity-check the economic constants** in `lib/sim.ts` — ticket price, wage, service rate. They
   decide whether the game has an interesting answer.
3. **Run `scripts/import-audience.ts`** when the registration CSV arrives, then clear
   `IS_PLACEHOLDER` and re-run the suite.

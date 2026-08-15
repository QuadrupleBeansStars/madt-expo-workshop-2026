# MADT Expo 2026 — two workshops, one app

**23 Aug 2026.** Both workshops run from this one repo and one server, on different routes.

| | Workshop | Projector | Phones | Length |
|---|---|---|---|---|
| 1 | [**AI Detective**](#ai-detective) — think with AI, not just trust AI | `/tv` | `/` | 5 cases |
| 2 | [**The Decision Room**](#the-decision-room) — you are the dataset | `/biz` | `/play` | 15 min |

Shared, and worth reading whichever workshop you are running: [Run it](#run-it) ·
[the LAN gotcha](#the-lan-gotcha-blank-unclickable-pages) ·
[the projector check](#the-projector-check) · [Deploying](#deploying)

---

# AI Detective

> Think with AI, not just trust AI.

A synchronized, **Kahoot-style** quiz about AI hallucination. One **TV** drives the room through 5
rounds; players follow on their **phones**. Each round opens on a short **storyboard**, then the
question and the AI "duck's" confident answer beside the **Case File** — the retrieval manifest and
the documents the AI did (and did not) find. All of that is on the projector; the phone shows the
question and four answer cards, nothing else. Tap A/B/C/D before the timer runs out. The reveal
shows the punchline (*"73% of you believed the AI"*) **and the running
standings**, so there is something to play for in the middle of the game rather than only at the
end.

Answer windows are **45-60 seconds** (45s easy → 60s for the harder cases), and the host can close
a question early when the room has visibly finished.

🧠 **[What each question is doing to the player](docs/question-design.md)** — the design intent
behind every question in **both** workshops: what we are trying to make a player think, why they
fall for it, which knob to turn to change it, and what not to break. **Start here if you want to
argue with a question.**

📖 **[The five cases — what each one teaches](docs/cases.md)** — per-case sources, the point of each
failure mode, why every wrong answer is wrong, and which evidence is real vs. deliberately invented.
Read this before facilitating.

## Run it

```bash
npm install
cp .env.local.example .env.local     # sets FACILITATOR_TOKEN (Start/Next/reset secret) — CHANGE THE VALUE
npm run build                        # ONCE, online — bundles the fonts so the app runs offline
npm run start:lan                    # production server, binds 0.0.0.0 so phones can reach it
ipconfig getifaddr en0               # your IP — players go to http://<that-ip>:3000
```

> **Run the day on `start:lan`, not `dev:lan`.** The production server has no dev-only origin
> restrictions (see [LAN gotcha](#the-lan-gotcha-blank-unclickable-pages)), starts faster, and is
> the mode the room should see. Use `dev:lan` only while editing code.

| URL | Who | What |
| --- | --- | --- |
| `http://<ip>:3000` | Players (phones) | Codename → follow the rounds → tap answers |
| `http://<ip>:3000/tv` | TV / projector | The stage + host controls (**Start**, **Close it**, **Next**) |
| `http://<ip>:3000/dashboard` | Optional 2nd screen | Stats Wall / Leaderboard — press **L** to switch |

### Running a session

1. **TV:** open `/tv`, type the `FACILITATOR_TOKEN` into the **Host token** box (top-right).
2. **Players:** open `http://<ip>:3000` on their phones and pick a codename — they appear in the
   TV lobby.
3. Press **Start** on the TV. Each round's answer window is timed (**45s** easy / **50s** medium /
   **60s** for the three hardest cases); it auto-advances to the reveal when the timer ends **or**
   everyone has answered.
4. If the room has clearly finished before the clock does, press **⏭ Close it — reveal now**. It
   sits under the answered count, which is the number you read to decide. It stops on the reveal
   and never skips a case — cutting a question short and skipping its explanation are different
   acts, and the button deliberately cannot do the second.
5. Press **Next** on the TV to leave each reveal and begin the next round. After round 5, Next
   shows the final leaderboard.
6. Latecomers who open the app mid-game **spectate** until you reset for the next session.

Total answering time across all five cases is **4m35s**, so budget the session around how long you
talk over the reveals, not around the clocks.

> The host controls need `FACILITATOR_TOKEN` set in the server environment (`.env.local` is loaded
> automatically, in production too). Inline alternative:
> `FACILITATOR_TOKEN=<your-token> npm run start:lan`.

## Clearing the room between sessions

`/api/reset` is **token-protected** — it will not clear the room, and will not even respond to a
plain `curl -X POST`, unless the facilitator token matches.

```bash
curl -X POST http://localhost:3000/api/reset -H "x-facilitator-token: <your-token>"
```

A `200 {"ok":true}` means the room was cleared and returned to the lobby; every phone drops back to
the codename screen with a "session was reset" message **on its own, within about a second**
(expected — players just re-enter a codename). Nobody has to reload, and nobody is ejected
mid-round: the phone learns the room was reset from its next poll, not from a tap that fails. If `FACILITATOR_TOKEN` is unset, `/api/reset` and `/api/control` are **disabled** and
always return `403`.

### Why control needs a token

In Next.js route handlers, `req.url`'s hostname is **always** `localhost`, regardless of which
laptop on the LAN actually sent the request — because the dev server runs with `-H 0.0.0.0` so
phones can reach it. Any "localhost-only" check would therefore be inert and would let **any phone
on the LAN drive or wipe the live room**. The shared token is the only real guard — treat it like
any secret for the day (a sticky note on the laptop is fine).

> ⚠️ **This repo is public.** `madt2026` in `.env.local.example` is a placeholder and is visible to
> anyone — do **not** run the event on it. Put a different value in your (gitignored) `.env.local`,
> or any attendee could look it up and reset the room mid-session.

## The LAN gotcha: blank, unclickable pages

**Symptom:** the TV and phone pages render and look correct, but nothing responds — **Start** does
nothing, typing a codename never enables **Begin the mission**, and the TV's join URL and QR code
are missing entirely. Only happens when you reach the app by **IP** (`http://10.x.x.x:3000`), never
via `localhost`.

**Cause:** Next.js blocks cross-origin requests to dev-only resources. Reaching the dev server from
a LAN IP gets `/_next/webpack-hmr` blocked, React never hydrates, and you're left with static HTML
that has no event handlers attached. The missing QR is the tell — it's computed client-side, so its
absence means client JS never ran. Check the server log for:

```
⚠ Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "10.88.20.122".
```

**Fixed** in `next.config.ts` via `allowedDevOrigins`. Patterns match per dot-segment, so the
private ranges below cover any venue IP without hardcoding one:

```ts
allowedDevOrigins: ['10.*.*.*', '192.168.*.*', '172.*.*.*'],
```

This applies to `dev`/`dev:lan` only — `npm run start:lan` is unaffected, which is the other reason
to run the day in production mode.

## Player experience notes

A phone stores only its **identity** (`playerId` + codename) in `localStorage`; the current round
and phase always come from the server, so a reload or a flaky reconnect resumes cleanly without
desyncing. Answers are **first-answer-wins** and server-timed, so a reconnecting phone can't
re-submit or game the speed bonus.

An answer that can't reach the server during its round is queued and retried; if the round has
already closed by the time it retries, it's correctly dropped (the room has moved on). This is the
synchronized model working as intended.

## ⚠️ Before the day — test the network

The failure mode is **client isolation**: wifi that gives every device internet but blocks
device-to-device traffic. Your server becomes invisible to players and there is **no fix on the
day**.

1. Put two phones on the venue wifi. Run the server on the laptop (`npm run dev:lan`). Open
   `http://<host-ip>:3000` on both phones.
2. If it fails → run a **phone hotspot** and have the laptop + all phones join that instead. Test
   this too, in advance.

## Editing the cases

All content is in `content/cases.ts` — bilingual (th/en), no code changes needed.
`npx vitest run content/` validates every case (one correct option, one "AI is correct" option,
both languages present, real sources cited).

**Content rules:** never fabricate evidence imitating a real outlet. Real cases cite real URLs;
fictional evidence (NovaBrew) is flagged `fictional: true` and renders a FICTIONAL badge.

**Storyboards.** Each case has an optional `storyboard` of 2-4 frames — an emoji character and one
short bilingual caption each — shown above the question **on the projector only**. Two rules, both
deliberate:

- A board sets up the SITUATION and the DOUBT. It must never name the failure mode; giving away
  "watch for a fabricated citation" in frame two answers the question the room is there to answer.
- The phone does **not** render them. The story is what the room reads together off the big screen;
  the phone is for tapping, and the strip cost ~150px above the answer cards.

To swap emoji for real artwork later, drop a file in `public/` and set `art: '/story/x.png'` on the
panel. No code change — the renderer prefers `art` when present.

**The Case File is on the projector, not the phone.** `components/game/CaseFile.tsx` renders the
retrieval manifest (every filename with ✓ / ✗) and the found documents, in the right-hand column
beside the question. Three things about it are load-bearing:

- **The `✗ NOT FOUND` row is the lesson** in cases 1-3 — it is the gap the AI filled by inventing.
  It sits at the top of the manifest and never shrinks; the documents below give up pixels first.
- **The source renders as a domain** (`nasa.gov`), not the full `sourceUrl`. A wrapped URL costs
  ~40px of a budget measured in tens, and nobody reads a path segment off a projector. The full URL
  is untouched in `content/cases.ts`.
- **The type scale steps down at three or more documents.** `citation` has four manifest rows and
  three documents; at one size for all five cases it pushed the host's own button off the screen.
  `artemis` and `novabrew` stay at the roomy scale.

Editing a case body? Re-run the projector check. The right column is the tightest part of the
screen and there is no scrollbar on a projector.

**The teaching beat.** Every reveal carries a panel with two lines — `failureMode` (the name of the
trick, so the room has a handle for it) and `checkNextTime` (**the only thing on the screen meant to
be useful outside it**). `checkNextTime` is **required** by the schema: a case without one is a quiz
question with no lesson attached. Two rules:

- Write it as an **instruction**, not a summary. `reveal` says what happened in this case; this says
  what to do in front of a different question next Tuesday. A test fails if it turns out to be a
  substring of `reveal`.
- **Case 5 is the shape test.** The AI is right there, so anything phrased "here is the trick" is
  nonsense — its lesson is that reflexive suspicion is not a substitute for checking, and a player
  who learned "distrust the AI" fails it as badly as one who believed everything. That is why the
  panel heading is the neutral "ข้อนี้ทดสอบอะไร" and not "what fooled you".

The reveal is a **two-column** screen for a measured reason: before the panel existed it had 31px of
clearance under the host's Next button on `citation` and `novabrew` at 1366×768. Reading sits left,
the room's payoff (the % fooled and the standings) sits right. It now has 137px.

---

# The Decision Room

*The second workshop.* Fifteen minutes. The audience runs a cafe using data **they supplied at event registration**, and
competes on profit. Same app, same server, different routes.

Three decisions, one tap each, four options each. Every player carries their own shop, and its
numbers accumulate across all three rounds. The board ranks revenue, profit, satisfaction and
waste — with **waste inverted**, so a player who pushes every bar upward loses. That inversion is
the workshop's argument compressed into a scoreboard.

## Run the Decision Room

```bash
FACILITATOR_TOKEN='<your-token>' npm run start:lan     # after npm run build
```

| Screen | URL |
|---|---|
| 📺 Room view (projector) | `http://<your-ip>:3000/biz` |
| 📱 Player | `http://<your-ip>:3000/play` — the QR on the intro stage points here |

The host advances with **→ or space**, after entering the facilitator token once. There is no
"close voting" button by design: advancing off a decision closes it and resolves the round. One
control under stage pressure beats two.

Reset between sessions:

```bash
curl -X POST -H "x-facilitator-token: $FACILITATOR_TOKEN" http://<your-ip>:3000/api/room/reset
```

Phones detect the reset from their next poll and return to the join screen on their own — they do
**not** have to be reloaded, and nobody is ejected mid-round by a tap that fails. AI Detective's
phones now behave identically; if you change one, change both.

## The fifteen minutes

Ten stages: intro → their data → decide → outcome → new data → decide → outcome → decide → outcome
→ close. Voting takes 2:10 of it; the rest is the host talking. Budgeted at 12:40, leaving 2:20 of
slack.

**The teaching lives in the `outcome` stages**, never in a lecture slide.

### Round 1 — what do you charge?

The one round resolved by simulation, and the one that carries the workshop. A competitor puts ฿45
on a board across the street; the room prices a cup at ฿45 / ฿65 / ฿85 / ฿120. The result is
computed from what the audience said **they** usually spend, at registration.

| | ฿45 | ฿65 | **฿85** | ฿120 |
|---|---|---|---|---|
| Customers (of 120) | 120 | 113 | **113** | 27 |
| Profit | ฿2,760 | ฿4,719 | **฿6,979** | ฿786 |

Matching the competitor's ฿45 wins **7 customers** and costs **฿4,219** — because only one
respondent in 18 said they spend under ฿50. Almost nobody was priced out, so there was almost
nothing for a discount to win back.

The second half of the lesson is in the other new question: 11 of 18 named **price** as a deciding
factor, but **all 18 named taste**. The people leaving were not leaving over price. That is the
answer to *"why doesn't cutting the price work?"* and it comes from the audience, not from a slide.

**Say this out loud:** ฿85 is the best price *on the board*, not the optimal price. What the data
actually says is that the ceiling sits at ฿100 — 13 of 18 answered "฿50–100" — so the winner is
simply the highest option under it. Claiming ฿85 is optimal overstates what 18 answers support.

### Rounds 2 and 3 — fixed outcomes

Both apply hand-written KPI deltas; price sensitivity and capital allocation are not in the
registration questions, so there is nothing honest to simulate them from.

Round 2's four options are **ordered by the audience's own answers** — taste (18 of 18) beats
promotion (8) beats convenience (6) beats a price cut (11 named it, and it still loses, which is
round 1's lesson arriving in a different costume). A test asserts that ordering, because the
outcome copy claims it out loud. The *magnitudes* are still hand-chosen and are flagged as such in
`content/room.ts` — see "Before the day" below.

Round 2 is the **designated cut** if you are running long. Rounds are self-contained; dropping it
needs no code change, just advance past it.

## ⚠️ Before the day

1. **Change `FACILITATOR_TOKEN`.** It is `madt2026` in these docs, which are public.
2. **Re-import the survey.** It stays open until the event, so do this as late as you can:
   ```bash
   node scripts/import-audience.ts "MADT Expo 2026 - ... - Form Responses 1.csv"
   npx vitest run          # fails, by design, if the on-screen copy is now stale
   ```
   Use **`node`, not `npx tsx`** — this script ends in a top-level await and tsx cannot run it.
   The output path is optional and defaults to `content/audience.ts`, which is generated and meant
   to be overwritten. `IS_PLACEHOLDER` is set by the importer; you do not edit it by hand.

   Every figure on screen is recomputed from the aggregate, and `content/room.test.ts` pins the
   round 1 script to the simulator. **A failure there is the system working** — it means a sentence
   on the projector no longer matches the data. Fix the sentence, don't relax the test.
3. **Review the economics.** These are still unreviewed guesses and they decide whether the game is
   interesting:
   - `lib/pricing.ts` — `cogsPerDrinkBaht` (฿22) and `footfallPerDay` (120). Note which matters:
     footfall scales every number on screen and **cannot change the winner**; cost-per-cup could in
     principle, and a test asserts it does not across ฿10-40. Review footfall for plausibility,
     cost for correctness.
   - `content/room.ts` — the `fx` values on rounds 2 and 3. Their *ordering* is grounded in the
     survey; their sizes are mine.
4. **Run the projector check** after any content or layout edit (see below). The deck now fits at
   1366×768 with only a few pixels to spare on the decide stages.

## Things not to say on stage

- **Never call the simulator AI, ML, or a model.** It is arithmetic over the audience's own
  answers. A workshop about data honesty should not oversell its own machinery.
- **Never present a multi-select bar as a share of the room.** "18 of 18 chose taste" does not mean
  taste was the only thing anyone cared about — people could tick several. Both the projector and
  the phone print that caveat under the chart automatically; don't contradict it.
- **Say the sample size.** 18 people, and registrants rather than the room in front of you. The
  script does this on `data-you`; deciding on a small sample is part of the lesson, not something
  to smooth over.

## A note on the survey that shipped

The form actually sent on 3 Aug differs from `docs/registration-questions.md`, which is the
proposal. Queue patience thresholds are 5/10/15 minutes — **there was never a 3-minute option** —
`Bus` replaced BTS/MRT, and two questions were added (spend, and the multi-select deciding factor)
that now carry round 1 entirely. `content/audience.ts` is the authoritative record.

The original round 1 asked how many baristas to staff. On the real responses that round is
unplayable: 8 people buy at 7-9, scaled by 6-of-18 coffee drinkers, is **three customers** against
one barista's capacity of 25. No queue forms, nobody walks out, every option loses money.
`lib/sim.ts` is kept and still tested — at a few hundred responses the round works again, and
`lib/sim.test.ts` says so — but it is not currently in the deck.

## Editing the workshop

`content/room.ts` holds every stage and every word, bilingual (th/en), both languages rendered at
once — there is no language toggle anywhere. `content/audience.ts` is the only file that knows
about registration data, and it is **generated** — edit the CSV and re-import, never the numbers.
`lib/pricing.ts` holds round 1's economics.

Decide and data stages take an optional `storyboard` of 2-4 frames, same shape as AI Detective's.
Unlike AI Detective, The Decision Room renders both languages at once, so the two workshops share
the `StoryPanel` **type** but not the renderer.

`npx vitest run content/room.test.ts` validates the script: unique stage ids, every outcome points
at a real decision, both languages present, the time budget fits fifteen minutes, round 3's
recurring option still beats the flashy one, round 2's ordering matches the survey, and every
figure quoted in the round 1 copy still matches what the simulator produces.

## Superseded / dead code (safe to delete later)

`app/reveal/`, `components/CaseScreen.tsx`, `components/ResultScreen.tsx` are from the v1 free-roam
flow and are no longer routed to by the Kahoot phone/TV. `/dashboard` remains as an optional
second-screen stats view.

`lib/sim.ts` (the staffing simulator) is **not dead** and should not be deleted — see "A note on
the survey that shipped" above. It is out of the deck because the sample is too small, not because
it is wrong, and it is still tested.

## Development

```bash
npm run dev        # localhost only, for local development
npm run dev:lan    # binds 0.0.0.0 — for editing code with phones connected
npm run build      # production build (also bundles fonts)
npm run start:lan  # production server on 0.0.0.0 — USE THIS ON THE DAY
npm test           # vitest run — full suite (36 files, 393 tests)
```

Type-check with `npx tsc --noEmit`. Styling is Tailwind v4 (CSS-first): the theme lives in
`app/globals.css` (`@import "tailwindcss"` + `@theme inline`), including the retro/CRT game theme.

### The projector check

**Run this after any change to a stage, a slide, or the length of anything on one.**

```bash
npm run build
FACILITATOR_TOKEN=<token> npm run start:lan &
FACILITATOR_TOKEN=<token> npm run check:projector
```

It drives both workshops through every stage in a real browser at **1600×900 and 1366×768** and
fails if anything lands below the fold. This exists because the unit suite structurally cannot
catch it: jsdom performs no layout, so no assertion written against it can measure a height. Nine
of ten stages once overflowed — putting the lesson and the leaderboard off-screen — with the full
suite passing and `next build` reporting success.

It also walks **390×844** and reports how far a player must scroll to reach the last vote button.
That one is a **warning, not a failure** — phones scroll — but an option someone has to hunt for
inside a 45-second window collects fewer votes than it deserves. Both phones currently reach every
option without scrolling; AI Detective needed ~420px until the Case File moved to the projector.

**It checks the host's controls separately, and that check is not redundant.** `/tv`'s `<main>` is
`min-h-screen overflow-hidden`, so a stage that grows past the screen is **clipped, not scrolled** —
`scrollHeight` stays pinned to `clientHeight` and the overflow metric reports a tidy ✓ while the
bottom of the screen is cut off. Moving the Case File onto the projector cut the host's "close it
now" button by 36px on `citation` and all 24 combinations still passed. If you add a control below
the fold-critical content, it is `checkHostControl` that will catch it, not the height comparison.

Known traps, each paid for:

- **Kill the old server by port, not by `pkill`.** `npm start` spawning failures leave port 3000
  held; every measurement then comes from a stale build and looks like a catastrophic CSS bug.
  `lsof -ti:3000 | xargs kill -9`.
- **`cssChunking: 'strict'` in `next.config.ts` is load-bearing.** The default chunker once emitted
  a `<link>` to a chunk it never wrote, and the projector rendered the entire deck as unstyled 16px
  text. `next build` said success.
- **Height, not width.** These slides are sized with `min(clamp(px, vw, px), Nvh)`. A projector is
  wide and *short*, so the height cap is what binds — Tailwind's `lg:` breakpoints cannot see the
  problem at all.
- **Watch specificity.** Several rules in `stages.css` are 0,4,0. A new rule written the obvious way
  loses silently, and the only symptom is that a stage stays too tall.

## Deploying

For running this on Cloud Run instead of a laptop on the venue LAN, see
**[docs/deploy-gcp.md](docs/deploy-gcp.md)**. Two things that matter there and nowhere else:

- `--max-instances=1` is a **correctness** constraint, not cost control. Two instances mean two
  independent rooms, with phones split between them and no error surfaced anywhere.
- **A redeploy wipes the room back to the lobby.** Do not deploy on the day once people have joined.

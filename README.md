# MADT Expo 2026 — two workshops, one app

**23 Aug 2026.** Both workshops run from this one repo and one server, on different routes.

| | Workshop | Projector | Phones | Length |
|---|---|---|---|---|
| 1 | [**AI Detective**](#ai-detective) — think with AI, not just trust AI | `/tv` | `/` | 9 questions, 8:03 |
| 2 | [**Café Persona**](#café-persona) — which coffee decides like you? | `/biz` | `/play` | 15–20 min |

Shared, and worth reading whichever workshop you are running: [Run it](#run-it) ·
[the LAN gotcha](#the-lan-gotcha-blank-unclickable-pages) ·
[the projector check](#the-projector-check) · [Background music](#background-music) ·
[Deploying](#deploying)

---

# AI Detective

> Think with AI, not just trust AI.

A synchronized, **Kahoot-style** quiz about AI hallucination. One **TV** drives the room through
**9 questions in 3 acts**; players follow on their **phones**. The duck sends one confident answer
per question — one line, no storyboard, no evidence panel — and the player's only job is to tap
**✓ ผ่าน** (let it through) or **✕ ตีกลับ** (send it back) before the 8-second window closes.

Every question opens with a **ten-second reading beat** first: the question and the duck's answer
are on the projector in full, and both buttons are on the phone but **locked**. Nobody can answer
yet — the server refuses an answer outside the answer window, so the beat holds against a crafted
request and not merely a disabled button — and the speed bonus's clock does not start until it
ends. It exists so the fastest thumb in the room is not also the person who read the least. The
projector marks it with a dot countdown, never the timer bar: the bar means *you may answer now*
and nothing else. The
reveal shows the room's split (X% ผ่าน / Y% ตีกลับ) **and the running top-5 standings**, so there is
something to play for in the middle of the game rather than only at the end. Every third question
closes with an **act card** — the lesson, named once the room has already felt it three times — and
the ninth question's act card leads into a **room-wide tally**, where the host delivers the
workshop's closing line: *"เราเชื่อ AI ได้ไม่ถึง 100% — ยังต้องมีคนคอยตรวจ"* (Human-in-the-loop),
before the podium.

Each question's answer window is a fixed **15 seconds**, after its 5-second reading beat; the
reveal that follows is **12 seconds and auto-advances on its own** (the host can `Hold` it). Total
time budget across all nine readings, nine questions, nine reveals, three ~30s act cards, the
tally, and the podium is **8:03** — see [`docs/questions.md`](docs/questions.md) for how that
number is built.

**Seven phases**, and the projector wears the same frame for all of them — a HUD band across the
top (the clock, the phase, the host's controls), the stage, and a case-number status line along the
bottom:

| Phase | Length | The room |
|---|---|---|
| `lobby` | until **Start** | QR code, join URL, names pinning themselves to the board |
| `rules` | untimed, host advances | How to play, once, before the first case |
| `reading` | **10s**, on its own clock | Question + the duck's answer on the case file. Buttons locked. |
| `question` | **8s**, on its own clock — never early | Same scene, timer bar running, answers open |
| `reveal` | untimed, host advances | The verdict stamped on the file, the truth, the room's split, the standings |
| `tally` | untimed, host advances | One number: how many times the room let a bad answer through |
| `podium` | end | Top three |

**A question always runs its full eight seconds.** It used to end the moment the last active player
answered; it does not any more. That exit let the fastest thumbs in the room decide how long
everyone else got to think — which is the one thing the reading beat in front of it exists to buy.
`Next` on the projector still closes a question immediately when the host can see the room is done.

🧠 **[What each question is doing to the player](docs/question-design.md)** — the design intent
behind every question in **both** workshops: what we are trying to make a player think, why they
fall for it, which knob to turn to change it, and what not to break. **Start here if you want to
argue with a question.**

📖 **[The nine questions — what each one teaches](docs/questions.md)** — per-question sources, the
point of each failure mode, why the answer key is what it is, and the three facilitator-only
`needsCheck` notes. Read this before facilitating.

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
| `http://<ip>:3000` | Players (phones) | Codename → nine questions → **✓ ผ่าน** / **✕ ตีกลับ** |
| `http://<ip>:3000/tv` | TV / projector | The stage + host controls (**Start**, **Next**, **Hold**) |

### Running a session

1. **TV:** open `/tv`. It opens on a **login screen** — 🔒 EVIDENCE ROOM — with one password
   field. Type the `FACILITATOR_TOKEN` there and press **เปิดห้อง**; the browser remembers it for
   that tab, so this is once per laptop, not once per session. Until it is entered the projector
   shows nothing else, which is the point: the token is no longer a text box sitting on the
   projector in front of a hundred people for the whole game. It is a **login screen, not a
   security boundary** — every control route still checks the token server-side on every call, and
   an unset `FACILITATOR_TOKEN` still means `403`.
2. **Players:** open `http://<ip>:3000` on their phones and pick a codename — they appear in the
   TV lobby.
3. Press **Start** on the TV to begin question 1. Each question opens with a **5-second reading
   beat** — question and answer up, phones locked, a dot countdown on the projector — and then a
   fixed **15-second** answer window, which advances to the reveal early once every active player
   has answered. `Next` ends the beat early if the room is clearly ready.
4. The reveal is **12 seconds and advances on its own** — that auto-advance is what makes nine
   questions feel rapid instead of nine separate host presses. If the room needs a moment on one
   reveal (a surprising result, a question from the floor), press **Hold** to freeze it; press it
   again to release, and the reveal gets a fresh 12 seconds.
5. **`Next` ends whichever phase is current, immediately** — including mid-question or mid-reveal,
   not only the three untimed phases (act card, tally, podium). Pressed during a question, it
   closes the answer window early and moves to that same question's reveal; pressed during a
   reveal, it skips the rest of the 12-second timer but the room still gets the reveal itself —
   **`Next` can end a phase early, it can never skip one.** A double-tap (a laggy projector, two
   quick presses) is guarded on the server, not just by the button's own disabled state, so a
   second press within the guard window is a true no-op even from a second `/tv` tab or after a
   refresh. See `docs/superpowers/specs/2026-08-18-ai-detective-v3-design.md` §3 for why the two
   v2 controls (`revealNow`, `nextRound`) were merged into this one `Next` and what that cost.
6. Every third question closes on an **act card** instead of a question — the teaching beat,
   untimed, for the host to talk over (~30s planned per act). Press **Next** to move on.
7. After question 9's act card comes the **room tally** — one number, untimed: how many times,
   across the whole room, someone pressed ผ่าน on an answer that should have been rejected.
   **Deliver the closing Human-in-the-loop line here** —
   *"เราเชื่อ AI ได้ไม่ถึง 100% — ยังต้องมีคนคอยตรวจ"* — then press **Next** for the podium.
8. Latecomers who open the app mid-game **spectate** until you reset for the next session.

Total time across all nine readings, questions and reveals is 9×5s + 9×15s + 9×12s = **4:48**;
with the three ~30s act cards, the tally, and the podium budgeted in, the whole session runs
**8:03** end to end — so budget the session around how long you talk over the act cards and the
tally, not around the 5s/15s/12s clocks.

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

## Editing the questions

All content is in `content/questions.ts` — **Thai only** (a deliberate v3 decision; see
[`docs/questions.md`](docs/questions.md) and `docs/question-design.md` for why), no code changes
needed. `npx vitest run content/` validates the whole file: exactly 9 questions with `order` 1..9
unique, exactly 3 acts of 3 questions each, exactly 3 `pass` verdicts at orders 2/5/8, no run of
three or more consecutive `reject` questions (the anti-guess invariant — see `docs/questions.md`),
every `highlight` is a real substring of its `duckSays`, and every question carries non-empty
`truth`/`tell`.

**Content rule:** never fabricate a source that imitates a real outlet, journal, or case number.
Act 3 satisfies this by construction — a quote pinned on Einstein, a Great Wall length, and a WHO
step count are all **real misattributions that actually happen in the world**, which teaches harder
than an invented citation and forges nothing.

**`needsCheck`** is a facilitator-only note on three questions — declared in the content file, never
rendered anywhere in the UI. It flags a claim worth having a citation ready for if someone in the
room pushes back. See [`docs/questions.md`](docs/questions.md) for the three of them and why.

**No storyboards, no Case File, no bilingual text.** v3 removed all three along with v2's five-case
flow: the duck's one sentence is the whole case, the phone renders nothing during a question but the
line and two buttons, and there is no evidence panel to fact-check on screen — the checking happens
in the room's head, not on the projector. If you are looking for `components/game/CaseFile.tsx`,
`AnswerCards`, or a `storyboard` field, they went with v2; `docs/questions.md` explains what
replaced them and why.

Editing a question or an act card? Re-run the projector check
(`npm run build && FACILITATOR_TOKEN=<token> npm run start:lan &` then
`FACILITATOR_TOKEN=<token> npm run check:projector`). Longer copy grows the case file, and the case
file is what the status line along the bottom of the stage is standing on — the check measures that
line's own bottom edge against the fold on every one of the seven phases, because `/tv` clips
rather than scrolls and a status line that has fallen off the screen fails silently otherwise.

---

# Café Persona

*The second workshop.* 15–20 minutes. The audience are the owner of a café whose market research is
**their own registration data** — every question opens with one real figure from this room. Eight
dilemmas, four defensible paths each, **no points and no winner**: each choice silently accumulates
toward one of four decision-maker personas (THE PIONEER / SPRINTER / ANALYST / GUARDIAN — coffee
drinks on a GUT↔DATA × MOVE FAST↔WAIT & SEE map). The finale shows your MBTI-style card on your
phone and the room's 2×2 map on the projector. The engine enforces the message: **no `correct`
field exists anywhere in the type system.**

Design intent and every knob: `docs/superpowers/specs/2026-08-20-cafe-persona-design.md`.

## Run Café Persona

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

   Every data-hook figure is recomputed from the aggregate, and `content/persona.test.ts`
   re-derives each one. **A failure there is the system working** — it means a figure on the
   projector no longer matches the data. Fix the content, don't relax the test.
3. **Run the projector check** after any content or layout edit (see below).

## Things not to say on stage

- **Never present a multi-select figure as a share of the room.** "18 of 18 named taste" does not
  mean taste was the only thing anyone cared about — people could tick several (q1 and q7's hooks
  both come from that multi-select).
- **Say the sample size.** 18 people, and registrants rather than the room in front of you.
  Deciding on a small sample is part of the lesson, not something to smooth over.
- **Never announce anyone's type before the finale, and never rank the types.** The game's whole
  argument is that there is no 0 or 1 — a "best persona" remark from the stage undoes it.

## A note on the survey that shipped

The form actually sent on 3 Aug differs from `docs/registration-questions.md`, which is the
proposal. Queue patience thresholds are 5/10/15 minutes — **there was never a 3-minute option** —
`Bus` replaced BTS/MRT, and two questions were added (spend, and the multi-select deciding factor)
that now carry round 1 entirely. `content/audience.ts` is the authoritative record.

(The Decision Room era's staffing/pricing simulators were removed with that game on 20 Aug 2026 —
the persona game quotes the audience's counts directly and needs no economic model.)

## Editing the workshop

`content/persona.ts` holds every word — the four persona cards and all eight questions, Thai copy
with English persona/axis labels (framework language, by design). `content/audience.ts` is the only
file that knows about registration data, and it is **generated** — edit the CSV and re-import,
never the numbers.

`npx vitest run content/persona.test.ts lib/persona.test.ts` validates the content and the scoring:
eight questions, each offering all four personas exactly once, choice order shuffled across
questions, every data-hook figure re-derived from `content/audience.ts`, partners always diagonal,
and the tie-break deterministic.

## Superseded / dead code

AI Detective's v1 free-roam flow (`app/reveal/`, `components/CaseScreen.tsx`,
`components/ResultScreen.tsx`, `components/Retrieval.tsx`) and v2's five-case content
(`content/cases.ts`) are gone as of the v3 rebuild — nothing in `app/` or `content/` imports or
routes to them any more.

The Decision Room (the KPI/shop game that previously ran on `/biz` + `/play`: `content/room.ts`,
`lib/sim.ts`, `lib/pricing.ts`, the leaderboard) was removed on 20 Aug 2026 when Café Persona
replaced it. The join/poll/control plumbing survived; only the game changed.

## Development

```bash
npm run dev        # localhost only, for local development
npm run dev:lan    # binds 0.0.0.0 — for editing code with phones connected
npm run build      # production build (also bundles fonts)
npm run start:lan  # production server on 0.0.0.0 — USE THIS ON THE DAY
npm test           # vitest run — full suite (26 files, 360 tests)
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

It also walks **390×844** and reports how far a player must scroll to reach the last option. That
one is a **warning, not a failure** — phones scroll — but an option someone has to hunt for inside a
game's answer window collects fewer votes than it deserves (Café Persona's countdown is a soft 30s;
AI Detective's is a fixed 15s, so it has even less slack). Both phones currently reach every option
without scrolling.

**It checks the host's controls separately, and that check is not redundant.** `/tv`'s `<main>` is
`min-h-screen overflow-hidden`, so a stage that grows past the screen is **clipped, not scrolled** —
`scrollHeight` stays pinned to `clientHeight` and the overflow metric reports a tidy ✓ while the
bottom of the screen is cut off. The v3 rebuild's projector run found exactly that on AI Detective's
reveal: the host control bar grows a third row when the facilitator token is mistyped, and at
1366×768 the grown panel overlapped the reveal's own right-hand column (the split bar + top-5
standings) — `scrollHeight`
never changed, because nothing scrolled; two elements just occupied the same rectangle. Fixed by
scaling down the bar's buttons (`.host-ctrl` in `app/globals.css`), which had also left only ~4px of
clearance in the normal, no-error state. If you add a control near fold-critical content, it is
`checkHostControl` — or a rectangle-intersection check like the one that caught this
(`checkBadTokenState` in `scripts/check-projector-fit.mjs`) — that will catch it, not the height
comparison.

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

## Background music

Both projectors run one instrumental loop, quietly, for the whole workshop — **Spy Glass** on
`/tv` and **Bossa Antigua** on `/biz`, both by Kevin MacLeod ([incompetech.com](https://incompetech.com)),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Instrumental on purpose:
a lyric is a second voice competing with the host. Full credits and how to re-encode:
**[`public/audio/CREDITS.md`](public/audio/CREDITS.md)**.

Three things to know before the day:

- **Press `M` to mute, from either projector, at any time.** There is also a small speaker button
  in the bottom-left corner of the screen. Use it — a bed that fights the microphone is worse than
  no bed.
- **The music starts when you log in through the token gate, not when the game starts.** That is
  deliberate: a browser will not play audio on a page that has never been clicked, and the gate is
  the one click either projector gets. **If you reload `/tv` or `/biz` mid-session** the token is
  already remembered, there is no click, and the browser refuses — the corner button turns **amber**
  to say so, and one press on it starts the music again. Amber in the corner always means the room
  is silent.
- **Volume is set in the app at 12%** (`BED_VOLUME` in `components/audio/RoomMusic.tsx`) and the
  rest is the hall's mixer. Set the hall level with the music playing *and someone talking into the
  microphone*, never with the music alone — alone, it will always sound too quiet.

Phones never play music, in either workshop. A hundred handsets a half-second out of sync is not a
bed, it is noise.

## Deploying

For running this on Cloud Run instead of a laptop on the venue LAN, see
**[docs/deploy-gcp.md](docs/deploy-gcp.md)**. Two things that matter there and nowhere else:

- `--max-instances=1` is a **correctness** constraint, not cost control. Two instances mean two
  independent rooms, with phones split between them and no error surfaced anywhere.
- **A redeploy wipes the room back to the lobby.** Do not deploy on the day once people have joined.

# 🕵️ AI Detective — MADT Expo, 23 Aug 2026

> Think with AI, not just trust AI.

A synchronized, **Kahoot-style** quiz about AI hallucination. One **TV** drives the room through 5
rounds; players follow on their **phones**. Each round: read the retrieved Case File evidence and
the AI "duck's" confident answer, then tap A/B/C/D before the timer runs out. The reveal shows the
punchline — *"73% of you believed the AI."*

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
| `http://<ip>:3000/tv` | TV / projector | The stage + host controls (**Start**, **Next**) |
| `http://<ip>:3000/dashboard` | Optional 2nd screen | Stats Wall / Leaderboard — press **L** to switch |

### Running a session

1. **TV:** open `/tv`, type the `FACILITATOR_TOKEN` into the **Host token** box (top-right).
2. **Players:** open `http://<ip>:3000` on their phones and pick a codename — they appear in the
   TV lobby.
3. Press **Start** on the TV. Each round's answer window is timed (75s easy / 90s hard); it
   auto-advances to the reveal when the timer ends **or** everyone has answered.
4. Press **Next** on the TV to leave each reveal and begin the next round. After round 5, Next
   shows the final leaderboard.
5. Latecomers who open the app mid-game **spectate** until you reset for the next session.

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
the codename screen with a "session was reset" message (expected — players just re-enter a
codename). If `FACILITATOR_TOKEN` is unset, `/api/reset` and `/api/control` are **disabled** and
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

---

# ☕ The Decision Room — the second workshop

Fifteen minutes. The audience runs a cafe using data **they supplied at event registration**, and
competes on profit. Same app, same server, different routes.

## Run it

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
**not** have to be reloaded, and they are not ejected mid-round the way AI Detective's are.

## The fifteen minutes

Ten stages: intro → their data → decide → outcome → new data → decide → outcome → decide → outcome
→ close. Voting takes 2:10 of it; the rest is the host talking. Budgeted at 12:40, leaving 2:20 of
slack.

**The teaching lives in the `outcome` stages**, never in a lecture slide. Round 1's outcome is the
one that matters: two baristas produce a 3.7-minute wait, and nineteen people who told you at
registration they would not wait three minutes walk out. Three baristas is the right answer, worth
฿1,700 against ฿610.

Round 2 is the **designated cut** if you are running long. Rounds are self-contained; dropping it
needs no code change, just advance past it.

## ⚠️ Before the day

1. **Change `FACILITATOR_TOKEN`.** It is `madt2026` in these docs, which are public.
2. **Import the registration CSV**, then clear the placeholder flag:
   ```bash
   node scripts/import-audience.ts registration-export.csv
   # then set IS_PLACEHOLDER = false in content/audience.ts
   ```
   Until you do, every data screen carries a loud **PLACEHOLDER DATA** badge. That badge is driven
   by the flag, not by hand — it cannot be forgotten, only cleared deliberately.
3. **Expect to re-tune the simulator.** `lib/sim.ts`'s constants (ticket ฿70, wage ฿600/shift,
   service rate, waste ฿20) are tuned so three baristas wins by 54%. That answer sits on a knife
   edge: one fewer respondent in the 7–9 bucket, or a 1% change to the service rate, flips it to
   two. `lib/sim.test.ts` fails loudly if the curve goes flat or the winner changes — treat that
   failure as a signal to re-tune, not to relax the test.
4. **Round 1's on-screen copy quotes figures from the placeholder data** (50 arrivals, 3.7 minutes,
   19 walkouts, ฿1,700, 54%). A test recomputes them through the simulator, so real data will fail
   loudly and four sentences in `content/room.ts` need rewriting — plus `NARRATED_BARISTAS` in
   `content/room-labels.ts`.

## Things not to say on stage

- **Never call the simulator AI, ML, or a model.** It is arithmetic over the audience's own
  answers. A workshop about data honesty should not oversell its own machinery.
- **Never narrate `waitMinutes` as "your drink takes X minutes."** It is a shop-throughput figure,
  not individual service time. Correcting the arithmetic collapses the profit curve, so it is
  deferred to the post-CSV re-tune; until then, do not put that reading in anyone's head.

## Editing the workshop

`content/room.ts` holds every stage and every word, bilingual (th/en), both languages rendered at
once — there is no language toggle anywhere. `content/audience.ts` is the only file that knows
about registration data. `lib/sim.ts` holds the economics.

`npx vitest run content/room.test.ts` validates the script: unique stage ids, every outcome points
at a real decision, both languages present, the time budget fits fifteen minutes, and round 3's
recurring option still beats the flashy one.

## Superseded / dead code (safe to delete later)

`app/reveal/`, `components/CaseScreen.tsx`, `components/ResultScreen.tsx` are from the v1 free-roam
flow and are no longer routed to by the Kahoot phone/TV. `/dashboard` remains as an optional
second-screen stats view.

## Development

```bash
npm run dev        # localhost only, for local development
npm run dev:lan    # binds 0.0.0.0 — for editing code with phones connected
npm run build      # production build (also bundles fonts)
npm run start:lan  # production server on 0.0.0.0 — USE THIS ON THE DAY
npm test           # vitest run — full suite (22 files, 168 tests)
```

Type-check with `npx tsc --noEmit`. Styling is Tailwind v4 (CSS-first): the theme lives in
`app/globals.css` (`@import "tailwindcss"` + `@theme inline`), including the retro/CRT game theme.

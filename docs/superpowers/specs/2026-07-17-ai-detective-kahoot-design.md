# AI Detective — Kahoot-Style Design Spec (v2)

**Workshop:** MADT Expo, **23 August 2026**
**Format:** ~10 minutes, ~20 concurrent players on their **own phones**, one **TV** in the room
**Key message:** *Think with AI, not just trust AI.*

> **Supersedes** `2026-07-14-ai-detective-design.md`. That v1 spec described a *free-roam* game
> (each player walks 5 cases at their own pace; the TV is a passive stats mirror). This v2 pivots
> to a **synchronized, host-paced quiz** (one TV = the stage, phones = controllers, the whole room
> moves round-by-round together). Two v1 principles are **deliberately reversed** here — see §4.
> Everything in v1 §7 (content integrity), §8/§8a (the five cases and their retrieval gaps), and the
> scoring invariant in §2b carries over **unchanged**. Where this v2 is silent, v1 still governs.

---

## 1. Concept

Players are **AI Detectives**. The room plays **5 rounds together**, one case per round, driven from
a TV. Each round: the TV presents the case and the AI "duck's" confident answer; each player, on their
phone, reads the retrieved **Case File** evidence, then taps one of four answers before the timer runs
out. On reveal, the TV shows the correct answer and the punchline — **"73% of you believed the duck."**

Difficulty ramps 🟢 → ⚫, and each case teaches a **different failure mode**, so players leave with a
checklist rather than "AI is sometimes wrong." (Cases and failure modes: v1 §8 / §8a, unchanged.)

---

## 2. Architecture

A single Next.js app run from the facilitator's laptop (`npm run dev:lan`), reachable on the room LAN.
Three surfaces:

| Route | Device | Purpose |
| --- | --- | --- |
| `/tv` | TV / projector | The stage. Lobby → per-round case + duck answer + live countdown + "N/20 answered" → reveal with live "% fooled" → final leaderboard. Also the **host control** (Start, Next). |
| `/` | Player phone | Codename → per round: read Case File evidence + tap A/B/C/D → personal result → wait for next round. |
| `/dashboard` | *(optional second screen)* | The v1 stats/leaderboard panels, unchanged. Not required for the Kahoot flow; kept for a second monitor if available. |

**State: the server owns everything.** A single in-memory room store on the server (mirrored to a
JSON file, behind the existing `RoomStore` interface) holds players, answers, **and the new game
state**: current phase, current round index, and the authoritative clock. The TV and phones are both
**followers** that render server state; neither holds the only copy of "what round are we on." A TV
refresh or a phone reconnect resumes exactly where the room is.

**Transport: keep the existing polling loop and its protections.** Phones and the TV poll a game-state
endpoint. During a live round the phone polls at **~1 s**; in lobby/reveal, ~2 s is fine. We keep the
monotonic-sequence guard, last-good-frame fallback, and runtime shape validation already built. **No
websockets, no SSE** — a ~1 s spread on the reveal moment is invisible in a room this size. (Revisit
SSE only if 1 s genuinely feels laggy in on-site testing.)

### 2a. The authoritative clock (the one thing that ruins the demo if wrong)

The countdown is now the center of the game, so the **server owns the clock and the timed transition**:

- Room state stores `phaseStartedAt` (server clock, ms) and `phaseDurationMs` for the current phase.
- On every poll the server computes `remainingMs = max(0, phaseStartedAt + phaseDurationMs − serverNow)`
  and **returns that number**. When it reaches 0, the server itself flips `investigate → reveal`
  (computed lazily on read, then persisted).
- Phones **snap to the returned `remainingMs`** on each poll and tick down locally only *between* polls
  for smoothness. No client's `setInterval` is authoritative.

**Do NOT send an absolute deadline timestamp for the phone to subtract `Date.now()` from.** Returning
`remainingMs` is immune to client clock skew, makes a phone that loads mid-round show the correct time
for free, and makes background-tab timer throttling a non-issue. This is a hard requirement, not a
preference — a subagent must not "simplify" it into a client-side deadline.

### 2b. Host control

The TV is the only device that can POST control actions, guarded by the existing `FACILITATOR_TOKEN`:

- **Start** — leave the lobby, begin Round 1 (`investigate` phase).
- **Next** — the *single* manual step: leave the `reveal` screen and start the next round (or finish).

Everything else follows from server state and the clock. The answer window is **timed** (auto-advances
investigate → reveal); leaving reveal is **manual** (see §4).

### 2c. Game state machine

```
lobby ──Start──► investigate(round r) ──timer hits 0 OR all joined players answered──► reveal(round r)
                        ▲                                                                    │
                        └───────────────────── Next (if r < 5) ◄─────────────────────────────┤
                                                                                             │
                                                          Next (if r == 5) ──► final(leaderboard)
```

- **lobby** — players join, codenames appear on the TV. Countdown not running.
- **investigate(r)** — timed. TV shows case + duck answer + countdown + answered-count. Phones show
  evidence + options; a player may submit once. Ends when the timer hits 0 **or** every currently
  joined player has answered (whichever first).
- **reveal(r)** — untimed. TV shows correct answer, the catching evidence, failure mode, live "% fooled."
  Phones show correct/wrong + points earned. Waits for the host's **Next**.
- **final** — TV shows the leaderboard and the closing summary; phones show final rank + badge.

### 2d. Late join & reconnect (decided up front)

- **Join is only open in `lobby`.** A phone that opens the URL after Start sees a "round in progress —
  you'll join at the next round" screen and is admitted to the room as a **spectator** until `final`;
  they see reveals but cannot score this session. (Simplest correct rule; avoids half-scored players and
  mid-round answered-count churn.)
- **Reconnect within a round is seamless:** a joined player who refreshes or drops re-polls game state
  and lands on the right phase with the right `remainingMs`. If they already answered this round, the
  server reports it and the phone shows the locked/answered state — no double submissions
  (answers dedupe by `(playerId, caseId)`, unchanged from v1).

### 2e. Network risk (unchanged from v1 — still must be tested)

Client isolation (wifi that blocks phone-to-laptop traffic) is the unfixable-on-the-day failure. Both
mitigations still required: (1) test on-site with two phones + the laptop; (2) phone-hotspot fallback.
Phones make this *easier* to test than laptops — bring two and try before the day.

---

## 3. Offline asset bundling (demo-day safety — non-negotiable)

The room may have **no real internet**. Every asset must be served from the app itself:

- **Bundle the fonts locally** — `Press Start 2P`, `VT323`, `Sarabun` self-hosted (e.g. `next/font/local`
  or bundled `@font-face` woff2). No Google Fonts `<link>`.
- **No Font Awesome CDN** — replace icons with inline SVG or emoji.
- **No `cdn.tailwindcss.com`** — use the app's compiled Tailwind (v4, already in place).

A CDN dependency that renders in preview and breaks in the room is the #1 demo-day failure mode. The
existing app already compiles Tailwind locally; this section is about the *theme's* assets (below).

---

## 4. Timing: now a HARD per-round timer (reverses v1 §4 — read this)

**v1 §4 said the app never hard-cuts a player, and v1 §10 ruled out synchronized phone flipping. This
v2 deliberately overturns both** — a synchronized quiz *requires* a shared clock and a hard round
boundary. This reversal is intentional; a subagent must **not** "restore" the soft-timer/free-roam
behavior. The two protections that made the soft timer humane are preserved as follows:

1. **Generous round timers.** Each round's timer is sized as *"time to read the evidence and think,"*
   not *"race."* Default **75 s** for 🟢🟡, **90 s** for 🟠🔴⚫ (single tunable constants per case /
   difficulty). The room still moves together, but nobody is racing a 15-second clock.
2. **Accuracy always dominates (unchanged invariant).** The speed bonus remains a **tiebreaker only**,
   capped so `5 × MAX_SPEED_BONUS < min base score`, exactly as v1 §2b. A fast-wrong player can never
   outrank a slow-right one. A workshop teaching "don't trust snap judgments" must not reward them —
   the hard *round* boundary is for room synchronization, not for rewarding speed.

The countdown creates shared tension; it does not decide the winner.

---

## 5. Scoring & identity (unchanged from v1)

- **Per round: one 4-way multiple choice**, one option always "The AI is correct." (v1 §2b — load-bearing.)
- **Accuracy + capped speed-bonus-as-tiebreaker** (§4 above; invariant unchanged).
- **Detective codename**, typed or from a "random codename" button. No email capture. (v1 §5.)
- **Bilingual Thai/English**, one toggle, remembered per player, single content file. (v1 §6.)
- **Content integrity rules** (v1 §7) and the **five cases + retrieval gaps** (v1 §8 / §8a) are unchanged.

---

## 6. Visual theme (adopt the "Premium Edition" look)

Adopt the retro-detective / CRT aesthetic from `ai_detective_premium_edition.html` across **both**
surfaces, ported into the app's component system (not the standalone file):

- **Palette:** navy ground (`#04050e` / panel `#0d1127`), gold `#ffd700`, cyan `#00e5ff`, pink `#ff3366`,
  green `#39ff14`, paper `#fffbf2` for the Case File dossier.
- **Type roles:** `Press Start 2P` (pixel headers/labels), `VT323` (retro body/HUD numerals), `Sarabun`
  (Thai + readable body). **Self-hosted** per §3.
- **Signature elements:** CRT scanline overlay, pixel-bordered buttons with hard drop shadows, the duck
  companion + speech bubble, the paper "MADT CLASSIFIED" dossier for evidence, the pink HUD timer.
- **TV (`/tv`)** inherits the fixed **1280×720 stage** almost directly — it's built for a projector/TV.
- **Phone (`/`)** is a **responsive portrait port** of the same language: full-bleed pixel A/B/C/D cards,
  the duck bubble, scanlines, a compact evidence view — **not** the desktop two-column dossier layout.
  Answer cards must be large, high-contrast, and thumb-reachable.
- **Both themes legible in a bright expo hall / on a TV** — verify contrast on the actual display.

The standalone HTML file is a **visual reference only**; its content (its own 5 cases, its client-side
game logic) is not imported. The app's existing `content/cases.ts` remains the single source of truth.

---

## 7. Reveal & closing (per round, on the TV)

Each `reveal` screen shows: the duck's answer, the verdict, **the specific evidence that catches it**,
the named failure mode, and the **live "% of you believed the duck"** pulled from actual play (omit the
percentage when zero answered). After Round 5's reveal, **Next** goes to `final`: the leaderboard plus
the closing map of the five cases onto the four objectives (Critical Thinking, AI Hallucination,
Overreliance on AI, Human-AI Collaboration). This is the workshop's emotional payoff. (v1 §9.)

---

## 8. Out of scope (YAGNI)

- Accounts/auth, cross-session persistence, email capture (v1 §10).
- Websockets/SSE — **explicitly reconsidered and still declined** for v2; 1 s polling suffices (§2).
- Per-player pacing / free-roam — **removed** in this pivot; the room moves together (§4).
- Importing the standalone HTML's logic or content — theme reference only (§6).

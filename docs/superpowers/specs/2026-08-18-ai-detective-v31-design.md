# AI Detective v3.1 — "Premium Edition" Design Spec

**Workshop:** MADT Expo, **23 August 2026**
**Builds on:** `2026-08-18-ai-detective-v3-design.md` — v3's mechanics, content and phase machine stand unless this document overrides them.

> v3 shipped a game that works and is verified. Three things came out of looking at it in a real
> browser and of the team's review of the built screens:
>
> 1. **The phone's top two thirds are empty black** during a question. Two buttons at the bottom,
>    nothing above them.
> 2. **The reveal and tally screens cluster in the top ~45% of the projector**, leaving the bottom
>    half unused — which forces the type smaller than it needs to be on the one screen a hundred
>    people read from the back of a hall.
> 3. **The visual language is thinner than the workshop deserves.** The team supplied a reference,
>    `ai_detective_premium_edition-3.html`, and asked for that look.
>
> The projector check passes on all of it, because "fits" and "uses the screen well" are different
> questions and only one of them can be measured.
>
> v3.1 also adds one **mechanic** change the team asked for: a five-second beat to read the question
> before the answer window opens.

---

## 1. What changes

| | v3 (shipped) | v3.1 (this spec) |
| --- | --- | --- |
| Phases | 6 | **7** — a `reading` phase before every `question` |
| Answer window | 15 s from the moment the question appears | **5 s to read, then 15 s to answer** |
| `/tv` entry | Lobby with a token box in the corner | **A token gate screen, then the lobby** |
| Lobby | QR, a list of names, a Start button | **Scattered pinned name cards, centred QR, centred Start** |
| Host controls in lobby | Top-right, always | **Absent until the game starts** |
| Art direction | The repo's retro-CRT theme | **The reference's premium palette and type**, namespaced |
| Phone during a question | Two buttons, empty above | **Two buttons plus an animated patrol strip** |
| Reveal / tally layout | Top-anchored | **Vertically centred, larger type** |

**Unchanged and still binding from v3:** the nine questions and their answer key, the streak
multiplier and its invariants, `wrongPass`, the server-authoritative clock, `FACILITATOR_TOKEN` on
every control route, the top-5 cap, Thai-only copy, and the Decision Room's total isolation.

---

## 2. The `reading` phase

A new phase sits between `actcard`/`lobby` and `question`:

```
lobby → reading → question → reveal → [actcard every 3rd] → … → tally → podium
```

`READING_MS = 5_000`. The projector shows the question and the duck's answer in full; the phone
shows the same two buttons it will show next, **visibly present but locked**, above a countdown.

**Why a separate phase and not a sub-state of `question`.** Two existing guarantees do the work for
free, and neither survives a sub-state:

- `recordAnswer` already rejects anything that arrives outside `phase === 'question'`. During
  `reading` the server refuses answers **without one line of new code**, and it refuses them to a
  crafted `POST`, not merely to a hidden button.
- `elapsedMs` is measured from `phaseStartedAt`. Because `question` now starts when answering opens,
  the speed bonus clock is already correct. In a sub-state design every player would collect the
  full bonus, because the clock would have started five seconds before anyone could answer.

**The timer bar does not appear during `reading`.** That bar means "you may answer now" and nothing
else; showing it while answering is impossible teaches the room the wrong signal. `reading` gets its
own countdown affordance — discrete dots, not a bar.

**Budget:** 9 × 5 s = 45 s on top of v3's 7:18 → **8:03**.

---

## 3. The token gate

`/tv` opens on a gate screen. No QR, no player-facing content, nothing a room can see and act on.
The host types the facilitator token; on success `/tv` moves to the lobby.

**This is UX, not security, and the spec says so out loud** so nobody later mistakes it for a
boundary. The real guard is unchanged: every control route validates `x-facilitator-token`
server-side on every call, and an unset `FACILITATOR_TOKEN` still means 403. The gate exists so the
host stops typing a shared secret in front of a hundred people, and so the lobby's top-right corner
is empty.

The token is held in **`localStorage`** under the key `aidet.hostToken`, which `app/tv/page.tsx`
already used before this pass. An earlier draft of this spec said `sessionStorage`; that was
written without checking, and adopting it would have created a second source of truth for the
same value. A refresh mid-session must not throw the host back to the gate — that is a stage
failure, not a security improvement — and `localStorage` satisfies that while matching the
posture the README already takes toward this token (treat it like a sticky note on the laptop).

---

## 4. The lobby

- **QR centred**, large, on a paper-coloured card.
- **Start centred below it**, the largest control on screen, with a slow idle pulse.
- **Player names are pinned cards** scattered around the edges at small random-looking rotations,
  each dropping in as its player joins, with faint connector lines between a few of them.
- **No host controls.** `Start` is the only thing the host can press here. `Next`, `Hold` and the
  reset control appear only once the game has started, and from then on they hold their v3 position
  and never move again.

**At 100 players the lobby shows the most recent arrivals, not all of them.** Cap the visible cards
and let them cycle; a wall of a hundred names is unreadable and the point of the screen is "your
name appeared, you are in", which the most recent N satisfies. The authoritative count is displayed
as a number.

---

## 5. Art direction

Lifted from `ai_detective_premium_edition-3.html`, verbatim where possible.

| token | value | role |
| --- | --- | --- |
| `--det-bg` | `#04050e` | ground |
| `--det-panel` | `#0d1127` | panels |
| `--det-border` | `#2b325c` | pixel borders |
| `--det-cyan` | `#00e5ff` | questions, timer, secondary |
| `--det-gold` | `#ffd700` | headings, primary action, frames |
| `--det-green` | `#39ff14` | correct / approve |
| `--det-pink` | `#ff3366` | incorrect / reject / alarm |
| `--det-paper` | `#fffbf2` | the duck's speech, name cards, QR |
| `--det-paper-ink` | `#1e1713` | text on paper |

**Namespaced under a `.det` scope.** `app/globals.css` is imported by the root layout, so an
unscoped re-theme would reach The Decision Room, which is finished and reviewed. Every new token and
class carries the `det-` prefix and applies under a `.det` wrapper on `/` and `/tv` only.

**Type, and a hard constraint that has already bitten this project's fonts once:**

- **`Press Start 2P` has no Thai glyphs.** It is used for English only — `AI DETECTIVE`, `TOP 5`, an
  act's English subtitle, phase labels. Any Thai in it renders as tofu or drops its vowel marks.
- **All Thai copy is `Sarabun`**, weight 700–800 for headings.
- **`VT323` for numerals** — scores, counts, the tally number, the countdown.

The reference itself splits the three faces exactly this way; follow it.

---

## 6. Characters

The reference draws two sprites on a `<canvas>` with plain 2D primitives and a frame counter:
`drawSherlockSprite(ctx, x, y, w, h, direction, frame)` and `drawDuckSprite(...)`, plus a patrol
loop in which the detective walks between bounds and the duck follows with easing
(`duck.x += ((player.x - direction * 70) - duck.x) * 0.055`) and an idle bounce
(`Math.sin(frame * 0.28) * 3`).

**Lift it.** It is about sixty lines, has no dependencies, and it is exactly the decorative motion
the phone's dead space needs.

- **Phone**: a patrol strip fills the empty area above the buttons during `reading` and `question`.
- **`/tv` lobby**: the same pair patrols along the bottom edge.
- **Nowhere else.** During `reveal`, `actcard` and `tally` the screen has something to say and a
  walking duck competes with it.

**It must stop under `prefers-reduced-motion: reduce`** — hold frame 0 rather than cancelling the
render, so the characters are still present, just still. A `matchMedia` check that skips the
`requestAnimationFrame` loop is sufficient; a CSS rule cannot reach a canvas.

---

## 7. Colour semantics — buttons and the split bar disagree on purpose

**Buttons colour by action.** `ผ่าน` is green, `ตีกลับ` is pink. Approve/reject reads as go/stop in
every interface a person has ever used, and the buttons are an action the player is taking.

**The split bar colours by correctness, not by action.** On a question whose correct verdict is
`reject`, the share that pressed `ตีกลับ` renders green and the share that pressed `ผ่าน` renders
pink — with labels naming the action so nobody has to guess which is which.

This is deliberate and it is the whole point of the screen. v3 coloured the bar by action, so a
reveal where 68% of the room approved a fabricated answer rendered as a wall of green — the colour
of "well done" — under a sentence saying they had just been fooled. The bar's job is to show the
room what it did, and being mostly alarm-coloured is the honest rendering of a room that was fooled.

---

## 8. Layout corrections

- **`reveal` and `tally` are vertically centred** in the stage rather than top-anchored, and their
  type scales up to use the recovered space. These are the two screens the room reads longest.
- **The phone is never mostly empty.** During `reading` and `question` the patrol strip occupies the
  space above the buttons.
- The projector's existing constraints stand: size with `min(clamp(px, vw, px), Nvh)` because height
  binds on a projector; `/tv`'s `<main>` is `overflow-hidden` so anything too tall is clipped rather
  than scrolled, which is why the host control has its own separate measurement.

---

## 9. Tests

Beyond v3's suite, which must stay green:

1. `reading` is entered before every `question`, nine times, and never after a `reveal` directly.
2. `recordAnswer` returns `closed` during `reading` — the server-side proof that the beat is real.
3. `remainingMs` counts down during `reading` and the timer-bar element is absent from that phase.
4. The speed bonus for an answer at the first instant of `question` is the maximum — proving the
   clock did not start five seconds early.
5. The gate renders when no token is held, the lobby renders when one is, and a re-render with a
   held token does not return to the gate.
6. The lobby renders no `Next`/`Hold` control; a started game does.
7. The split bar assigns green to the correct verdict's share on both a `pass` question and a
   `reject` question.
8. `needsCheck` still never renders — the constraint survives the re-skin.
9. The reduced-motion probe in `scripts/check-projector-fit.mjs` additionally asserts the canvas
   loop is not running.
10. `npm run check:projector` passes at both projector shapes for **seven** phase kinds, and the
    phone walk still reaches both buttons at 390×844.

---

## 10. Out of scope

- Re-theming The Decision Room. It is finished, reviewed, and shares only the root stylesheet.
- Replacing the emoji avatars with pixel sprites. The patrol characters are decorative; per-player
  avatars stay as they are.
- The `/api/state` inference channel noted at the end of v3 (`score`/`streak`/`wrongPass` are
  ungated across phases). Real but theoretical, and unrelated to this pass.

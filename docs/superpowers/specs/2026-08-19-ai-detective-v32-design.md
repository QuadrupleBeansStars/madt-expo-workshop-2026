# AI Detective v3.2 — Legibility, Reveal Beats, and the Rules Screen

**Workshop:** MADT Expo, **23 August 2026**
**Builds on:** `2026-08-18-ai-detective-v31-design.md`. v3.1's mechanics, content, phase machine and
art direction stand unless this document overrides them.

> v3.1 was measured in a real browser at 1366×768 against the **8H rule** — the AV standard that the
> smallest text on a projected screen must be at least 1/50 of the screen height. Almost nothing
> passed, and the failure was worse than "too small": every size tier is written as
> `clamp(<px>, <n>vh, <px>)`, and **all eighteen tiers hit their pixel ceiling between 944px and
> 1067px of screen height**. A 1080p monitor is already past every one of them, so the design gets
> *relatively smaller as the monitor gets bigger*. On a 4K panel the smallest text is 1/120 of the
> screen — less than half the 8H minimum.
>
> The team also approved a set of reveal beats (Kahoot-shaped, detective-dressed), a rules screen,
> and a longer reading beat.

---

## 1. The type system — vh, with no ceiling

**Every `clamp(<px>, <n>vh, <px>)` on `/tv` loses both bounds and becomes a plain `vh` value.**

This is the whole fix, and it is a fix in the *unit*, not in the numbers: `2vh` **is** 1/50 of the
screen height at every resolution, so once sizes are expressed in `vh` the 8H rule holds by
construction and never has to be re-checked against a new monitor.

Raising the ceilings instead was considered and rejected: whatever ceiling is chosen, a larger
display exists.

| role | size | 768p | 1080p | 4K |
| --- | --- | --- | --- | --- |
| Screen title (lobby, standings, podium) | **9vh** | 69px | 97px | 194px |
| The question | **5.7vh** | 44px | 62px | 123px |
| The duck's answer | **4.6vh** | 35px | 50px | 99px |
| Host controls | **3.6vh** | 28px | 39px | 78px |
| Leaderboard rows | **3.1vh** | 24px | 33px | 67px |
| Lobby name cards | **3.0vh** | 23px | 32px | 65px |
| **Floor — nothing on `/tv` may be smaller** | **3.1vh** | 24px | 33px | 67px |
| *(8H absolute minimum, for reference)* | *2vh* | *15px* | *22px* | *43px* |

**The floor is 3.1vh, not the 8H minimum of 2vh.** The sources are explicit that 1/50 is a bare
minimum "not for guaranteed easy reading", and it degrades with room brightness, projector
sharpness and viewer age — all unknown at an expo hall with walk-up seating.

**Lobby name cards at 3.0vh are the one deliberate exception**, and they sit above the 8H minimum
by 50%. They are short proper nouns, not running text, and the size buys the board its capacity
(§4). Anything else below 3.1vh is a defect.

**A label that cannot justify 3.1vh is deleted, not shrunk.** `คำถาม / สถานการณ์:` and
`เจ้าเป็ด AI ตอบว่า:` measured 14.6px and go: the dossier's own structure already says what each
field is, and a label nobody can read is worse than no label.

## 2. The gold button — a deliberate break from the reference

`.det-btn-gold` gets **`color: #241c00`**.

It currently has no `color` declaration because an earlier pass removed one for fidelity — the
reference file does not set one either — so text falls back to white on `#b08200`, measured at
**3.5:1**, on the Start button, the single most important control on the pre-game screen. Dark ink
measures 8.9:1.

The reference is a single-viewer desktop deck; this is projected to a hundred people in a lit hall.
Where fidelity and legibility collide **on a control the room has to find**, legibility wins. The
purple `.det-btn` is untouched — white on `#290852` is fine.

## 3. `READING_MS` → 10 s, and a new `rules` phase

`READING_MS = 10_000`.

A phase is added between `lobby` and the first `reading`:

```
lobby → rules → reading → question → reveal → [actcard every 3rd] → … → tally → podium
```

**`rules` is a real phase, not an overlay**, for the same reasons `reading` is: the host advances it
with the control that already exists, every phone follows the projector automatically, and a
refresh mid-screen does not lose it. It is **host-advanced with no countdown** — a hundred people
read at different speeds, and it is the one screen where spending extra time costs nothing.

**The rules screen does not mention the speed bonus.** Announcing that faster answers score more
would make the room rush, which is the opposite of what this workshop teaches. The bonus stays a
silent tiebreaker.

Content (Thai; the modal is paper-coloured over a scrim):

1. จอจะขึ้น **คำถาม** กับ **คำตอบของ AI**
2. อ่าน 10 วิ แล้วตัดสินใน 15 วิ — ✓ ผ่าน (เชื่อได้) / ✗ ตีกลับ (มีปัญหา)
3. ถูกติดกันยิ่งได้เยอะ **ผิดเมื่อไหร่เริ่มนับใหม่**

Footer chips: `ถูก +100` · `ติดกัน2 +200` · `ติดกัน3+ +300` · `ผิด 0`

**Budget:** 9 × 10 s reading = 90 s, plus ~30 s of rules → **≈ 9:18** total, up from 8:03.

## 4. The lobby

**Big title**, 9vh, `ห้องสืบสวน` over `SCAN TO JOIN THE CASE`, inline-block and centred so name
cards can sit beside it rather than losing a full band of board.

**No red string.** Removed.

**Names must not overlap each other at all, and every card renders at full opacity.** Because
nothing is covered, the age-based and coverage-based fading of earlier drafts is deleted outright.

**Placement is shelf packing, not scattering.** Two earlier attempts scattered and tried to dodge;
neither can reach "no overlap", because 100 cards at a readable size occupy most of the board and
random placement jams well before they all fit. Instead:

- The board is divided into invisible shelves of one card-height plus `GAP_Y = 1.35vh`.
- Furniture — the title, the QR, the Start button, the counter — blocks an x-range on every shelf
  it crosses, padded by `GAP_X = 1.1` / `GAP_Y`. Furniture rectangles are **measured from the live
  DOM**, never hard-coded, so they stay correct at any stage size.
- A new card takes the free gaps of each shelf, and lands in one **chosen at random from the four
  shelves with the most free width** — empty space wins, but not so rigidly that the board looks
  sorted.
- Rotation is ±1.5°, y-jitter ±0.25vh: enough to stop it reading as a table, small enough that a
  rotated card still cannot reach its neighbour.

Overlap is then impossible by construction, not merely unlikely.

**Capacity at 3.0vh is about 108 cards.** Past that the board is genuinely full; the choice at that
point is smaller cards or accepting overlap, and it is not made here.

**The QR, the Start button and the counter render above the name layer** with dark haloes, so they
stay readable over a full board.

**Nothing about the right edge may be reserved.** An earlier draft positioned cards by left offset
constrained to `100 − cardWidth`, which silently reserved a card's width of dead space along the
right edge; shelf gaps are walked to the true edge instead.

## 5. The standings

- **Ten places**, up from five. Row pitch `8.0vh`, row body ≈ 5.6vh, so every pair keeps a 2.4vh gap
  and no two rows ever touch.
- **Big title**, 9vh, same treatment as the lobby and podium, over `AFTER CASE n OF 09`.
- **The rank-change indicator comes first in the row** — before the position, the avatar and the
  name. The eye should learn who climbed before it learns who they are.
- **Rank is encoded in a left rail as well as the numeral**: gold, silver, bronze for the top three,
  neutral below; and the numeral itself is larger for the top three.
- **No score-proportional fill bars.** Tried and rejected by the team.
- **Everything moves on one beat**: the number counts up, the row slides to its new slot, the arrow
  fades in — all in ~0.95 s. The rank numeral flips at the midpoint, when the row is nearest its new
  slot, which is what makes a simultaneous move readable.
- **The arrows are computed on the projector**, by diffing against the previous ranking held in a
  ref. The server keeps nothing extra. A mid-game refresh of `/tv` costs that round's arrows and
  nothing else — acceptable for a presentational cue.

## 6. The podium

- **Three distinct widths** — 3rd `17cqw`, 2nd `21cqw`, 1st `29cqw` — with lifts `0`, `-3cqh`,
  `-9cqh`, so first place is unmistakably first from any seat.
- **Revealed 3 → 2 → 1**, first place after a longer beat, with a crown, a gold border, a glow and a
  spotlight that lights only when it lands.
- **Each score counts up from zero as its card lands.** The climbing number *is* the announcement;
  a number already sitting there when the card appears throws away half the beat.
- **Cards are pinned evidence cards, not three coloured plinths.** Plinths are game-show language;
  the pinned card is the same object as the lobby's name card, so the end of the game is visibly the
  same world as the start.
- Title `คดีปิดแล้ว` at 9vh over `TOP 3 OF <n> DETECTIVES`, then a `CASE CLOSED` stamp that slams in.

## 7. The phone

- **`components/CodenameScreen.tsx` is rebuilt.** It was never touched by v3.1 and still carries v2
  classes (`bg-brand-orange`, `text-brand-navy`, `border-line`, `bg-surface`) — the first screen every
  player sees and the only one left in the old design. It becomes the case-folder language: folder
  tab, paper body, pixel type for English and `--font-thai` for Thai, gold action button with dark
  ink. Nothing under 16px.
- **The two answer buttons are rubber stamps.** On press the chosen stamp slams onto the paper at
  −11° from ~2.6× with a spring and stays; the other dims. Under `prefers-reduced-motion` the mark
  appears without the slam.
- **The reveal shows rank and the gap to the player above** — Kahoot's move, and the number that
  keeps someone playing: "85 points behind 3rd" means the next question can change it, which a bare
  total cannot say.
- **The reveal also shows what the room did** ("ห้องนี้ 68% ตอบพลาดข้อนี้"). Knowing you were not
  the only one fooled is what lets a person admit they were fooled.
- **The final screen has no replay button.** Beyond tidiness: a player who replays mid-event becomes
  a second scoreless player while the room counter and the closing tally still count them, so the
  tally — the number the whole workshop walks toward — goes wrong. The screen ends on the player's
  own lesson and points at the projector.
- The `+points` line currently uses `var(--rt-gold)`, a v2 token; it moves onto the `.det` palette.

## 8. Server additions

**`rank` and `gapToNext` on `you`** in `getPublicState`, both derived from the leaderboard that
already exists — no new stored state. Rank 1 has no one above it, so `gapToNext` is absent there and
the phone shows the lead instead. Both are the player's own standing; no other player's score is
exposed.

**Duplicate codenames get a numeric suffix.** `app/api/join/route.ts` today enforces exactly three
rules — must be a string, must be non-empty after trimming, truncated to 40 characters — and
**nothing prevents two people both being `เป็ดทอง`**. Scores survive it, because players are keyed
by a generated `playerId`, but everything the room sees breaks: two identical lobby cards, two
identical leaderboard rows, and an unresolvable podium announcement.

The fix is Kahoot's: the second `เป็ดทอง` becomes `เป็ดทอง 2`. **It must happen server-side inside
`join()`** — two phones can submit the same name in the same second, and a client-side check cannot
see the other phone. Matching is on the trimmed string.

**Lobby cards truncate at ~14 characters with an ellipsis.** Storing 40 is fine; rendering 40 on the
board lets one name eat a shelf.

## 9. Also on the projector

- **The question screen shows how many have answered** — `ตอบแล้ว 84/103`. Without it the host cannot
  tell whether to wait or advance. This is the one addition here that serves the person running the
  game rather than the people watching it.
- **The reveal's teaching line moves to the middle of the screen at 4.2vh**, ruled above and below.
  It had been the smallest thing on the screen where the lesson is supposed to land.
- **The tally number counts up** over ~2 s instead of appearing. It is the number the entire
  workshop walks toward.

## 10. Tests

v3.1's suite must stay green (415 at the time of writing). Beyond it:

1. `rules` is entered once, between `lobby` and the first `reading`, and never again.
2. `recordAnswer` returns `closed` during `rules`.
3. `READING_MS === 10_000`, and the speed bonus for an answer at the first instant of `question` is
   still the maximum — proving the clock did not start early.
4. `join()` twice with the same codename yields distinct codenames, the second suffixed.
5. `getPublicState().you.rank` matches the player's position in `getLeaderboard()`, and `gapToNext`
   equals the difference to the player above; rank 1 has no `gapToNext`.
6. The standings render ten rows when ten players exist, and the rank-change indicator precedes the
   position in DOM order.
7. **`app/globals.css` and the `/tv` tree contain no `clamp(` with a `px` upper bound** — a
   source-level guard, because this is the defect class the whole pass exists to remove.
8. `scripts/check-projector-fit.mjs` additionally asserts **no text node on any `/tv` phase computes
   below 3.1vh of the stage height**, at both projector shapes. The user has now twice caught a
   legibility problem the existing checks were blind to; the check gets the assertion so it cannot
   regress.

Presentational work — exact sizes, colours, easing — is **not** asserted in unit tests. The screenshot
and the projector check are the gate. Assertions there would lock in numbers that are still being
tuned and would fail for reasons that are not defects.

## 11. Out of scope

- The Decision Room (`app/biz`, `app/play`, `lib/room*.ts`, `lib/pricing.ts`, `lib/sim.ts`,
  `content/room*.ts`, `content/audience.ts`). Finished, reviewed, shares only the root stylesheet.
- Per-player pixel avatars. Emoji stay.
- The `/api/state` inference channel noted at the end of v3.
- Any decision about what happens past ~108 lobby cards.

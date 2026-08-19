# AI Detective v3.1 ("Premium Edition") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a five-second reading beat before every answer window, gate `/tv` behind a login screen, rebuild the lobby around scattered name cards, and re-skin AI Detective in the reference file's premium pixel language — without touching The Decision Room.

**Architecture:** A seventh phase (`reading`) slots into the existing machine so the server's own guards enforce "you cannot answer yet" for free. Everything else is presentation: a namespaced `.det` token set in `app/globals.css`, a canvas patrol component lifted from the reference, and layout corrections to screens that currently use the top half of a projector and leave the bottom empty.

**Tech Stack:** Next.js 16.2.10 (App Router), React 19, TypeScript, Tailwind v4 (CSS-first), vitest + @testing-library/react, playwright-core for the real-browser check.

**Spec:** `docs/superpowers/specs/2026-08-18-ai-detective-v31-design.md`

## Global Constraints

- **Amend files, never replace them.** Four defects on the previous branch came from a plan that said "replace `<file>` with this sample" and silently dropped tests. Every step below names what must survive. When you add tests, **append to the existing file** and leave every existing test in place.
- **`Press Start 2P` has no Thai glyphs.** English only. All Thai copy is `Sarabun` (700–800 for headings). `VT323` for numerals.
- **The reference file is the specification for the look.** `C:\\Users\\notap\\Downloads\\ai_detective_premium_edition-3.html`. Values are lifted verbatim, not approximated: the title's double shadow, the CRT overlay's two background sizes, the button's left-offset shadow and white border, and the framed screen's inset vignette are all part of it, not decoration on top of it.
- **All new tokens and classes are prefixed `det-` and apply under a `.det` wrapper**, because `app/globals.css` is imported by the root layout and The Decision Room shares it.
- **`READING_MS = 5_000`**, `QUESTION_MS = 15_000`, `REVEAL_MS = 12_000`, `NEXT_GUARD_MS = 700` — all single-sourced from `lib/game.ts`.
- **The timer bar never appears during `reading`.** That bar means "you may answer now".
- **Buttons colour by action** (`ผ่าน` green, `ตีกลับ` pink). **The split bar colours by correctness** — the correct verdict's share is green whichever action it was.
- **`needsCheck` must never render.**
- **Out of bounds:** `app/biz`, `app/play`, `lib/room*.ts`, `lib/pricing.ts`, `lib/sim.ts`, `content/room*.ts`, `content/audience.ts`, and every Decision Room section of the docs.
- The server owns the clock; `now` is always a parameter in `lib/game.ts`.

---

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `lib/types.ts` | modify | add `'reading'` to `Phase` |
| `lib/game.ts` | modify | `READING_MS`, `readingState`, transitions, expiry |
| `lib/game.test.ts` | append | reading-phase walk and expiry |
| `lib/store.test.ts` | append | the server refuses answers during `reading` |
| `app/globals.css` | modify | `.det` token block, premium classes, CRT overlay, keyframes, reduced-motion |
| `app/globals.det.test.ts` | create | pins the treatments lifted from the reference |
| `components/game/Patrol.tsx` | create | canvas patrol characters |
| `components/game/Patrol.test.tsx` | create | mounts, honours reduced motion |
| `app/tv/page.tsx` | modify | token gate, lobby rebuild, `reading` branch, `.det` wrapper |
| `app/tv/tv.test.tsx` | append | gate, lobby controls, reading branch |
| `app/page.tsx` | modify | `reading` branch, patrol strip, `.det` wrapper |
| `app/page.test.tsx` | append | locked buttons during `reading` |
| `components/game/SplitBar.tsx` | modify | colour by correctness |
| `components/game/Tally.tsx` | modify | vertical centring, larger type |
| `scripts/check-projector-fit.mjs` | modify | seven phases, canvas reduced-motion assert |
| `content/questions.ts` | modify | swap the opener to the question that fools the room |
| `content/questions.test.ts` | append | pins the opener and act 1's chip order |

---

## Task 1: The `reading` phase

**Files:**
- Modify: `lib/types.ts:140` (the `Phase` union)
- Modify: `lib/game.ts`
- Test: `lib/game.test.ts` (append), `lib/store.test.ts` (append)

**Interfaces:**
- Consumes: `QUESTION_MS`, `REVEAL_MS`, `QUESTIONS_PER_ACT`, `QUESTION_COUNT` from `lib/game.ts`.
- Produces: `READING_MS = 5_000`; `Phase` gains `'reading'`; `startedState(now)` now returns a `reading` state; `currentQuestion` returns the question during `reading` as well as `question`/`reveal`.

- [ ] **Step 1: Append the failing tests to `lib/game.test.ts`**

Do **not** rewrite this file. It currently holds the v3 phase-machine suite; every one of those tests must still be there and still pass. Add at the end:

```ts
describe('the reading beat', () => {
  it('opens the game on reading, not on question', () => {
    expect(startedState(T0).phase).toBe('reading')
    expect(startedState(T0).phaseDurationMs).toBe(READING_MS)
  })

  it('puts a reading phase in front of every one of the nine questions', () => {
    const seen = walk()
    expect(seen.filter((p) => p === 'reading')).toHaveLength(QUESTION_COUNT)
    for (let i = 0; i < seen.length; i++) {
      if (seen[i] === 'question') expect(seen[i - 1], `question at ${i}`).toBe('reading')
    }
  })

  it('carries the same qIndex from reading into its question', () => {
    let s = startedState(T0)
    expect(s.qIndex).toBe(0)
    s = nextState(s, T0)
    expect(s.phase).toBe('question')
    expect(s.qIndex).toBe(0)
  })

  it('shows the question during reading, so the room can read it', () => {
    expect(currentQuestion(startedState(T0))?.id).toBe(QUESTIONS_IN_ORDER[0].id)
  })

  it('expires on its own timer and never early on an answered count', () => {
    const s = startedState(T0)
    expect(shouldExpire(s, T0 + READING_MS - 1, 5, 5)).toBe(false)
    expect(shouldExpire(s, T0 + READING_MS, 5, 0)).toBe(true)
  })

  it('counts down during reading', () => {
    const s = startedState(T0)
    expect(remainingMs(s, T0 + 2000)).toBe(READING_MS - 2000)
  })
})
```

Add `READING_MS` and `QUESTION_COUNT` to the existing import from `./game`, and `QUESTIONS_IN_ORDER` if it is not already imported.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/game.test.ts`
Expected: FAIL — `READING_MS` is not exported and `startedState` returns a `question` state.

- [ ] **Step 3: Add `'reading'` to the `Phase` union**

`lib/types.ts:140`:

```ts
export type Phase = 'lobby' | 'reading' | 'question' | 'reveal' | 'actcard' | 'tally' | 'podium'
```

- [ ] **Step 4: Implement the phase in `lib/game.ts`**

Add the constant beside `QUESTION_MS`:

```ts
/**
 * The beat before the answer window opens. The room reads the question and the duck's answer with
 * no button to press.
 *
 * This is a PHASE, not a sub-state of `question`, and the reason is that two guarantees fall out of
 * that for free. `recordAnswer` already refuses anything arriving outside `phase === 'question'`, so
 * the server rejects an early answer without a line of new code — and to a crafted POST, not just to
 * a hidden button. And `elapsedMs` is measured from `phaseStartedAt`, so the speed-bonus clock
 * starts when answering opens. As a sub-state, every player would collect the full bonus because
 * the clock would have started five seconds before anyone could act.
 */
export const READING_MS = 5_000
```

Add the constructor beside `questionState`:

```ts
const readingState = (qIndex: number, now: number): GameState =>
  ({ phase: 'reading', qIndex, phaseStartedAt: now, phaseDurationMs: READING_MS, holding: false })
```

`startedState` now opens on it:

```ts
export function startedState(now: number): GameState {
  return readingState(0, now)
}
```

In `nextState`, add the `reading` case and route the two places that used to jump straight to a question through it:

```ts
    case 'reading':
      return questionState(s.qIndex, now)
```

and in `case 'reveal':` replace `return questionState(finished, now)` with `return readingState(finished, now)`;
in `case 'actcard':` replace `return questionState(next, now)` with `return readingState(next, now)`.

In `shouldExpire`, add ahead of the `question` branch:

```ts
  // Reading ends on its clock and only on its clock. There is nothing to answer, so an
  // "everyone has answered" early exit would fire immediately on a room that answered the
  // PREVIOUS question — `answeredCount` is not reset between phases.
  if (s.phase === 'reading') return now >= s.phaseStartedAt + s.phaseDurationMs
```

In `remainingMs`, widen the guard:

```ts
  if (s.phase !== 'reading' && s.phase !== 'question' && s.phase !== 'reveal') return 0
```

In `currentQuestion`, widen the guard:

```ts
  if (s.phase !== 'reading' && s.phase !== 'question' && s.phase !== 'reveal') return null
```

- [ ] **Step 5: Append the server-side proof to `lib/store.test.ts`**

Do not rewrite this file — it holds the v3 store suite. Append:

```ts
describe('the reading beat is enforced by the server, not the UI', () => {
  it('refuses an answer while the room is still reading', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    store.startGame(T0)
    expect(store.getGameState().phase).toBe('reading')
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: 'pass' }, T0 + 1)).toBe('closed')
    expect(store.getAnswers()).toHaveLength(0)
  })

  it('accepts it the instant the question opens, at full speed bonus', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    store.startGame(T0)
    store.next(T0 + READING_MS)
    expect(store.getGameState().phase).toBe('question')
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: q.verdict }, T0 + READING_MS)).toBe('ok')
    // elapsedMs is measured from the QUESTION's start, so an instant answer earns the whole bonus.
    expect(store.getAnswers()[0].elapsedMs).toBe(0)
  })
})
```

- [ ] **Step 6: Run both suites**

Run: `npx vitest run lib/game.test.ts lib/store.test.ts`
Expected: PASS, with every pre-existing test still present and green.

- [ ] **Step 7: Run the whole suite and commit**

Run: `npm test` — some `app/` tests will fail because `startedState` now lands on `reading` and their fixtures say `question`. Fix **only** the fixture phase strings in those tests; do not change what they assert.

```bash
git add lib/types.ts lib/game.ts lib/game.test.ts lib/store.test.ts app/
git commit -m "feat(detective): a five-second reading beat before every answer window"
```

---

## Task 2: The premium token set, namespaced

**Files:**
- Modify: `app/globals.css`
- Modify: `app/tv/page.tsx`, `app/page.tsx` — add the `.det` wrapper class to each page's outermost element only

**Interfaces:**
- Produces: CSS custom properties `--det-bg`, `--det-panel`, `--det-border`, `--det-cyan`, `--det-gold`, `--det-green`, `--det-pink`, `--det-paper`, `--det-paper-ink`; utility classes `.det-pixel`, `.det-title`, `.det-thai`, `.det-term`, `.det-btn`, `.det-btn-gold`, `.det-frame`, `.det-goldbox`, `.det-paper`; and the CRT overlay on `.det::after`.
- **The reference file is at `C:\\Users\\notap\\Downloads\\ai_detective_premium_edition-3.html`.** Open it and read its `<style>` block before you start. Every value in Step 1 came from there; if one looks wrong to you, check the source rather than "fixing" it.

- [ ] **Step 1: Add the token block to `app/globals.css`**

Append a new section. Do not modify the existing `@theme inline` block or any Decision Room rule — The Decision Room imports this same stylesheet and is out of bounds.

```css
/* ── AI Detective v3.1 · premium edition ──────────────────────────────
   EVERY value below is lifted verbatim from the team's reference,
   ai_detective_premium_edition-3.html. Do not "improve" any of them — the whole point of
   this task is that the result looks like that file. If a value seems odd (the button's
   shadow is offset LEFT, the title carries two shadows), it is odd in the reference too.

   Namespaced `det-` and scoped under `.det`, which only `/` and `/tv` carry:
   app/globals.css is imported by the root layout, so an unscoped re-theme would reach
   The Decision Room, which is finished and out of bounds. */
.det {
  --det-bg: #04050e;
  --det-panel: #0d1127;
  --det-border: #2b325c;
  --det-cyan: #00e5ff;
  --det-gold: #ffd700;
  --det-green: #39ff14;
  --det-pink: #ff3366;
  --det-paper: #fffbf2;
  --det-paper-ink: #1e1713;
  background: var(--det-bg);
  color: #f1f5f9;
  position: relative;
}

/* The CRT overlay. Two layers: a 4px horizontal scanline and a 6px vertical RGB stripe.
   This is most of why the reference reads as a screen rather than a web page. */
.det::after {
  content: " ";
  position: absolute;
  inset: 0;
  z-index: 99;
  pointer-events: none;
  background:
    linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.12) 50%),
    linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 255, 0, 0.02));
  background-size: 100% 4px, 6px 100%;
}

/* Press Start 2P has NO Thai glyphs — Thai in it loses its vowel marks. English only. */
.det-pixel { font-family: var(--font-pixel), monospace; letter-spacing: 4px; }

/* The signature treatment: a hard offset shadow in dark gold PLUS a soft glow.
   Without both, gold pixel type on a near-black ground reads flat. */
.det-title {
  font-family: var(--font-pixel), monospace;
  color: var(--det-gold);
  text-shadow: 6px 6px 0px #705400, 0 0 25px rgba(255, 215, 0, 0.55);
  letter-spacing: 4px;
}

.det-thai { font-family: var(--font-thai), system-ui, sans-serif; font-weight: 700; }
/* VT323 is the reference's terminal face — numerals AND short machine-ish lines, not numerals only. */
.det-term { font-family: var(--font-retro), monospace; font-variant-numeric: tabular-nums; }

/* The reference's button is purple with a white border and a hard shadow offset LEFT-down.
   It is not a gold button; the gold one is the primary variant below. */
.det-btn {
  font-family: var(--font-pixel), monospace;
  font-size: 13px;
  padding: 14px 28px;
  background-color: #290852;
  color: #fff;
  border: 4px solid #fff;
  box-shadow: -4px 4px 0px #000;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.1s ease;
  text-transform: uppercase;
  display: inline-flex; align-items: center; justify-content: center; gap: 12px;
}
.det-btn:hover { background-color: #3f107c; }
.det-btn:active { transform: translate(-2px, 2px); box-shadow: -2px 2px 0px #000; }
.det-btn:disabled { opacity: .45; cursor: default; transform: none; }
.det-btn.det-btn-gold { background-color: var(--det-gold); color: #241c00; border-color: #fff6c2; }
.det-btn.det-btn-gold:hover { background-color: #ffe680; }

/* The framed screen: a thick dark border, generous radius, and an inset vignette. */
.det-frame {
  border: 6px solid #141724;
  border-radius: 20px;
  box-shadow: 0 0 80px rgba(0, 0, 0, 0.95), inset 0 0 50px rgba(0, 0, 0, 0.85);
  overflow: hidden;
}

.det-goldbox { border: 3px solid var(--det-gold); border-radius: 10px; background: var(--det-panel);
               box-shadow: 0 0 26px rgba(255, 215, 0, .18); }
.det-paper { background: var(--det-paper); color: var(--det-paper-ink); }
```

- [ ] **Step 2: Confirm the faces are already loaded — do NOT add new ones**

`app/layout.tsx:2-7` already loads all three via `next/font/google`, exposing them as CSS
variables: `--font-pixel` (Press Start 2P), `--font-retro` (VT323), `--font-thai` (Sarabun,
weights 300/400/600/700).

**Always reference the variables, never the family names.** `npm run build` bundles these fonts so
the app runs with no internet on the day — the README calls that out as non-negotiable. Hardcoding
`"Press Start 2P"` bypasses the bundle and would silently fall back to a system monospace in the
venue, which is the kind of failure nobody notices until the room is full.

**Sarabun 800 is not loaded** — the spec says 700–800 for headings; use **700**, which is. Do not
add a weight to `layout.tsx` for this; 700 is heavy enough at projector scale and every extra
weight is bytes in the offline bundle.

- [ ] **Step 3: Add the wrapper**

In `app/tv/page.tsx` and `app/page.tsx`, add `det` to the className of each page's outermost element. Change nothing else in either file in this task.

- [ ] **Step 4: Verify nothing leaked**

Run: `npm test` — expected green.
Run: `npx tsc --noEmit` — expected clean.
Then confirm the Decision Room is untouched: `git diff --name-only` must list only `app/globals.css`, `app/layout.tsx`, `app/tv/page.tsx`, `app/page.tsx`.

- [ ] **Step 5: Prove the treatments are actually present**

Every one of these is a thing the reference does that a token list alone would miss. Assert them
in a new `app/globals.det.test.ts` by reading the stylesheet source — jsdom will not compute them,
so read the file and assert the declarations exist:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('app/globals.css', 'utf8')

describe('the premium treatments survive', () => {
  it('keeps the title double shadow — hard offset plus glow', () => {
    expect(css).toContain('6px 6px 0px #705400')
    expect(css).toContain('0 0 25px rgba(255, 215, 0, 0.55)')
  })
  it('keeps the CRT overlay at both background sizes', () => {
    expect(css).toContain('background-size: 100% 4px, 6px 100%')
  })
  it("keeps the button's left-offset shadow, not a bottom one", () => {
    expect(css).toContain('box-shadow: -4px 4px 0px #000')
  })
  it('keeps the framed screen', () => {
    expect(css).toContain('border: 6px solid #141724')
    expect(css).toContain('inset 0 0 50px rgba(0, 0, 0, 0.85)')
  })
  it('scopes everything under .det so the Decision Room is untouched', () => {
    const det = css.slice(css.indexOf('.det {'))
    expect(det).not.toMatch(/^\s*(body|:root|html)\s*\{/m)
  })
})
```

- [ ] **Step 6: Commit**

```bash
git add app/globals.css app/globals.det.test.ts app/layout.tsx app/tv/page.tsx app/page.tsx
git commit -m "feat(detective): the premium look, lifted verbatim and pinned by tests"
```

---

## Task 3: The token gate

**Files:**
- Modify: `app/tv/page.tsx` (it already holds `HOST_TOKEN_KEY = 'aidet.hostToken'` at line 26 and a `token`/`tokenError` state pair — build on those, do not add a second source of truth)
- Test: `app/tv/tv.test.tsx` (append)

**Interfaces:**
- Consumes: the `.det` classes from Task 2.
- Produces: a `TokenGate` component rendered in place of everything else when no token is held.

- [ ] **Step 1: Append the failing tests**

Do not rewrite `app/tv/tv.test.tsx` — it holds the v3 projector suite including the lobby test restored during the last branch's audit. Append:

```tsx
describe('the token gate', () => {
  it('shows the gate and nothing player-facing when no token is held', async () => {
    localStorage.removeItem('aidet.hostToken')
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    expect(await screen.findByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByText(/เริ่มเกม/)).toBeNull()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('goes through to the lobby once a token is held', async () => {
    localStorage.setItem('aidet.hostToken', 'dev-local-9f2c')
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    expect(await screen.findByText(/เริ่มเกม/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/tv/tv.test.tsx`
Expected: FAIL — the lobby renders regardless of the token.

- [ ] **Step 3: Implement the gate**

Add above `TvPage`'s return, keeping every existing hook and both poll effects exactly as they are:

```tsx
/**
 * A login screen, not a security boundary — and the distinction matters enough to write down.
 * Every control route validates `x-facilitator-token` server-side on every call, and an unset
 * FACILITATOR_TOKEN still means 403. This screen exists so the host stops typing a shared secret
 * in front of a hundred people, and so the lobby's top-right corner can be empty.
 */
function TokenGate({ value, onChange, onSubmit, error }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; error: boolean
}) {
  return (
    <div className="grid min-h-screen place-items-center">
      <form
        className="det-goldbox w-[min(52vw,620px)] px-10 py-9 text-center"
        onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      >
        <div className="text-[clamp(40px,7vh,72px)] leading-none">🔒</div>
        <h1 className="det-pixel mt-5 text-[clamp(16px,2.6vh,26px)] text-[var(--det-gold)]">EVIDENCE ROOM</h1>
        <p className="det-thai mt-2 text-[clamp(18px,3vh,30px)]">ห้องเก็บหลักฐาน</p>
        <p className="det-thai mt-3 text-[clamp(12px,1.9vh,18px)] font-normal opacity-70">
          ใส่รหัสผู้ดำเนินรายการเพื่อเปิดห้อง
        </p>
        <input
          type="password" value={value} onChange={(e) => onChange(e.target.value)}
          className="det-num mt-6 w-2/3 rounded border-2 border-[var(--det-cyan)] bg-[#05060f]
                     px-4 py-3 text-center text-[clamp(20px,3vh,32px)] tracking-[.2em]
                     text-[var(--det-cyan)] outline-none"
        />
        <div>
          <button type="submit" className="det-btn mt-6 px-8 py-3 text-[clamp(11px,1.7vh,16px)]">
            เปิดห้อง
          </button>
        </div>
        {error && <p className="det-thai mt-3 text-[var(--det-pink)]">รหัสไม่ถูกต้อง</p>}
      </form>
    </div>
  )
}
```

Render it before anything else when `!token`, and **keep the token in `sessionStorage` for the tab** so a mid-session refresh does not throw the host back to the gate — that is a stage failure, not a security improvement. Reuse the existing `HOST_TOKEN_KEY`.

Validate by making a real `POST /api/control` the server can reject: send `{action:'hold'}` — it is the one action that is a no-op outside a reveal, so a wrong token gives a 403 and a right one gives a harmless 200.

- [ ] **Step 4: Run and commit**

Run: `npx vitest run app/tv/tv.test.tsx` — expected PASS, every pre-existing test included.

```bash
git add app/tv/page.tsx app/tv/tv.test.tsx
git commit -m "feat(detective): a login gate in front of the projector's lobby"
```

---

## Task 4: The lobby

**Files:**
- Modify: `app/tv/page.tsx` — the `Lobby` component at line 278 and the `HostControls` render at line 171
- Test: `app/tv/tv.test.tsx` (append)

**Interfaces:**
- Consumes: `TokenGate` from Task 3, `.det` classes from Task 2.
- Produces: nothing later tasks consume.

- [ ] **Step 1: Append the failing test**

```tsx
describe('the lobby', () => {
  it('offers Start and nothing else — Next and Hold appear only once the game runs', async () => {
    localStorage.setItem('aidet.hostToken', 'dev-local-9f2c')
    mockFetch({ ...base, phase: 'lobby' })
    render(<TV />)
    expect(await screen.findByText(/เริ่มเกม/)).toBeInTheDocument()
    expect(screen.queryByText(/ถัดไป/)).toBeNull()
    expect(screen.queryByText(/พัก/)).toBeNull()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/tv/tv.test.tsx`
Expected: FAIL — `HostControls` renders `ถัดไป` and `พัก` in the lobby.

- [ ] **Step 3: Gate the controls and rebuild the lobby**

`HostControls` keeps its position and its double-tap guard exactly as they are — both were reviewed and are load-bearing. Change only *which* buttons it renders: in `lobby`, render Start alone and place it centred in the lobby body rather than in the corner panel; from `reading` onward render the corner panel with `Next`, `Hold` and the reset control, in their current position, which then never moves again.

In `Lobby`, centre the QR and the Start button, and render player names as pinned cards:

```tsx
/** The most recent arrivals, not all of them. A hundred names is a wall nobody reads, and the
 *  screen's job is "your name appeared, you are in" — which the last N satisfies. The true count
 *  is printed as a number underneath. */
const VISIBLE_CARDS = 12

function NameCards({ names }: { names: string[] }) {
  const shown = names.slice(-VISIBLE_CARDS)
  return (
    <>
      {shown.map((n, i) => (
        <span
          key={n + i}
          className="det-thai det-paper absolute rounded px-3 py-1.5 text-[clamp(10px,1.7vh,16px)] shadow-lg"
          style={{
            // Deterministic scatter: no Math.random, so a re-render never reshuffles the board.
            left: `${6 + ((i * 37) % 82)}%`,
            top: `${14 + ((i * 53) % 68)}%`,
            transform: `rotate(${((i * 7) % 9) - 4}deg)`,
          }}
        >
          {n}
        </span>
      ))}
    </>
  )
}
```

- [ ] **Step 4: Run and commit**

Run: `npx vitest run app/tv/tv.test.tsx` — expected PASS.

```bash
git add app/tv/page.tsx app/tv/tv.test.tsx
git commit -m "feat(detective): a lobby of pinned name cards with the start button in the middle"
```

---

## Task 5: The patrol characters

**Files:**
- Create: `components/game/Patrol.tsx`, `components/game/Patrol.test.tsx`

**Interfaces:**
- Produces: `<Patrol className?: string />` — a self-contained `<canvas>` that draws a detective walking with a duck following.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { Patrol } from './Patrol'

const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((q: string) => ({
    matches: reduced, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))

afterEach(() => vi.unstubAllGlobals())

describe('Patrol', () => {
  it('renders a canvas', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    const { container } = render(<Patrol />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('does not start an animation loop under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', matchMedia(true))
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    render(<Patrol />)
    // The characters still draw — they just hold frame 0 instead of walking.
    expect(raf).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run components/game/Patrol.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `components/game/Patrol.tsx`**

The two sprite functions and the follow behaviour are lifted from the team's reference file, `ai_detective_premium_edition-3.html` — same primitives, same easing constant, same bounce.

```tsx
'use client'
import { useEffect, useRef } from 'react'

/**
 * The detective walks, the duck follows. Purely decorative, and it exists because the phone's
 * screen above the two verdict buttons was otherwise empty black for the whole of a question.
 *
 * Lifted from the team's reference (ai_detective_premium_edition-3.html): the same canvas
 * primitives, the same follow easing (0.055) and the same idle bounce (sin(frame * 0.28) * 3).
 *
 * Not rendered during reveal, actcard or tally — those screens have something to say and a
 * walking duck competes with it.
 */
function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, frame: number) {
  const bounce = Math.sin(frame * 0.28) * 3
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  ctx.fillStyle = '#ffd23f'
  ctx.beginPath(); ctx.arc(0, bounce, 16, 0, Math.PI * 2); ctx.fill()
  ctx.beginPath(); ctx.arc(8, -16 + bounce, 10, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ff7f50'; ctx.fillRect(16, -18 + bounce, 9, 5)
  ctx.restore()
}

function drawDetective(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, frame: number) {
  const bounce = Math.sin(frame * 0.22) * 2
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1)
  ctx.fillStyle = '#6b5334'; ctx.fillRect(-11, -14 + bounce, 22, 30)     // coat
  ctx.fillStyle = '#e8c9a0'; ctx.fillRect(-8, -30 + bounce, 16, 16)      // face
  ctx.fillStyle = '#3b2f1e'; ctx.fillRect(-14, -34 + bounce, 28, 5)      // hat brim
  ctx.fillRect(-9, -42 + bounce, 18, 8)                                   // hat crown
  ctx.fillStyle = '#2b325c'; ctx.fillRect(-9, 16 + bounce, 7, 9); ctx.fillRect(3, 16 + bounce, 7, 9)
  ctx.restore()
}

export function Patrol({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const w = (cv.width = cv.clientWidth * 2)
    const h = (cv.height = cv.clientHeight * 2)
    ctx.scale(2, 2)
    const W = w / 2, H = h / 2
    const man = { x: 60, dir: 1, speed: 0.7 }
    let duckX = 0, frame = 0, raf = 0

    const paint = () => {
      ctx.clearRect(0, 0, W, H)
      drawDuck(ctx, duckX, H - 26, man.dir, frame)
      drawDetective(ctx, man.x, H - 30, man.dir, frame)
    }

    // A CSS rule cannot reach a canvas, so the preference is checked here. The characters still
    // draw — they hold frame 0 rather than disappearing.
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
      duckX = man.x - 70
      paint()
      return
    }

    const tick = () => {
      frame++
      man.x += man.speed * man.dir
      if (man.x > W - 40 && man.dir === 1) man.dir = -1
      else if (man.x < 40 && man.dir === -1) man.dir = 1
      duckX += ((man.x - man.dir * 70) - duckX) * 0.055
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className={className} aria-hidden="true" />
}
```

- [ ] **Step 4: Run and commit**

Run: `npx vitest run components/game/Patrol.test.tsx` — expected PASS.

```bash
git add components/game/Patrol.tsx components/game/Patrol.test.tsx
git commit -m "feat(detective): the patrol characters, lifted from the team's reference"
```

---

## Task 6: The phone's reading and question screens

**Files:**
- Modify: `app/page.tsx` — the phase branches at lines 185–193
- Test: `app/page.test.tsx` (append)

**Interfaces:**
- Consumes: `Patrol` from Task 5, `READING_MS` from `lib/game.ts`, `.det` classes from Task 2.

**Preserve verbatim:** the identity helpers, the polling loop with its monotonic-`seq` guard, the offline answer queue, and the `youAnswered` lock. All four were reviewed as load-bearing on the previous branch; one of them was silently dropped by a plan that said "replace this file" and had to be restored.

- [ ] **Step 1: Append the failing tests**

```tsx
describe('the phone during the reading beat', () => {
  it('shows both buttons, locked, so nothing appears out of nowhere when the window opens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(state({ phase: 'reading' })), { headers: { 'content-type': 'application/json' } })))
    render(<Page />)
    const pass = await screen.findByRole('button', { name: /ผ่าน/ })
    expect(pass).toBeDisabled()
    expect(screen.getByRole('button', { name: /ตีกลับ/ })).toBeDisabled()
  })

  it('posts nothing if a locked button is somehow clicked', async () => {
    const f = vi.fn(async () => new Response(
      JSON.stringify(state({ phase: 'reading' })), { headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', f)
    render(<Page />)
    await userEvent.click(await screen.findByRole('button', { name: /ผ่าน/ }))
    expect(f.mock.calls.filter(([u]) => String(u).includes('/api/answer'))).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/page.test.tsx`
Expected: FAIL — there is no `reading` branch, so nothing renders.

- [ ] **Step 3: Add the branch**

Add to the phase switch, leaving every other branch untouched:

```tsx
{state.phase === 'reading' && (
  <>
    <Patrol className="h-40 w-full" />
    <ReadingPanel remainingMs={state.remainingMs} />
    <QuestionPanel onPick={submit} locked picked={undefined} />
  </>
)}
```

and give `QuestionPanel` a `locked` prop that sets `disabled` on both buttons and returns early from `onPick`. Also render `<Patrol className="h-40 w-full" />` above the buttons in the existing `question` branch — that empty space is the reason this task exists.

`ReadingPanel` shows four dots extinguishing one per second; it must not render a timer bar.

- [ ] **Step 4: Run and commit**

Run: `npx vitest run app/page.test.tsx` — expected PASS, all pre-existing tests included.

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat(detective): the phone reads before it answers, and is never empty while it waits"
```

---

## Task 7: The projector's reading branch, split-bar honesty, and vertical centring

**Files:**
- Modify: `app/tv/page.tsx` (add a `reading` branch beside `question` at line 265)
- Modify: `components/game/SplitBar.tsx`, `components/game/Tally.tsx`
- Test: `app/tv/tv.test.tsx` (append)

- [ ] **Step 1: Append the failing tests**

```tsx
describe('the reading branch and the split bar', () => {
  it('shows the question during reading but no timer bar', async () => {
    localStorage.setItem('aidet.hostToken', 'dev-local-9f2c')
    mockFetch({ ...base, phase: 'reading' })
    const { container } = render(<TV />)
    expect(await screen.findByText(q0.ask)).toBeInTheDocument()
    expect(container.querySelector('.timer-fill')).toBeNull()
  })

  it('colours the split by which verdict was CORRECT, not by which button was pressed', () => {
    // q0's correct verdict is `reject`, so the ตีกลับ share is the green one.
    const { container } = render(<SplitBar split={{ pass: 7, reject: 3 }} verdict="reject" />)
    const [first, second] = [...container.querySelectorAll('[data-share]')]
    expect(first.getAttribute('data-share')).toBe('pass')
    expect(getComputedStyle(first).backgroundColor).not.toBe(getComputedStyle(second).backgroundColor)
    expect(second.getAttribute('data-correct')).toBe('true')
  })
})
```

- [ ] **Step 2: Run and watch it fail**

Run: `npx vitest run app/tv/tv.test.tsx`
Expected: FAIL — no `reading` branch; `SplitBar` takes no `verdict`.

- [ ] **Step 3: Implement**

Add the `reading` branch rendering the same question and duck line as `QuestionStage` but with the timer bar and the answered counter omitted, and a dot countdown in their place.

`SplitBar` gains a `verdict: Verdict` prop and colours each share by whether it matches:

```tsx
/**
 * Coloured by CORRECTNESS, not by action — deliberately out of step with the buttons, which are
 * green for ผ่าน because approve/reject reads as go/stop on a control you press.
 *
 * v3 coloured this bar by action, so a reveal where 68% of the room approved a fabricated answer
 * rendered as a wall of green — the colour of "well done" — under a sentence saying they had just
 * been fooled. The bar's job is to show the room what it did.
 */
```

Mark each share with `data-share="pass"|"reject"` and `data-correct` so the test can assert without depending on class names.

`Tally` centres vertically and scales its type up into the space that recovers. Keep the framed closing line exactly as it is — it is spec §5a and was a Critical finding on the last branch.

- [ ] **Step 4: Run and commit**

Run: `npm test` — expected green.

```bash
git add app/tv/page.tsx app/tv/tv.test.tsx components/game/SplitBar.tsx components/game/Tally.tsx
git commit -m "feat(detective): the projector reads first, and the split bar tells the truth"
```

---

## Task 8: Prove it on a projector, and update the docs

**Files:**
- Modify: `scripts/check-projector-fit.mjs`, `README.md`, `docs/superpowers/specs/2026-08-18-ai-detective-v3-design.md` (a pointer to the v3.1 spec)

- [ ] **Step 1: Teach the check the seventh phase**

The walk currently samples six phase kinds. Add `reading`, and assert in the reduced-motion context that the patrol canvas is **not** animating — read `requestAnimationFrame` call counts over a short window, or assert two successive `canvas.toDataURL()` reads are identical.

- [ ] **Step 2: Run it for real**

Ports 3000 and 3001 are occupied by other processes on this machine — use 3100.

```bash
npm run build
FACILITATOR_TOKEN=dev-local-9f2c npx next start -p 3100 &
BASE_URL=http://localhost:3100 FACILITATOR_TOKEN=dev-local-9f2c npm run check:projector
```

Expected: every phase clears 1600×900 and 1366×768, both phones reach their buttons at 390×844, and the Decision Room's twelve stages are still green. **If something overflows, shrink type or spacing — do not remove content to force a pass without saying so in your report.**

Kill the server by port when done: `Get-NetTCPConnection -LocalPort 3100 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`

- [ ] **Step 3: Compare the built screens against the reference, by eye**

Nothing else in this plan checks that the result *looks like* the file the team asked for — every
other check asks whether it fits and whether it behaves. Close that gap here.

With the server still running on 3100, screenshot `/tv` in each of the seven phases and `/` in
`reading` and `question`, at 1366×768 and 390×844, into the workspace directory. Then screenshot
the reference file itself (`file:///C:/Users/notap/Downloads/ai_detective_premium_edition-3.html`,
1366×768 — its slides are toggled by adding the `active` class to a `.slide-container`).

Put the two sets side by side in one HTML file in the workspace and **look at them**. In your
report, answer these four specifically, each with yes/no and what you saw:

1. Does gold pixel type carry the hard offset shadow **and** the glow?
2. Is the CRT scanline overlay visible on a flat dark area?
3. Do buttons have the white border and the shadow offset **left**-down?
4. Is the screen framed, with the inset vignette darkening the edges?

Anything that is missing is a finding — fix it before you commit and say so in the report.

- [ ] **Step 4: Update the docs**

`README.md`: the seven phases, the 5 s reading beat, the **8:03** budget (9×5 + 9×15 + 9×12 + 3×30 + 45 + 60), and the fact that `/tv` now opens on a login screen. Leave every Decision Room section alone.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-projector-fit.mjs README.md docs/
git commit -m "chore(detective): prove v3.1 on a real projector and update the docs"
```

---

---

## Task 9: Open on the question that fools the room

**Files:**
- Modify: `content/questions.ts` — swap the `order` of `most-populous` (currently 3) and `coffee-cups` (currently 1), and reorder act 1's `chips` to match the new question order
- Modify: `docs/questions.md` — the act 1 table's row order and any prose that calls a question "the opener"
- Test: `content/questions.test.ts` (append)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks consume. `QUESTIONS_IN_ORDER` re-sorts itself from `order`, so every consumer follows automatically.

**Why.** v3 opened on `coffee-cups` — an invented statistic with no source, deliberately easy so the room would dare to press a button. It works, but it sends players into the game feeling they can spot a fake, which is the wrong posture for a workshop about not trusting an answer because it sounds confident. The team asked for an opener that catches the room out instead.

`most-populous` is the strongest opener in the set: nearly everyone will approve it, because everyone learned that China is the most populous country and nothing prompts you to re-check a fact that settled years ago. The duck is not lying — it is answering with something that was true until 2023, which is act 1's trick in its sharpest form, and the reveal is checkable on a phone in ten seconds, so the doubt it creates is earned rather than asserted.

**What must not change.** The three `pass` questions stay at orders **2, 5 and 8**. Both swapped questions are `reject` and both are in act 1, so the answer key's shape, the no-three-consecutive-rejects invariant and the act boundaries are all untouched — `content/questions.test.ts` already asserts every one of those and must stay green without being edited.

- [ ] **Step 1: Append the failing test**

Do not rewrite `content/questions.test.ts` — it holds the invariants that make the game work. Append:

```ts
describe('the opener', () => {
  it('opens on the question the room is most likely to get wrong', () => {
    const first = [...QUESTIONS].sort((a, b) => a.order - b.order)[0]
    expect(first.id).toBe('most-populous')
    // The point of opening here: the duck is not lying, it is answering with something that
    // was true until 2023. A room that approves it has been fooled by staleness in round one.
    expect(first.verdict).toBe('reject')
    expect(first.act).toBe(1)
  })

  it("keeps act 1's chips in the order its questions are now asked", () => {
    const act1 = [...QUESTIONS].filter((q) => q.act === 1).sort((a, b) => a.order - b.order)
    expect(act1.map((q) => q.id)).toEqual(['most-populous', 'banana-berry', 'coffee-cups'])
    expect(ACTS[0].chips).toEqual(['ความจริงที่หมดอายุ', 'นิยามที่ไม่เคยเปลี่ยน', 'ตัวเลขที่ไม่มีคนนับ'])
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run content/questions.test.ts`
Expected: FAIL — the first question is `coffee-cups` and the chips are in the old order.

- [ ] **Step 3: Make the swap**

In `content/questions.ts`: set `most-populous`'s `order` to `1` and `coffee-cups`'s `order` to `3`. Leave every other field of both questions — `ask`, `duckSays`, `highlight`, `verdict`, `truth`, `tell`, `needsCheck` — **byte-identical**. The array's source order does not matter; `QUESTIONS_IN_ORDER` sorts by `order`.

Reorder `ACTS[0].chips` to `['ความจริงที่หมดอายุ', 'นิยามที่ไม่เคยเปลี่ยน', 'ตัวเลขที่ไม่มีคนนับ']` so the card's three chips still read in the order the room met them.

- [ ] **Step 4: Run the content suite**

Run: `npx vitest run content/`
Expected: PASS — including the pre-existing invariants (three `pass` at orders 2/5/8, longest reject run ≤ 2, acts in order) with no edits to them.

- [ ] **Step 5: Run everything**

Run: `npm test` and `npx tsc --noEmit`. Both green. Any test that hardcodes a question id for "question 1" is a real finding — fix the test to derive it from `QUESTIONS_IN_ORDER[0]` rather than pinning a new id, and say so in your report.

- [ ] **Step 6: Update the doc**

`docs/questions.md`: reorder act 1's rows and fix any prose describing the opener's job. The per-question rationale text for each question is unchanged — only their positions and the framing of why the first one is first.

- [ ] **Step 7: Commit**

```bash
git add content/questions.ts content/questions.test.ts docs/questions.md
git commit -m "feat(detective): open on the question that fools the room"
```


## Self-Review

**Spec coverage.** §2 reading phase → Task 1. §3 token gate → Task 3. §4 lobby → Task 4. §5 art direction → Task 2. §6 characters → Task 5, consumed in Tasks 6 and 4. §7 colour semantics → Task 7. §8 layout corrections → Tasks 6 and 7. §9 tests → the test step of every task, plus Task 8 for the two that need a real browser. §10 out of scope → nothing here builds any of it.

**Placeholder scan.** No "TBD"/"handle edge cases"/"similar to Task N". Tasks 4, 6 and 7 describe modifications to existing components rather than pasting whole files — deliberately, because the previous branch lost four tests to "replace this file" instructions, and every one of those tasks names what must survive.

**Type consistency.** `READING_MS` (Task 1) is imported by Tasks 6 and 7. `Phase` gains `'reading'` in Task 1 and every later branch switches on it. `Patrol`'s signature (`{ className?: string }`, Task 5) is what Tasks 4 and 6 call. `SplitBar` gains `verdict: Verdict` in Task 7 and its only call site is in the same task. The `.det-*` class names defined in Task 2 are the ones used in Tasks 3, 4, 6 and 7.

# AI Detective — Kahoot Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the existing free-roam AI Detective app into a synchronized, host-paced Kahoot-style quiz — one TV drives the room through 5 rounds; players follow on their phones; a retro/pixel theme is applied to both surfaces.

**Architecture:** The server owns all game state (phase, round index, and an authoritative clock) in the existing in-memory `RoomStore`. The TV (`/tv`) is the host stage and the only device that POSTs control actions (Start, Next); phones (`/`) and the TV both poll a `/api/state` heartbeat and render whatever the server reports. The countdown and the scoring clock are the *same* server clock — the server computes `remainingMs` on every read and stamps answer elapsed-time itself, so no client timer is authoritative.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Tailwind CSS v4 (`@theme inline` in `app/globals.css`), Zod v4, Vitest + @testing-library/react + jsdom. Self-hosted fonts via `next/font/google`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-17-ai-detective-kahoot-design.md` (v2). It supersedes the v1 spec. Content integrity rules, the five cases, and the scoring invariant carry over from v1 unchanged.
- **This is NOT the Next.js you know.** Before writing any route handler, page, or font code, read the relevant guide under `node_modules/next/dist/docs/01-app/` (e.g. `01-getting-started/15-route-handlers.md`, `01-getting-started/13-fonts.md`). Heed deprecation notices.
- **Server owns the clock (hard requirement).** `/api/state` returns `remainingMs` computed as `max(0, phaseStartedAt + phaseDurationMs − serverNow)`. NEVER send an absolute deadline for a client to subtract `Date.now()` from. Clients snap to `remainingMs` on each poll and only tick locally between polls.
- **Server stamps `elapsedMs`.** The answer route computes `elapsedMs = serverNow − phaseStartedAt` from server state and IGNORES any client-supplied value. There is one clock, not two.
- **First-answer-wins per `(playerId, caseId)`.** A second answer for a case that already has one is a no-op (idempotent), never an overwrite.
- **Answer route status contract (phones depend on it exactly):** `200` = recorded or idempotent no-op; `400` = unknown player → room was reset (permanent; phone clears run and returns to codename); `409` = round closed / not accepting answers / spectator → phone DROPS the answer, never requeues; network/timeout → phone requeues. An offline answer that arrives after its round closed is *correctly dropped* — the offline queue rescues a blip *within* a round, not across rounds. This is the synchronized model working as intended; do not "fix" it back toward cross-round replay.
- **`tick(now)` is synchronous, atomic, and persists only on a flip.** ~21 devices poll `/api/state` at ~1s. `tick` must do its read-of-phase → write-of-flip with NO `await` between them (Node's single thread makes that atomic and prevents a double-flip race), and must call `persist()` only when it actually flips a phase — never on a read that changes nothing.
- **Phone `localStorage` holds identity ONLY** (`playerId`, `codename`). Round index and phase come from `/api/state`. Never store `{answers, index}` on the phone — two copies of "what round is it" is a desync bug.
- **"Believed the AI" = chose the option whose `id === 'ai-correct'`.** Every case has exactly one such option (verified by a test). This is more correct than v1's "% incorrect": a player who picked a *different* wrong option did not believe the AI.
- **Spectators** (joined after Start) never score, never appear on the leaderboard, and never count toward `playerCount`/`answeredCount`.
- **Offline font warm-up:** `next/font/google` self-hosts (bundles fonts into the build, zero runtime requests). It downloads once at build/dev-start time, so the facilitator must start the app once on a connected network before the event; thereafter it runs fully offline. Document this in the run guide (Task 12).
- **Palette (retro theme):** navy ground `#04050e`, panel `#0d1127`, border `#2b325c`, gold `#ffd700`, cyan `#00e5ff`, pink `#ff3366`, green `#39ff14`, paper `#fffbf2` / paper-text `#1e1713`. Fonts: `Press Start 2P` (pixel headers/labels), `VT323` (retro HUD/body numerals), `Sarabun` (Thai + readable body).
- **DRY, YAGNI, TDD, frequent commits.** Run the full suite with `npm test` (`vitest run`). Tests must not touch the real `.room-state.json` (the store already skips persistence when `VITEST`/`NODE_ENV=test`).

---

## File Structure

**New files:**
- `lib/game.ts` — pure game-logic + clock helpers (durations, transitions, `remainingMs`, `shouldExpire`).
- `app/api/state/route.ts` — GET sync heartbeat (lazy `tick`, returns `PublicGameState`).
- `app/api/control/route.ts` — POST host actions (`start` | `next`), token-guarded.
- `app/tv/page.tsx` — the host stage (lobby → investigate → reveal → final + Start/Next).
- `components/game/Countdown.tsx` — server-synced countdown display.
- `components/game/Duck.tsx` — the AI duck SVG + speech bubble.
- `components/game/AnswerCards.tsx` — the four themed A/B/C/D option cards.
- `components/game/PhoneRound.tsx` — the phone's per-round view (evidence + answer cards + lock/reveal).
- `components/game/TvStage.tsx` — the TV's phase renderer (used by `app/tv/page.tsx`).

**Modified files:**
- `lib/types.ts` — add `Phase`, `GameState`, `PublicGameState`; add `spectator` to `Player`; drop `elapsedMs` from the answer POST body contract (server-stamped).
- `lib/store.ts` — add game state, `seq`, spectator-aware `join`, first-wins `recordAnswer`, `tick`, `startGame`, `nextRound`, `getGameState`, `getSeq`, `getPublicState`; persist game state; reset to lobby.
- `lib/stats.ts` — exclude spectators; add `believedAi`/`believedAiPct`.
- `lib/i18n.ts` — new bilingual strings for the Kahoot flow.
- `app/api/answer/route.ts` — server-stamp `elapsedMs`, enforce round/spectator/first-wins, new status contract.
- `app/api/join/route.ts` — return spectator flag.
- `app/api/reset/route.ts` — reset now also returns to lobby (via `store.reset()`; no route change needed beyond confirming).
- `app/page.tsx` — rewrite as the server-synced phone flow.
- `app/layout.tsx` — self-hosted fonts + CSS font variables.
- `app/globals.css` — retro theme tokens + component classes.

**Reused unchanged:** `content/cases.ts`, `lib/scoring.ts`, `lib/codenames.ts`, `components/CaseFileDoc.tsx`, `components/Retrieval.tsx`, `components/LangToggle.tsx`, `components/CodenameScreen.tsx`. The old `/dashboard` stays as an optional second screen. The old `/reveal`, `components/CaseScreen.tsx`, and `components/ResultScreen.tsx` are **superseded** by `/tv` and `PhoneRound`; leave them in place but the phone/TV tasks do not use them (Task 12 notes them as dead for a later cleanup).

---

## Task 1: Game logic & clock (`lib/game.ts`)

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/game.ts`
- Test: `lib/game.test.ts`

**Interfaces:**
- Consumes: `CASES` from `content/cases.ts`; `Difficulty` from `lib/types.ts`.
- Produces:
  - Types (in `lib/types.ts`): `Phase = 'lobby' | 'investigate' | 'reveal' | 'final'`; `GameState = { phase: Phase; roundIndex: number; phaseStartedAt: number; phaseDurationMs: number }`; `PublicGameState = { seq: number; phase: Phase; roundIndex: number; caseId: string | null; remainingMs: number; answeredCount: number; playerCount: number; youAnswered?: boolean }`.
  - `lib/game.ts`: `ROUNDS: DetectiveCase[]` (cases sorted by `order`), `ROUND_COUNT: number`, `roundDurationMs(d: Difficulty): number`, `LOBBY_STATE: GameState`, `remainingMs(s: GameState, now: number): number`, `startedState(now: number): GameState`, `revealState(s: GameState, now: number): GameState`, `nextState(s: GameState, now: number): GameState`, `shouldExpire(s: GameState, now: number, activeCount: number, answeredCount: number): boolean`, `currentCaseId(s: GameState): string | null`.

- [ ] **Step 1: Add the game types to `lib/types.ts`**

Append to `lib/types.ts` (after the existing `Answer` type):

```ts
export type Phase = 'lobby' | 'investigate' | 'reveal' | 'final'

/** Server-authoritative game state. `phaseStartedAt`/`phaseDurationMs` are the ONLY clock. */
export type GameState = {
  phase: Phase
  /** 0-based index into game ROUNDS (cases sorted by order). Meaningful in investigate/reveal. */
  roundIndex: number
  /** Server epoch ms when the current phase began. */
  phaseStartedAt: number
  /** Duration of the current phase in ms; 0 for untimed phases (lobby, reveal, final). */
  phaseDurationMs: number
}

/** What clients receive from /api/state. `remainingMs` is server-computed; clients never derive it. */
export type PublicGameState = {
  seq: number
  phase: Phase
  roundIndex: number
  caseId: string | null
  remainingMs: number
  answeredCount: number
  playerCount: number
  youAnswered?: boolean
}
```

Also change the `Player` type in `lib/types.ts` to add `spectator`:

```ts
export type Player = { id: string; codename: string; joinedAt: number; spectator: boolean }
```

- [ ] **Step 2: Write the failing test** — `lib/game.test.ts`

```ts
import { describe, expect, it } from 'vitest'
import {
  ROUNDS, ROUND_COUNT, roundDurationMs, LOBBY_STATE,
  remainingMs, startedState, revealState, nextState, shouldExpire, currentCaseId,
} from './game'
import type { GameState } from './types'

describe('game logic', () => {
  it('ROUNDS is the 5 cases sorted by order', () => {
    expect(ROUND_COUNT).toBe(5)
    expect(ROUNDS.map((c) => c.order)).toEqual([1, 2, 3, 4, 5])
  })

  it('easy/medium rounds get 75s, harder rounds get 90s', () => {
    expect(roundDurationMs('easy')).toBe(75_000)
    expect(roundDurationMs('medium')).toBe(75_000)
    expect(roundDurationMs('hard')).toBe(90_000)
    expect(roundDurationMs('expert')).toBe(90_000)
    expect(roundDurationMs('final')).toBe(90_000)
  })

  it('remainingMs counts down only during investigate and never goes negative', () => {
    const s: GameState = { phase: 'investigate', roundIndex: 0, phaseStartedAt: 1000, phaseDurationMs: 75_000 }
    expect(remainingMs(s, 1000)).toBe(75_000)
    expect(remainingMs(s, 31_000)).toBe(45_000)
    expect(remainingMs(s, 999_999)).toBe(0)
    expect(remainingMs(LOBBY_STATE, 5)).toBe(0)
    expect(remainingMs(revealState(s, 2000), 9999)).toBe(0)
  })

  it('startedState opens round 0 in investigate with the round-0 duration', () => {
    const s = startedState(5000)
    expect(s.phase).toBe('investigate')
    expect(s.roundIndex).toBe(0)
    expect(s.phaseStartedAt).toBe(5000)
    expect(s.phaseDurationMs).toBe(roundDurationMs(ROUNDS[0].difficulty))
  })

  it('nextState advances reveal → next investigate, then → final after the last round', () => {
    let s: GameState = revealState(startedState(0), 100)
    for (let i = 1; i < ROUND_COUNT; i++) {
      s = nextState(s, 200)
      expect(s.phase).toBe('investigate')
      expect(s.roundIndex).toBe(i)
    }
    s = nextState(s, 300) // from reveal of last round conceptually
    expect(s.phase).toBe('final')
  })

  it('shouldExpire fires on timeout OR when all active players answered', () => {
    const s: GameState = { phase: 'investigate', roundIndex: 0, phaseStartedAt: 0, phaseDurationMs: 75_000 }
    expect(shouldExpire(s, 10_000, 20, 5)).toBe(false)   // time left, not all answered
    expect(shouldExpire(s, 80_000, 20, 5)).toBe(true)    // timed out
    expect(shouldExpire(s, 10_000, 20, 20)).toBe(true)   // everyone answered early
    expect(shouldExpire(s, 10_000, 0, 0)).toBe(false)    // nobody active → don't auto-close
    expect(shouldExpire(revealState(s, 0), 999_999, 20, 20)).toBe(false) // only investigate expires
  })

  it('currentCaseId is the round case in investigate/reveal, null otherwise', () => {
    expect(currentCaseId(LOBBY_STATE)).toBeNull()
    expect(currentCaseId(startedState(0))).toBe(ROUNDS[0].id)
    expect(currentCaseId({ phase: 'final', roundIndex: 4, phaseStartedAt: 0, phaseDurationMs: 0 })).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- lib/game.test.ts`
Expected: FAIL — `lib/game.ts` does not exist.

- [ ] **Step 4: Implement `lib/game.ts`**

```ts
import type { Difficulty, DetectiveCase, GameState } from './types'
import { CASES } from '@/content/cases'

/** The rounds in play order (cases sorted by `order`). Round index is an index into this. */
export const ROUNDS: DetectiveCase[] = [...CASES].sort((a, b) => a.order - b.order)
export const ROUND_COUNT = ROUNDS.length

/** Generous "read the evidence and think" windows — never a race. See spec §4. */
const DURATION_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 75_000,
  medium: 75_000,
  hard: 90_000,
  expert: 90_000,
  final: 90_000,
}
export function roundDurationMs(difficulty: Difficulty): number {
  return DURATION_BY_DIFFICULTY[difficulty]
}

export const LOBBY_STATE: GameState = { phase: 'lobby', roundIndex: 0, phaseStartedAt: 0, phaseDurationMs: 0 }

/** Server-authoritative time left; 0 outside investigate. Never derived on a client. */
export function remainingMs(s: GameState, now: number): number {
  if (s.phase !== 'investigate') return 0
  return Math.max(0, s.phaseStartedAt + s.phaseDurationMs - now)
}

export function startedState(now: number): GameState {
  return { phase: 'investigate', roundIndex: 0, phaseStartedAt: now, phaseDurationMs: roundDurationMs(ROUNDS[0].difficulty) }
}

export function revealState(s: GameState, now: number): GameState {
  return { phase: 'reveal', roundIndex: s.roundIndex, phaseStartedAt: now, phaseDurationMs: 0 }
}

export function nextState(s: GameState, now: number): GameState {
  const next = s.roundIndex + 1
  if (next >= ROUND_COUNT) {
    return { phase: 'final', roundIndex: s.roundIndex, phaseStartedAt: now, phaseDurationMs: 0 }
  }
  return { phase: 'investigate', roundIndex: next, phaseStartedAt: now, phaseDurationMs: roundDurationMs(ROUNDS[next].difficulty) }
}

/** Whether the current investigate phase should flip to reveal now. */
export function shouldExpire(s: GameState, now: number, activeCount: number, answeredCount: number): boolean {
  if (s.phase !== 'investigate') return false
  if (now >= s.phaseStartedAt + s.phaseDurationMs) return true
  if (activeCount > 0 && answeredCount >= activeCount) return true
  return false
}

export function currentCaseId(s: GameState): string | null {
  if (s.phase === 'investigate' || s.phase === 'reveal') return ROUNDS[s.roundIndex]?.id ?? null
  return null
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- lib/game.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Confirm the whole suite still compiles/passes** (the `Player.spectator` addition may break store/stats tests — that's expected and fixed in Tasks 2–3; if this task's own file and types compile, proceed)

Run: `npm test -- lib/game.test.ts lib/types.test.ts`
Expected: game tests PASS; if `types.test.ts` references `Player`, update it to include `spectator: false`.

- [ ] **Step 7: Commit**

```bash
git add lib/game.ts lib/game.test.ts lib/types.ts lib/types.test.ts
git commit -m "feat: game logic + clock helpers and game state types"
```

---

## Task 2: Store game state (`lib/store.ts`)

**Files:**
- Modify: `lib/store.ts`
- Test: `lib/store.test.ts`

**Interfaces:**
- Consumes: `GameState`, `Player`, `Answer`, `PublicGameState` from `lib/types.ts`; `LOBBY_STATE`, `startedState`, `revealState`, `nextState`, `shouldExpire`, `currentCaseId`, `remainingMs`, `ROUNDS` from `lib/game.ts`.
- Produces (new/changed `RoomStore` interface):
  - `join(codename: string, now: number): Player` — spectator = `gameState.phase !== 'lobby'`.
  - `recordAnswer(input: { playerId: string; caseId: string; optionId: string }, now: number): 'ok' | 'duplicate' | 'unknown' | 'spectator' | 'closed'` — server-stamps `elapsedMs = now − phaseStartedAt`; first-wins.
  - `getPlayers(): Player[]`, `getAnswers(): Answer[]`, `reset(): void` (resets to `LOBBY_STATE`, bumps seq), `getGameState(): GameState`, `getSeq(): number`.
  - `tick(now: number): boolean` — lazily flips investigate→reveal when `shouldExpire`; returns whether it flipped; persists ONLY on a flip; no `await` in the flip.
  - `startGame(now: number): void` (only from lobby), `nextRound(now: number): void` (only from reveal).
  - `getPublicState(now: number, playerId?: string): PublicGameState`.

- [ ] **Step 1: Write the failing tests** — replace `lib/store.test.ts` game-relevant cases; add:

```ts
import { describe, expect, it } from 'vitest'
import { MemoryRoomStore } from './store'
import { ROUNDS } from './game'

const round0 = ROUNDS[0].id
const opt0 = ROUNDS[0].options[0].id

describe('store game state', () => {
  it('starts in lobby; a lobby joiner is not a spectator', () => {
    const s = new MemoryRoomStore()
    expect(s.getGameState().phase).toBe('lobby')
    const p = s.join('Alice', 1000)
    expect(p.spectator).toBe(false)
    expect(s.getSeq()).toBeGreaterThan(0)
  })

  it('startGame opens round 0 in investigate; a post-start joiner is a spectator', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 1000)
    s.startGame(2000)
    expect(s.getGameState().phase).toBe('investigate')
    const late = s.join('Bob', 3000)
    expect(late.spectator).toBe(true)
  })

  it('recordAnswer server-stamps elapsedMs and is first-wins', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    s.startGame(1000)
    expect(s.recordAnswer({ playerId: p.id, caseId: round0, optionId: opt0 }, 4000)).toBe('ok')
    const a = s.getAnswers()[0]
    expect(a.elapsedMs).toBe(3000) // 4000 − phaseStartedAt(1000)
    // second answer for same case is ignored (first-wins), returns 'duplicate'
    expect(s.recordAnswer({ playerId: p.id, caseId: round0, optionId: ROUNDS[0].options[1].id }, 5000)).toBe('duplicate')
    expect(s.getAnswers()).toHaveLength(1)
    expect(s.getAnswers()[0].optionId).toBe(opt0)
  })

  it('recordAnswer rejects unknown player, spectator, and wrong/closed round', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    s.startGame(1000)
    expect(s.recordAnswer({ playerId: 'nope', caseId: round0, optionId: opt0 }, 2000)).toBe('unknown')
    const spec = s.join('Late', 1500)
    expect(s.recordAnswer({ playerId: spec.id, caseId: round0, optionId: opt0 }, 2000)).toBe('spectator')
    // wrong case id (not the current round) → closed
    expect(s.recordAnswer({ playerId: p.id, caseId: ROUNDS[1].id, optionId: ROUNDS[1].options[0].id }, 2000)).toBe('closed')
  })

  it('tick flips investigate→reveal on timeout and persists only then', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    s.startGame(1000)
    expect(s.tick(2000)).toBe(false)               // still time left
    expect(s.getGameState().phase).toBe('investigate')
    expect(s.tick(1000 + 75_000 + 1)).toBe(true)   // timed out → flip
    expect(s.getGameState().phase).toBe('reveal')
    expect(s.tick(999_999)).toBe(false)            // already reveal, no more flips
  })

  it('tick flips early when all active players answered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    const b = s.join('Bob', 0)
    s.startGame(1000)
    s.recordAnswer({ playerId: a.id, caseId: round0, optionId: opt0 }, 1100)
    expect(s.tick(1200)).toBe(false)               // Bob hasn't answered
    s.recordAnswer({ playerId: b.id, caseId: round0, optionId: opt0 }, 1300)
    expect(s.tick(1400)).toBe(true)                // all active answered → flip
    expect(s.getGameState().phase).toBe('reveal')
  })

  it('getPublicState reports counts, remaining, and youAnswered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    s.join('Bob', 0)
    s.startGame(1000)
    s.recordAnswer({ playerId: a.id, caseId: round0, optionId: opt0 }, 1500)
    const pub = s.getPublicState(2000, a.id)
    expect(pub.phase).toBe('investigate')
    expect(pub.caseId).toBe(round0)
    expect(pub.playerCount).toBe(2)
    expect(pub.answeredCount).toBe(1)
    expect(pub.remainingMs).toBe(1000 + 75_000 - 2000)
    expect(pub.youAnswered).toBe(true)
    expect(s.getPublicState(2000, 'nobody').youAnswered).toBe(false)
    expect(s.getPublicState(2000).youAnswered).toBeUndefined()
  })

  it('reset returns to lobby and clears players/answers', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    s.startGame(1000)
    s.reset()
    expect(s.getGameState().phase).toBe('lobby')
    expect(s.getPlayers()).toHaveLength(0)
    expect(s.getAnswers()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/store.test.ts`
Expected: FAIL — new methods/signatures don't exist yet.

- [ ] **Step 3: Implement the store changes** — replace `lib/store.ts` with:

```ts
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { Answer, GameState, Player, PublicGameState } from './types'
import {
  LOBBY_STATE, ROUNDS, currentCaseId, nextState, remainingMs, revealState, shouldExpire, startedState,
} from './game'

export interface RoomStore {
  join(codename: string, now: number): Player
  recordAnswer(input: { playerId: string; caseId: string; optionId: string }, now: number): AnswerResult
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
  getGameState(): GameState
  getSeq(): number
  tick(now: number): boolean
  startGame(now: number): void
  nextRound(now: number): void
  getPublicState(now: number, playerId?: string): PublicGameState
}

export type AnswerResult = 'ok' | 'duplicate' | 'unknown' | 'spectator' | 'closed'

type Snapshot = { players: Player[]; answers: Answer[]; game: GameState; seq: number }

export class MemoryRoomStore implements RoomStore {
  private players: Player[] = []
  /** Keyed `${playerId}:${caseId}`. First-wins: we never overwrite an existing key. */
  private answers = new Map<string, Answer>()
  private game: GameState = LOBBY_STATE
  private seq = 0

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  private activePlayers(): Player[] {
    return this.players.filter((p) => !p.spectator)
  }

  private answeredCountFor(caseId: string | null): number {
    if (!caseId) return 0
    const active = new Set(this.activePlayers().map((p) => p.id))
    let n = 0
    for (const a of this.answers.values()) {
      if (a.caseId === caseId && active.has(a.playerId)) n++
    }
    return n
  }

  join(codename: string, now: number): Player {
    const player: Player = { id: randomUUID(), codename, joinedAt: now, spectator: this.game.phase !== 'lobby' }
    this.players.push(player)
    this.seq++
    this.persist()
    return player
  }

  recordAnswer(input: { playerId: string; caseId: string; optionId: string }, now: number): AnswerResult {
    const player = this.players.find((p) => p.id === input.playerId)
    if (!player) return 'unknown'
    if (player.spectator) return 'spectator'
    if (this.game.phase !== 'investigate') return 'closed'
    if (input.caseId !== currentCaseId(this.game)) return 'closed'
    const key = `${input.playerId}:${input.caseId}`
    if (this.answers.has(key)) return 'duplicate' // first-wins, idempotent no-op
    const elapsedMs = now - this.game.phaseStartedAt
    this.answers.set(key, { playerId: input.playerId, caseId: input.caseId, optionId: input.optionId, elapsedMs })
    this.seq++
    this.persist()
    return 'ok'
  }

  getPlayers(): Player[] { return this.players.map((p) => ({ ...p })) }
  getAnswers(): Answer[] { return [...this.answers.values()].map((a) => ({ ...a })) }
  getGameState(): GameState { return { ...this.game } }
  getSeq(): number { return this.seq }

  reset(): void {
    this.players = []
    this.answers.clear()
    this.game = LOBBY_STATE
    this.seq++
    this.persist()
  }

  /**
   * Lazily flip investigate→reveal. Runs on every /api/state read (~21×/sec).
   * The read-of-phase → write-of-flip below has NO await between the checks and
   * the assignment, so Node's single thread makes it atomic (no double-flip race).
   * Persists ONLY when it actually flips — a no-op read must not fsync.
   */
  tick(now: number): boolean {
    if (this.game.phase !== 'investigate') return false
    const active = this.activePlayers().length
    const answered = this.answeredCountFor(currentCaseId(this.game))
    if (!shouldExpire(this.game, now, active, answered)) return false
    this.game = revealState(this.game, now)
    this.seq++
    this.persist()
    return true
  }

  startGame(now: number): void {
    if (this.game.phase !== 'lobby') return
    this.game = startedState(now)
    this.seq++
    this.persist()
  }

  nextRound(now: number): void {
    if (this.game.phase !== 'reveal') return
    this.game = nextState(this.game, now)
    this.seq++
    this.persist()
  }

  getPublicState(now: number, playerId?: string): PublicGameState {
    const caseId = currentCaseId(this.game)
    const pub: PublicGameState = {
      seq: this.seq,
      phase: this.game.phase,
      roundIndex: this.game.roundIndex,
      caseId,
      remainingMs: remainingMs(this.game, now),
      answeredCount: this.answeredCountFor(caseId),
      playerCount: this.activePlayers().length,
    }
    if (playerId !== undefined) {
      pub.youAnswered = caseId != null && this.answers.has(`${playerId}:${caseId}`)
    }
    return pub
  }

  private persist(): void {
    if (!this.persistPath) return
    const snap: Snapshot = { players: this.players, answers: this.getAnswers(), game: this.game, seq: this.seq }
    try {
      const tmpPath = `${this.persistPath}.${randomUUID()}.tmp`
      writeFileSync(tmpPath, JSON.stringify(snap), 'utf8')
      renameSync(tmpPath, this.persistPath)
    } catch (err) {
      console.error('[store] persist() failed — room state may not survive a restart:', err)
    }
  }

  private load(): void {
    try {
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as Partial<Snapshot>
      if (!Array.isArray(snap.players) || !Array.isArray(snap.answers)) {
        throw new Error('persisted snapshot has an unexpected shape')
      }
      this.players = snap.players.map((p) => ({ ...p, spectator: !!p.spectator }))
      for (const a of snap.answers) {
        if (!a || typeof a !== 'object' || !a.playerId || !a.caseId) continue
        this.answers.set(`${a.playerId}:${a.caseId}`, a)
      }
      const validPhases = new Set(['lobby', 'investigate', 'reveal', 'final'])
      this.game = snap.game && validPhases.has(snap.game.phase as string) ? (snap.game as GameState) : LOBBY_STATE
      this.seq = typeof snap.seq === 'number' && Number.isFinite(snap.seq) ? snap.seq : 0
    } catch {
      this.players = []
      this.answers.clear()
      this.game = LOBBY_STATE
      this.seq = 0
    }
  }
}

const globalForStore = globalThis as unknown as { __roomStore?: RoomStore }
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST
export function getStore(): RoomStore {
  if (!globalForStore.__roomStore) {
    globalForStore.__roomStore = isTestEnv ? new MemoryRoomStore() : new MemoryRoomStore('.room-state.json')
  }
  return globalForStore.__roomStore
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- lib/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/store.ts lib/store.test.ts
git commit -m "feat: server-owned game state, first-wins answers, lazy tick in store"
```

---

## Task 3: Stats — spectator-aware, "believed the AI" metric (`lib/stats.ts`)

**Files:**
- Modify: `lib/stats.ts`
- Test: `lib/stats.test.ts`, `content/cases.test.ts`

**Interfaces:**
- Consumes: `Player`, `Answer` from `lib/types.ts`; `CASES`, `getCase` from `content/cases.ts`; `totalScore` from `lib/scoring.ts`.
- Produces: `CaseStat` gains `believedAi: number` and `believedAiPct: number` (keep existing `fooled`/`fooledPct`); `computeStats` excludes spectators from `detectives`, `leaderboard`, and `finished`. New exported helper `isBelieveAiOption(caseId: string, optionId: string): boolean`.

- [ ] **Step 1: Write the failing test** — add to `content/cases.test.ts`:

```ts
import { CASES } from './cases'

it('every case has exactly one option with id "ai-correct" (the "believe the AI" option)', () => {
  for (const c of CASES) {
    const believeAi = c.options.filter((o) => o.id === 'ai-correct')
    expect(believeAi, `case ${c.id}`).toHaveLength(1)
  }
})
```

Add to `lib/stats.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeStats, isBelieveAiOption } from './stats'
import { CASES } from '@/content/cases'
import type { Answer, Player } from './types'

const c0 = [...CASES].sort((a, b) => a.order - b.order)[0]
const believeAiOpt = c0.options.find((o) => o.id === 'ai-correct')!.id

function player(id: string, spectator = false): Player {
  return { id, codename: id, joinedAt: 0, spectator }
}

describe('stats believedAi + spectators', () => {
  it('isBelieveAiOption is true only for the ai-correct option', () => {
    expect(isBelieveAiOption(c0.id, believeAiOpt)).toBe(true)
    const other = c0.options.find((o) => o.id !== 'ai-correct')!.id
    expect(isBelieveAiOption(c0.id, other)).toBe(false)
  })

  it('believedAi counts players who chose the ai-correct option', () => {
    const players = [player('a'), player('b')]
    const answers: Answer[] = [
      { playerId: 'a', caseId: c0.id, optionId: believeAiOpt, elapsedMs: 0 },
      { playerId: 'b', caseId: c0.id, optionId: c0.options.find((o) => o.id !== 'ai-correct')!.id, elapsedMs: 0 },
    ]
    const cs = computeStats(players, answers).caseStats.find((s) => s.caseId === c0.id)!
    expect(cs.answered).toBe(2)
    expect(cs.believedAi).toBe(1)
    expect(cs.believedAiPct).toBe(50)
  })

  it('spectators are excluded from detectives, leaderboard, and answered counts', () => {
    const players = [player('a'), player('spec', true)]
    const answers: Answer[] = [
      { playerId: 'spec', caseId: c0.id, optionId: believeAiOpt, elapsedMs: 0 },
    ]
    const stats = computeStats(players, answers)
    expect(stats.detectives).toBe(1)
    expect(stats.leaderboard.map((r) => r.codename)).toEqual(['a'])
    expect(stats.caseStats.find((s) => s.caseId === c0.id)!.answered).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/stats.test.ts content/cases.test.ts`
Expected: FAIL — `isBelieveAiOption` missing, `believedAi` undefined, spectators counted.

- [ ] **Step 3: Implement** — replace `lib/stats.ts` with:

```ts
import type { Answer, Player } from './types'
import { CASES, getCase } from '@/content/cases'
import { totalScore } from './scoring'

export type CaseStat = {
  caseId: string
  order: number
  answered: number
  fooled: number
  fooledPct: number
  believedAi: number
  believedAiPct: number
}

export type LeaderboardRow = { codename: string; score: number; correct: number }

export type RoomStats = {
  detectives: number
  finished: number
  caseStats: CaseStat[]
  leaderboard: LeaderboardRow[]
}

function isCorrect(a: Answer): boolean {
  const c = getCase(a.caseId)
  return !!c && c.options.some((o) => o.id === a.optionId && o.correct)
}

/** "Believed the AI" = chose the option whose id is 'ai-correct'. Exactly one per case. */
export function isBelieveAiOption(caseId: string, optionId: string): boolean {
  const c = getCase(caseId)
  return !!c && optionId === 'ai-correct' && c.options.some((o) => o.id === 'ai-correct')
}

/**
 * Dedupe by `playerId:caseId` (last-write-wins), drop answers for unknown cases,
 * unknown players, and SPECTATORS (who never score). Every downstream number is
 * derived from this single validated set.
 */
function dedupeAndValidate(players: Player[], answers: Answer[]): Answer[] {
  const knownCaseIds = new Set(CASES.map((c) => c.id))
  const activePlayerIds = new Set(players.filter((p) => !p.spectator).map((p) => p.id))
  const lastByKey = new Map<string, Answer>()
  for (const a of answers) {
    if (!knownCaseIds.has(a.caseId)) continue
    if (!activePlayerIds.has(a.playerId)) continue
    lastByKey.set(`${a.playerId}:${a.caseId}`, a)
  }
  return [...lastByKey.values()]
}

export function computeStats(players: Player[], answers: Answer[]): RoomStats {
  const active = players.filter((p) => !p.spectator)
  const clean = dedupeAndValidate(players, answers)

  const caseStats: CaseStat[] = [...CASES]
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      const forCase = clean.filter((a) => a.caseId === c.id)
      const fooled = forCase.filter((a) => !isCorrect(a)).length
      const believedAi = forCase.filter((a) => isBelieveAiOption(a.caseId, a.optionId)).length
      return {
        caseId: c.id,
        order: c.order,
        answered: forCase.length,
        fooled,
        fooledPct: forCase.length === 0 ? 0 : Math.round((fooled / forCase.length) * 100),
        believedAi,
        believedAiPct: forCase.length === 0 ? 0 : Math.round((believedAi / forCase.length) * 100),
      }
    })

  const leaderboard: LeaderboardRow[] = active
    .map((p) => {
      const mine = clean.filter((a) => a.playerId === p.id)
      return { codename: p.codename, score: totalScore(mine), correct: mine.filter(isCorrect).length }
    })
    .sort((a, b) => b.score - a.score)

  const finished = active.filter(
    (p) => clean.filter((a) => a.playerId === p.id).length >= CASES.length,
  ).length

  return { detectives: active.length, finished, caseStats, leaderboard }
}
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- lib/stats.test.ts content/cases.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/stats.ts lib/stats.test.ts content/cases.test.ts
git commit -m "feat: spectator-aware stats + believed-the-AI metric"
```

---

## Task 4: `/api/state` heartbeat + `/api/control` host actions

**Files:**
- Create: `app/api/state/route.ts`, `app/api/control/route.ts`
- Test: extend `app/api/routes.test.ts`

**Interfaces:**
- Consumes: `getStore` from `lib/store.ts`.
- Produces:
  - `GET /api/state?playerId=<id?>` → `200` `PublicGameState`. Calls `store.tick(Date.now())` first, then `store.getPublicState(Date.now(), playerId)`. `export const dynamic = 'force-dynamic'`.
  - `POST /api/control` `{ action: 'start' | 'next' }`, header `x-facilitator-token`. `403` if token unset/mismatch (same rule as `/api/reset`); `400` if action invalid; `200` `{ ok: true }` on success.

- [ ] **Step 1: Write the failing tests** — add to `app/api/routes.test.ts`:

```ts
import { GET as stateGET } from './state/route'
import { POST as controlPOST } from './control/route'

function req(url: string, body?: unknown, headers?: Record<string, string>) {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('/api/state and /api/control', () => {
  it('GET /api/state returns the public game state', async () => {
    const res = await stateGET(req('http://localhost/api/state'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('phase')
    expect(body).toHaveProperty('remainingMs')
    expect(body).toHaveProperty('seq')
  })

  it('POST /api/control without a valid token is forbidden', async () => {
    const prev = process.env.FACILITATOR_TOKEN
    process.env.FACILITATOR_TOKEN = 'secret'
    const res = await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'wrong' }))
    expect(res.status).toBe(403)
    process.env.FACILITATOR_TOKEN = prev
  })

  it('POST /api/control start then next moves the room forward', async () => {
    const prev = process.env.FACILITATOR_TOKEN
    process.env.FACILITATOR_TOKEN = 'secret'
    const h = { 'x-facilitator-token': 'secret' }
    const start = await controlPOST(req('http://localhost/api/control', { action: 'start' }, h))
    expect(start.status).toBe(200)
    const after = await (await stateGET(req('http://localhost/api/state'))).json()
    expect(after.phase).toBe('investigate')
    const bad = await controlPOST(req('http://localhost/api/control', { action: 'bogus' }, h))
    expect(bad.status).toBe(400)
    process.env.FACILITATOR_TOKEN = prev
  })
})
```

> Note: `app/api/routes.test.ts` shares one process-wide store singleton across tests. If ordering matters, call `getStore().reset()` in a `beforeEach` (import `getStore` from `@/lib/store`).

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/routes.test.ts`
Expected: FAIL — route modules don't exist.

- [ ] **Step 3: Implement `app/api/state/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const now = Date.now()
  const store = getStore()
  store.tick(now) // lazy phase expiry — someone always polls, so this fires
  const playerId = new URL(req.url).searchParams.get('playerId') ?? undefined
  return NextResponse.json(store.getPublicState(now, playerId))
}
```

- [ ] **Step 4: Implement `app/api/control/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  const expected = process.env.FACILITATOR_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'control is disabled: FACILITATOR_TOKEN is not set' }, { status: 403 })
  }
  if (req.headers.get('x-facilitator-token') !== expected) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  const action = (body as { action?: unknown })?.action
  const now = Date.now()
  const store = getStore()
  if (action === 'start') store.startGame(now)
  else if (action === 'next') store.nextRound(now)
  else return NextResponse.json({ error: 'action must be "start" or "next"' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Run to verify passing**

Run: `npm test -- app/api/routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/state/route.ts app/api/control/route.ts app/api/routes.test.ts
git commit -m "feat: /api/state heartbeat and /api/control host actions"
```

---

## Task 5: `/api/join` + `/api/answer` — spectator flag, server clock, status contract

**Files:**
- Modify: `app/api/join/route.ts`, `app/api/answer/route.ts`
- Test: extend `app/api/routes.test.ts`

**Interfaces:**
- Consumes: `getStore` from `lib/store.ts`.
- Produces:
  - `POST /api/join` `{ codename }` → `200` `{ player }` where `player.spectator` is set by the store.
  - `POST /api/answer` `{ playerId, caseId, optionId }` (NO `elapsedMs` — server-stamped) → status per the Global Constraints contract: `200` on `ok`/`duplicate`; `400` on `unknown`; `409` on `spectator`/`closed`.

- [ ] **Step 1: Write the failing tests** — add to `app/api/routes.test.ts`:

```ts
import { POST as joinPOST } from './join/route'
import { POST as answerPOST } from './answer/route'
import { getStore } from '@/lib/store'
import { ROUNDS } from '@/lib/game'

describe('/api/answer status contract', () => {
  it('answer during the open round returns 200; unknown player returns 400', async () => {
    process.env.FACILITATOR_TOKEN = 'secret'
    getStore().reset()
    const joined = await (await joinPOST(req('http://localhost/api/join', { codename: 'Alice' }))).json()
    await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'secret' }))
    const round0 = ROUNDS[0]
    const ok = await answerPOST(req('http://localhost/api/answer', {
      playerId: joined.player.id, caseId: round0.id, optionId: round0.options[0].id,
    }))
    expect(ok.status).toBe(200)
    const unknown = await answerPOST(req('http://localhost/api/answer', {
      playerId: 'ghost', caseId: round0.id, optionId: round0.options[0].id,
    }))
    expect(unknown.status).toBe(400)
  })

  it('answering the wrong/closed round returns 409', async () => {
    process.env.FACILITATOR_TOKEN = 'secret'
    getStore().reset()
    const joined = await (await joinPOST(req('http://localhost/api/join', { codename: 'Bob' }))).json()
    await controlPOST(req('http://localhost/api/control', { action: 'start' }, { 'x-facilitator-token': 'secret' }))
    const wrong = ROUNDS[1]
    const res = await answerPOST(req('http://localhost/api/answer', {
      playerId: joined.player.id, caseId: wrong.id, optionId: wrong.options[0].id,
    }))
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/api/routes.test.ts`
Expected: FAIL — join returns no spectator handling change needed, but answer still requires old body / returns 400 for closed rounds.

- [ ] **Step 3: Implement `app/api/join/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const codename = (body as { codename?: unknown }).codename
  if (typeof codename !== 'string') {
    return NextResponse.json({ error: 'codename must be a string' }, { status: 400 })
  }
  const trimmed = codename.trim()
  if (!trimmed) return NextResponse.json({ error: 'codename required' }, { status: 400 })
  const player = getStore().join(trimmed.slice(0, 40), Date.now())
  return NextResponse.json({ player })
}
```

- [ ] **Step 4: Implement `app/api/answer/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }
  const { playerId, caseId, optionId } = body as { playerId?: unknown; caseId?: unknown; optionId?: unknown }
  if (typeof playerId !== 'string' || !playerId || typeof caseId !== 'string' || !caseId || typeof optionId !== 'string' || !optionId) {
    return NextResponse.json({ error: 'playerId, caseId and optionId are required' }, { status: 400 })
  }

  // elapsedMs is stamped by the store from server state — client values are ignored.
  const result = getStore().recordAnswer({ playerId, caseId, optionId }, Date.now())
  switch (result) {
    case 'ok':
    case 'duplicate':
      return NextResponse.json({ ok: true })
    case 'unknown':
      return NextResponse.json({ error: 'unknown player' }, { status: 400 })
    case 'spectator':
    case 'closed':
      return NextResponse.json({ error: 'round not accepting answers' }, { status: 409 })
  }
}
```

- [ ] **Step 5: Run to verify passing**

Run: `npm test -- app/api/routes.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/join/route.ts app/api/answer/route.ts app/api/routes.test.ts
git commit -m "feat: spectator-aware join + server-stamped answer with 400/409 contract"
```

---

## Task 6: i18n strings for the Kahoot flow (`lib/i18n.ts`)

**Files:**
- Modify: `lib/i18n.ts`
- Test: `lib/i18n.test.ts` (create)

**Interfaces:**
- Produces new `UIKey`s (both `th` and `en`, non-empty): `lobby`, `waitingToStart`, `detectivesInRoom`, `hostStart`, `hostNext`, `roundInProgress`, `spectating`, `answerLocked`, `waitingForOthers`, `timesUp`, `answered`, `believedAiLabel`, `youWereRight`, `youWereFooled`, `pointsEarned`, `hostTokenLabel`, `hostTokenSave`, `playAgain`, `finalTitle`, `joinOnPhone`, `correctAnswer`.

- [ ] **Step 1: Write the failing test** — `lib/i18n.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { t } from './i18n'

const NEW_KEYS = [
  'lobby', 'waitingToStart', 'detectivesInRoom', 'hostStart', 'hostNext',
  'roundInProgress', 'spectating', 'answerLocked', 'waitingForOthers', 'timesUp',
  'answered', 'believedAiLabel', 'youWereRight', 'youWereFooled', 'pointsEarned',
  'hostTokenLabel', 'hostTokenSave', 'playAgain', 'finalTitle', 'joinOnPhone', 'correctAnswer',
] as const

describe('i18n Kahoot strings', () => {
  it('every new key has a non-empty th and en string', () => {
    for (const k of NEW_KEYS) {
      expect(t(k as never, 'th'), k).toBeTruthy()
      expect(t(k as never, 'en'), k).toBeTruthy()
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- lib/i18n.test.ts`
Expected: FAIL — keys missing.

- [ ] **Step 3: Implement** — add these entries inside the `STRINGS` object in `lib/i18n.ts` (before the closing `} as const`):

```ts
  lobby:            { th: 'ห้องรอ', en: 'Lobby' },
  waitingToStart:   { th: 'รอผู้ดำเนินรายการเริ่มเกม…', en: 'Waiting for the host to start…' },
  detectivesInRoom: { th: 'นักสืบในห้อง', en: 'Detectives in the room' },
  hostStart:        { th: '▶ เริ่มเกม', en: '▶ Start game' },
  hostNext:         { th: 'ถัดไป →', en: 'Next →' },
  roundInProgress:  { th: 'เกมกำลังดำเนินอยู่ — คุณจะได้ชมรอบนี้ และเข้าร่วมได้เมื่อเริ่มเซสชันใหม่', en: 'A game is in progress — you can watch this session and join when a new one starts' },
  spectating:       { th: '👀 กำลังรับชม', en: '👀 Spectating' },
  answerLocked:     { th: '🔒 ล็อกคำตอบแล้ว', en: '🔒 Answer locked' },
  waitingForOthers: { th: 'รอเพื่อนนักสืบคนอื่น…', en: 'Waiting for the other detectives…' },
  timesUp:          { th: 'หมดเวลา!', en: "Time's up!" },
  answered:         { th: 'ตอบแล้ว', en: 'answered' },
  believedAiLabel:  { th: 'เชื่อคำตอบของ AI', en: 'believed the AI' },
  youWereRight:     { th: '✅ ถูกต้อง!', en: '✅ Correct!' },
  youWereFooled:    { th: '❌ ยังไม่ใช่', en: '❌ Not quite' },
  pointsEarned:     { th: 'คะแนนที่ได้', en: 'Points earned' },
  hostTokenLabel:   { th: 'รหัสผู้ดำเนินรายการ', en: 'Host token' },
  hostTokenSave:    { th: 'บันทึก', en: 'Save' },
  playAgain:        { th: '🔄 เล่นอีกครั้ง', en: '🔄 Play again' },
  finalTitle:       { th: '🏆 สรุปผลการไขคดี', en: '🏆 Final Results' },
  joinOnPhone:      { th: 'เข้าร่วมด้วยมือถือของคุณที่', en: 'Join on your phone at' },
  correctAnswer:    { th: 'คำตอบที่ถูกต้อง', en: 'Correct answer' },
```

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- lib/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n.ts lib/i18n.test.ts
git commit -m "feat: bilingual strings for the Kahoot flow"
```

---

## Task 7: Self-hosted fonts + retro theme foundation

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Test: `app/layout.test.tsx` (create)

**Interfaces:**
- Consumes: nothing new.
- Produces: CSS custom properties `--font-pixel`, `--font-retro`, `--font-thai` on `<html>`; retro palette CSS variables (`--rt-bg`, `--rt-panel`, `--rt-border`, `--rt-gold`, `--rt-cyan`, `--rt-pink`, `--rt-green`, `--rt-paper`, `--rt-paper-text`) and Tailwind theme colors (`--color-rt-*`); reusable classes `.crt`, `.pixel-btn`, `.pixel-title`, `.retro-panel`, `.dossier`, `.duck-bubble`, `.answer-card`.

- [ ] **Step 1: Read the Next 16 fonts guide**

Read `node_modules/next/dist/docs/01-app/01-getting-started/13-fonts.md` and `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`. Confirm `next/font/google` usage: call as a function, pass `subsets`/`weight`/`variable`, apply `.variable` className to `<html>`.

- [ ] **Step 2: Write the failing test** — `app/layout.test.tsx`:

```ts
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import RootLayout from './layout'

describe('RootLayout', () => {
  it('renders children inside the body', () => {
    // next/font is transformed in the app build; in tests it may be mocked to {}.
    const { getByText } = render(<RootLayout><p>hello detective</p></RootLayout>)
    expect(getByText('hello detective')).toBeInTheDocument()
  })
})
```

> If `next/font/google` throws under vitest, add a mock at the top of the test:
> ```ts
> vi.mock('next/font/google', () => ({
>   Press_Start_2P: () => ({ variable: 'font-pixel', className: 'font-pixel' }),
>   VT323: () => ({ variable: 'font-retro', className: 'font-retro' }),
>   Sarabun: () => ({ variable: 'font-thai', className: 'font-thai' }),
> }))
> ```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- app/layout.test.tsx`
Expected: FAIL — layout not yet importing fonts / test file new.

- [ ] **Step 4: Implement `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { Press_Start_2P, VT323, Sarabun } from 'next/font/google'
import './globals.css'

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel', display: 'swap' })
const retro = VT323({ weight: '400', subsets: ['latin'], variable: '--font-retro', display: 'swap' })
const thai = Sarabun({ weight: ['300', '400', '600', '700'], subsets: ['latin', 'thai'], variable: '--font-thai', display: 'swap' })

export const metadata: Metadata = {
  title: '🕵️ AI Detective — MADT',
  description: 'Think with AI, not just trust AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${pixel.variable} ${retro.variable} ${thai.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Add the retro theme to `app/globals.css`**

Append (keep the existing MAD+ tokens and `@theme inline` block — the old `/dashboard` still uses them):

```css
/* ── Retro / CRT detective theme (TV + phone game surfaces) ───────────────── */
:root {
  --rt-bg: #04050e;
  --rt-panel: #0d1127;
  --rt-border: #2b325c;
  --rt-gold: #ffd700;
  --rt-cyan: #00e5ff;
  --rt-pink: #ff3366;
  --rt-green: #39ff14;
  --rt-paper: #fffbf2;
  --rt-paper-text: #1e1713;
  --rt-text: #f1f5f9;
}

@theme inline {
  --color-rt-bg: var(--rt-bg);
  --color-rt-panel: var(--rt-panel);
  --color-rt-border: var(--rt-border);
  --color-rt-gold: var(--rt-gold);
  --color-rt-cyan: var(--rt-cyan);
  --color-rt-pink: var(--rt-pink);
  --color-rt-green: var(--rt-green);
  --color-rt-paper: var(--rt-paper);
  --color-rt-paper-text: var(--rt-paper-text);
  --color-rt-text: var(--rt-text);
  --font-pixel: var(--font-pixel);
  --font-retro: var(--font-retro);
  --font-thai: var(--font-thai);
}

.pixel-title {
  font-family: var(--font-pixel), monospace;
  color: var(--rt-gold);
  text-shadow: 4px 4px 0 #705400, 0 0 20px rgba(255, 215, 0, 0.45);
  letter-spacing: 2px;
}

.retro-panel {
  background: var(--rt-panel);
  border: 3px solid var(--rt-border);
  border-radius: 14px;
}

/* CRT scanline overlay — apply to a full-bleed positioned wrapper. */
.crt::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.12) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 255, 0, 0.02));
  background-size: 100% 4px, 6px 100%;
  z-index: 40;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .crt::after { background: none; }
}

.pixel-btn {
  font-family: var(--font-pixel), monospace;
  font-size: 13px;
  padding: 14px 24px;
  background: #290852;
  color: #fff;
  border: 4px solid #fff;
  box-shadow: -4px 4px 0 #000;
  border-radius: 6px;
  cursor: pointer;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.pixel-btn:hover { transform: translate(2px, -2px); box-shadow: -6px 6px 0 #000; }
.pixel-btn:active { transform: translate(-2px, 2px); box-shadow: -2px 2px 0 #000; }
.pixel-btn.gold { background: #b08200; border-color: #ffeb80; }
.pixel-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.dossier {
  background: var(--rt-paper);
  color: var(--rt-paper-text);
  border: 4px solid #382c1f;
  border-radius: 10px;
  box-shadow: 6px 6px 0 rgba(0, 0, 0, 0.5);
}

.duck-bubble {
  background: #ffeaa7;
  color: #2d3436;
  border: 3px solid #6b5300;
  border-radius: 12px;
  padding: 12px 14px;
  font-weight: 700;
}

.answer-card {
  background: #fff;
  border: 3px solid #cbd5e1;
  color: #1e293b;
  border-radius: 12px;
  box-shadow: -3px 3px 0 #cbd5e1;
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
}
.answer-card:hover:not(:disabled) { border-color: var(--rt-cyan); transform: translate(2px, -2px); box-shadow: -5px 5px 0 var(--rt-cyan); }
.answer-card.selected-correct { border-color: #22c55e; background: #f0fdf4; color: #15803d; box-shadow: -4px 4px 0 #22c55e; }
.answer-card.selected-incorrect { border-color: #ef4444; background: #fef2f2; color: #b91c1c; box-shadow: -4px 4px 0 #ef4444; }
.answer-card:disabled { cursor: not-allowed; }
```

- [ ] **Step 6: Run to verify passing**

Run: `npm test -- app/layout.test.tsx`
Expected: PASS.

- [ ] **Step 7: Verify the dev server compiles the fonts (needs internet ONCE)**

Run: `npm run build 2>&1 | tail -20` (or start `npm run dev` and load `/`).
Expected: build succeeds; `next/font` downloads and bundles Press Start 2P / VT323 / Sarabun. If offline, this is the only step that needs network — note it for the run guide.

- [ ] **Step 8: Commit**

```bash
git add app/layout.tsx app/globals.css app/layout.test.tsx
git commit -m "feat: self-hosted retro fonts + CRT theme foundation"
```

---

## Task 8: Themed game components (Countdown, Duck, AnswerCards, EvidenceList)

**Files:**
- Create: `components/game/Countdown.tsx`, `components/game/Duck.tsx`, `components/game/AnswerCards.tsx`, `components/game/EvidenceList.tsx`
- Test: `components/game/Countdown.test.tsx`, `components/game/AnswerCards.test.tsx`, `components/game/EvidenceList.test.tsx`

**Interfaces:**
- Consumes: `DetectiveCase`, `CaseOption`, `Lang` from `lib/types.ts`; `t` from `lib/i18n.ts`; `CaseFileDoc` from `components/CaseFileDoc.tsx`.
- Produces:
  - `formatClock(ms: number): string` (exported from `Countdown.tsx`) → `"M:SS"`.
  - `<Countdown remainingMs={number} />` — displays `formatClock`, ticks locally between prop updates, turns pink under 15s.
  - `<Duck bubble?={string} size?={number} />` — the AI duck SVG + optional speech bubble.
  - `<AnswerCards options={CaseOption[]} lang={Lang} disabled?={boolean} selectedId?={string} correctId?={string} onPick={(id: string) => void} />` — four A/B/C/D cards; when `correctId` is set (reveal), applies `selected-correct`/`selected-incorrect`.
  - `<EvidenceList detectiveCase={DetectiveCase} lang={Lang} />` — retrieval status lines (`✓ retrieved` / `✗ NOT FOUND`) + a `CaseFileDoc` for each found doc.

- [ ] **Step 1: Write failing tests**

`components/game/Countdown.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Countdown, formatClock } from './Countdown'

describe('Countdown', () => {
  it('formats ms as M:SS', () => {
    expect(formatClock(75_000)).toBe('1:15')
    expect(formatClock(9_000)).toBe('0:09')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5)).toBe('0:00')
  })
  it('renders the initial remaining time', () => {
    const { getByText } = render(<Countdown remainingMs={45_000} />)
    expect(getByText('0:45')).toBeInTheDocument()
  })
})
```

`components/game/AnswerCards.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AnswerCards } from './AnswerCards'
import type { CaseOption } from '@/lib/types'

const opts: CaseOption[] = [
  { id: 'a', label: { th: 'ก', en: 'Aye' }, correct: false },
  { id: 'b', label: { th: 'ข', en: 'Bee' }, correct: true },
  { id: 'c', label: { th: 'ค', en: 'Cee' }, correct: false },
  { id: 'd', label: { th: 'ง', en: 'Dee' }, correct: false },
]

describe('AnswerCards', () => {
  it('renders all options and reports picks', () => {
    const onPick = vi.fn()
    const { getByText } = render(<AnswerCards options={opts} lang="en" onPick={onPick} />)
    fireEvent.click(getByText('Bee'))
    expect(onPick).toHaveBeenCalledWith('b')
  })
  it('does not fire onPick when disabled', () => {
    const onPick = vi.fn()
    const { getByText } = render(<AnswerCards options={opts} lang="en" disabled onPick={onPick} />)
    fireEvent.click(getByText('Bee'))
    expect(onPick).not.toHaveBeenCalled()
  })
  it('marks the correct and the wrongly-selected option at reveal', () => {
    const { getByText } = render(
      <AnswerCards options={opts} lang="en" disabled selectedId="a" correctId="b" onPick={() => {}} />,
    )
    expect(getByText('Bee').closest('button')!.className).toContain('selected-correct')
    expect(getByText('Aye').closest('button')!.className).toContain('selected-incorrect')
  })
})
```

`components/game/EvidenceList.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { EvidenceList } from './EvidenceList'
import { ROUNDS } from '@/lib/game'
import { t } from '@/lib/i18n'

describe('EvidenceList', () => {
  it('shows a NOT FOUND line for a missing doc (the retrieval gap)', () => {
    const artemis = ROUNDS.find((c) => c.id === 'artemis')!
    const { getAllByText } = render(<EvidenceList detectiveCase={artemis} lang="en" />)
    // Case 1 has exactly one found:false doc.
    expect(getAllByText(new RegExp(t('notFound', 'en'), 'i')).length).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- components/game/`
Expected: FAIL — component files don't exist.

- [ ] **Step 3: Implement `components/game/Countdown.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Displays server-provided remainingMs, ticking down locally between polls. */
export function Countdown({ remainingMs }: { remainingMs: number }) {
  const [displayMs, setDisplayMs] = useState(remainingMs)

  // Snap to the authoritative value whenever the server sends a fresh one.
  useEffect(() => { setDisplayMs(remainingMs) }, [remainingMs])

  // Smooth local tick between polls; the next poll re-snaps.
  useEffect(() => {
    if (displayMs <= 0) return
    const id = setInterval(() => setDisplayMs((v) => Math.max(0, v - 250)), 250)
    return () => clearInterval(id)
  }, [displayMs])

  const urgent = displayMs <= 15_000
  return (
    <span
      className="tabular-nums font-bold"
      style={{ fontFamily: 'var(--font-pixel), monospace', color: urgent ? 'var(--rt-pink)' : 'var(--rt-gold)' }}
    >
      {formatClock(displayMs)}
    </span>
  )
}
```

- [ ] **Step 4: Implement `components/game/Duck.tsx`**

```tsx
export function Duck({ bubble, size = 64 }: { bubble?: string; size?: number }) {
  return (
    <div className="flex items-start gap-3">
      <svg viewBox="0 0 64 64" width={size} height={size} className="flex-shrink-0" aria-label="AI duck">
        <rect x="24" y="6" width="16" height="8" fill="#5c4a3c" />
        <rect x="20" y="14" width="24" height="3" fill="#5c4a3c" />
        <rect x="22" y="17" width="20" height="18" fill="#ffd23f" />
        <rect x="26" y="22" width="4" height="4" fill="#111" />
        <rect x="12" y="24" width="10" height="6" fill="#ff7f50" />
        <rect x="18" y="35" width="28" height="20" fill="#ffd23f" />
        <rect x="24" y="37" width="18" height="14" fill="#4a3b32" />
        <rect x="20" y="35" width="24" height="4" fill="#322721" />
      </svg>
      {bubble ? <div className="duck-bubble" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{bubble}</div> : null}
    </div>
  )
}
```

- [ ] **Step 5: Implement `components/game/AnswerCards.tsx`**

```tsx
'use client'
import type { CaseOption, Lang } from '@/lib/types'

const LETTERS = ['A', 'B', 'C', 'D']

export function AnswerCards({
  options, lang, disabled = false, selectedId, correctId, onPick,
}: {
  options: CaseOption[]
  lang: Lang
  disabled?: boolean
  selectedId?: string
  correctId?: string
  onPick: (id: string) => void
}) {
  const revealed = correctId !== undefined
  return (
    <div className="grid gap-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      {options.map((o, i) => {
        let stateClass = ''
        if (revealed) {
          if (o.id === correctId) stateClass = 'selected-correct'
          else if (o.id === selectedId) stateClass = 'selected-incorrect'
        } else if (o.id === selectedId) {
          stateClass = 'selected-correct'
        }
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o.id)}
            className={`answer-card flex items-center gap-3 p-3 text-left font-bold ${stateClass}`}
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-white"
              style={{ background: '#0f172a', color: 'var(--rt-gold)', fontFamily: 'var(--font-pixel), monospace', fontSize: 11 }}
            >
              {LETTERS[i]}
            </span>
            <span>{o.label[lang]}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 6: Implement `components/game/EvidenceList.tsx`**

```tsx
import type { DetectiveCase, Lang } from '@/lib/types'
import { CaseFileDoc } from '@/components/CaseFileDoc'
import { t } from '@/lib/i18n'

export function EvidenceList({ detectiveCase, lang }: { detectiveCase: DetectiveCase; lang: Lang }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="dossier p-3" style={{ fontFamily: 'var(--font-retro), monospace' }}>
        <div className="mb-1 text-sm font-bold">{t('retrieving', lang)}</div>
        <ul className="text-sm leading-relaxed">
          {detectiveCase.docs.map((d) => (
            <li key={d.filename} className="flex justify-between gap-2">
              <span className="truncate">{d.filename}</span>
              <span style={{ color: d.found ? '#15803d' : 'var(--alert)', fontWeight: 700 }}>
                {d.found ? `✓ ${t('retrieved', lang)}` : `✗ ${t('notFound', lang)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {detectiveCase.docs.filter((d) => d.found).map((d) => (
        <CaseFileDoc key={d.filename} doc={d} lang={lang} />
      ))}
    </div>
  )
}
```

> Note: confirm `CaseFileDoc`'s prop names by reading `components/CaseFileDoc.tsx` first; adapt the `doc`/`lang` prop names if they differ.

- [ ] **Step 7: Run to verify passing**

Run: `npm test -- components/game/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/game/ && git commit -m "feat: themed game components (Countdown, Duck, AnswerCards, EvidenceList)"
```

---

## Task 9: Phone flow — server-synced rounds (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`
- Test: `app/page.test.tsx` (replace free-roam tests with synced-flow tests)

**Interfaces:**
- Consumes: `PublicGameState`, `Lang` from `lib/types.ts`; `ROUNDS` from `lib/game.ts`; `t` from `lib/i18n.ts`; `CodenameScreen`, `LangToggle`; `Countdown`, `AnswerCards`, `EvidenceList`, `Duck` from `components/game/`.
- Produces: the phone client. Joins in lobby; polls `GET /api/state?playerId=` (~1200ms); renders by phase; submits one answer per round; honors the 200/400/409/network answer contract; stores ONLY `{playerId, codename}` in `localStorage`.

- [ ] **Step 1: Read the current file** to preserve the resilience patterns worth keeping (`fetchWithTimeout`, the offline queue idea, `localStorage` guards): read `app/page.tsx`.

- [ ] **Step 2: Write the failing tests** — replace `app/page.test.tsx` with:

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PlayerPage from './page'
import { ROUNDS } from '@/lib/game'
import type { PublicGameState } from '@/lib/types'

function stateResponse(partial: Partial<PublicGameState>): Response {
  const body: PublicGameState = {
    seq: 1, phase: 'lobby', roundIndex: 0, caseId: null, remainingMs: 0,
    answeredCount: 0, playerCount: 1, ...partial,
  }
  return { ok: true, status: 200, json: async () => body } as Response
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})
afterEach(() => vi.restoreAllMocks())

describe('phone flow', () => {
  it('after joining, shows the lobby waiting screen', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const u = String(url)
      if (u.includes('/api/join')) return { ok: true, status: 200, json: async () => ({ player: { id: 'p1', codename: 'Alice', spectator: false } }) } as Response
      if (u.includes('/api/state')) return stateResponse({ phase: 'lobby' })
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Alice' } })
    fireEvent.click(screen.getByRole('button', { name: /begin|เริ่ม/i }))
    await waitFor(() => expect(screen.getByText(/waiting for the host|รอผู้ดำเนินรายการ/i)).toBeInTheDocument())
  })

  it('during investigate, shows answer cards and submits the pick', async () => {
    const round0 = ROUNDS[0]
    const posted: string[] = []
    localStorage.setItem('aidet.run', JSON.stringify({ playerId: 'p1', codename: 'Alice' }))
    vi.spyOn(global, 'fetch').mockImplementation(async (url, init) => {
      const u = String(url)
      if (u.includes('/api/state')) return stateResponse({ phase: 'investigate', roundIndex: 0, caseId: round0.id, remainingMs: 60_000, youAnswered: false })
      if (u.includes('/api/answer')) { posted.push(String((init as RequestInit).body)); return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response }
      return { ok: true, status: 200, json: async () => ({}) } as Response
    })
    render(<PlayerPage />)
    await waitFor(() => expect(screen.getByText(round0.options[0].label.th)).toBeInTheDocument())
    fireEvent.click(screen.getByText(round0.options[0].label.th))
    await waitFor(() => expect(posted.some((b) => b.includes(round0.options[0].id))).toBe(true))
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- app/page.test.tsx`
Expected: FAIL — page still implements the free-roam flow.

- [ ] **Step 4: Implement `app/page.tsx`** (full replacement)

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, PublicGameState } from '@/lib/types'
import { ROUNDS } from '@/lib/game'
import { CodenameScreen } from '@/components/CodenameScreen'
import { LangToggle } from '@/components/LangToggle'
import { Countdown } from '@/components/game/Countdown'
import { AnswerCards } from '@/components/game/AnswerCards'
import { EvidenceList } from '@/components/game/EvidenceList'
import { Duck } from '@/components/game/Duck'
import { t } from '@/lib/i18n'

const RUN_KEY = 'aidet.run'   // identity ONLY: { playerId, codename }
const LANG_KEY = 'aidet.lang'
const PENDING_KEY = 'aidet.pending'
const POLL_MS = 1200
const REQ_TIMEOUT_MS = 5000

type Identity = { playerId: string; codename: string }
type QueuedAnswer = { playerId: string; caseId: string; optionId: string }

function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(RUN_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<Identity>
    if (typeof p?.playerId === 'string' && p.playerId && typeof p.codename === 'string') {
      return { playerId: p.playerId, codename: p.codename }
    }
  } catch { /* ignore */ }
  return null
}
function saveIdentity(id: Identity | null) {
  try { id ? localStorage.setItem(RUN_KEY, JSON.stringify(id)) : localStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
}
function readPending(): QueuedAnswer[] {
  try { const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]'); return Array.isArray(p) ? p : [] } catch { return [] }
}
function writePending(list: QueuedAnswer[]) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQ_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export default function PlayerPage() {
  const [lang, setLang] = useState<Lang>('th')
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [gameState, setGameState] = useState<PublicGameState | null>(null)
  const [joinError, setJoinError] = useState(false)
  const [sessionWasReset, setSessionWasReset] = useState(false)
  // Ephemeral memory of my pick per caseId (for the reveal screen). NOT persisted.
  const [picks, setPicks] = useState<Record<string, string>>({})
  const lastSeqRef = useRef(-1)

  useEffect(() => {
    const savedLang = localStorage.getItem(LANG_KEY) as Lang | null
    if (savedLang) setLang(savedLang)
    setIdentity(loadIdentity())
  }, [])

  const changeLang = (l: Lang) => { setLang(l); try { localStorage.setItem(LANG_KEY, l) } catch { /* ignore */ } }

  const returnToCodename = useCallback((wasReset: boolean) => {
    saveIdentity(null)
    writePending([])
    setIdentity(null)
    setGameState(null)
    setPicks({})
    lastSeqRef.current = -1
    setSessionWasReset(wasReset)
  }, [])

  // Poll the server heartbeat while we have an identity.
  useEffect(() => {
    if (!identity) return
    let alive = true
    const poll = async () => {
      try {
        const res = await fetchWithTimeout(`/api/state?playerId=${encodeURIComponent(identity.playerId)}`, { method: 'GET' })
        if (!res.ok) return
        const next = (await res.json()) as PublicGameState
        if (!alive) return
        if (typeof next.seq === 'number' && next.seq >= lastSeqRef.current) {
          lastSeqRef.current = next.seq
          setGameState(next)
        }
      } catch { /* transient — keep last good frame */ }
    }
    void poll()
    const id = setInterval(poll, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [identity])

  const join = async (codenameInput: string) => {
    try {
      const res = await fetchWithTimeout('/api/join', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codename: codenameInput }),
      })
      if (!res.ok) throw new Error('bad status')
      const { player } = await res.json()
      const id: Identity = { playerId: player.id, codename: player.codename ?? codenameInput }
      saveIdentity(id)
      setIdentity(id)
      setJoinError(false)
      setSessionWasReset(false)
    } catch {
      setJoinError(true)
    }
  }

  const flushPending = useCallback(async () => {
    const pending = readPending()
    if (pending.length === 0) return
    const still: QueuedAnswer[] = []
    for (const a of pending) {
      try {
        const res = await fetchWithTimeout('/api/answer', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(a),
        })
        if (res.status === 400) { returnToCodename(true); return }
        if (res.status === 409) continue            // round closed — drop, never requeue
        if (!res.ok) still.push(a)                   // transient
      } catch { still.push(a) }
    }
    writePending(still)
  }, [returnToCodename])

  const commit = async (caseId: string, optionId: string) => {
    if (!identity) return
    setPicks((p) => ({ ...p, [caseId]: optionId }))   // optimistic lock
    const answer: QueuedAnswer = { playerId: identity.playerId, caseId, optionId }
    try {
      const res = await fetchWithTimeout('/api/answer', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer),
      })
      if (res.status === 400) { returnToCodename(true); return }
      if (res.status === 409) return                  // too late — locked, drop
      if (!res.ok) throw new Error('bad status')
    } catch {
      writePending([...readPending().filter((a) => a.caseId !== caseId), answer])
    }
    void flushPending()
  }

  const message = joinError ? t('joinFailed', lang) : sessionWasReset ? t('sessionReset', lang) : undefined

  return (
    <main className="crt relative min-h-screen" style={{ background: 'var(--rt-bg)', color: 'var(--rt-text)' }}>
      <LangToggle lang={lang} onChange={changeLang} />
      {!identity ? (
        <CodenameScreen lang={lang} onJoin={join} message={message} />
      ) : (
        <PhoneBody lang={lang} state={gameState} picks={picks} onCommit={commit} onNewDetective={() => returnToCodename(false)} />
      )}
    </main>
  )
}

function PhoneBody({
  lang, state, picks, onCommit, onNewDetective,
}: {
  lang: Lang
  state: PublicGameState | null
  picks: Record<string, string>
  onCommit: (caseId: string, optionId: string) => void
  onNewDetective: () => void
}) {
  if (!state || state.phase === 'lobby') {
    return <Centered>{t('waitingToStart', lang)}</Centered>
  }
  if (state.phase === 'final') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="pixel-title text-2xl">{t('finalTitle', lang)}</div>
        <p style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('waitReveal', lang)}</p>
        <button type="button" className="pixel-btn gold" onClick={onNewDetective}>{t('newDetective', lang)}</button>
      </div>
    )
  }

  const round = ROUNDS[state.roundIndex]
  if (!round || state.caseId !== round.id) return <Centered>{t('waitingForOthers', lang)}</Centered>

  const myPick = picks[round.id]
  const locked = state.youAnswered === true || myPick !== undefined
  const correctId = round.options.find((o) => o.correct)!.id

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <span className="pixel-title text-sm">{t('caseLabel', lang)} {round.order}/5</span>
        {state.phase === 'investigate' ? <Countdown remainingMs={state.remainingMs} /> : <span className="pixel-title text-sm">{t('reveal', lang)}</span>}
      </header>

      <div className="retro-panel p-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
        <div className="mb-1 font-bold" style={{ color: 'var(--rt-cyan)' }}>{round.question[lang]}</div>
        <Duck bubble={round.aiAnswer[lang]} size={48} />
      </div>

      <EvidenceList detectiveCase={round} lang={lang} />

      <AnswerCards
        options={round.options}
        lang={lang}
        disabled={state.phase === 'reveal' || locked}
        selectedId={myPick}
        correctId={state.phase === 'reveal' ? correctId : undefined}
        onPick={(id) => onCommit(round.id, id)}
      />

      {state.phase === 'investigate' && locked ? (
        <p className="text-center" style={{ color: 'var(--rt-gold)' }}>{t('answerLocked', lang)} — {t('waitingForOthers', lang)}</p>
      ) : null}

      {state.phase === 'reveal' ? (
        <div className="retro-panel p-3" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          <div className="font-bold">{myPick === correctId ? t('youWereRight', lang) : t('youWereFooled', lang)}</div>
          <p className="mt-1 text-sm">{round.reveal[lang]}</p>
        </div>
      ) : null}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
      <p className="text-lg" style={{ color: 'var(--rt-gold)' }}>{children}</p>
    </div>
  )
}
```

- [ ] **Step 5: Run to verify passing**

Run: `npm test -- app/page.test.tsx`
Expected: PASS. (Old component tests for `CaseScreen`/`ResultScreen` may still exist and pass independently — leave them.)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/page.test.tsx
git commit -m "feat: server-synced phone flow (lobby/investigate/reveal/final)"
```

---

## Task 10: TV host stage (`app/tv/page.tsx`)

**Files:**
- Create: `app/tv/page.tsx`
- Test: `app/tv/tv.test.tsx`

**Interfaces:**
- Consumes: `PublicGameState`, `Lang` from `lib/types.ts`; `RoomStats` from `lib/stats.ts`; `ROUNDS` from `lib/game.ts`; `t`; `Countdown`, `Duck` from `components/game/`.
- Produces: the TV stage. Polls `GET /api/state` (~1000ms) and `GET /api/stats` (~1500ms). Renders lobby (join info + codenames + Start), investigate (question + duck + Countdown + `answeredCount/playerCount`), reveal (correct answer + reveal text + `believedAiPct` + Next), final (leaderboard + PlayAgain). Host actions POST `/api/control` with `x-facilitator-token` from a `localStorage` token field.

- [ ] **Step 1: Write the failing test** — `app/tv/tv.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TvPage from './page'
import { ROUNDS } from '@/lib/game'
import type { PublicGameState } from '@/lib/types'

function mockFetch(state: Partial<PublicGameState>, stats: unknown = { detectives: 2, finished: 0, caseStats: [], leaderboard: [] }) {
  const body: PublicGameState = { seq: 1, phase: 'lobby', roundIndex: 0, caseId: null, remainingMs: 0, answeredCount: 0, playerCount: 2, ...state }
  vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const u = String(url)
    if (u.includes('/api/state')) return { ok: true, status: 200, json: async () => body } as Response
    if (u.includes('/api/stats')) return { ok: true, status: 200, json: async () => stats } as Response
    return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response
  })
}

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('TV stage', () => {
  it('lobby shows the join prompt and a Start control', async () => {
    mockFetch({ phase: 'lobby' })
    render(<TvPage />)
    await waitFor(() => expect(screen.getByText(/join on your phone|เข้าร่วมด้วยมือถือ/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /start|เริ่มเกม/i })).toBeInTheDocument()
  })

  it('investigate shows the question and the answered count', async () => {
    const r0 = ROUNDS[0]
    mockFetch({ phase: 'investigate', roundIndex: 0, caseId: r0.id, remainingMs: 40_000, answeredCount: 3, playerCount: 5 })
    render(<TvPage />)
    await waitFor(() => expect(screen.getByText(r0.question.th)).toBeInTheDocument())
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- app/tv/tv.test.tsx`
Expected: FAIL — `app/tv/page.tsx` does not exist.

- [ ] **Step 3: Implement `app/tv/page.tsx`**

```tsx
'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang, PublicGameState } from '@/lib/types'
import type { RoomStats } from '@/lib/stats'
import { ROUNDS } from '@/lib/game'
import { Countdown } from '@/components/game/Countdown'
import { Duck } from '@/components/game/Duck'
import { t } from '@/lib/i18n'

const HOST_TOKEN_KEY = 'aidet.hostToken'
const STATE_POLL_MS = 1000
const STATS_POLL_MS = 1500

export default function TvPage() {
  const [lang] = useState<Lang>('th')
  const [state, setState] = useState<PublicGameState | null>(null)
  const [stats, setStats] = useState<RoomStats | null>(null)
  const [token, setToken] = useState('')
  const [tokenError, setTokenError] = useState(false)
  const lastSeqRef = useRef(-1)

  useEffect(() => { setToken(localStorage.getItem(HOST_TOKEN_KEY) ?? '') }, [])

  useEffect(() => {
    let alive = true
    const pollState = async () => {
      try {
        const res = await fetch('/api/state')
        if (!res.ok) return
        const next = (await res.json()) as PublicGameState
        if (alive && next.seq >= lastSeqRef.current) { lastSeqRef.current = next.seq; setState(next) }
      } catch { /* keep last good frame */ }
    }
    void pollState()
    const id = setInterval(pollState, STATE_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  useEffect(() => {
    let alive = true
    const pollStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (res.ok && alive) setStats(await res.json())
      } catch { /* keep last good frame */ }
    }
    void pollStats()
    const id = setInterval(pollStats, STATS_POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [])

  const control = useCallback(async (action: 'start' | 'next') => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-facilitator-token': token },
        body: JSON.stringify({ action }),
      })
      setTokenError(res.status === 403)
    } catch { setTokenError(true) }
  }, [token])

  const saveToken = (v: string) => { setToken(v); try { localStorage.setItem(HOST_TOKEN_KEY, v) } catch { /* ignore */ } }

  return (
    <main className="crt relative min-h-screen overflow-hidden p-8" style={{ background: 'var(--rt-bg)', color: 'var(--rt-text)' }}>
      <TokenBar token={token} onSave={saveToken} error={tokenError} lang={lang} />
      <Stage state={state} stats={stats} lang={lang} onStart={() => control('start')} onNext={() => control('next')} />
    </main>
  )
}

function TokenBar({ token, onSave, error, lang }: { token: string; onSave: (v: string) => void; error: boolean; lang: Lang }) {
  return (
    <div className="absolute right-4 top-4 z-50 flex items-center gap-2 rounded-lg p-2" style={{ background: 'var(--rt-panel)', border: '2px solid var(--rt-border)' }}>
      <label className="text-xs" style={{ fontFamily: 'var(--font-thai), sans-serif', color: error ? 'var(--rt-pink)' : 'var(--rt-text)' }}>{t('hostTokenLabel', lang)}</label>
      <input
        type="password"
        defaultValue={token}
        onBlur={(e) => onSave(e.target.value)}
        className="w-28 rounded bg-black/40 px-2 py-1 text-sm"
        style={{ border: '1px solid var(--rt-border)', color: 'var(--rt-text)' }}
      />
    </div>
  )
}

function Stage({
  state, stats, lang, onStart, onNext,
}: {
  state: PublicGameState | null
  stats: RoomStats | null
  lang: Lang
  onStart: () => void
  onNext: () => void
}) {
  if (!state || state.phase === 'lobby') {
    const names = stats?.leaderboard.map((r) => r.codename) ?? []
    return (
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-8 text-center">
        <h1 className="pixel-title text-6xl">🕵️ AI DETECTIVE</h1>
        <p className="text-2xl" style={{ fontFamily: 'var(--font-retro), monospace', color: 'var(--rt-cyan)' }}>
          {t('joinOnPhone', lang)} <strong>{'http://<host-ip>:3000'}</strong>
        </p>
        <div className="retro-panel min-w-[320px] p-4">
          <div className="pixel-title mb-2 text-sm">{t('detectivesInRoom', lang)}: {names.length}</div>
          <div className="flex flex-wrap justify-center gap-2" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
            {names.map((n) => <span key={n} className="rounded-full px-3 py-1" style={{ background: 'var(--rt-border)' }}>{n}</span>)}
          </div>
        </div>
        <button type="button" className="pixel-btn gold text-lg" onClick={onStart}>{t('hostStart', lang)}</button>
      </div>
    )
  }

  if (state.phase === 'final') {
    const rows = stats?.leaderboard.slice(0, 10) ?? []
    return (
      <div className="flex min-h-[80vh] flex-col items-center gap-6">
        <h1 className="pixel-title text-4xl">{t('finalTitle', lang)}</h1>
        <ol className="retro-panel w-full max-w-2xl p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          {rows.map((r, i) => (
            <li key={r.codename} className="flex justify-between border-b border-white/10 py-2 text-xl">
              <span>{i + 1}. {r.codename}</span>
              <span className="tabular-nums" style={{ color: 'var(--rt-gold)' }}>{r.score}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }

  const round = ROUNDS[state.roundIndex]
  const caseStat = stats?.caseStats.find((c) => c.caseId === round.id)

  if (state.phase === 'investigate') {
    return (
      <div className="flex min-h-[80vh] flex-col gap-6">
        <header className="flex items-center justify-between">
          <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5</span>
          <span className="text-4xl"><Countdown remainingMs={state.remainingMs} /></span>
        </header>
        <div className="retro-panel p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
          <div className="mb-4 text-3xl font-bold" style={{ color: 'var(--rt-cyan)' }}>{round.question[lang]}</div>
          <Duck bubble={round.aiAnswer[lang]} size={72} />
        </div>
        <div className="mt-auto text-center pixel-title text-3xl">
          {state.answeredCount} / {state.playerCount} {t('answered', lang)}
        </div>
      </div>
    )
  }

  // reveal
  const correct = round.options.find((o) => o.correct)!
  return (
    <div className="flex min-h-[80vh] flex-col gap-6">
      <span className="pixel-title text-2xl">{t('caseLabel', lang)} {round.order}/5 — {t('reveal', lang)}</span>
      <div className="retro-panel p-6" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>
        <div className="mb-2 text-sm" style={{ color: 'var(--rt-gold)' }}>{t('correctAnswer', lang)}:</div>
        <div className="mb-4 text-3xl font-bold" style={{ color: 'var(--rt-green)' }}>{correct.label[lang]}</div>
        <p className="text-xl">{round.reveal[lang]}</p>
      </div>
      {caseStat && caseStat.answered > 0 ? (
        <div className="text-center">
          <span className="pixel-title text-7xl" style={{ color: 'var(--rt-pink)' }}>{caseStat.believedAiPct}%</span>
          <div className="mt-2 text-2xl" style={{ fontFamily: 'var(--font-thai), sans-serif' }}>{t('believedAiLabel', lang)}</div>
        </div>
      ) : null}
      <button type="button" className="pixel-btn gold mx-auto mt-auto text-lg" onClick={onNext}>{t('hostNext', lang)}</button>
    </div>
  )
}
```

> Note: the lobby prints a literal `http://<host-ip>:3000` placeholder for the URL. Task 12 replaces it with a runtime-derived origin (`window.location.host`), which cannot be read during SSR — do it in a `useEffect`.

- [ ] **Step 4: Run to verify passing**

Run: `npm test -- app/tv/tv.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/tv/page.tsx app/tv/tv.test.tsx
git commit -m "feat: TV host stage (lobby/investigate/reveal/final + Start/Next)"
```

---

## Task 11: Wire-up, run guide, and manual QA

**Files:**
- Modify: `app/tv/page.tsx` (real join URL), `package.json` (dev script env), `README.md` (create or update)
- Create: `.env.local.example`

**Interfaces:** none new — this task makes the app runnable end-to-end and documents it.

- [ ] **Step 1: Show the real join URL on the TV lobby**

In `app/tv/page.tsx`, add a state + effect to read the origin at runtime and use it in the lobby instead of the placeholder:

```tsx
const [origin, setOrigin] = useState('')
useEffect(() => { setOrigin(window.location.origin) }, [])
// ...in the lobby JSX, replace the placeholder with:
//   <strong>{origin || '…'}</strong>
```

- [ ] **Step 2: Create `.env.local.example`**

```
# The facilitator's shared secret for /api/control (Start/Next) and /api/reset.
# Set the same value in the TV's Host token field. Without it, control is disabled (403).
FACILITATOR_TOKEN=madt2026
```

- [ ] **Step 3: Add a LAN dev script that carries the token** — set `package.json` `scripts.dev:lan` to:

```json
"dev:lan": "next dev -H 0.0.0.0"
```

(Leave as-is; the facilitator supplies `FACILITATOR_TOKEN` via `.env.local`. Document this in Step 4.)

- [ ] **Step 4: Write/refresh `README.md`** with the run guide:

```markdown
# AI Detective — MADT Kahoot Workshop

## Run it (facilitator laptop)

1. `cp .env.local.example .env.local` and keep or change `FACILITATOR_TOKEN`.
2. **Once, on a connected network:** `npm run build` (or start `npm run dev` and load a page) so `next/font` downloads and bundles the fonts. After this the app runs fully offline.
3. `npm run dev:lan` — serves on `http://0.0.0.0:3000`. Note your LAN IP (e.g. `http://192.168.1.165:3000`).
4. **TV/projector:** open `/tv`, enter the `FACILITATOR_TOKEN` in the Host token box (top-right).
5. **Players:** open `http://<host-ip>:3000` on their phones, pick a codename in the lobby.
6. Press **Start** on the TV. Each round auto-advances when the timer ends or everyone answers; press **Next** to leave each reveal.

## Reset between sessions
`curl -X POST http://localhost:3000/api/reset -H "x-facilitator-token: <token>"`
(or add a Play Again control on `/tv` that calls `/api/control` — future work.)

## Network risk (test before the event)
Venue wifi may block phone-to-laptop traffic (client isolation). Test with two phones + the laptop beforehand; keep a phone hotspot as fallback.

## Superseded / dead code (safe to delete later)
`app/reveal/`, `components/CaseScreen.tsx`, `components/ResultScreen.tsx` are from the v1 free-roam flow and are no longer routed to by the Kahoot phone/TV. `/dashboard` remains as an optional second-screen stats view.
```

- [ ] **Step 4b: Run the full suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Manual QA (two-device smoke test)** — with `FACILITATOR_TOKEN=madt2026 npm run dev:lan` running, verify by hand (no test harness can cover the sync):
  1. Open `/tv`, enter the token. Open `/` on a second device (or a second browser), join a codename → it appears in the TV lobby.
  2. Press Start → both show Round 1; TV countdown ticks; answer on the phone → TV `answered` count increments.
  3. Let the timer expire (or answer on all devices) → both flip to reveal; TV shows `% believed the AI`.
  4. Press Next through all 5 → final leaderboard on TV.
  5. Join a NEW device mid-round → it shows the spectating message and cannot answer.
  6. Reset via curl → phones drop to the codename screen with the reset banner.

- [ ] **Step 6: Commit**

```bash
git add app/tv/page.tsx .env.local.example package.json README.md
git commit -m "chore: real join URL, run guide, env example"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** §2/2a/2b/2c server clock + state machine → Tasks 1,2,4; §2d late-join/spectator → Tasks 2,5,9; §2e network → README; §3 offline fonts → Task 7 + README; §4 hard timer + invariant → Task 1 (durations), scoring unchanged; §5 scoring/identity/i18n → Tasks 3,6, reused; §6 theme → Tasks 7,8,9,10; §7 reveal/closing → Task 10.
- **The reversed v1 principles** (soft timer, no synchronized flipping) are intentional — do not "restore" them.
- **Do not port** `{answers, index}` into the phone's `localStorage` — identity only.
- **Server owns the clock** for both countdown AND `elapsedMs` — never trust a client value for either.

import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import type { Answer, GameState, Player, PublicGameState, Verdict } from './types'
import { avatarFor } from './avatars'
import { scorePlayer } from './scoring'
import {
  LOBBY_STATE, NEXT_GUARD_MS, QUESTIONS_IN_ORDER, currentQuestion, nextState, remainingMs, rulesState,
  shouldExpire, toggleHold, currentActIndex,
} from './game'

export interface RoomStore {
  join(codename: string, now: number): Player
  recordAnswer(input: { playerId: string; questionId: string; verdict: Verdict }, now: number): AnswerResult
  getPlayers(): Player[]
  getAnswers(): Answer[]
  reset(): void
  getGameState(): GameState
  getSeq(): number
  tick(now: number): boolean
  startGame(now: number): void
  /** Advance one phase. The host's only forward control. */
  next(now: number): void
  /** Toggle the reveal freeze. No-op off a reveal. */
  hold(now: number): void
  getLeaderboard(): LeaderboardEntry[]
  getRoomWrongPass(): number
  getSplit(questionId: string): { pass: number; reject: number }
  getPublicState(now: number, playerId?: string): PublicGameState
}

export type AnswerResult = 'ok' | 'duplicate' | 'unknown' | 'spectator' | 'closed'

export type LeaderboardEntry = {
  playerId: string
  codename: string
  avatar: string
  score: number
  wrongPass: number
  rank: number
}

type Snapshot = { players: Player[]; answers: Answer[]; game: GameState; seq: number }

const validPhases = new Set(['lobby', 'rules', 'reading', 'question', 'reveal', 'actcard', 'tally', 'podium'])

/**
 * The stale-v2-file hazard: a `.room-state.json` written by the old build is NOT malformed JSON —
 * it parses fine, and its `phase` value ("lobby") is still a member of `validPhases`. A loader
 * that checks only `phase` would ACCEPT that file and hand the app a Player with no `avatar`. So
 * every field is checked here; one bad field fails the whole player, and (below) the whole
 * snapshot — a half-loaded room is worse than an empty one.
 */
function isValidPlayer(p: unknown): p is Player {
  if (!p || typeof p !== 'object') return false
  const r = p as Record<string, unknown>
  return typeof r.id === 'string' && r.id.length > 0
    && typeof r.codename === 'string' && r.codename.length > 0
    && typeof r.joinedAt === 'number' && Number.isFinite(r.joinedAt)
    && typeof r.spectator === 'boolean'
    && typeof r.avatar === 'string' && r.avatar.length > 0
}

/**
 * Same hazard, the GameState half of it: a v2 snapshot has no `qIndex` and no `holding`, so both
 * come back `undefined` — checking `phase` alone would let that through. `qIndex` also gets a
 * bounds check here rather than trusting the file: it comes straight off disk and both
 * `currentQuestion` and `currentActIndex` index `QUESTIONS_IN_ORDER` with it. `currentQuestion`
 * guards with `?? null`; `currentActIndex` does not — a corrupt or hand-edited `qIndex` is where
 * that surfaces, so it is rejected here instead of downstream.
 */
function isValidGameState(g: unknown): g is GameState {
  if (!g || typeof g !== 'object') return false
  const r = g as Record<string, unknown>
  return typeof r.phase === 'string' && validPhases.has(r.phase)
    && typeof r.qIndex === 'number' && Number.isInteger(r.qIndex)
    && r.qIndex >= 0 && r.qIndex < QUESTIONS_IN_ORDER.length
    && typeof r.phaseStartedAt === 'number' && Number.isFinite(r.phaseStartedAt)
    && typeof r.phaseDurationMs === 'number' && Number.isFinite(r.phaseDurationMs)
    && typeof r.holding === 'boolean'
}

/**
 * The whole-snapshot gate. Individual malformed ANSWER entries are still tolerated and skipped
 * one at a time in `load()` (a single bad answer should not cost the room its players) — but
 * `players` and `game` are all-or-nothing: either the shape is the current one, or the snapshot
 * is stale/corrupt and the room starts empty rather than half-loaded.
 */
function isValidSnapshot(snap: unknown): snap is { players: Player[]; answers: unknown[]; game: GameState; seq: unknown } {
  if (!snap || typeof snap !== 'object') return false
  const r = snap as Record<string, unknown>
  return Array.isArray(r.players) && r.players.every(isValidPlayer)
    && Array.isArray(r.answers)
    && isValidGameState(r.game)
}

export class MemoryRoomStore implements RoomStore {
  private players: Player[] = []
  /** Keyed `${playerId}:${questionId}`. First-wins: we never overwrite an existing key. */
  private answers = new Map<string, Answer>()
  private game: GameState = LOBBY_STATE
  private seq = 0
  /**
   * The moment the last `next()` actually advanced the phase, or `null` before the first one.
   * NOT part of `Snapshot`/persistence: `isValidSnapshot`/`isValidGameState` are all-or-nothing
   * gates, and adding a field there would reject every `.room-state.json` written before this
   * guard existed. A restart simply forgets the last press, which is harmless — the window is
   * 700ms, nobody presses Next across a server restart.
   */
  private lastNextAt: number | null = null

  constructor(private persistPath?: string) {
    if (persistPath) this.load()
  }

  private activePlayers(): Player[] {
    return this.players.filter((p) => !p.spectator)
  }

  private answeredCountFor(questionId: string | null): number {
    if (!questionId) return 0
    const active = new Set(this.activePlayers().map((p) => p.id))
    let n = 0
    for (const a of this.answers.values()) if (a.questionId === questionId && active.has(a.playerId)) n++
    return n
  }

  /**
   * THE ONLY PLACE A CODENAME IS DECIDED. `app/api/join/route.ts` checks the shape of the input
   * (a string, non-empty once trimmed, cut to 40) and nothing else — deliberately, because the
   * uniqueness question cannot be answered anywhere but here. Two phones can POST `เป็ดทอง` in the
   * same second and neither client can see the other; a check in the route would race the same
   * way, since the read and the push would not be one operation. The store sees both, in order.
   */
  join(codename: string, now: number): Player {
    const id = randomUUID()
    const player: Player = {
      id,
      codename: this.uniqueCodename(codename),
      joinedAt: now,
      avatar: avatarFor(id),
      /* `rules` counts as pre-game. v3.2 put a host-advanced rules screen between the lobby and
       * the first question, which opens a window of ~30 seconds — and before this line changed,
       * everyone who finished typing their codename during that window joined as a scoreless
       * spectator. That is backwards: the screen exists so the room can get ready, and no
       * question has been asked yet, so a straggler gains nothing by arriving on it. The spec
       * added the screen without deciding this; the answer is that the game starts at the first
       * `reading`, not at the host's first press. */
      spectator: this.game.phase !== 'lobby' && this.game.phase !== 'rules',
    }
    this.players.push(player)
    this.seq++
    this.persist()
    return player
  }

  /**
   * Kahoot's rule: the second `เป็ดทอง` becomes `เป็ดทอง 2`, the third `เป็ดทอง 3`.
   *
   * Duplicates cost nothing in SCORE — players are keyed by a generated `playerId`, so two people
   * with one name still bank their own points — and everything the room SEES breaks: two identical
   * lobby cards, two identical leaderboard rows, and a podium announcement nobody can resolve.
   *
   * Matched on the trimmed string, and the trimmed string is what gets stored, so ` เป็ดทอง ` and
   * `เป็ดทอง` cannot become two rows that read the same on the projector. (An all-whitespace
   * codename is the route's 400, not ours.)
   *
   * The base is EXACTLY what the player typed, so someone who literally types `เป็ดทอง 2` into a
   * room that already has one gets `เป็ดทอง 2 2`. Ugly, and correct: the tidier-looking rule —
   * strip a trailing number and re-suffix — turns a second `Agent 007` into `Agent 8`, which is
   * not that player's name at all.
   *
   * Spectators are included in the check. They are shown in the room's own lists and a repeated
   * name there is exactly as confusing as one on the board.
   *
   * The loop terminates: at most `players.length` names are taken, each `n` yields a distinct
   * candidate, so a free suffix always appears within `players.length + 1` steps.
   */
  private uniqueCodename(codename: string): string {
    const wanted = codename.trim()
    const taken = new Set(this.players.map((p) => p.codename))
    if (!taken.has(wanted)) return wanted
    let n = 2
    while (taken.has(`${wanted} ${n}`)) n++
    return `${wanted} ${n}`
  }

  recordAnswer(input: { playerId: string; questionId: string; verdict: Verdict }, now: number): AnswerResult {
    const player = this.players.find((p) => p.id === input.playerId)
    if (!player) return 'unknown'
    if (player.spectator) return 'spectator'
    if (this.game.phase !== 'question') return 'closed'
    if (input.questionId !== currentQuestion(this.game)?.id) return 'closed'
    const key = `${input.playerId}:${input.questionId}`
    if (this.answers.has(key)) return 'duplicate' // first-wins, idempotent no-op
    const elapsedMs = now - this.game.phaseStartedAt
    this.answers.set(key, { playerId: input.playerId, questionId: input.questionId, verdict: input.verdict, elapsedMs })
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
    this.lastNextAt = null
    this.seq++
    this.persist()
  }

  /**
   * Lazily advance on expiry. Runs on every `/api/state` read — roughly 100 phones polling once a
   * second — so it must stay cheap, and it persists ONLY when `shouldExpire` actually fires. A
   * fsync on every no-op read would mean ~100 disk writes/sec against a room that has not changed;
   * `shouldExpire` is the single gate both the question timeout/all-answered path and v3's reveal
   * auto-advance (REVEAL_MS) share, so a timed advance and a host's `next` can never disagree
   * about what comes after either phase.
   */
  tick(now: number): boolean {
    const active = this.activePlayers().length
    const answered = this.answeredCountFor(currentQuestion(this.game)?.id ?? null)
    if (!shouldExpire(this.game, now, active, answered)) return false
    this.game = nextState(this.game, now)
    this.seq++
    this.persist()
    return true
  }

  /**
   * Start opens the RULES screen, not question 1 — `rulesState`, not `startedState`. The host then
   * presses Next once to reach the first `reading`. Still lobby-only, so it stays the single exit
   * from the lobby and `rules` can be reached exactly once per game.
   */
  startGame(now: number): void {
    if (this.game.phase !== 'lobby') return
    this.game = rulesState(now)
    this.seq++
    this.persist()
  }

  /**
   * THE DOUBLE-TAP GUARD. §3's ruling: `next` is shipped as a UNIVERSAL advance — it works on
   * `question` and `reveal` too, not just the three untimed phases the spec originally described
   * — because `scripts/check-projector-fit.mjs` depends on being able to close a question early to
   * walk the whole game without waiting out real 15s/12s clocks (see `NEXT_GUARD_MS`'s doc comment
   * in `lib/game.ts`). That makes a double-tap during `question`/`reveal` a real hazard: two quick
   * presses would skip the NEXT phase's own window entirely, and nothing on screen would say so
   * until the leaderboard looked wrong later.
   *
   * A `next` that arrives within `NEXT_GUARD_MS` of the previous successful advance is a TRUE
   * no-op — no `seq` bump, no persist — exactly like `hold`'s no-op path below. `lastNextAt` is
   * armed only AFTER the lobby/podium early-return, so a press that never advanced anything (lobby,
   * podium, or a 403 the caller never got this far to make) never arms the guard.
   *
   * This governs the HOST'S BUTTON only. `tick()` — the timed auto-advance every `/api/state` poll
   * drives — calls `nextState` directly and never touches `lastNextAt`, so a real clock expiry is
   * never swallowed by a recent manual press.
   */
  next(now: number): void {
    if (this.game.phase === 'lobby' || this.game.phase === 'podium') return
    if (this.lastNextAt !== null && now - this.lastNextAt < NEXT_GUARD_MS) return
    this.game = nextState(this.game, now)
    this.lastNextAt = now
    this.seq++
    this.persist()
  }

  hold(now: number): void {
    const held = toggleHold(this.game)
    if (held === this.game) return
    // Restart the reveal clock on unhold so the room still gets a full beat after the host talks.
    this.game = held.holding ? held : { ...held, phaseStartedAt: now }
    this.seq++
    this.persist()
  }

  /**
   * MUST filter by playerId. `scorePlayer` keys its walk on questionId alone and no longer throws
   * on a mixed-player array the way v2's `totalScore` did — hand it answers from two players and
   * it silently collapses them last-write-wins instead of failing. Every call site is responsible
   * for this filter; there is no guard underneath you.
   */
  private answersFor(playerId: string): Answer[] {
    return [...this.answers.values()].filter((a) => a.playerId === playerId)
  }

  getLeaderboard(): LeaderboardEntry[] {
    const rows = this.activePlayers().map((p) => {
      const { total, wrongPass } = scorePlayer(this.answersFor(p.id), QUESTIONS_IN_ORDER)
      return { playerId: p.id, codename: p.codename, avatar: p.avatar, score: total, wrongPass, rank: 0 }
    })
    // Ties keep a stable order by codename so the board does not shuffle between polls: two
    // players on the same score in different insertion order (e.g. after a rejoin) would
    // otherwise swap rows every time this is called, even though nothing about their play changed.
    rows.sort((a, b) => b.score - a.score || a.codename.localeCompare(b.codename))
    /*
     * RANK IS POSITIONAL: 1-based index after that sort, so equal scores get DIFFERENT ranks
     * (1,2,3,4 — never 1,1,3). Early in a game most of the room is on 0 and the ties are the
     * common case, so this is a decision, not a default.
     *
     * `lib/room-store.ts` (The Decision Room) deliberately does the opposite — competition
     * ranking, where equal scores share a rank. Two workshops, two right answers; do not
     * "fix" either to match the other:
     *
     *  - The podium announces 1st, 2nd and 3rd as three named people. Shared ranks can produce
     *    two firsts and no second, and there is no beat in the show for that.
     *  - The phone prints `อันดับ N จาก M` and, under it, the gap to the player above. Under
     *    shared ranks the player above can be at your own rank, and "0 points behind the person
     *    level with you" is not a sentence.
     *  - The tie-break is `codename.localeCompare`, which is stable and content-free — it does
     *    not reward or punish anything a player did, it just refuses to leave the order to
     *    insertion luck.
     *
     * The honest cost: at equal scores the ordering is alphabetical, so the gap between two tied
     * players is a real `0` on the phone. That is why `you.gapToNext` is ABSENT for rank 1 rather
     * than 0 — see `getPublicState` below.
     */
    return rows.map((r, i) => ({ ...r, rank: i + 1 }))
  }

  getRoomWrongPass(): number {
    return this.getLeaderboard().reduce((n, r) => n + r.wrongPass, 0)
  }

  getSplit(questionId: string): { pass: number; reject: number } {
    let pass = 0
    let reject = 0
    const active = new Set(this.activePlayers().map((p) => p.id))
    for (const a of this.answers.values()) {
      if (a.questionId !== questionId || !active.has(a.playerId)) continue
      if (a.verdict === 'pass') pass++
      else reject++
    }
    return { pass, reject }
  }

  getPublicState(now: number, playerId?: string): PublicGameState {
    const q = currentQuestion(this.game)
    const pub: PublicGameState = {
      seq: this.seq,
      phase: this.game.phase,
      qIndex: this.game.qIndex,
      questionId: q?.id ?? null,
      actIndex: currentActIndex(this.game),
      remainingMs: remainingMs(this.game, now),
      answeredCount: this.answeredCountFor(q?.id ?? null),
      playerCount: this.activePlayers().length,
      holding: this.game.holding,
    }
    if (playerId !== undefined) {
      pub.youAnswered = q != null && this.answers.has(`${playerId}:${q.id}`)
      /* `this.players`, NOT `activePlayers()`. The latter filters out spectators, who are real
       * players the store knows and answers for with `'spectator'`. Deriving presence from the
       * active set would eject every spectator phone on the next poll tick, once a second. */
      const me = this.players.find((p) => p.id === playerId)
      if (me) {
        const board = this.getLeaderboard()
        const row = board.find((r) => r.playerId === playerId)
        // `scorePlayer` already returns `streak` (and, spec §5b, `perQuestion`) from the same
        // walk — read both from there rather than recomputing. `correct` and `streak` are
        // different numbers (a miss resets the streak but still counts nothing toward `correct`)
        // and coincide only on a perfect game.
        const { streak, perQuestion } = scorePlayer(this.answersFor(playerId), QUESTIONS_IN_ORDER)
        /* The CURRENT question's outcome, and REVEAL-ONLY on purpose: `q` stays non-null through
         * `question` too (currentQuestion covers both), and a player who answered early could
         * otherwise read their own correctness off `/api/state` before the projector's reveal
         * beat lands — no scoring exploit (it is their own data, and answers are already
         * first-wins locked), but it can spoil the room's reveal moment for anyone who checks.
         * Gating on `this.game.phase === 'reveal'` costs nothing `question`-phase UI needs: the
         * phone never renders `lastCorrect`/`lastPoints` before `reveal` (app/page.tsx's phase
         * switch), and `perQuestion[q.id]` is absent anyway if this player never answered it
         * (§5b's "null means never answered", not "answered and lost"). */
        const outcome = q && this.game.phase === 'reveal' ? perQuestion[q.id] : undefined
        /* Derived from the board above, never stored. `row.rank` is a 1-based position, so the
         * player immediately above sits at `board[row.rank - 2]`.
         *
         * Absent in two cases, and they are the same case: nobody is above this player. Rank 1
         * leads, and someone with no `row` at all (a spectator, or an id the board does not carry)
         * is not on the ladder to begin with — the phone shows the lead line for the first and the
         * spectating state for the second, and neither is a gap of zero. A tie DOES produce a real
         * `gapToNext` of 0 (ranks are positional — see `getLeaderboard`), which is exactly why the
         * leader must not send one. See `PublicGameState.you.gapToNext`. */
        const gapToNext = row && row.rank > 1 ? board[row.rank - 2].score - row.score : undefined
        /* What share of the room got THIS question wrong, as a whole percent.
         *
         * It exists so the phone can say "68% of the room missed this too", which is what lets a
         * person accept they were fooled instead of quietly deciding they are bad at this. The
         * phone cannot compute it: the share is public but which side is wrong is the ANSWER KEY,
         * and `app/page.tsx` is a client component — importing `content/questions` there would
         * ship all nine verdicts to every player's browser, readable in devtools. So the server
         * does the comparison and sends only the number.
         *
         * Reveal-gated for the same reason as `outcome` above: during `question` this would tell
         * an early answerer how the room is leaning, which is a hint they should not have.
         *
         * Absent, never 0, when nobody answered — "0% got it wrong" and "nobody answered" are
         * different facts and must not collapse into the same render. */
        let roomWrongPct: number | undefined
        if (q && this.game.phase === 'reveal') {
          const split = this.getSplit(q.id)
          const answered = split.pass + split.reject
          if (answered > 0) {
            const wrong = q.verdict === 'pass' ? split.reject : split.pass
            roomWrongPct = Math.round((wrong / answered) * 100)
          }
        }
        const you: NonNullable<PublicGameState['you']> = {
          codename: me.codename,
          avatar: me.avatar,
          spectator: me.spectator,
          score: row?.score ?? 0,
          rank: row?.rank ?? 0,
          streak,
          wrongPass: row?.wrongPass ?? 0,
          lastCorrect: outcome ? outcome.correct : null,
          lastPoints: outcome ? outcome.points : null,
        }
        // Assigned only when it exists. `gapToNext: undefined` serialises away over HTTP but is
        // still a key on the object every server-side caller holds, and `'gapToNext' in you` is
        // exactly the check someone reaches for — absence should mean absence on both sides.
        if (gapToNext !== undefined) you.gapToNext = gapToNext
        if (roomWrongPct !== undefined) you.roomWrongPct = roomWrongPct
        pub.you = you
      }
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
      const snap = JSON.parse(readFileSync(this.persistPath!, 'utf8')) as unknown
      if (!isValidSnapshot(snap)) {
        throw new Error('persisted snapshot is stale or has an unexpected shape')
      }
      this.players = snap.players
      for (const a of snap.answers) {
        if (!a || typeof a !== 'object') continue
        const r = a as Record<string, unknown>
        // `verdict` gets the same treatment as `qIndex`: a garbage or missing value here would
        // silently fall into `getSplit`'s `else` branch and get counted as a 'reject', inflating
        // the room split rather than being dropped like any other malformed entry. `elapsedMs`
        // gets it too: a missing/non-numeric value flows into `speedBonus` as `Math.max(0,
        // undefined)` -> NaN, poisons `total`, and then the leaderboard's sort comparator and the
        // projector both show NaN — a worse live failure than the miscounted split above.
        if (
          !r.playerId || !r.questionId
          || (r.verdict !== 'pass' && r.verdict !== 'reject')
          || typeof r.elapsedMs !== 'number' || !Number.isFinite(r.elapsedMs)
        ) continue
        this.answers.set(`${r.playerId}:${r.questionId}`, a as Answer)
      }
      this.game = snap.game
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

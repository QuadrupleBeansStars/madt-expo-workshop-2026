import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MemoryRoomStore } from './store'
import { codenamePool, emojiFor } from './codenames'
import { LOBBY_STATE, NEXT_GUARD_MS, QUESTIONS_IN_ORDER, QUESTION_MS, READING_MS, REVEAL_MS } from './game'
import { BASE_POINTS, MAX_SPEED_BONUS } from './scoring'

const Q0 = QUESTIONS_IN_ORDER[0]
const Q1 = QUESTIONS_IN_ORDER[1]

/**
 * v3.2 puts an untimed `rules` screen between the lobby and the first reading beat, so opening
 * question 0 is now START, a press to leave the rules, and a press to end the reading — where it
 * used to be START and one press.
 *
 * `startToReading(s, t)` leaves the room where `startGame(t)` used to: reading question 0 with
 * `phaseStartedAt === t`. `startToQuestion(s, t)` leaves it where `startGame(t); next(t)` used to:
 * the answer window open with `phaseStartedAt === t`, so every elapsedMs and speed-bonus
 * expectation below still means what it says.
 *
 * The rules press is dated a second before `t` on purpose. `next` swallows a press that lands
 * within NEXT_GUARD_MS (700ms) of the last one, so the rules press and the reading press cannot
 * share a timestamp — and a second is far inside READING_MS (10s), so no reading beat expires in
 * the gap.
 */
const startToReading = (s: MemoryRoomStore, now: number) => { s.startGame(now); s.next(now) }
const startToQuestion = (s: MemoryRoomStore, now: number) => { startToReading(s, now - 1000); s.next(now) }

describe('MemoryRoomStore', () => {
  let store: MemoryRoomStore
  beforeEach(() => { store = new MemoryRoomStore() })

  it('joins a player and assigns a unique id', () => {
    const a = store.join('Detective Ramen', 0)
    const b = store.join('นักสืบกาแฟ', 0)
    expect(a.codename).toBe('Detective Ramen')
    expect(a.id).not.toBe(b.id)
    expect(store.getPlayers()).toHaveLength(2)
  })

  it('assigns every joiner an avatar', () => {
    const a = store.join('Detective Ramen', 0)
    expect(a.avatar).toBeTruthy()
  })

  it('gives a pool name the face that belongs to it', () => {
    expect(store.join('นักสืบราเมง', 0).avatar).toBe('🍜')
  })

  it('derives the avatar from the RESOLVED codename, not from what was passed in', () => {
    /* The two used to be computed side by side in one object literal, `avatarFor(id)` beside
     * `codename: this.uniqueCodename(codename)`. Now that the face comes from the name, looking it
     * up from the ARGUMENT instead of from the stored string diverges the moment a name repeats:
     * the second `นักสืบราเมง` is filed as `นักสืบราเมง 2`, and the row on the projector would read
     * as the same detective wearing a different face. */
    const first = store.join('นักสืบราเมง', 0)
    const second = store.join('นักสืบราเมง', 1)
    expect(second.codename).toBe('นักสืบราเมง 2')
    expect(second.avatar).toBe(first.avatar)
  })

  it('records an answer', () => {
    const p = store.join('D', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    expect(store.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'pass' }, 1500)).toBe('ok')
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('is first-wins — re-answering the same question is ignored, never overwrites', () => {
    const p = store.join('D', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    expect(store.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'pass' }, 1500)).toBe('ok')
    expect(store.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'reject' }, 2000)).toBe('duplicate')
    const answers = store.getAnswers()
    expect(answers).toHaveLength(1)
    expect(answers[0].verdict).toBe('pass')
  })

  it('keeps different players\' answers to the same question separate', () => {
    const p1 = store.join('A', 0)
    const p2 = store.join('B', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    store.recordAnswer({ playerId: p1.id, questionId: Q0.id, verdict: 'pass' }, 1500)
    store.recordAnswer({ playerId: p2.id, questionId: Q0.id, verdict: 'reject' }, 1500)
    expect(store.getAnswers()).toHaveLength(2)
  })

  it('resets', () => {
    store.join('D', 0)
    store.reset()
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
  })

  it('mutating a returned player does not affect subsequent getPlayers() calls', () => {
    store.join('Detective Ramen', 0)
    const players = store.getPlayers()
    players[0].codename = 'Hacked'
    expect(store.getPlayers()[0].codename).toBe('Detective Ramen')
  })

  it('mutating a returned answer does not affect subsequent getAnswers() calls', () => {
    const p = store.join('D', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    store.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'pass' }, 1500)
    const answers = store.getAnswers()
    answers[0].verdict = 'reject'
    expect(store.getAnswers()[0].verdict).toBe('pass')
  })
})

describe('store game state', () => {
  it('starts in lobby; a lobby joiner is not a spectator', () => {
    const s = new MemoryRoomStore()
    expect(s.getGameState().phase).toBe('lobby')
    const p = s.join('Alice', 1000)
    expect(p.spectator).toBe(false)
    expect(s.getSeq()).toBeGreaterThan(0)
  })

  // v3.2: START opens the RULES screen, not question 0's reading beat. It is untimed
  // (`phaseDurationMs: 0`) — the host presses Next when the room looks done reading, and no clock
  // can drag them off it. The reading beat is one press further on.
  it('startGame opens the untimed rules screen, and joining on it still scores', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 1000)
    s.startGame(2000)
    expect(s.getGameState().phase).toBe('rules')
    expect(s.getGameState().phaseDurationMs).toBe(0)
    expect(s.getGameState().qIndex).toBe(0)

    /* The rules screen is pre-game: it is there so the room can get ready, and no question has
     * been asked yet. Someone still typing their codename when the host pressed Start must not be
     * punished for it. The cut-off is the first `reading`, not the host's first press. */
    const onRules = s.join('Bob', 3000)
    expect(onRules.spectator).toBe(false)

    // No clock: a tick an hour later leaves the room exactly where the host left it.
    expect(s.tick(2000 + 60 * 60 * 1000)).toBe(false)
    expect(s.getGameState().phase).toBe('rules')

    // One press, and the reading beat for question 0 begins.
    s.next(3000)
    expect(s.getGameState().phase).toBe('reading')
    expect(s.getGameState().qIndex).toBe(0)

    // The other side of the cut-off — without this the assertion above would also pass if
    // `spectator` were simply hard-wired to false for everyone.
    expect(s.join('Carol', 4000).spectator).toBe(true)
  })

  it('recordAnswer server-stamps elapsedMs and is first-wins', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    expect(s.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'pass' }, 4000)).toBe('ok')
    const a = s.getAnswers()[0]
    expect(a.elapsedMs).toBe(3000) // 4000 − phaseStartedAt(1000)
    // second answer for same question is ignored (first-wins), returns 'duplicate'
    expect(s.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'reject' }, 5000)).toBe('duplicate')
    expect(s.getAnswers()).toHaveLength(1)
    expect(s.getAnswers()[0].verdict).toBe('pass')
  })

  /*
   * `you` is how the phone learns it was ejected. Its ABSENCE is the signal, so these three
   * cases are the whole contract:
   *
   *   - a known player gets `you`
   *   - a stale id (host reset since this phone joined) gets NO `you` -> the poll sends it back
   *     to the join screen, instead of it discovering the ejection on a tap, mid-round
   *   - a SPECTATOR gets `you`. Spectators are known players who never score. If presence were
   *     derived from the active set they would be ejected once per second, forever.
   */
  it('getPublicState reports player presence via `you`: known yes, stale no, spectator yes', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    startToReading(s, 1000) // past the rules screen: only now does a joiner become a spectator
    const spec = s.join('Late', 1500)

    const you = s.getPublicState(2000, p.id).you
    expect(you).toMatchObject({ codename: 'Alice', spectator: false, score: 0, rank: 1, streak: 0, wrongPass: 0 })
    expect(you?.avatar).toBeTruthy()

    const specYou = s.getPublicState(2000, spec.id).you
    // A spectator is excluded from the leaderboard entirely, so rank/score/wrongPass fall back to 0.
    expect(specYou).toMatchObject({ codename: 'Late', spectator: true, score: 0, rank: 0, streak: 0, wrongPass: 0 })
    expect(specYou?.avatar).toBeTruthy()

    expect(s.getPublicState(2000, 'nobody').you).toBeUndefined()

    // Absent, not `false`: `youAnswered` is already false for an unknown player, so it cannot
    // carry this signal. Only `you` distinguishes "ejected" from "has not answered yet".
    expect(s.getPublicState(2000, 'nobody').youAnswered).toBe(false)

    // A reset forgets every player, so the id this phone is still holding goes unknown.
    s.reset()
    expect(s.getPublicState(3000, p.id).you).toBeUndefined()
  })

  it('recordAnswer rejects unknown player, spectator, and a question the room is not on', () => {
    const s = new MemoryRoomStore()
    const p = s.join('Alice', 0)
    // The window must be OPEN for the three rejections below to mean anything: off `question`
    // every one of them returns 'closed' for the phase, and the test would stop discriminating.
    startToQuestion(s, 1000)
    expect(s.recordAnswer({ playerId: 'nope', questionId: Q0.id, verdict: 'pass' }, 2000)).toBe('unknown')
    const spec = s.join('Late', 1500)
    expect(s.recordAnswer({ playerId: spec.id, questionId: Q0.id, verdict: 'pass' }, 2000)).toBe('spectator')
    // Q1, not the current question (qIndex 0) → closed
    expect(s.recordAnswer({ playerId: p.id, questionId: Q1.id, verdict: 'pass' }, 2000)).toBe('closed')
  })

  it('tick flips question→reveal on timeout and persists only then', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    const before = s.getSeq()
    expect(s.tick(2000)).toBe(false)                  // still time left
    expect(s.getGameState().phase).toBe('question')
    expect(s.getSeq()).toBe(before)                   // a no-op tick must not persist
    expect(s.tick(1000 + QUESTION_MS + 1)).toBe(true) // timed out → flip
    expect(s.getGameState().phase).toBe('reveal')
    expect(s.getSeq()).toBeGreaterThan(before)         // a real advance does persist
  })

  it('tick flips early when all active players answered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    const b = s.join('Bob', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    s.recordAnswer({ playerId: a.id, questionId: Q0.id, verdict: 'pass' }, 1100)
    expect(s.tick(1200)).toBe(false)                  // Bob hasn't answered
    s.recordAnswer({ playerId: b.id, questionId: Q0.id, verdict: 'pass' }, 1300)
    expect(s.tick(1400)).toBe(true)                   // all active answered → flip
    expect(s.getGameState().phase).toBe('reveal')
  })

  // Unlike v2 — where only the host's `nextRound` moved a room past `reveal` — v3's reveal
  // AUTO-ADVANCES after REVEAL_MS. `tick` is the only thing that runs on every `/api/state` poll,
  // so it has to drive that clock too, not just the question timeout.
  /* The reveal used to auto-advance after REVEAL_MS. It does not any more — it is a host press,
     like the rules screen, so a host explaining a case cannot be cut off mid-sentence by a clock.
     Asserted with a tick an hour later, which is the shape that catches a clock being restored. */
  it('never ticks a reveal forward — only a host press leaves it', () => {
    const s = new MemoryRoomStore()
    s.join('A', 0)
    startToQuestion(s, 1000)
    s.next(1000 + QUESTION_MS + NEXT_GUARD_MS)
    expect(s.getGameState().phase).toBe('reveal')

    expect(s.tick(1000 + 60 * 60 * 1000)).toBe(false)
    expect(s.getGameState().phase).toBe('reveal')
  })

  it('next is a no-op in the lobby — startGame is the only way out', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    const before = s.getSeq()
    s.next(500)
    expect(s.getGameState().phase).toBe('lobby')
    expect(s.getSeq()).toBe(before)
  })

  // The host's forward button: it ends the CURRENT phase immediately, on the host's word, without
  // waiting out the timer or the room finishing. In v2 this required two separate methods
  // (`revealNow` during investigate, `nextRound` during reveal) because reveal never auto-advanced;
  // v3 collapses both into one `next`, because the phase machine itself (`nextState`) now knows
  // what comes after any phase.
  it('next ends the current phase immediately, without waiting for the timer or answers', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    const before = s.getSeq()
    s.next(2000) // long before QUESTION_MS elapses, and nobody has answered
    expect(s.getGameState().phase).toBe('reveal')
    expect(s.getGameState().qIndex).toBe(0) // the SAME question — advancing does not skip the teaching beat
    expect(s.getSeq()).toBeGreaterThan(before)
  })

  // THE SERVER-SIDE DOUBLE-TAP GUARD (spec §3's ruling on the universal `next`). The client-side
  // disabled button in app/tv/page.tsx is feedback only — a refresh, a second /tv tab, or a slow
  // POST all defeat per-tab React state, so the guarantee has to live here. A guarded press must be
  // a TRUE no-op: no seq bump, no persist, exactly like hold's no-op path.
  it('ignores a second next within NEXT_GUARD_MS of the first, then accepts one after the window', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    const before = s.getSeq()

    s.next(2000) // question -> reveal
    expect(s.getGameState().phase).toBe('reveal')
    const afterFirst = s.getSeq()
    expect(afterFirst).toBeGreaterThan(before)

    s.next(2000 + NEXT_GUARD_MS - 1) // the double-tap, still inside the window
    expect(s.getGameState().phase).toBe('reveal') // unchanged — did NOT advance to the next question
    expect(s.getSeq()).toBe(afterFirst) // unchanged — a true no-op, not just a same-effect call

    s.next(2000 + NEXT_GUARD_MS + 1) // past the window
    expect(s.getGameState().phase).not.toBe('reveal') // the delayed press finally lands
    expect(s.getSeq()).toBeGreaterThan(afterFirst)
  })

  it('next walks the whole machine to podium and is a no-op there, so a double-tap cannot skip past it', () => {
    const s = new MemoryRoomStore()
    s.join('Alice', 0)
    s.startGame(1000)
    let guard = 0
    while (s.getGameState().phase !== 'podium' && guard < 40) {
      s.next(2000 + guard * 1000)
      guard++
    }
    expect(s.getGameState().phase).toBe('podium')
    const atPodium = s.getSeq()
    s.next(999_999) // the laggy-projector double-tap
    expect(s.getGameState().phase).toBe('podium')
    expect(s.getSeq()).toBe(atPodium) // nothing happened at all
  })

  it('getPublicState reports counts, remaining, and youAnswered', () => {
    const s = new MemoryRoomStore()
    const a = s.join('Alice', 0)
    s.join('Bob', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    s.recordAnswer({ playerId: a.id, questionId: Q0.id, verdict: 'pass' }, 1500)
    const pub = s.getPublicState(2000, a.id)
    expect(pub.phase).toBe('question')
    expect(pub.qIndex).toBe(0)
    expect(pub.questionId).toBe(Q0.id)
    expect(pub.playerCount).toBe(2)
    expect(pub.answeredCount).toBe(1)
    expect(pub.remainingMs).toBe(1000 + QUESTION_MS - 2000)
    expect(pub.youAnswered).toBe(true)
    expect(s.getPublicState(2000, 'nobody').youAnswered).toBe(false)
    expect(s.getPublicState(2000).youAnswered).toBeUndefined()
  })

  // Spec §5b: the phone's reveal has to survive a reload, which means correctness and points for
  // THE CURRENT QUESTION can no longer live only in the phone's own ephemeral React state — the
  // server has to know, from the recorded answer, not from what the client remembers submitting.
  it('getPublicState reports you.lastCorrect/lastPoints for the current question: right, wrong, and never answered', () => {
    const s = new MemoryRoomStore()
    const right = s.join('Right', 0)
    const wrong = s.join('Wrong', 0)
    const silent = s.join('Silent', 0)
    startToQuestion(s, 1000) // past rules and reading: the question is open at 1000
    const q = Q0
    s.recordAnswer({ playerId: right.id, questionId: q.id, verdict: q.verdict }, 1500)
    s.recordAnswer({ playerId: wrong.id, questionId: q.id, verdict: q.verdict === 'pass' ? 'reject' : 'pass' }, 1500)
    // `silent` never answers at all.

    // REVEAL-ONLY, deliberately: a player who answered early must not be able to read their own
    // correctness off /api/state before the reveal beat, even though the store already knows it
    // and `q` (currentQuestion) is non-null during `question` too.
    expect(s.getPublicState(2000, right.id).you?.lastCorrect).toBeNull()

    s.next(2000) // -> reveal (same question)

    const rightYou = s.getPublicState(3000, right.id).you
    expect(rightYou?.lastCorrect).toBe(true)
    expect(rightYou?.lastPoints).toBeGreaterThan(0)

    const wrongYou = s.getPublicState(3000, wrong.id).you
    expect(wrongYou?.lastCorrect).toBe(false)
    expect(wrongYou?.lastPoints).toBe(0)

    const silentYou = s.getPublicState(3000, silent.id).you
    // null, not false: "never answered" must not read as "answered and lost".
    expect(silentYou?.lastCorrect).toBeNull()
    expect(silentYou?.lastPoints).toBeNull()
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

describe('getSplit', () => {
  it('counts pass/reject verdicts for one question, active players only', () => {
    const store = new MemoryRoomStore()
    const a = store.join('a', 0)
    const b = store.join('b', 0)
    const c = store.join('c', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    store.recordAnswer({ playerId: a.id, questionId: Q0.id, verdict: 'pass' }, 1000)
    store.recordAnswer({ playerId: b.id, questionId: Q0.id, verdict: 'pass' }, 1000)
    store.recordAnswer({ playerId: c.id, questionId: Q0.id, verdict: 'reject' }, 1000)
    expect(store.getSplit(Q0.id)).toEqual({ pass: 2, reject: 1 })
  })

  it('excludes spectators from the split', () => {
    const store = new MemoryRoomStore()
    const a = store.join('a', 0)
    startToQuestion(store, 1000) // past rules and reading: the question is open at 1000
    const spec = store.join('late', 1500) // joins after start -> spectator
    store.recordAnswer({ playerId: a.id, questionId: Q0.id, verdict: 'pass' }, 1500)
    expect(store.recordAnswer({ playerId: spec.id, questionId: Q0.id, verdict: 'reject' }, 1500)).toBe('spectator')
    expect(store.getSplit(Q0.id)).toEqual({ pass: 1, reject: 0 })
  })
})

describe('MemoryRoomStore persistence', () => {
  let dir: string
  let persistPath: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'room-store-test-'))
    persistPath = join(dir, '.room-state.json')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('starts empty and stays usable when the file has valid JSON of the wrong shape', () => {
    writeFileSync(persistPath, JSON.stringify({ players: 'oops', answers: null }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
    expect(store.getGameState().phase).toBe('lobby')
    expect(store.getSeq()).toBe(0)
    // Must not throw — the wedged-singleton bug.
    const p = store.join('Detective Ramen', 0)
    expect(store.getPlayers()).toHaveLength(1)
    expect(p.codename).toBe('Detective Ramen')
  })

  it('starts empty when the file is malformed JSON', () => {
    writeFileSync(persistPath, '{not json', 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getAnswers()).toHaveLength(0)
    expect(() => store.join('D', 0)).not.toThrow()
  })

  /**
   * This is the exact hazard sitting in the repo's real, gitignored `.room-state.json` right now
   * (see task-5-brief.md): a v2 snapshot whose `phase` value ("lobby") is STILL a member of the
   * new phase set. A loader that validates only `phase` would accept it and hand the app a
   * GameState with `qIndex` and `holding` both `undefined`, and a Player with no `avatar`.
   * "Reject" has to mean the WHOLE snapshot degrades to LOBBY_STATE with no players — not a
   * half-loaded room.
   */
  it('rejects a stale v2 snapshot instead of half-loading it', () => {
    writeFileSync(persistPath, JSON.stringify({
      players: [{ id: 'a6d8cf2e-0b9d-43a0-8376-147b88fdf045', codename: 'นักสืบราเมง', joinedAt: 1787036715248, spectator: false }],
      answers: [],
      game: { phase: 'lobby', roundIndex: 0, phaseStartedAt: 0, phaseDurationMs: 0 },
      seq: 18,
    }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(0)
    expect(store.getGameState()).toEqual(LOBBY_STATE)
    expect(store.getSeq()).toBe(0)
  })

  /**
   * `qIndex` is attacker-adjacent input: it comes straight off disk and both `currentQuestion`
   * and `currentActIndex` index `QUESTIONS_IN_ORDER` with it, but only `currentQuestion` guards
   * with `?? null`. A hand-edited or corrupted snapshot with an out-of-range `qIndex` has to be
   * caught on load, not downstream in a reader that assumes the file is trustworthy.
   */
  it('rejects a snapshot whose qIndex is out of range for QUESTIONS_IN_ORDER', () => {
    writeFileSync(persistPath, JSON.stringify({
      players: [],
      answers: [],
      game: { phase: 'question', qIndex: 999, phaseStartedAt: 0, phaseDurationMs: QUESTION_MS, holding: false },
      seq: 1,
    }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getGameState()).toEqual(LOBBY_STATE)
  })

  it('skips answer entries missing playerId/questionId instead of crashing', () => {
    writeFileSync(persistPath, JSON.stringify({
      players: [{ id: '1', codename: 'A', joinedAt: 1, spectator: false, avatar: '🕵️' }],
      answers: [
        { playerId: '1', questionId: Q0.id, verdict: 'pass', elapsedMs: 1 },
        { questionId: Q0.id, verdict: 'pass', elapsedMs: 1 },
        { playerId: '1', verdict: 'pass', elapsedMs: 1 },
      ],
      game: LOBBY_STATE,
      seq: 1,
    }), 'utf8')
    const store = new MemoryRoomStore(persistPath)
    expect(store.getPlayers()).toHaveLength(1)
    expect(store.getAnswers()).toHaveLength(1)
  })

  it('round-trips a valid snapshot: persist, then a new store from the same path recovers it', () => {
    const store1 = new MemoryRoomStore(persistPath)
    const p = store1.join('Detective Ramen', 0)
    startToQuestion(store1, 1000) // past rules and reading: the question is open at 1000
    store1.recordAnswer({ playerId: p.id, questionId: Q0.id, verdict: 'pass' }, 1500)

    const store2 = new MemoryRoomStore(persistPath)
    expect(store2.getPlayers()).toHaveLength(1)
    expect(store2.getPlayers()[0].codename).toBe('Detective Ramen')
    expect(store2.getPlayers()[0].avatar).toBeTruthy()
    expect(store2.getAnswers()).toHaveLength(1)
    expect(store2.getAnswers()[0].verdict).toBe('pass')
    expect(store2.getGameState().phase).toBe('question')
    expect(store2.getSeq()).toBe(store1.getSeq())
  })

  // `validPhases` (isValidGameState's gate) has to know about 'reading' too, or a room persisted
  // mid-beat is rejected on the next load and the whole room — not just the phase — resets to
  // LOBBY_STATE with no players, per isValidSnapshot's all-or-nothing rule above.
  it('round-trips a snapshot persisted while the room is still reading', () => {
    const store1 = new MemoryRoomStore(persistPath)
    store1.join('Detective Ramen', 0)
    startToReading(store1, 1000)
    expect(store1.getGameState().phase).toBe('reading')

    const store2 = new MemoryRoomStore(persistPath)
    expect(store2.getPlayers()).toHaveLength(1)
    expect(store2.getGameState().phase).toBe('reading')
    expect(store2.getGameState().qIndex).toBe(0)
  })

  // Same gate, the v3.2 phase: the rules screen is untimed and host-advanced, so it is the phase a
  // room is MOST likely to be sitting on when a server restarts — nothing moves it on its own. If
  // `validPhases` did not know it, that reload would take the whole snapshot down (isValidSnapshot
  // is all-or-nothing) and the room would come back empty, in the lobby, mid-workshop.
  it('round-trips a snapshot persisted while the room is on the rules screen', () => {
    const store1 = new MemoryRoomStore(persistPath)
    store1.join('Detective Ramen', 0)
    store1.startGame(1000)
    expect(store1.getGameState().phase).toBe('rules')

    const store2 = new MemoryRoomStore(persistPath)
    expect(store2.getPlayers()).toHaveLength(1)
    expect(store2.getGameState().phase).toBe('rules')
  })

  it('writes atomically: no leftover temp file after a successful persist', () => {
    const store = new MemoryRoomStore(persistPath)
    store.join('D', 0)
    expect(existsSync(persistPath)).toBe(true)
    const contents = JSON.parse(readFileSync(persistPath, 'utf8'))
    expect(contents.players).toHaveLength(1)
    const leftovers = readdirSync(dir).filter((f) => f.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })
})

const T0 = 2_000_000

/**
 * Drive a store to the question at `qIndex` with `n` players joined in the lobby.
 *
 * Each `next()` call is spaced by more than `NEXT_GUARD_MS` — `MemoryRoomStore#next` now ignores a
 * press that arrives inside that window of the previous successful one (the double-tap guard), so
 * three same-instant calls at `T0` would silently collapse into one and strand this helper on the
 * wrong question. The guard itself gets its own direct test below; this is just not tripping it.
 *
 * The opening reading beat is cleared with `tick`, not `next`: several callers of `roomAt` press
 * `next(T0)` themselves right after, to advance the question this helper lands on (e.g. `hold`'s
 * tests). A `next()` here would arm `lastNextAt` at `T0` and silently swallow that caller's own
 * `next(T0)` as a double-tap. `tick` drives the SAME clock-expiry path a real client's poll would,
 * and never touches `lastNextAt`.
 *
 * The v3.2 rules screen cannot be cleared that way — it is untimed, so no `tick` ever expires it
 * and only a host press moves it. That press is therefore dated NEXT_STEP_MS BEFORE `T0`, which
 * leaves `lastNextAt` far enough in the past that a caller's own `next(T0)` still lands.
 */
const NEXT_STEP_MS = NEXT_GUARD_MS + 1
function roomAt(qIndex: number, n = 3) {
  const store = new MemoryRoomStore()
  const players = Array.from({ length: n }, (_, i) => store.join(`p${i}`, T0))
  store.startGame(T0 - NEXT_STEP_MS)
  store.next(T0 - NEXT_STEP_MS) // rules -> reading, the one press no clock can make for the host
  store.tick(T0 + READING_MS) // reading -> question 0, on the reading clock, not the host's button
  let t = T0
  for (let i = 0; i < qIndex; i++) {
    t += NEXT_STEP_MS
    store.next(t) // question -> reveal
    t += NEXT_STEP_MS
    store.next(t) // reveal -> reading (there is no act card between cases any more)
    if (store.getGameState().phase === 'reading') { t += NEXT_STEP_MS; store.next(t) } // reading -> next question
  }
  return { store, players }
}

describe('recordAnswer', () => {
  it('accepts a verdict for the current question and is first-wins', () => {
    const { store, players } = roomAt(0)
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'pass' }, T0 + 500)).toBe('ok')
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'reject' }, T0 + 900)).toBe('duplicate')
    expect(store.getAnswers()[0].verdict).toBe('pass')
  })

  it('refuses an answer for a question the room has moved past', () => {
    const { store, players } = roomAt(1)
    const stale = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: players[0].id, questionId: stale.id, verdict: 'pass' }, T0)).toBe('closed')
  })

  it('refuses answers outside the question phase', () => {
    const { store, players } = roomAt(0)
    const q = QUESTIONS_IN_ORDER[0]
    store.next(T0) // -> reveal
    expect(store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: 'pass' }, T0)).toBe('closed')
  })
})

describe('the room tally', () => {
  it('counts only approvals of answers that should have been rejected', () => {
    const store = new MemoryRoomStore()
    const a = store.join('a', T0)
    const b = store.join('b', T0)
    startToQuestion(store, T0) // past rules and reading: the question is open at T0
    let t = T0
    for (const q of QUESTIONS_IN_ORDER) {
      store.recordAnswer({ playerId: a.id, questionId: q.id, verdict: 'pass' }, t)   // approves everything
      store.recordAnswer({ playerId: b.id, questionId: q.id, verdict: 'reject' }, t) // rejects everything
      // Spaced past NEXT_GUARD_MS each call — see roomAt's comment on why same-instant next()
      // calls would collapse under the double-tap guard.
      t += NEXT_STEP_MS
      store.next(t) // question -> reveal
      t += NEXT_STEP_MS
      store.next(t) // reveal -> reading, or (on the last question) tally
      // On every question but the last, that landed on 'reading' — clear it for the next iteration.
      // On the last question it lands on 'tally' instead, and there is no reading beat to clear.
      if (store.getGameState().phase === 'reading') { t += NEXT_STEP_MS; store.next(t) } // reading -> question
    }
    const rejects = QUESTIONS_IN_ORDER.filter((q) => q.verdict === 'reject').length
    // player a contributes one wrongPass per reject question; player b contributes none
    expect(store.getRoomWrongPass()).toBe(rejects)
  })
})

describe('the leaderboard', () => {
  it('ranks by score and carries the avatar', () => {
    const { store, players } = roomAt(0, 2)
    const q = QUESTIONS_IN_ORDER[0]
    store.recordAnswer({ playerId: players[0].id, questionId: q.id, verdict: q.verdict }, T0)
    store.recordAnswer({ playerId: players[1].id, questionId: q.id, verdict: q.verdict === 'pass' ? 'reject' : 'pass' }, T0)
    const board = store.getLeaderboard()
    expect(board[0].playerId).toBe(players[0].id)
    expect(board[0].rank).toBe(1)
    expect(board[1].rank).toBe(2)
    expect(board[0].avatar).toBeTruthy()
  })

  it('breaks ties by codename so the board does not reshuffle between polls', () => {
    const store = new MemoryRoomStore()
    const zebra = store.join('Zebra', T0)
    const alpha = store.join('Alpha', T0)
    store.startGame(T0)
    // Neither answers anything — both score 0, a tie.
    const board1 = store.getLeaderboard().map((r) => r.playerId)
    const board2 = store.getLeaderboard().map((r) => r.playerId)
    expect(board1).toEqual([alpha.id, zebra.id])
    expect(board2).toEqual(board1) // stable across polls, not just within one call
  })
})


/*
 * The rules screen is untimed and host-advanced, which makes it the LONGEST window in the game
 * where a phone is showing something and the answer buttons must not work — a crafted POST has
 * thirty seconds or more to arrive. `recordAnswer`'s existing `phase !== 'question'` guard covers
 * it, and that is the point: the phase is what closes the window, so a new phase is closed by
 * construction. This is the test that says so rather than assuming it.
 */
describe('the rules screen is closed to answers', () => {
  it('refuses an answer while the rules screen is up', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    store.startGame(T0)
    expect(store.getGameState().phase).toBe('rules')

    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: q.verdict }, T0 + 1)).toBe('closed')
    expect(store.getAnswers()).toHaveLength(0)
    // Nothing banked, either — a refused answer must not reach the score by another door.
    expect(store.getLeaderboard()[0].score).toBe(0)
  })

  it('accepts the same answer two presses later, so the refusal was the phase and nothing else', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    startToQuestion(store, T0)

    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: q.verdict }, T0)).toBe('ok')
  })
})

describe('duplicate codenames', () => {
  /*
   * Two people typing `เป็ดทอง` cost nothing in score — players are keyed by a generated id — and
   * break everything the room SEES: two identical lobby cards, two identical leaderboard rows, an
   * unresolvable podium. The room is the reason this rule exists, so the assertions are about what
   * the room can tell apart.
   */
  it('suffixes the second and third of a repeated codename, Kahoot-style', () => {
    const store = new MemoryRoomStore()
    expect(store.join('เป็ดทอง', 0).codename).toBe('เป็ดทอง')
    expect(store.join('เป็ดทอง', 1).codename).toBe('เป็ดทอง 2')
    expect(store.join('เป็ดทอง', 2).codename).toBe('เป็ดทอง 3')
    expect(new Set(store.getPlayers().map((p) => p.codename)).size).toBe(3)
  })

  it('decides it inside join(), where two phones in the same second are both visible', () => {
    // The route trims and truncates and does nothing else, deliberately: a check up there reads
    // the player list and pushes in two separate steps, so two simultaneous POSTs can both read
    // "free" and both push. This is the store's own contract, exercised the way the race would
    // arrive — same name, same instant, no route in between.
    const store = new MemoryRoomStore()
    const a = store.join('เป็ดทอง', 1000)
    const b = store.join('เป็ดทอง', 1000)
    expect(a.codename).not.toBe(b.codename)
    expect(a.id).not.toBe(b.id)
  })

  it('matches on the trimmed string, and stores the trimmed string', () => {
    const store = new MemoryRoomStore()
    store.join('  เป็ดทอง  ', 0)
    expect(store.getPlayers()[0].codename).toBe('เป็ดทอง')
    // Untrimmed, this would read as a second identical card on the board — two names that differ
    // only by whitespace are the same name to everyone looking at the projector.
    expect(store.join('เป็ดทอง', 1).codename).toBe('เป็ดทอง 2')
  })

  it('never hands out a name someone typed for themselves', () => {
    // Someone who literally types `เป็ดทอง 2` into a room that already has one gets
    // `เป็ดทอง 2 2`. Ugly, and correct: the base is exactly what they typed, so the tidier rule —
    // strip a trailing number, re-suffix — cannot turn a second `Agent 007` into `Agent 8`.
    const store = new MemoryRoomStore()
    store.join('เป็ดทอง', 0)
    store.join('เป็ดทอง', 1)
    const typed = store.join('เป็ดทอง 2', 2)
    expect(typed.codename).not.toBe('เป็ดทอง 2') // that one is taken, by the auto-suffix above
    expect(typed.codename).toBe('เป็ดทอง 2 2')
    expect(store.join('Agent 007', 3).codename).toBe('Agent 007')
    expect(store.join('Agent 007', 4).codename).toBe('Agent 007 2') // not `Agent 8`
  })

  it('leaves a codename that merely looks similar alone', () => {
    const store = new MemoryRoomStore()
    store.join('เป็ดทอง', 0)
    expect(store.join('เป็ดเงิน', 1).codename).toBe('เป็ดเงิน')
    expect(store.join('เป็ดทองคำ', 2).codename).toBe('เป็ดทองคำ')
  })

  it('counts spectators as holding a name', () => {
    // A spectator's card is on the projector's room list like anyone else's, so a repeat there is
    // exactly as confusing as one on the board.
    const store = new MemoryRoomStore()
    startToReading(store, 0) // past the rules screen: everyone from here on is a spectator
    const first = store.join('เป็ดทอง', 1)
    expect(first.spectator).toBe(true)
    expect(store.join('เป็ดทอง', 2).codename).toBe('เป็ดทอง 2')
  })
})

/*
 * DEALING A NAME FROM THE POOL — what the 🎲 button asks for, via GET /api/codename.
 *
 * The point of dealing rather than drawing is arithmetic: 100 phones drawing INDEPENDENTLY from
 * 150 names produce only ~73 distinct ones, so about 27 people end up on the projector under a
 * numbered name. Dealt from pool-minus-taken, a full room gets a full room of different names.
 */
describe('dealCodename', () => {
  it('deals a name from the pool', () => {
    const store = new MemoryRoomStore()
    expect(codenamePool('th')).toContain(store.dealCodename())
  })

  it('never deals a name the room already holds, so a dealt room needs no suffixes', () => {
    const store = new MemoryRoomStore()
    for (let i = 0; i < 40; i++) store.join(store.dealCodename(), i)
    const names = store.getPlayers().map((p) => p.codename)
    expect(new Set(names).size).toBe(40)
    expect(names.filter((n) => / \d+$/.test(n))).toEqual([])
  })

  it('counts spectators as holding a name', () => {
    // Same rule as `uniqueCodename`: a spectator's card is on the room's own lists, and a repeat
    // there is exactly as confusing as one on the leaderboard. `activePlayers()` would miss this,
    // and a lobby-sized test would never notice — nobody is a spectator in a lobby.
    const store = new MemoryRoomStore()
    startToReading(store, 0) // past the rules screen: everyone from here on joins as a spectator
    const taken = store.dealCodename()
    expect(store.join(taken, 1).spectator).toBe(true)
    const next = Array.from({ length: 30 }, () => store.dealCodename())
    expect(next).not.toContain(taken)
  })

  it('picks uniformly from the free names rather than off the front of the list', () => {
    // Nothing joins between these draws, so all 60 come from the same 150. Taking the head of the
    // list would name the first twenty players after Thai food in group order, which reads as a
    // broken room rather than a themed one.
    const store = new MemoryRoomStore()
    const firstGroup = new Set(codenamePool('th').slice(0, 15))
    const deals = Array.from({ length: 60 }, () => store.dealCodename())
    expect(deals.some((c) => !firstGroup.has(c))).toBe(true)
  })

  it('falls back to a plain random draw once the pool is exhausted, and never blocks a join', () => {
    // Player 151. The pool is empty, so the deal is a plain draw and `uniqueCodename` suffixes it
    // on join — the pre-pool behaviour, paid for only by a room 50% larger than the largest one
    // this workshop plans for. It must not throw and must not refuse anyone entry.
    const store = new MemoryRoomStore()
    const pool = codenamePool('th')
    pool.forEach((name, i) => store.join(name, i))
    expect(store.getPlayers()).toHaveLength(150)

    const dealt = store.dealCodename()
    expect(pool).toContain(dealt)
    const player = store.join(dealt, 151)
    expect(player.codename).toBe(`${dealt} 2`)
    // ...and player 151 still gets the FACE that belongs to the name, not a fallback prop.
    expect(player.avatar).toBe(emojiFor(dealt))
  })
})

/*
 * `rank` and `gapToNext` — the phone's reveal line. Both are derived from `getLeaderboard()` on
 * every read; the store keeps nothing extra for them.
 */
describe('you.rank and you.gapToNext', () => {
  /** Three players on three different scores: 109, 105, 0.
   *  The top score moved from 110 when `MAX_SPEED_BONUS` went 10 -> 9 to keep the speed invariant
   *  clear at ten cases (lib/scoring.ts). The SHAPE is what this fixture is for — three distinct
   *  scores, one of them zero — and that is unchanged. */
  function threeWayRoom() {
    const store = new MemoryRoomStore()
    const ann = store.join('Ann', T0)
    const bee = store.join('Bee', T0)
    const cid = store.join('Cid', T0)
    startToQuestion(store, T0)
    const q = QUESTIONS_IN_ORDER[0]
    const wrong = q.verdict === 'pass' ? 'reject' : 'pass'
    store.recordAnswer({ playerId: ann.id, questionId: q.id, verdict: q.verdict }, T0)              // 100 + 9
    store.recordAnswer({ playerId: bee.id, questionId: q.id, verdict: q.verdict }, T0 + QUESTION_MS / 2) // 100 + 5
    store.recordAnswer({ playerId: cid.id, questionId: q.id, verdict: wrong }, T0 + 1)              // 0
    return { store, ann, bee, cid }
  }

  /* One in three of this room got it wrong. The phone shows that so a player can see they were
   * not the only one fooled — and the server has to compute it, because which side is wrong is
   * the answer key and app/page.tsx is a client component. */
  it('reports what share of the room got the current question wrong', () => {
    const { store } = threeWayRoom()
    store.next(T0 + QUESTION_MS + 1) // into reveal
    expect(store.getGameState().phase).toBe('reveal')
    // Ann and Bee right, Cid wrong -> 1 of 3 -> 33%
    expect(store.getPublicState(T0 + QUESTION_MS + 2, store.getPlayers()[0].id).you?.roomWrongPct).toBe(33)
  })

  it('withholds the room share until the reveal, so an early answerer cannot read the room', () => {
    const { store, ann } = threeWayRoom()
    expect(store.getGameState().phase).toBe('question')
    expect(store.getPublicState(T0 + 1, ann.id).you).not.toHaveProperty('roomWrongPct')
  })

  // 0% wrong and nobody-answered are different facts; a 0 here would render as the first.
  it('omits the room share entirely when nobody answered', () => {
    const store = new MemoryRoomStore()
    const solo = store.join('Solo', T0)
    startToQuestion(store, T0)
    store.next(T0 + QUESTION_MS + 1)
    expect(store.getGameState().phase).toBe('reveal')
    expect(store.getPublicState(T0 + QUESTION_MS + 2, solo.id).you).not.toHaveProperty('roomWrongPct')
  })

  it('reports the player their own position in the leaderboard', () => {
    const { store, ann, bee, cid } = threeWayRoom()
    const board = store.getLeaderboard()
    expect(board.map((r) => r.codename)).toEqual(['Ann', 'Bee', 'Cid']) // 109, 105, 0

    for (const p of [ann, bee, cid]) {
      const you = store.getPublicState(T0 + 1000, p.id).you
      const index = board.findIndex((r) => r.playerId === p.id)
      expect(you?.rank, p.codename).toBe(index + 1)
    }
  })

  it('reports the gap to the player immediately above', () => {
    const { store, bee, cid } = threeWayRoom()
    const board = store.getLeaderboard()

    const youBee = store.getPublicState(T0 + 1000, bee.id).you
    expect(youBee?.gapToNext).toBe(board[0].score - board[1].score) // 109 − 105
    expect(youBee?.gapToNext).toBe(4) // pinned, so a leaderboard that changed underneath is red

    const youCid = store.getPublicState(T0 + 1000, cid.id).you
    expect(youCid?.gapToNext).toBe(board[1].score - board[2].score) // 105 − 0
    expect(youCid?.gapToNext).toBe(105)
  })

  it('sends no gap to the leader — absent, not zero', () => {
    const { store, ann } = threeWayRoom()
    const you = store.getPublicState(T0 + 1000, ann.id).you
    expect(you?.rank).toBe(1)
    // `not.toHaveProperty` and not `toBeUndefined`: `gapToNext: undefined` would still be a key
    // on the object, and `'gapToNext' in you` is the check a caller reaches for.
    expect(you).not.toHaveProperty('gapToNext')
  })

  /*
   * The reason absence has to be absence rather than 0: 0 is a REAL gap. Ranks here are positional
   * (see getLeaderboard), so two players on the same score sit at n and n+1, and the lower one is
   * genuinely zero points behind. If the leader also sent 0 the phone could not tell "you lead"
   * from "you are level with the person above you" — opposite messages, one number.
   */
  it('sends a real zero to a player level with the one above them', () => {
    const store = new MemoryRoomStore()
    const alpha = store.join('Alpha', T0)
    const zebra = store.join('Zebra', T0)
    startToQuestion(store, T0)
    // Neither answers: both on 0, and the codename tie-break puts Alpha first.
    const board = store.getLeaderboard()
    expect(board.map((r) => r.codename)).toEqual(['Alpha', 'Zebra'])
    expect(board[0].score).toBe(board[1].score)

    const youAlpha = store.getPublicState(T0 + 1000, alpha.id).you
    expect(youAlpha?.rank).toBe(1)
    expect(youAlpha).not.toHaveProperty('gapToNext')

    const youZebra = store.getPublicState(T0 + 1000, zebra.id).you
    expect(youZebra?.rank).toBe(2) // positional: a tie does NOT collapse two players onto rank 1
    expect(youZebra?.gapToNext).toBe(0)
  })

  it('gives a spectator neither a rank nor a gap', () => {
    const store = new MemoryRoomStore()
    store.join('Ann', T0)
    startToReading(store, T0) // past the rules screen, so `Late` really is a spectator
    const late = store.join('Late', T0 + 1)
    expect(late.spectator).toBe(true)

    const you = store.getPublicState(T0 + 1000, late.id).you
    expect(you?.spectator).toBe(true)
    expect(you?.rank).toBe(0) // the existing off-the-board sentinel app/page.tsx reads
    expect(you).not.toHaveProperty('gapToNext')
  })
})

describe('the reading beat is enforced by the server, not the UI', () => {
  it('refuses an answer while the room is still reading', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    startToReading(store, T0)
    expect(store.getGameState().phase).toBe('reading')
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: 'pass' }, T0 + 1)).toBe('closed')
    expect(store.getAnswers()).toHaveLength(0)
  })

  it('accepts it the instant the question opens, at full speed bonus', () => {
    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    startToReading(store, T0)
    store.next(T0 + READING_MS)
    expect(store.getGameState().phase).toBe('question')
    const q = QUESTIONS_IN_ORDER[0]
    expect(store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: q.verdict }, T0 + READING_MS)).toBe('ok')
    // elapsedMs is measured from the QUESTION's start, so an instant answer earns the whole bonus.
    expect(store.getAnswers()[0].elapsedMs).toBe(0)
  })

  /*
   * v3.2 doubled READING_MS to 10s, and the hazard that comes with a longer reading beat is that
   * the SCORING clock starts with it. `elapsedMs` is stamped from `phaseStartedAt`, so a `question`
   * that inherited the reading phase's start instead of beginning its own would hand every player
   * an elapsed of 10s before they could possibly tap — and silently shave the speed bonus for the
   * whole room (speedBonus(10_000) is 3 of a possible 10, not 10).
   *
   * The constant and the bonus are asserted together on purpose: the constant alone would go green
   * on a retune that broke the clock, and the bonus alone would not say which value it was proving.
   */
  it('does not start the scoring clock during the reading beat', () => {
    expect(READING_MS).toBe(10_000)

    const store = new MemoryRoomStore()
    const p = store.join('reader', T0)
    startToReading(store, T0)
    store.next(T0 + READING_MS) // the reading beat runs its full ten seconds
    expect(store.getGameState().phase).toBe('question')
    expect(store.getGameState().phaseStartedAt).toBe(T0 + READING_MS) // the question's OWN clock

    const q = QUESTIONS_IN_ORDER[0]
    // The first instant of the answer window, ten seconds after the room started reading.
    store.recordAnswer({ playerId: p.id, questionId: q.id, verdict: q.verdict }, T0 + READING_MS)
    expect(store.getAnswers()[0].elapsedMs).toBe(0)
    expect(store.getLeaderboard()[0].score).toBe(BASE_POINTS + MAX_SPEED_BONUS)
  })
})

/*
 * THE PER-QUESTION GAIN, which the projector used to infer and got wrong at scale.
 *
 * The standings shows `+150` beside a running total. That used to be computed on the projector by
 * diffing the board against the board it saw at the previous reveal — correct for the rank arrows,
 * wrong for this. With ten visible places and a hundred players, someone climbing into the top ten
 * from below has no previous row to subtract from, so their whole running total was rendered as
 * this question's gain: `+685` beside a total of `685`. Only a hundred-player room churns the
 * board enough to show it, which is why it survived every ten-player test.
 */
describe('leaderboard gained', () => {
  it('reports what a player scored on THIS question, not their running total', () => {
    const store = new MemoryRoomStore()
    const p = store.join('Ann', T0)
    const q0 = QUESTIONS_IN_ORDER[0]
    const q1 = QUESTIONS_IN_ORDER[1]

    startToQuestion(store, T0)
    store.recordAnswer({ playerId: p.id, questionId: q0.id, verdict: q0.verdict }, T0)
    store.next(T0 + QUESTION_MS + NEXT_STEP_MS)          // -> reveal on q0
    const afterFirst = store.getLeaderboard()[0]
    expect(afterFirst.gained).toBe(afterFirst.score)      // first question: they ARE equal

    store.next(T0 + QUESTION_MS + NEXT_STEP_MS * 2)       // -> reading q1
    const t = T0 + QUESTION_MS + NEXT_STEP_MS * 2 + READING_MS
    store.next(t)                                        // -> question q1
    store.recordAnswer({ playerId: p.id, questionId: q1.id, verdict: q1.verdict }, t)
    store.next(t + QUESTION_MS + NEXT_STEP_MS)           // -> reveal on q1

    const row = store.getLeaderboard()[0]
    // The whole point: the second question's gain is NOT the two-question total.
    expect(row.gained).toBeLessThan(row.score)
    expect(row.gained).toBe(row.score - afterFirst.score)
  })

  it('omits it for a player who did not answer this question — absence is not zero', () => {
    const store = new MemoryRoomStore()
    const p = store.join('Ann', T0)
    startToQuestion(store, T0)
    store.next(T0 + QUESTION_MS + NEXT_STEP_MS) // reveal, nobody answered
    expect(store.getLeaderboard()[0].playerId).toBe(p.id)
    expect(store.getLeaderboard()[0]).not.toHaveProperty('gained')
  })
})

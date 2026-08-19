import { describe, it, expect } from 'vitest'
import {
  ACT_COUNT, LOBBY_STATE, QUESTION_COUNT, QUESTION_MS, READING_MS, REVEAL_MS, QUESTIONS_IN_ORDER,
  currentActIndex, currentQuestion, nextState, remainingMs, rulesState, shouldExpire, startedState,
  toggleHold,
} from './game'
import type { GameState, Phase } from './types'

const T0 = 1_000_000

/** Walk the whole game with the host pressing Next on every untimed phase. */
function walk(): Phase[] {
  let s: GameState = startedState(T0)
  const seen: Phase[] = [s.phase]
  for (let i = 0; i < 100 && s.phase !== 'podium'; i++) {
    s = nextState(s, T0)
    seen.push(s.phase)
  }
  return seen
}

/** The same walk from the LOBBY — the only route through the rules screen. */
function walkFromLobby(): Phase[] {
  let s: GameState = LOBBY_STATE
  const seen: Phase[] = [s.phase]
  for (let i = 0; i < 100 && s.phase !== 'podium'; i++) {
    s = nextState(s, T0)
    seen.push(s.phase)
  }
  return seen
}

describe('the phase sequence', () => {
  it('runs 9 question/reveal pairs with an act card after every third', () => {
    const seen = walk()
    expect(seen.filter((p) => p === 'question')).toHaveLength(QUESTION_COUNT)
    expect(seen.filter((p) => p === 'reveal')).toHaveLength(QUESTION_COUNT)
    expect(seen.filter((p) => p === 'actcard')).toHaveLength(3)
    expect(seen.at(-3)).toBe('actcard')
    expect(seen.at(-2)).toBe('tally')
    expect(seen.at(-1)).toBe('podium')
  })

  it('puts the act cards after questions 3, 6 and 9 and nowhere else', () => {
    let s = startedState(T0)
    const cardAfter: number[] = []
    for (let i = 0; i < 100 && s.phase !== 'podium'; i++) {
      const prev = s
      s = nextState(s, T0)
      if (s.phase === 'actcard') cardAfter.push(prev.qIndex + 1)
    }
    expect(cardAfter).toEqual([3, 6, 9])
  })

  // The actcard trigger is `finished % QUESTIONS_PER_ACT === 0`, and QUESTIONS_PER_ACT is a plain
  // division (QUESTION_COUNT / ACT_COUNT). That only lands on clean boundaries while the content
  // divides evenly. If a future edit makes it fractional, act cards silently stop firing on the
  // right question and nothing above would notice — this is the guard for that content invariant.
  it('the question count divides evenly into acts', () => {
    expect(QUESTION_COUNT % ACT_COUNT).toBe(0)
  })

  it('is terminal at podium', () => {
    const podium = { phase: 'podium', qIndex: 8, phaseStartedAt: T0, phaseDurationMs: 0, holding: false } as GameState
    expect(nextState(podium, T0 + 5000)).toEqual(podium)
  })

  it('exposes the act index on actcard and nowhere else', () => {
    let s = startedState(T0)
    for (let i = 0; i < 100 && s.phase !== 'actcard'; i++) s = nextState(s, T0)
    expect(s.phase).toBe('actcard') // guards against the loop above silently walking past a regression
    expect(currentActIndex(s)).toBe(0)
    expect(currentActIndex(startedState(T0))).toBeNull()
  })

  it('names the current question during question and reveal only', () => {
    const q = nextState(startedState(T0), T0) // past reading, so this is 'question'
    expect(currentQuestion(q)?.id).toBe(QUESTIONS_IN_ORDER[0].id)
    expect(currentQuestion(nextState(q, T0))?.id).toBe(QUESTIONS_IN_ORDER[0].id) // reveal
    expect(currentQuestion(LOBBY_STATE)).toBeNull()
  })
})

describe('expiry', () => {
  it('ends a question on the timer', () => {
    const s = nextState(startedState(T0), T0) // past reading, so this is 'question'
    expect(shouldExpire(s, T0 + QUESTION_MS - 1, 5, 0)).toBe(false)
    expect(shouldExpire(s, T0 + QUESTION_MS, 5, 0)).toBe(true)
  })

  it('ends a question early once every active player has answered', () => {
    const s = nextState(startedState(T0), T0) // past reading, so this is 'question'
    expect(shouldExpire(s, T0 + 1, 5, 5)).toBe(true)
    expect(shouldExpire(s, T0 + 1, 5, 4)).toBe(false)
    expect(shouldExpire(s, T0 + 1, 0, 0)).toBe(false) // an empty room never auto-advances
  })

  it('auto-advances the reveal, which is what makes it feel rapid', () => {
    const reveal = nextState(nextState(startedState(T0), T0), T0) // reading -> question -> reveal
    expect(reveal.phase).toBe('reveal')
    expect(shouldExpire(reveal, T0 + REVEAL_MS, 5, 5)).toBe(true)
  })

  it('freezes the reveal while the host is holding', () => {
    const held = toggleHold(nextState(nextState(startedState(T0), T0), T0)) // reading -> question -> reveal
    expect(held.holding).toBe(true)
    expect(shouldExpire(held, T0 + REVEAL_MS * 10, 5, 5)).toBe(false)
    expect(remainingMs(held, T0 + REVEAL_MS * 10)).toBe(0)
  })

  it('never expires an untimed phase', () => {
    let s = startedState(T0)
    for (let i = 0; i < 100 && s.phase !== 'actcard'; i++) s = nextState(s, T0)
    expect(s.phase).toBe('actcard') // guards against the loop above silently walking past a regression
    expect(shouldExpire(s, T0 + 60 * 60 * 1000, 5, 5)).toBe(false)
  })

  it('only ever holds on a reveal', () => {
    expect(toggleHold(startedState(T0)).holding).toBe(false)
    expect(toggleHold(LOBBY_STATE).holding).toBe(false)
  })
})

describe('the rules screen', () => {
  it('is entered once, between the lobby and the first reading, and never again', () => {
    const seen = walkFromLobby()
    expect(seen.slice(0, 3)).toEqual(['lobby', 'rules', 'reading'])
    expect(seen.filter((p) => p === 'rules')).toHaveLength(1)
    // The walk actually FINISHED. Without this, a machine that looped `rules -> rules` (or that
    // never reached the podium for any other reason) could still satisfy the two assertions
    // above by exhausting the 100-step cap, and this test would pass on a broken game.
    expect(seen.at(-1)).toBe('podium')
    // ...and the nine reading beats are all still there: the rules screen was inserted in front
    // of the game, not in place of the first one.
    expect(seen.filter((p) => p === 'reading')).toHaveLength(QUESTION_COUNT)
  })

  it('has no countdown — only the host moves it', () => {
    const rules = rulesState(T0)
    expect(rules.phaseDurationMs).toBe(0)
    expect(remainingMs(rules, T0 + 60 * 60 * 1000)).toBe(0)
    // Not even a full room that has somehow "answered" can expire it: `shouldExpire`'s
    // all-answered early exit belongs to `question` alone.
    expect(shouldExpire(rules, T0 + 60 * 60 * 1000, 100, 100)).toBe(false)
  })

  it('advances to the reading beat for question 0, on the reading clock', () => {
    const after = nextState(rulesState(T0), T0)
    expect(after.phase).toBe('reading')
    expect(after.qIndex).toBe(0)
    expect(after.phaseDurationMs).toBe(READING_MS)
    expect(after.phaseStartedAt).toBe(T0) // the reading clock starts on the press, not at start-up
  })

  it('shows no question of its own — the room is reading rules, not evidence', () => {
    expect(currentQuestion(rulesState(T0))).toBeNull()
    expect(currentActIndex(rulesState(T0))).toBeNull()
  })
})

describe('the reading beat', () => {
  // The room reads a question line and a duck sentence in it; five seconds was enough to READ
  // both and not enough to think about either, which is the only thing the beat buys.
  it('is ten seconds long', () => {
    expect(READING_MS).toBe(10_000)
  })

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

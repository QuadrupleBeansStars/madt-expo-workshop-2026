import { describe, it, expect } from 'vitest'
import {
  LOBBY_STATE, QUESTION_COUNT, QUESTION_MS, READING_MS, QUESTIONS_IN_ORDER, currentQuestion, nextState, remainingMs, rulesState, shouldExpire, startedState, tutorialState,
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

/** The same walk from the LOBBY — the only route through the rules screen and the tutorial. */
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
  /* Nine question/reveal pairs and nothing between them. An act card used to close every third
     question; the team cut it, so the room goes question -> reveal -> next question with no fourth
     screen in the way. `seen` carrying no other phase kind is the assertion that keeps a new one
     from being slipped in unnoticed. */
  it('runs 9 question/reveal pairs and goes straight from one case to the next', () => {
    const seen = walk()
    expect(seen.filter((p) => p === 'question')).toHaveLength(QUESTION_COUNT)
    expect(seen.filter((p) => p === 'reveal')).toHaveLength(QUESTION_COUNT)
    // `walk()` starts from `startedState`, which is already past the rules screen.
    expect(new Set(seen)).toEqual(new Set(['reading', 'question', 'reveal', 'tally', 'podium']))
    expect(seen.at(-2)).toBe('tally')
    expect(seen.at(-1)).toBe('podium')
  })

  it('is terminal at podium', () => {
    const podium = { phase: 'podium', qIndex: 8, phaseStartedAt: T0, phaseDurationMs: 0, holding: false } as GameState
    expect(nextState(podium, T0 + 5000)).toEqual(podium)
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

  /* A question runs its FULL window now. The old "everyone has answered, move on" exit handed the
     room's fastest thumbs the power to cut short the thinking time the reading beat just bought
     for everyone else. This is the assertion that would catch it being put back. */
  it('never ends a question early, however fast the room answers', () => {
    const s = nextState(startedState(T0), T0) // past reading, so this is 'question'
    expect(shouldExpire(s, T0 + 1, 5, 5)).toBe(false)
    expect(shouldExpire(s, T0 + QUESTION_MS - 1, 100, 100)).toBe(false)
    expect(shouldExpire(s, T0 + QUESTION_MS, 100, 100)).toBe(true)
  })



  it('never expires an untimed phase', () => {
    let s = startedState(T0)
    for (let i = 0; i < 100 && s.phase !== 'tally'; i++) s = nextState(s, T0)
    expect(s.phase).toBe('tally') // guards against the loop above silently walking past a regression
    expect(shouldExpire(s, T0 + 60 * 60 * 1000, 5, 5)).toBe(false)
  })

})

describe('the rules screen', () => {
  it('is entered once, between the lobby and the first reading, and never again', () => {
    const seen = walkFromLobby()
    expect(seen.slice(0, 4)).toEqual(['lobby', 'rules', 'tutorial', 'reading'])
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
    // Not even a full room that has somehow "answered" can expire it — and nothing else can
    // either now that no phase has an all-answered exit left.
    expect(shouldExpire(rules, T0 + 60 * 60 * 1000, 100, 100)).toBe(false)
  })

  it('advances to the tutorial, not straight to the first case', () => {
    const after = nextState(rulesState(T0), T0)
    expect(after.phase).toBe('tutorial')
    expect(after.qIndex).toBe(0)
  })

  it('shows no question of its own — the room is reading rules, not evidence', () => {
    expect(currentQuestion(rulesState(T0))).toBeNull()
  })
})

describe('the tutorial', () => {
  it('is entered once, between the rules and the first reading, and never again', () => {
    const seen = walkFromLobby()
    expect(seen.filter((p) => p === 'tutorial')).toHaveLength(1)
    expect(seen[seen.indexOf('tutorial') - 1]).toBe('rules')
    expect(seen[seen.indexOf('tutorial') + 1]).toBe('reading')
    // The walk FINISHED. Without this, a machine that looped tutorial -> tutorial could satisfy
    // everything above by exhausting the 100-step cap and this test would pass on a broken game.
    expect(seen.at(-1)).toBe('podium')
    // ...and every reading beat is still there: the worked example was inserted in FRONT of the
    // game, not in place of its first case.
    expect(seen.filter((p) => p === 'reading')).toHaveLength(QUESTION_COUNT)
  })

  it('has no countdown — only the host moves it', () => {
    const tutorial = tutorialState(T0)
    expect(tutorial.phaseDurationMs).toBe(0)
    expect(remainingMs(tutorial, T0 + 60 * 60 * 1000)).toBe(0)
    expect(shouldExpire(tutorial, T0 + 60 * 60 * 1000, 100, 100)).toBe(false)
  })

  it('advances to the reading beat for question 0, on the reading clock', () => {
    const after = nextState(tutorialState(T0), T0)
    expect(after.phase).toBe('reading')
    expect(after.qIndex).toBe(0)
    expect(after.phaseDurationMs).toBe(READING_MS)
    expect(after.phaseStartedAt).toBe(T0) // the reading clock starts on the press, not at start-up
  })

  /* The example it draws is content/tutorial.ts's TUTORIAL_CASE, which is deliberately NOT one of
     the ten. If this phase ever resolved a real question, case 1 would be spent on the screen that
     exists to teach the buttons — and the room would meet it again, already knowing the answer. */
  it('resolves no question out of the real set', () => {
    expect(currentQuestion(tutorialState(T0))).toBeNull()
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

  /* The reveal is UNTIMED since v3.2 — it leaves only on a host press, so no clock can take the
     screen away while the host is still talking over it. `hold` existed solely to freeze the old
     auto-advance and was removed with it. This is the assertion that would catch a clock being
     put back: an hour later, on a reveal, nothing expires and nothing is counting down. */
  it('never expires a reveal — it waits for the host, however long that is', () => {
    const reveal = nextState(nextState(startedState(T0), T0), T0) // reading -> question -> reveal
    expect(reveal.phase).toBe('reveal')
    expect(reveal.phaseDurationMs).toBe(0)
    expect(shouldExpire(reveal, T0 + 60 * 60 * 1000, 5, 5)).toBe(false)
    expect(remainingMs(reveal, T0 + 60 * 60 * 1000)).toBe(0)
  })
})

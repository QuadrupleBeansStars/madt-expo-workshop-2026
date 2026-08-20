import { describe, expect, it } from 'vitest'
import { QUESTIONS } from '@/content/persona'
import {
  ASK_MS, LOBBY_STATE, SEQUENCE, STAGE_COUNT, advance, askOpen, back, currentQuestion,
  currentStage, remainingMs,
} from '@/lib/room'

describe('SEQUENCE', () => {
  it('is ask,reveal per question, in question order', () => {
    expect(STAGE_COUNT).toBe(QUESTIONS.length * 2)
    QUESTIONS.forEach((_, i) => {
      expect(SEQUENCE[i * 2]).toEqual({ kind: 'ask', questionIndex: i })
      expect(SEQUENCE[i * 2 + 1]).toEqual({ kind: 'reveal', questionIndex: i })
    })
  })
})

describe('advance / back', () => {
  it('lobby → q1 ask → q1 reveal → … → done; done is terminal', () => {
    let s = advance(LOBBY_STATE, 1000)
    expect(currentStage(s)).toEqual({ kind: 'ask', questionIndex: 0 })
    expect(currentQuestion(s)?.id).toBe('q1')
    for (let i = 1; i < STAGE_COUNT; i++) s = advance(s, 1000 + i)
    expect(currentStage(s)).toEqual({ kind: 'reveal', questionIndex: QUESTIONS.length - 1 })
    s = advance(s, 9999)
    expect(s.phase).toBe('done')
    expect(advance(s, 10000)).toEqual(s)
  })

  it('back: stage 0 → lobby; done → last reveal; lobby stays lobby', () => {
    expect(back(LOBBY_STATE, 5).phase).toBe('lobby')
    const atFirst = advance(LOBBY_STATE, 1000)
    expect(back(atFirst, 2000).phase).toBe('lobby')
    let s = atFirst
    for (let i = 1; i <= STAGE_COUNT; i++) s = advance(s, 1000 + i)   // now done
    expect(s.phase).toBe('done')
    const b = back(s, 5000)
    expect(b.phase).toBe('stage')
    expect(currentStage(b)).toEqual({ kind: 'reveal', questionIndex: QUESTIONS.length - 1 })
  })

  it('back restarts the stage clock', () => {
    const s = advance(advance(LOBBY_STATE, 1000), 2000)
    expect(back(s, 7000).stageStartedAt).toBe(7000)
  })
})

describe('askOpen — the timer is display-only', () => {
  it('open on ask stages even after ASK_MS has elapsed; closed on reveal and off-stage', () => {
    const ask = advance(LOBBY_STATE, 1000)
    expect(askOpen(ask)).toBe(true)
    // The spec's soft countdown: elapsing changes NOTHING about voting.
    expect(remainingMs(ask, 1000 + ASK_MS + 5000)).toBe(0)
    expect(askOpen(ask)).toBe(true)
    const reveal = advance(ask, 2000)
    expect(askOpen(reveal)).toBe(false)
    expect(askOpen(LOBBY_STATE)).toBe(false)
  })

  it('remainingMs counts down from ASK_MS on ask, 0 on reveal, never negative', () => {
    const ask = advance(LOBBY_STATE, 1000)
    expect(remainingMs(ask, 1000)).toBe(ASK_MS)
    expect(remainingMs(ask, 11000)).toBe(ASK_MS - 10000)
    expect(remainingMs(advance(ask, 2000), 2000)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { UI } from './deck-strings'

describe('deck chrome strings', () => {
  it('every string is present and non-empty in both languages', () => {
    for (const [key, value] of Object.entries(UI)) {
      expect(value.en.trim(), `${key}.en`).not.toBe('')
      expect(value.th.trim(), `${key}.th`).not.toBe('')
    }
  })

  it('has the keys the surfaces need', () => {
    const required = [
      'deckTitle', 'joinPrompt', 'waitingToStart', 'voteReceived', 'changeVote',
      'votingClosed', 'lookAtScreen', 'thanks', 'start', 'next', 'back',
      'closeVoting', 'lesson', 'peopleInRoom', 'votes', 'hostToken', 'tokenRequired',
    ] as const
    for (const k of required) expect(UI[k], k).toBeDefined()
  })

  it('does not translate a string to itself', () => {
    for (const [key, value] of Object.entries(UI)) {
      expect(value.en, `${key} looks untranslated`).not.toBe(value.th)
    }
  })
})

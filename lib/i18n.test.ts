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

import { describe, expect, it } from 'vitest'
import {
  STAGE_COUNT, LOBBY_STATE, currentStage, acceptsVotes, votingOpen, remainingMs, advance,
} from './room'
import type { RoomState } from './room'
import { STAGES } from '@/content/room'
import type { DecideStage } from './room-types'

const at = (index: number, startedAt = 1000, closedAt: number | null = null): RoomState =>
  ({ phase: 'stage', stageIndex: index, stageStartedAt: startedAt, votingClosedAt: closedAt })

describe('room stage machine', () => {
  it('STAGE_COUNT matches the content sequence', () => {
    expect(STAGE_COUNT).toBe(STAGES.length)
  })

  it('lobby has no current stage', () => {
    expect(currentStage(LOBBY_STATE)).toBeNull()
  })

  it('advance from lobby moves to the first stage', () => {
    const s = advance(LOBBY_STATE, 5000)
    expect(s.phase).toBe('stage')
    expect(s.stageIndex).toBe(0)
    expect(s.stageStartedAt).toBe(5000)
    expect(s.votingClosedAt).toBeNull()
  })

  it('advance moves through every stage in order and stops at the last', () => {
    let s = advance(LOBBY_STATE, 0)
    for (let i = 1; i < STAGE_COUNT; i++) {
      s = advance(s, i * 1000)
      expect(s.phase).toBe('stage')
      expect(s.stageIndex).toBe(i)
    }
    // one more advance past the last stage goes to done
    s = advance(s, (STAGE_COUNT + 1) * 1000)
    expect(s.phase).toBe('done')
    expect(currentStage(s)).toBeNull()

    // advancing again stays at done
    const done = advance(s, (STAGE_COUNT + 2) * 1000)
    expect(done.phase).toBe('done')
  })

  it('acceptsVotes narrows to decide stages only', () => {
    const decideStage = STAGES.find((st) => st.kind === 'decide')
    const introStage = STAGES.find((st) => st.kind === 'intro')
    const dataStage = STAGES.find((st) => st.kind === 'data')
    const outcomeStage = STAGES.find((st) => st.kind === 'outcome')
    const closeStage = STAGES.find((st) => st.kind === 'close')
    expect(decideStage).toBeDefined()
    expect(introStage).toBeDefined()
    expect(dataStage).toBeDefined()
    expect(outcomeStage).toBeDefined()
    expect(closeStage).toBeDefined()

    expect(acceptsVotes(decideStage!)).toBe(true)
    expect(acceptsVotes(introStage!)).toBe(false)
    expect(acceptsVotes(dataStage!)).toBe(false)
    expect(acceptsVotes(outcomeStage!)).toBe(false)
    expect(acceptsVotes(closeStage!)).toBe(false)

    // type-level narrowing: this must compile without a cast.
    if (acceptsVotes(decideStage!)) {
      const narrowed: DecideStage = decideStage!
      expect(narrowed.options.length).toBeGreaterThan(0)
    }
  })

  it('remainingMs is 0 for every non-decide stage kind', () => {
    for (const kind of ['intro', 'data', 'outcome', 'close'] as const) {
      const index = STAGES.findIndex((st) => st.kind === kind)
      expect(remainingMs(at(index), 1000)).toBe(0)
    }
  })

  it('votingOpen is always false on non-decide stages', () => {
    for (const kind of ['intro', 'data', 'outcome', 'close'] as const) {
      const index = STAGES.findIndex((st) => st.kind === kind)
      expect(votingOpen(at(index), 1000)).toBe(false)
    }
  })

  it('voting is open on a decide stage until its duration elapses, exclusive boundary', () => {
    const index = STAGES.findIndex((st) => st.kind === 'decide')
    const stage = STAGES[index] as DecideStage
    const dur = stage.durationMs
    const s = at(index, 1000)
    expect(votingOpen(s, 1000)).toBe(true)
    expect(votingOpen(s, 1000 + dur - 1)).toBe(true)
    // exclusive boundary: at exactly stageStartedAt + durationMs, voting is closed
    expect(votingOpen(s, 1000 + dur)).toBe(false)
    expect(votingOpen(s, 1000 + dur + 500)).toBe(false)
  })

  it('remainingMs counts down to exactly 0 at the boundary and never negative', () => {
    const index = STAGES.findIndex((st) => st.kind === 'decide')
    const stage = STAGES[index] as DecideStage
    const dur = stage.durationMs
    const s = at(index, 1000)
    expect(remainingMs(s, 1000)).toBe(dur)
    expect(remainingMs(s, 1000 + dur - 1)).toBe(1)
    expect(remainingMs(s, 1000 + dur)).toBe(0)
    expect(remainingMs(s, 1000 + dur + 9999)).toBe(0)
  })

  it('an early host close shuts voting immediately regardless of the timer', () => {
    const index = STAGES.findIndex((st) => st.kind === 'decide')
    const s = at(index, 1000, 1200)
    expect(votingOpen(s, 1200)).toBe(false)
    expect(votingOpen(s, 1199)).toBe(true)
    expect(remainingMs(s, 1200)).toBe(0)
  })

  it('the timer never advances the stage on its own — only advance() moves the stage index', () => {
    const index = STAGES.findIndex((st) => st.kind === 'decide')
    const stage = STAGES[index] as DecideStage
    const s = at(index, 1000)
    // well past the timer's expiry, currentStage is unchanged without an explicit advance()
    const stillHere = currentStage({ ...s, stageStartedAt: 1000 })
    expect(stillHere?.id).toBe(stage.id)
    expect(votingOpen(s, 1000 + stage.durationMs + 100000)).toBe(false)
  })
})

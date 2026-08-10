import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as joinPath } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryDecisionRoomStore, shopValue, ZERO_KPI } from './room-store'
import { STAGES } from '@/content/room'
import { AUDIENCE } from '@/content/audience'
import { simulatePricing } from './pricing'
import { SHOP_VALUE_WEIGHTS } from './room-types'
import type { FixedDecideStage, PricedDecideStage } from './room-types'

const T0 = 1_000_000

/** Stage indices in `content/room.ts`, resolved by id so a content edit fails loudly here. */
const idx = (id: string): number => {
  const i = STAGES.findIndex((s) => s.id === id)
  if (i < 0) throw new Error(`no stage ${id}`)
  return i
}
const STAFFING = idx('decide-price')
const DEFEND = idx('decide-defend')
const INVEST = idx('decide-invest')

const pricingStage = STAGES[STAFFING] as PricedDecideStage
const defendStage = STAGES[DEFEND] as FixedDecideStage
const investStage = STAGES[INVEST] as FixedDecideStage

describe('shopValue', () => {
  it('uses the exported SHOP_VALUE_WEIGHTS, with waste subtracting', () => {
    const kpi = { revenue: 1000, profit: 500, satisfaction: 10, waste: 300 }
    expect(shopValue(kpi)).toBe(
      SHOP_VALUE_WEIGHTS.revenue * 1000 +
      SHOP_VALUE_WEIGHTS.profit * 500 +
      SHOP_VALUE_WEIGHTS.satisfaction * 10 -
      SHOP_VALUE_WEIGHTS.waste * 300,
    )
  })

  it('ranks a low-waste shop above an otherwise identical high-waste one', () => {
    const lean = { revenue: 5000, profit: 2000, satisfaction: 60, waste: 100 }
    const wasteful = { ...lean, waste: 900 }
    expect(shopValue(lean)).toBeGreaterThan(shopValue(wasteful))
  })

  it("preserves round 3's designed order: the recurring grinder beats the one-off campaign", () => {
    const score = (id: string) => {
      const fx = investStage.options.find((o) => o.id === id)!.fx
      return shopValue({ ...ZERO_KPI, ...fx })
    }
    expect(score('equipment')).toBeGreaterThan(score('marketing'))
    expect(score('equipment')).toBeGreaterThan(score('loyalty'))
  })
})

describe('decision room store', () => {
  let store: MemoryDecisionRoomStore
  beforeEach(() => { store = new MemoryDecisionRoomStore() })

  /** Advance until `stageIndex` is the current stage. */
  const advanceTo = (target: number, t = T0) => {
    for (let i = 0; i <= target; i++) store.advance(t + i)
  }

  it('starts in lobby with nobody', () => {
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(s.stageId).toBeNull()
    expect(s.tallies).toEqual([])
    expect(store.getLeaderboard()).toEqual([])
  })

  it('join gives a player a name and a zeroed shop', () => {
    const p = store.join('Nan', T0)
    expect(p.name).toBe('Nan')
    expect(p.kpi).toEqual(ZERO_KPI)
    expect(p.choices).toEqual({})
    expect(p.joinedAt).toBe(T0)
    expect(store.getPublicState(T0).playerCount).toBe(1)
  })

  it('join is idempotent per player id: rejoining does not duplicate the shop', () => {
    const a = store.join('Nan', T0)
    const again = store.join('Nan', T0 + 10, a.id)
    expect(again.id).toBe(a.id)
    expect(store.getPublicState(T0 + 10).playerCount).toBe(1)
    expect(store.getPlayers()).toHaveLength(1)
  })

  it('an unknown playerId on join creates a fresh player rather than throwing', () => {
    const p = store.join('Ghost', T0, 'not-a-real-id')
    expect(store.getPublicState(T0).playerCount).toBe(1)
    expect(p.id).toEqual(expect.any(String))
  })

  it('rejects votes from unknown players', () => {
    advanceTo(STAFFING)
    expect(store.vote({ playerId: 'nope', stageId: pricingStage.id, optionId: 'p65' }, T0)).toBe('unknown')
  })

  it('rejects votes for a stage that is not current', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    expect(store.vote({ playerId: p.id, stageId: defendStage.id, optionId: 'quality' }, T0)).toBe('closed')
  })

  it('rejects votes on a stage that does not accept them', () => {
    const p = store.join('Nan', T0)
    store.advance(T0) // intro
    expect(store.vote({ playerId: p.id, stageId: STAGES[0].id, optionId: 'p65' }, T0)).toBe('closed')
  })

  it('rejects an option id that is not on the stage', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    expect(store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'b99' }, T0 + 100)).toBe('closed')
  })

  it('rejects votes once the voting window has elapsed', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    const closed = T0 + STAFFING + pricingStage.durationMs
    expect(store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p65' }, closed)).toBe('closed')
  })

  it('a re-vote replaces rather than adds', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    expect(store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p65' }, T0 + 100)).toBe('ok')
    expect(store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 200)).toBe('ok')
    const s = store.getPublicState(T0 + 300, p.id)
    expect(s.voteCount).toBe(1)
    expect(s.you?.votedOptionId).toBe('p85')
    expect(s.tallies.find((t) => t.optionId === 'p85')!.count).toBe(1)
    expect(s.tallies.find((t) => t.optionId === 'p65')!.count).toBe(0)
  })

  it('you is null-voted before voting and absent without a playerId', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    expect(store.getPublicState(T0 + 1, p.id).you?.votedOptionId).toBeNull()
    expect(store.getPublicState(T0 + 1).you).toBeUndefined()
  })

  it('resolves round 1 through the simulator when the stage closes', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 100)
    store.advance(T0 + 50_000) // off the decide stage → resolve

    const sim = simulatePricing(85, AUDIENCE)
    expect(store.getPlayers()[0].kpi).toEqual({
      revenue: sim.revenue, profit: sim.profit, satisfaction: sim.satisfaction, waste: sim.waste,
    })
  })

  it('gives non-voters the first option outcome, so the board has no holes', () => {
    const voter = store.join('Voter', T0)
    const idle = store.join('Idle', T0)
    advanceTo(STAFFING)
    store.vote({ playerId: voter.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 100)
    store.advance(T0 + 50_000)

    const players = store.getPlayers()
    const idleKpi = players.find((x) => x.id === idle.id)!.kpi
    const first = simulatePricing(pricingStage.options[0].priceBaht, AUDIENCE)
    expect(idleKpi).toEqual({
      revenue: first.revenue, profit: first.profit, satisfaction: first.satisfaction, waste: first.waste,
    })
    expect(store.getLeaderboard()).toHaveLength(2)
  })

  it('resolves a fixed round by applying the chosen option fx', () => {
    const p = store.join('Nan', T0)
    advanceTo(DEFEND)
    store.vote({ playerId: p.id, stageId: defendStage.id, optionId: 'price' }, T0 + DEFEND + 10)
    store.advance(T0 + 100_000)

    const sim = simulatePricing(pricingStage.options[0].priceBaht, AUDIENCE) // round 1 default
    const fx = defendStage.options.find((o) => o.id === 'price')!.fx
    expect(store.getPlayers()[0].kpi).toEqual({
      revenue: sim.revenue + (fx.revenue ?? 0),
      profit: sim.profit + (fx.profit ?? 0),
      satisfaction: sim.satisfaction + (fx.satisfaction ?? 0),
      waste: sim.waste + (fx.waste ?? 0),
    })
  })

  it('carries KPI across two rounds — each shop accumulates', () => {
    const p = store.join('Nan', T0)
    advanceTo(STAFFING)
    store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 100)
    store.advance(T0 + 50_000)
    const afterRound1 = { ...store.getPlayers()[0].kpi }

    while (store.getPublicState(T0 + 60_000).stageId !== defendStage.id) store.advance(T0 + 60_000)
    store.vote({ playerId: p.id, stageId: defendStage.id, optionId: 'quality' }, T0 + 60_100)
    store.advance(T0 + 120_000)

    const fx = defendStage.options.find((o) => o.id === 'quality')!.fx
    expect(store.getPlayers()[0].kpi).toEqual({
      revenue: afterRound1.revenue + (fx.revenue ?? 0),
      profit: afterRound1.profit + (fx.profit ?? 0),
      satisfaction: afterRound1.satisfaction + (fx.satisfaction ?? 0),
      waste: afterRound1.waste + (fx.waste ?? 0),
    })
  })

  it('resolves a decide stage exactly once, however many times the host advances', () => {
    const p = store.join('Nan', T0)
    advanceTo(DEFEND)
    store.vote({ playerId: p.id, stageId: defendStage.id, optionId: 'quality' }, T0 + DEFEND + 10)
    store.advance(T0 + 100_000)
    const once = { ...store.getPlayers()[0].kpi }
    // Advancing onto the outcome stage and then onto the next decide stage must not re-apply the
    // round that was already resolved. (The restart path is covered in the persistence suite.)
    store.advance(T0 + 110_000)
    expect(store.getPublicState(T0 + 110_001).stageId).toBe(investStage.id)
    const fx = defendStage.options.find((o) => o.id === 'quality')!.fx
    expect(store.getPlayers()[0].kpi).toEqual(once)
    expect(once.profit).toBe(
      simulatePricing(pricingStage.options[0].priceBaht, AUDIENCE).profit + (fx.profit ?? 0),
    )
  })

  it('ranks the leaderboard by shop value, best first, with ties sharing a rank', () => {
    const lean = store.join('Lean', T0)
    const loose = store.join('Loose', T0 + 1)
    advanceTo(INVEST)
    store.vote({ playerId: lean.id, stageId: investStage.id, optionId: 'equipment' }, T0 + INVEST + 10)
    store.vote({ playerId: loose.id, stageId: investStage.id, optionId: 'marketing' }, T0 + INVEST + 10)
    store.advance(T0 + 200_000)

    const board = store.getLeaderboard()
    expect(board.map((e) => e.name)).toEqual(['Lean', 'Loose'])
    expect(board[0].rank).toBe(1)
    expect(board[1].rank).toBe(2)
    expect(board[0].score).toBe(shopValue(board[0].kpi))
    expect(board[0].score).toBeGreaterThan(board[1].score)
  })

  it('reports a player their own rank and score through getPublicState', () => {
    const a = store.join('A', T0)
    const b = store.join('B', T0 + 1)
    advanceTo(INVEST)
    store.vote({ playerId: b.id, stageId: investStage.id, optionId: 'equipment' }, T0 + INVEST + 10)
    store.vote({ playerId: a.id, stageId: investStage.id, optionId: 'marketing' }, T0 + INVEST + 10)
    store.advance(T0 + 200_000)

    const you = store.getPublicState(T0 + 200_001, a.id).you!
    expect(you.rank).toBe(2)
    expect(you.score).toBe(shopValue(you.kpi))
    expect(store.getPublicState(T0 + 200_001, 'nobody').you).toBeUndefined()
  })

  it('reset clears players and returns to lobby without lowering seq', () => {
    store.join('Nan', T0)
    advanceTo(STAFFING)
    const before = store.getSeq()
    store.reset()
    expect(store.getSeq()).toBeGreaterThan(before)
    const s = store.getPublicState(T0 + 1)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(store.getLeaderboard()).toEqual([])
  })

  it('seq rises on every mutation and never falls', () => {
    const seen: number[] = [store.getSeq()]
    const p = store.join('Nan', T0)
    seen.push(store.getSeq())
    store.join('Two', T0 + 1)
    seen.push(store.getSeq())
    advanceTo(STAFFING)
    seen.push(store.getSeq())
    store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p65' }, T0 + 100)
    seen.push(store.getSeq())
    store.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 200)
    seen.push(store.getSeq())
    store.advance(T0 + 50_000)
    seen.push(store.getSeq())
    store.reset()
    seen.push(store.getSeq())

    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThan(seen[i - 1])
    // Reads never move it.
    const held = store.getSeq()
    store.getPublicState(T0 + 60_000, p.id)
    store.getLeaderboard()
    expect(store.getSeq()).toBe(held)
  })

  it('a rejected vote does not bump seq', () => {
    advanceTo(STAFFING)
    const before = store.getSeq()
    store.vote({ playerId: 'nope', stageId: pricingStage.id, optionId: 'p65' }, T0 + 100)
    expect(store.getSeq()).toBe(before)
  })

  it('never reads the wall clock: the same inputs give the same result', () => {
    const a = new MemoryDecisionRoomStore()
    const b = new MemoryDecisionRoomStore()
    for (const s of [a, b]) {
      const p = s.join('Nan', T0)
      for (let i = 0; i <= STAFFING; i++) s.advance(T0 + i)
      s.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p65' }, T0 + 100)
      s.advance(T0 + 50_000)
    }
    expect(a.getPlayers()[0].kpi).toEqual(b.getPlayers()[0].kpi)
  })
})

describe('decision room store persistence', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = mkdtempSync(joinPath(tmpdir(), 'room-store-'))
    file = joinPath(dir, 'decision-room-state.json')
  })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it('round-trips players, KPI, choices and stage state through a restart', () => {
    const a = new MemoryDecisionRoomStore(file)
    const p = a.join('Nan', T0)
    for (let i = 0; i <= STAFFING; i++) a.advance(T0 + i)
    a.vote({ playerId: p.id, stageId: pricingStage.id, optionId: 'p85' }, T0 + 100)
    a.advance(T0 + 50_000)
    const expected = a.getPlayers()[0]
    const seq = a.getSeq()

    const b = new MemoryDecisionRoomStore(file)
    expect(b.getPlayers()).toEqual([expected])
    expect(b.getSeq()).toBe(seq)
    const pub = b.getPublicState(T0 + 60_000, p.id)
    expect(pub.phase).toBe('stage')
    expect(pub.stageIndex).toBe(STAFFING + 1)
    expect(pub.playerCount).toBe(1)
  })

  it('does not re-resolve a round that was already resolved before the restart', () => {
    // A round is resolved and the host is still sitting on the decide stage when the process
    // restarts. Without persisting `resolvedStageIds`, the next advance would apply the round a
    // second time and every shop would silently double-count it.
    const kpi = { revenue: 100, profit: 50, satisfaction: 5, waste: 10 }
    writeFileSync(file, JSON.stringify({
      players: [{ id: 'p1', name: 'Nan', kpi, choices: { [defendStage.id]: 'quality' }, joinedAt: T0 }],
      room: { phase: 'stage', stageIndex: DEFEND, stageStartedAt: T0, votingClosedAt: T0 },
      resolvedStageIds: [defendStage.id],
      seq: 12,
    }), 'utf8')

    const b = new MemoryDecisionRoomStore(file)
    b.advance(T0 + 110_000)
    expect(b.getPlayers()[0].kpi).toEqual(kpi)
    expect(b.getSeq()).toBeGreaterThan(12)
  })

  it('leaves no .tmp files behind after persist', () => {
    const a = new MemoryDecisionRoomStore(file)
    a.join('Nan', T0)
    expect(readdirSync(dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })

  it('falls back to a clean lobby when the persisted file is not valid JSON', () => {
    writeFileSync(file, 'not json at all', 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(store.getPlayers()).toEqual([])
  })

  it('falls back to a clean lobby when the persisted JSON has the wrong shape', () => {
    writeFileSync(file, JSON.stringify({ players: 'nope', room: null, seq: 'x' }), 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.playerCount).toBe(0)
    expect(s.stageId).toBeNull()
    // Still usable, not wedged.
    const p = store.join('Nan', T0 + 1)
    expect(store.getPublicState(T0 + 1).playerCount).toBe(1)
    expect(p.id).toEqual(expect.any(String))
  })

  it('drops malformed players and KPI rather than loading a broken shop', () => {
    writeFileSync(file, JSON.stringify({
      players: [
        { id: 'ok', name: 'Nan', kpi: { revenue: 1, profit: 2, satisfaction: 3, waste: 4 }, choices: { a: 'b' }, joinedAt: 5 },
        { name: 'no id' },
        { id: 'bad-kpi', name: 'X', kpi: { revenue: 'lots' }, joinedAt: 1 },
      ],
      room: { phase: 'lobby', stageIndex: 0, stageStartedAt: 0, votingClosedAt: null },
      resolvedStageIds: [],
      seq: 9,
    }), 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    const players = store.getPlayers()
    expect(players.map((p) => p.id)).toEqual(['ok', 'bad-kpi'])
    expect(players[0].kpi).toEqual({ revenue: 1, profit: 2, satisfaction: 3, waste: 4 })
    expect(players[1].kpi).toEqual(ZERO_KPI)
    expect(store.getSeq()).toBe(9)
  })

  it('falls back to lobby when the persisted phase is an unrecognized string', () => {
    writeFileSync(file, JSON.stringify({
      players: [], room: { phase: 'bogus', stageIndex: 3 }, resolvedStageIds: [], seq: 5,
    }), 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    expect(store.getPublicState(T0).phase).toBe('lobby')
  })

  it('falls back to lobby when the persisted stage state is malformed, and stays usable', () => {
    // A phase-only check would let this through: `currentStage` then returns null while the phase
    // still says 'stage', and every host advance produces 'x1', 'x11', 'x111' — a wedged room.
    writeFileSync(file, JSON.stringify({
      players: [],
      room: { phase: 'stage', stageIndex: 'x', stageStartedAt: 'abc', votingClosedAt: null },
      resolvedStageIds: [],
      seq: 7,
    }), 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    const s = store.getPublicState(T0)
    expect(s.phase).toBe('lobby')
    expect(s.stageId).toBeNull()
    expect(s.playerCount).toBe(0)
    // Still hostable: advancing reaches the real first stage.
    store.advance(T0 + 1)
    const after = store.getPublicState(T0 + 2)
    expect(after.stageIndex).toBe(0)
    expect(after.stageId).toBe(STAGES[0].id)
    expect(Number.isFinite(after.remainingMs)).toBe(true)
  })

  it('falls back to lobby when the persisted stageIndex is past the end of the sequence', () => {
    writeFileSync(file, JSON.stringify({
      players: [],
      room: { phase: 'stage', stageIndex: STAGES.length + 4, stageStartedAt: T0, votingClosedAt: null },
      resolvedStageIds: ['not-a-stage'],
      seq: 3,
    }), 'utf8')
    const store = new MemoryDecisionRoomStore(file)
    expect(store.getPublicState(T0).phase).toBe('lobby')
    expect(store.getPublicState(T0).stageIndex).toBe(0)
  })

  it('yields a clean lobby without throwing when the file does not exist', () => {
    const missing = joinPath(dir, 'does-not-exist.json')
    expect(() => new MemoryDecisionRoomStore(missing)).not.toThrow()
    const store = new MemoryDecisionRoomStore(missing)
    expect(store.getPublicState(T0).phase).toBe('lobby')
    expect(store.getPublicState(T0).playerCount).toBe(0)
  })

  it('survives a persist failure: the mutation still succeeds in memory and logs', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const unwritable = joinPath(dir, 'no-such-subdir', 'decision-room-state.json')
    const store = new MemoryDecisionRoomStore(unwritable)
    expect(() => store.join('Nan', T0)).not.toThrow()
    expect(store.getPublicState(T0).playerCount).toBe(1)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

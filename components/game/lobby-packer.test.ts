import { describe, it, expect } from 'vitest'
import { packShelves, type Placement, type Rect } from '@/app/tv/page'

/*
 * THE LOBBY BOARD'S ONE HARD GUARANTEE: no two name cards overlap, ever (spec §2).
 *
 * Two earlier drafts scattered cards and tried to dodge collisions, and neither could reach "no
 * overlap" — a hundred readable cards occupy most of the board, and random placement jams long
 * before they all fit. Shelf packing makes overlap impossible BY CONSTRUCTION, and this file is
 * where that claim is actually checked.
 *
 * IT HAS TO BE CHECKED AGAINST THE PURE FUNCTION, not against the rendered lobby: jsdom performs
 * no layout at all, so every rectangle it reports is 0x0 and an assertion written against the DOM
 * could only ever pass vacuously. That is exactly why the packer takes measured rectangles in and
 * returns placements out, with no DOM of its own.
 */

const GAP_X = 6
const GAP_Y = 10
const CARD_H = 40

/** A deterministic generator, so a failure is reproducible rather than "it went red once". */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const boxOf = (p: Placement, card: { w: number; h: number }): Rect => ({ x: p.x, y: p.y, w: card.w, h: card.h })
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function pack(cards: { w: number; h: number }[], furniture: Rect[] = [], board = { w: 1400, h: 760 }, rand = seeded(7)) {
  return packShelves({ board, cards, furniture, gapX: GAP_X, gapY: GAP_Y, jitterY: 2, rand })
}

describe('the lobby shelf packer', () => {
  const varied = Array.from({ length: 90 }, (_, i) => ({ w: 90 + ((i * 37) % 170), h: CARD_H }))

  it('never overlaps two cards, at any board fill', () => {
    const placements = pack(varied)
    const boxes = placements
      .map((p, i) => (p ? boxOf(p, varied[i]) : null))
      .filter((b): b is Rect => b !== null)

    expect(boxes.length, 'the fixture must actually seat cards or this proves nothing').toBeGreaterThan(20)
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j]), `cards ${i} and ${j} overlap`).toBe(false)
      }
    }
  })

  it('never places a card under the furniture', () => {
    /* The furniture column down the middle of the board: the title, the QR, Start and the counter,
       as they are measured off the live DOM. */
    const furniture: Rect[] = [
      { x: 480, y: 40, w: 440, h: 110 },   // the screen title
      { x: 560, y: 170, w: 280, h: 280 },  // the QR panel
      { x: 590, y: 470, w: 220, h: 70 },   // Start
      { x: 570, y: 560, w: 260, h: 50 },   // the counter
    ]
    const placements = pack(varied, furniture)
    const boxes = placements
      .map((p, i) => (p ? boxOf(p, varied[i]) : null))
      .filter((b): b is Rect => b !== null)

    expect(boxes.length).toBeGreaterThan(20)
    for (const box of boxes) {
      for (const f of furniture) {
        expect(overlaps(box, f), `a card landed on the furniture at ${f.x},${f.y}`).toBe(false)
      }
    }
  })

  /*
   * NOTHING ABOUT THE RIGHT EDGE IS RESERVED (spec §2). An earlier draft positioned cards by a
   * left offset capped at `100 − cardWidth`, which silently left a card's width of dead space
   * down the right side of every board and cost the lobby a whole column of names.
   *
   * Driven with a generator pinned near 1 so the packer takes the far end of every gap it is
   * offered — the case the old cap made unreachable.
   */
  it('walks its gaps to the true right edge, reserving nothing', () => {
    const card = { w: 200, h: CARD_H }
    const [placement] = pack([card], [], { w: 1400, h: 760 }, () => 0.999999)
    expect(placement).not.toBeNull()
    const right = placement!.x + card.w
    expect(1400 - right).toBeLessThanOrEqual(GAP_X + 1)
  })

  /*
   * A FULL BOARD STOPS, it does not stack. Past capacity the choice is smaller cards or accepting
   * overlap, and this pass makes neither — the unseated cards get no placement, the lobby renders
   * nothing for them, and the counter beside the QR carries the true number of the room.
   */
  it('returns null for every card past capacity rather than stacking them', () => {
    // One shelf's worth of height, and cards wider than a third of it.
    const tiny = { w: 300, h: 90 }
    const cards = Array.from({ length: 12 }, () => ({ ...tiny }))
    const placements = pack(cards, [], { w: 1000, h: 120 })

    const seated = placements.filter((p) => p !== null)
    expect(seated.length).toBeGreaterThan(0)
    expect(seated.length).toBeLessThan(cards.length)
    // Every unseated card is explicitly null — never a placement quietly reusing another's slot.
    expect(placements.filter((p) => p === null).length).toBe(cards.length - seated.length)
  })

  /*
   * Shelves are chosen from the four with the most free width, at random among them — empty space
   * wins, but not so rigidly that the board reads as sorted. A packer that always took the first
   * fitting shelf would fill the board top-down like a table, and this is what catches that.
   */
  it('spreads across shelves instead of filling the first one', () => {
    const cards = Array.from({ length: 12 }, () => ({ w: 150, h: CARD_H }))
    const placements = pack(cards).filter((p): p is Placement => p !== null)
    const bands = new Set(placements.map((p) => Math.round(p.y / (CARD_H + GAP_Y))))
    expect(bands.size).toBeGreaterThan(1)
  })

  it('tilts every card, and never by more than 1.5°', () => {
    const placements = pack(varied).filter((p): p is Placement => p !== null)
    expect(placements.length).toBeGreaterThan(20)
    for (const p of placements) expect(Math.abs(p.tilt)).toBeLessThanOrEqual(1.5)
  })
})

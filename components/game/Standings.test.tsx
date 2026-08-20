import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Standings, type LeaderboardRow } from './Standings'

/*
 * BEHAVIOUR ONLY. Sizes, colours, easing and positions are still being tuned and are checked by
 * `npm run check:projector` and by looking at the screenshots — an assertion on any of them here
 * would fail for reasons that are not defects. What IS asserted is what the spec commits to
 * structurally: ten places, and the rank-change indicator ahead of the position.
 */

const row = (rank: number, codename: string, score: number): LeaderboardRow =>
  ({ rank, codename, score, avatar: '🕵️', wrongPass: 0 })

const board = (n: number) =>
  Array.from({ length: n }, (_, i) => row(i + 1, `นักสืบ${i + 1}`, 1000 - i * 50))

describe('the standings', () => {
  // Spec §5: ten places, up from five. The old component was named for its five and rendered
  // exactly five; nothing in the suite would have noticed a sixth being dropped.
  it('renders ten rows when ten players exist', () => {
    const { container } = render(<Standings entries={board(10)} caseOrder={3} beat={3} />)
    expect(container.querySelectorAll('li')).toHaveLength(10)
    expect(screen.getByText('นักสืบ10')).toBeInTheDocument()
  })

  it('renders one row per player when fewer than ten have joined', () => {
    const { container } = render(<Standings entries={board(4)} caseOrder={1} beat={1} />)
    expect(container.querySelectorAll('li')).toHaveLength(4)
  })

  // Ten PLACES, not "as many as the server sent". A wire that grows past ten must not silently
  // grow the screen past the height it was measured at.
  it('never renders more than ten, however many the server sends', () => {
    const { container } = render(<Standings entries={board(25)} caseOrder={9} beat={9} />)
    expect(container.querySelectorAll('li')).toHaveLength(10)
    expect(screen.queryByText('นักสืบ11')).toBeNull()
  })

  /*
   * SPEC §5, and the reason it is a rule rather than a preference: "the eye should learn who
   * climbed before who they are". DOM order is the assertion because it is what a screen reader
   * and a left-to-right reading both follow, and because it survives a re-skin — a test on the
   * arrow's `left` would not.
   */
  it('puts the rank-change indicator before the position in DOM order', () => {
    const { container } = render(
      <Standings entries={board(10)} caseOrder={4} beat={4} deltas={{ 'นักสืบ3': 2, 'นักสืบ5': -1 }} />,
    )
    const rows = [...container.querySelectorAll('li')]
    expect(rows).toHaveLength(10)
    for (const li of rows) {
      const arrow = li.querySelector('[data-rank-change]')
      const position = li.querySelector('[data-rank]')
      expect(arrow, 'every row carries a rank-change indicator').not.toBeNull()
      expect(position, 'every row carries a position').not.toBeNull()
      // DOCUMENT_POSITION_FOLLOWING: `position` comes after `arrow`.
      expect(arrow!.compareDocumentPosition(position!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  /*
   * The direction is derived from the diff the projector holds, never from the server. A climb, a
   * fall, a player who held their place and a player who was not on the previous board are four
   * different states, and rendering any two of them alike would make the arrows decorative.
   */
  it('distinguishes a climb, a fall, a held place and a new arrival', () => {
    const { container } = render(
      <Standings
        entries={board(4)}
        caseOrder={2}
        beat={2}
        deltas={{ 'นักสืบ1': 3, 'นักสืบ2': -2, 'นักสืบ3': 0 }}
      />,
    )
    const directions = [...container.querySelectorAll('[data-rank-change]')]
      .map((el) => el.getAttribute('data-rank-change'))
    expect(directions).toEqual(['up', 'down', 'same', 'new'])
  })

  it('renders nothing at all before anyone has scored', () => {
    const { container } = render(<Standings entries={[]} caseOrder={1} beat={1} />)
    expect(container.firstChild).toBeNull()
  })
})

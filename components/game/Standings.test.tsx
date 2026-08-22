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

  /*
   * TEN PLACES, NOT "as many as have scored". A four-row board would give every row two and a half
   * times its real height, so a rehearsal with four people would be looking at a different design
   * from the event — and the slide would travel a different distance in each. The open seats are
   * what keep the pitch the same in both. A real row is identified by its rank-change indicator;
   * an open seat has nothing to say about movement and carries none.
   */
  it('always draws ten places, filling the rest with open seats', () => {
    const { container } = render(<Standings entries={board(4)} caseOrder={1} beat={1} />)
    expect(container.querySelectorAll('li')).toHaveLength(10)
    expect(container.querySelectorAll('[data-rank-change]')).toHaveLength(4)
    expect(screen.getByText('นักสืบ4')).toBeInTheDocument()
    // The furniture is not announced: a screen reader reading out six empty ranks is describing
    // the board's shape rather than its contents.
    expect(container.querySelectorAll('li[aria-hidden="true"]')).toHaveLength(6)
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
   * climbed before who they are". The position now leads the row — the rank plate is one object
   * carrying both the metal and the numeral — and the arrow comes straight after it, still ahead
   * of the avatar and the name. DOM order is the assertion because it is what a screen reader and
   * a left-to-right reading both follow, and because it survives a re-skin: a test on the arrow's
   * `left` would not.
   */
  it('puts the position, then the rank-change indicator, ahead of the codename', () => {
    const { container } = render(
      <Standings entries={board(10)} caseOrder={4} beat={4} deltas={{ 'นักสืบ3': 2, 'นักสืบ5': -1 }} />,
    )
    const rows = [...container.querySelectorAll('li')]
    expect(rows).toHaveLength(10)
    rows.forEach((li, i) => {
      const position = li.querySelector('[data-rank]')
      const arrow = li.querySelector('[data-rank-change]')
      const name = screen.getByText(`นักสืบ${i + 1}`)
      expect(position, 'every row carries a position').not.toBeNull()
      expect(arrow, 'every row carries a rank-change indicator').not.toBeNull()
      expect(li.contains(name), 'the codename belongs to its own row').toBe(true)
      // DOCUMENT_POSITION_FOLLOWING: the compared node comes LATER in the document.
      expect(position!.compareDocumentPosition(arrow!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(arrow!.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
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

  /*
   * THE MIDPOINT SCHEDULE, asserted at its start — the defect this file went red for twice.
   *
   * A row wears the rank it held on the PREVIOUS board until halfway through the beat, and the
   * plate's metal and the paper-or-screen material are drawn from that same value, so pinning the
   * numeral here pins all of it. Two bugs live on this assertion:
   *
   *   1. The plate's colour once came straight off the incoming `rank` while only the numeral
   *      waited for the midpoint, so rank 1 spent 475ms as a gold plate reading "3".
   *   2. The previous rank was then installed by an EFFECT, which runs after the browser paints —
   *      so the first painted frame was the finished board, flashing the answer for ~60ms before
   *      the reveal started. Measured on two page loads in three.
   *
   * Both show up the same way: the FIRST render must already carry the previous rank. No timers
   * are mocked and none need to be — the flip is a `setTimeout` that has not fired yet, so what
   * `render` commits is exactly the frame the room sees first.
   */
  it('wears the rank it held on the previous board from the very first render', () => {
    render(
      <Standings
        entries={board(10)}
        caseOrder={5}
        beat={5}
        deltas={{ 'นักสืบ3': 2, 'นักสืบ7': -1, 'นักสืบ9': 0 }}
      />,
    )
    const numeral = (codename: string) => screen.getByText(codename).closest('li')!.querySelector('[data-rank]')!

    // นักสืบ3 climbed two, so it held rank 5 — and `data-rank` still names where it has landed.
    expect(numeral('นักสืบ3').getAttribute('data-rank')).toBe('3')
    expect(numeral('นักสืบ3').textContent).toBe('5')
    // นักสืบ7 fell one, so it held rank 6.
    expect(numeral('นักสืบ7').textContent).toBe('6')
    // A held place and a new arrival have no previous rank to wear and show their own at once.
    expect(numeral('นักสืบ9').textContent).toBe('9')
    expect(numeral('นักสืบ4').textContent).toBe('4')
  })

  it('renders nothing at all before anyone has scored', () => {
    const { container } = render(<Standings entries={[]} caseOrder={1} beat={1} />)
    expect(container.firstChild).toBeNull()
  })
})

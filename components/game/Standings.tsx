'use client'
import { useEffect, useState } from 'react'
import { QUESTION_COUNT } from '@/lib/game'
import { STANDINGS_BEAT_MS, useAfterFirstFrame, useCountUp, usePrefersReducedMotion } from './motion'

/**
 * `playerId` deliberately NOT here (IMPORTANT 2, final whole-branch review): `/api/stats` is an
 * unauthenticated GET reachable by any phone on the LAN, and `/api/answer` accepts any `playerId`
 * with first-wins semantics — publishing the board's real ids would let a phone lock a wrong
 * answer in for someone else. Nothing here ever needed the id for anything but a React key; `rank`
 * is unique within one leaderboard response and does that job instead.
 */
export type LeaderboardRow = {
  codename: string
  avatar: string
  score: number
  wrongPass: number
  rank: number
}

/**
 * How a row moved since the previous reveal. `null` means "not on the previous board" — a player
 * who has just scored their way onto it, which is not a climb and must not render as one.
 */
export type RankDeltas = Record<string, number | undefined>

/**
 * TEN PLACES, not five — and the rename is the point of the file (spec §5). `TopFive` was an
 * honest name for a five-row component and a lie for a ten-row one, and a component whose name
 * disagrees with what it renders is how the next person ships a sixth row into a five-row layout.
 *
 * ROW PITCH. The spec's numbers are `8.0vh` pitch and a `≈5.6vh` body, so every pair keeps a
 * 2.4vh gap — a 70/30 split of the pitch. Ten rows at 8.0vh is 80vh, which is the WHOLE stage of
 * a 95vh frame once the HUD and the status line are paid for, so those numbers only compute on a
 * screen this component owns outright. It does not own one: there is no `standings` phase, and it
 * shares the reveal with the case file and the split bar. So the grid takes `1fr` rows of whatever
 * height it is actually given and the body caps at `min(5.6vh, 70%)`. On a full-height stage that
 * IS the spec — 8.0vh pitch, 5.6vh body. In the reveal's column it scales down and keeps the 70/30
 * ratio, which is what the 2.4vh gap was protecting: no two rows ever touch. The measured pitch is
 * in the batch report.
 *
 * ONE BEAT. The number counts up, the row slides to its new slot and the arrow fades in, all over
 * {@link STANDINGS_BEAT_MS}, and the rank numeral flips at the MIDPOINT — when the row is nearest
 * its new slot. That midpoint flip is what makes a simultaneous move readable; without it the room
 * sees ten numbers change at once and reads none of them.
 *
 * Rank, avatar and codename stay three SEPARATE elements, not one concatenated string — a row like
 * `1. หมูกรอบ` in a single node makes the codename un-queryable on its own, and the reveal and the
 * podium both need to assert a codename by itself.
 */
/** Re-exported from lib/game.ts, where app/api/stats/route.ts reads the same number. Declaring it
 *  twice is how the ten-place component ended up fed a five-row payload. */
export { STANDINGS_PLACES } from '@/lib/game'
import { STANDINGS_PLACES } from '@/lib/game'

/** Gold, silver, bronze, then neutral — the left rail, which is the second encoding of rank
 *  (spec §5). Colour alone is never the only cue: the numeral is right beside it and is larger
 *  for the same three places. */
const RAIL = ['var(--det-gold)', '#c9d1e0', '#c07f3a'] as const
const RAIL_NEUTRAL = 'var(--det-border)'

export function Standings({
  entries, caseOrder, deltas, beat,
}: {
  entries: LeaderboardRow[]
  /** Which case the room has just closed — the subtitle's `AFTER CASE n OF 09`. */
  caseOrder: number
  /** Previous rank minus current rank, by codename. Positive is a climb. */
  deltas?: RankDeltas
  /** Changes once per reveal; restarts the beat. The question's order is the natural value. */
  beat: number
}) {
  if (entries.length === 0) return null
  const rows = entries.slice(0, STANDINGS_PLACES)
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center">
      {/* `paddingTop`: Thai upper vowels and tone marks sit ABOVE the em box, and at 9vh with this
          title's glow they reach into whatever is directly above — on the reveal that is the split
          bar, a few pixels up. The padding is the clearance, not decoration. */}
      <h2 className="det-screen-title shrink-0" style={{ paddingTop: '1.8vh' }}>
        อันดับตอนนี้
        {/* English, because `.det-screen-title small` is Press Start 2P and that face carries no
            Thai glyphs at all. */}
        <small>{`AFTER CASE ${caseOrder} OF ${String(QUESTION_COUNT).padStart(2, '0')}`}</small>
      </h2>
      <ol
        className="grid min-h-0 w-full flex-1"
        style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => (
          <StandingRow key={row.codename} row={row} delta={deltas?.[row.codename]} beat={beat} />
        ))}
      </ol>
    </div>
  )
}

function StandingRow({ row, delta, beat }: { row: LeaderboardRow; delta: number | undefined; beat: number }) {
  const reduced = usePrefersReducedMotion()
  const settled = useAfterFirstFrame(`${beat}:${row.codename}`)
  const score = useCountUp(row.score, STANDINGS_BEAT_MS)
  const top3 = row.rank <= 3

  /* The slide. A grid item's own height IS the pitch, so `translateY(100%)` is exactly one row —
     no pitch value has to be threaded through, and it stays correct when the grid is given less
     height than the spec's 8.0vh. A climb (`delta > 0`) started BELOW its new slot, so it enters
     from +delta rows down. */
  const rowsMoved = delta ?? 0
  const travelling = !reduced && !settled && rowsMoved !== 0
  const direction = rowsMoved > 0 ? 'up' : rowsMoved < 0 ? 'down' : delta === undefined ? 'new' : 'same'

  return (
    <li
      className="flex list-none items-center"
      style={{
        transform: travelling ? `translateY(${rowsMoved * 100}%)` : 'translateY(0)',
        transition: reduced ? 'none' : `transform ${STANDINGS_BEAT_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`,
      }}
    >
      <div
        className="flex w-full items-center gap-[1.6vh] overflow-hidden rounded-[0.8vh] pr-[1.6vh]"
        style={{
          /* 70% of the pitch is the spec's 5.6-of-8.0 ratio, and it holds while the column is
             tall. Squeezed — ten rows in the reveal's right column, under a 9vh title and a split
             bar — 70% of a short pitch drops below the 3.1vh text it has to hold, and the row's
             own `overflow: hidden` would then CLIP the names rather than let them spill. 78% with
             a line-height of 1 keeps the text inside the box all the way down, and still leaves a
             visible gap between every pair, which is what the 2.4vh was protecting. */
          height: 'min(5.6vh, 78%)',
          lineHeight: 1,
          background: 'rgba(13, 17, 39, 0.86)',
          border: '0.2vh solid var(--det-border)',
          borderLeft: `1.1vh solid ${top3 ? RAIL[row.rank - 1] : RAIL_NEUTRAL}`,
          fontFamily: 'var(--font-thai), system-ui, sans-serif',
          fontWeight: 700,
          fontSize: '3.1vh',
        }}
      >
        {/*
          * THE RANK-CHANGE INDICATOR COMES FIRST (spec §5) — before the position, the avatar and
          * the name. The eye should learn who climbed before it learns who they are. It fades in
          * over the same beat everything else moves on, so the arrow arrives as the row settles
          * rather than announcing the move before it happens.
          */}
        <span
          data-rank-change={direction}
          aria-hidden="true"
          className="w-[3.4vh] shrink-0 text-center"
          style={{
            fontFamily: 'var(--font-retro), monospace',
            opacity: reduced ? 1 : settled ? 1 : 0,
            transition: reduced ? 'none' : `opacity ${STANDINGS_BEAT_MS}ms ease-out`,
            color: direction === 'up' ? 'var(--det-green)' : direction === 'down' ? 'var(--det-pink)' : '#8892b0',
          }}
        >
          {direction === 'up' ? '▲' : direction === 'down' ? '▼' : direction === 'new' ? '•' : '–'}
        </span>

        <RankNumeral rank={row.rank} delta={delta} beat={beat} large={top3} />

        <span className="shrink-0" aria-hidden="true">{row.avatar}</span>
        <span className="min-w-0 flex-1 truncate">{row.codename}</span>
        <span
          className="shrink-0 tabular-nums"
          style={{ fontFamily: 'var(--font-retro), monospace', color: 'var(--det-gold)' }}
        >
          {score}
        </span>
      </div>
    </li>
  )
}

/**
 * The numeral, which flips at the MIDPOINT of the beat rather than at either end.
 *
 * Swapping it at the start means the room reads the new number while the row is still in its old
 * slot; swapping it at the end means ten numbers change simultaneously after everything has
 * stopped. Halfway through — when the row is nearest its new slot and still moving — is the one
 * moment the change reads as "this row became rank 4", which is the whole reason a simultaneous
 * ten-row move is followable at all.
 *
 * Under reduced motion there is no travel to be halfway through, so the new numeral is what
 * renders from the first frame.
 */
function RankNumeral({ rank, delta, beat, large }: { rank: number; delta: number | undefined; beat: number; large: boolean }) {
  const reduced = usePrefersReducedMotion()
  /* The numeral this row wore on the previous board. `delta` is previous minus current, so the
     previous rank is current plus delta; `undefined` (new to the board) has no previous numeral
     to flip from and shows its own from the first frame. */
  const moved = delta !== undefined && delta !== 0
  const [shown, setShown] = useState(rank)

  useEffect(() => {
    if (reduced || !moved) { setShown(rank); return }
    setShown(rank + (delta as number))
    const id = setTimeout(() => setShown(rank), STANDINGS_BEAT_MS / 2)
    return () => clearTimeout(id)
  }, [rank, delta, moved, beat, reduced])

  /* The flip itself: the numeral closes to a line and opens on the other value, and the swap above
     is timed to the closed frame. A cross-fade would leave both numbers legible at once, which is
     the ambiguity this is here to remove. */
  const closing = !reduced && moved && shown !== rank
  return (
    <span
      data-rank={rank}
      className="shrink-0 text-center tabular-nums"
      style={{
        width: '5.2vh',
        fontFamily: 'var(--font-retro), monospace',
        fontSize: large ? '4.4vh' : '3.4vh',
        color: large ? 'var(--det-gold)' : '#c7d0e8',
        display: 'inline-block',
        transform: closing ? 'scaleY(0.05)' : 'scaleY(1)',
        transition: reduced ? 'none' : `transform ${STANDINGS_BEAT_MS / 2}ms ease-in`,
      }}
    >
      {reduced ? rank : shown}
    </span>
  )
}

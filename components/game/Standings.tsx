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
 * TEN PLACES ON A SCREEN THIS COMPONENT NOW OWNS OUTRIGHT.
 *
 * The approved artifact draws the standings as a full stage: the shared 9vh title at the top, then
 * ten rows at an 8.0vh pitch beginning below it, which reaches the bottom edge. That arithmetic
 * only closes on a whole screen — which is exactly why the reveal became two beats
 * (app/tv/page.tsx's `RevealStage`) instead of trying to fit this beside a case file and a split
 * bar. The grid takes `1fr` rows of whatever height the stage gives it and the row body caps at
 * `min(5.6vh, 78%)`, so the 8.0/5.6 spec holds at full height and the gap between every pair
 * survives being squeezed.
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
 *  for the same three places. Silver is the approved artifact's `#cdd4e0`. */
const RAIL = ['var(--det-gold)', '#cdd4e0', '#c07f3a'] as const
const RAIL_NEUTRAL = 'rgba(255, 255, 255, 0.16)'

export function Standings({
  entries, caseOrder, deltas, gains, beat,
}: {
  entries: LeaderboardRow[]
  /** Which case the room has just closed — the subtitle's `AFTER CASE n OF 09`. */
  caseOrder: number
  /** Previous rank minus current rank, by codename. Positive is a climb. */
  deltas?: RankDeltas
  /** What each row scored on the case just closed — the `+300` beside the name. */
  gains?: RankDeltas
  /** Changes once per reveal; restarts the beat. The question's order is the natural value. */
  beat: number
}) {
  if (entries.length === 0) return null
  const rows = entries.slice(0, STANDINGS_PLACES)
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center px-[6vw]">
      {/* `paddingTop`: Thai upper vowels and tone marks sit ABOVE the em box, and at 9vh with this
          title's glow they reach into whatever is directly above. The padding is the clearance. */}
      <h2 className="det-screen-title shrink-0" style={{ paddingTop: '1.2vh' }}>
        อันดับตอนนี้
        {/* English, because `.det-screen-title small` is Press Start 2P and that face carries no
            Thai glyphs at all. */}
        <small>{`AFTER CASE ${String(caseOrder).padStart(2, '0')} OF ${String(QUESTION_COUNT).padStart(2, '0')}`}</small>
      </h2>
      <ol
        className="grid min-h-0 w-full flex-1"
        style={{ gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => (
          <StandingRow
            key={row.codename}
            row={row}
            delta={deltas?.[row.codename]}
            gain={gains?.[row.codename]}
            beat={beat}
          />
        ))}
      </ol>
    </div>
  )
}

function StandingRow({
  row, delta, gain, beat,
}: {
  row: LeaderboardRow
  delta: number | undefined
  gain: number | undefined
  beat: number
}) {
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
        transition: reduced ? 'none' : `transform ${STANDINGS_BEAT_MS}ms cubic-bezier(0.32, 1.28, 0.4, 1)`,
      }}
    >
      <div
        className="flex w-full items-center gap-[1.2vw] overflow-hidden rounded-[0.6vh] pr-[1.8vw]"
        style={{
          /* 78% of the pitch with a line-height of 1 keeps the text inside the box at every stage
             height and still leaves a visible gap between every pair — which is what the spec's
             2.4vh out of the 8.0vh pitch was protecting: no two rows ever touch. */
          height: 'min(5.6vh, 78%)',
          lineHeight: 1,
          /* OPAQUE, not a translucent white wash. A 6% white overlay reads as a row on flat black
             and as nothing at all on the brown wall the whole game now stands on — the top six
             rows disappeared into it entirely while the four below the desk cut stayed visible,
             which is what "the leaderboard is gone" looked like. A row must carry its own ground
             so it cannot depend on what happens to be behind it. */
          background: 'rgba(6, 8, 20, 0.82)',
          fontFamily: 'var(--font-thai), system-ui, sans-serif',
          fontWeight: 700,
          fontSize: '3.1vh',
        }}
      >
        {/* THE RAIL — rank encoded a second time, as a colour down the left edge of the row, so
            the top three read from the back of the hall before any numeral is legible. */}
        <span
          aria-hidden="true"
          className="h-full w-[0.9vw] shrink-0"
          style={{ background: top3 ? RAIL[row.rank - 1] : RAIL_NEUTRAL }}
        />

        {/*
          * THE RANK-CHANGE INDICATOR COMES FIRST (spec §5) — before the position, the avatar and
          * the name. The eye should learn who climbed before it learns who they are. It fades in
          * over the same beat everything else moves on, so the arrow arrives as the row settles
          * rather than announcing the move before it happens.
          *
          * It carries HOW FAR, not just which way: a row that climbed four places and one that
          * climbed one are different events, and the artifact prints the distance beside the
          * arrowhead. A held place renders a dash in transparent ink so the column keeps its width
          * without saying anything.
          */}
        <span
          data-rank-change={direction}
          aria-hidden="true"
          className="w-[5.5vw] shrink-0 text-center"
          style={{
            fontFamily: 'var(--font-retro), monospace',
            fontSize: '3.4vh',
            opacity: reduced || settled ? 1 : 0,
            transition: reduced ? 'none' : `opacity ${STANDINGS_BEAT_MS}ms ease-out`,
            color: direction === 'up' ? 'var(--det-green)' : direction === 'down' ? 'var(--det-pink)' : 'transparent',
          }}
        >
          {direction === 'up' ? `▲${rowsMoved}` : direction === 'down' ? `▼${-rowsMoved}` : '–'}
        </span>

        <RankNumeral rank={row.rank} delta={delta} beat={beat} large={top3} />

        <span className="shrink-0" style={{ fontSize: '3.7vh' }} aria-hidden="true">{row.avatar}</span>
        <span className="min-w-0 truncate">{row.codename}</span>

        {/* WHAT THIS ROW JUST SCORED, in the climb's own green, beside the NAME rather than beside
            the total: the total is where they are, this is what just happened. Fades in on the
            same beat as the arrow. Absent renders nothing — a player who scored zero on this
            question did not gain, and "+0" is a different statement from silence. */}
        <span
          className="shrink-0 tabular-nums"
          style={{
            fontFamily: 'var(--font-retro), monospace',
            fontSize: '3.4vh',
            color: 'var(--det-green)',
            opacity: reduced || settled ? 1 : 0,
            transition: reduced ? 'none' : `opacity ${STANDINGS_BEAT_MS}ms ease-out`,
          }}
        >
          {gain !== undefined && gain > 0 ? `+${gain}` : ''}
        </span>

        <span
          className="ml-auto shrink-0 tabular-nums"
          style={{ fontFamily: 'var(--font-retro), monospace', fontSize: '4.6vh', color: 'var(--det-gold)' }}
        >
          {score.toLocaleString('en-US')}
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

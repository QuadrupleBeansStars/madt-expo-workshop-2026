'use client'
import { useEffect, useState } from 'react'
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
  /** What this row scored on the current question, from the server. Absent if they did not answer. */
  gained?: number
}

/**
 * How a row moved since the previous reveal. `null` means "not on the previous board" — a player
 * who has just scored their way onto it, which is not a climb and must not render as one.
 */
export type RankDeltas = Record<string, number | undefined>

/**
 * TEN PLACES ON A SCREEN THIS COMPONENT NOW OWNS OUTRIGHT.
 *
 * The approved artifact draws the standings as a full stage: a title with a gold rule under it,
 * then ten rows that reach the bottom edge. That arithmetic only closes on a whole screen — which
 * is exactly why the reveal became two beats (app/tv/page.tsx's `RevealStage`) instead of trying
 * to fit this beside a case file and a split bar. The grid takes `1fr` rows of whatever height the
 * stage gives it and each row body caps at a percentage of that, so the design holds at full
 * height and the gap between every pair survives being squeezed.
 *
 * TEN PLACES EVEN WHEN TEN PEOPLE HAVE NOT SCORED. The slots nobody has reached yet are drawn as
 * {@link OpenSeat} strips, so the pitch at a four-person rehearsal is the pitch at a hundred-person
 * event. An EMPTY board is still nothing at all, though — see the early return.
 *
 * THE TOP THREE ARE ON PAPER. Ranks 1–3 render as cream case-file strips and ranks 4–10 stay dark
 * screen rows, so the room reads "who is on paper" from the back of the hall without counting
 * down a column of numerals. Every ink on a paper row is a different value from the same ink on a
 * dark row: neon green on cream is a highlighter rather than a mark, and gold on gold is nothing
 * at all.
 *
 * AND EVERY ROW CARRIES ITS OWN SCORE TRACK. Ten rows of numbers tell the room the ORDER but not
 * the GAP — whether second place is one question behind the leader or five. The track is that
 * gap, drawn as a bar behind the row's contents whose width is the row's share of the leader.
 *
 * ONE BEAT. The number counts up, the row slides to its new slot and the arrow fades in, all over
 * {@link STANDINGS_BEAT_MS}, and at the MIDPOINT — when the row is nearest its new slot — the rank
 * numeral, the plate's metal and the row's whole material change together, on the one value
 * {@link useWornRank} owns. That midpoint flip is what makes a simultaneous move readable; without
 * it the room sees ten numbers change at once and reads none of them.
 *
 * Rank, avatar and codename stay three SEPARATE elements, not one concatenated string — a row like
 * `1. หมูกรอบ` in a single node makes the codename un-queryable on its own, and the reveal and the
 * podium both need to assert a codename by itself.
 */
/** Re-exported from lib/game.ts, where app/api/stats/route.ts reads the same number. Declaring it
 *  twice is how the ten-place component ended up fed a five-row payload. */
export { STANDINGS_PLACES } from '@/lib/game'
import { STANDINGS_PLACES } from '@/lib/game'

/** Gold, silver, bronze — the top three's rank plate, which is the second encoding of rank
 *  (spec §5). Colour alone is never the only cue: the numeral sits ON the plate, and both read the
 *  same {@link useWornRank} value, so in every frame of every beat the metal and the number say
 *  the same thing. Silver is the approved artifact's `#cdd4e0`. */
const METAL = ['var(--det-gold)', '#cdd4e0', '#c07f3a'] as const
/** The left edge of a dark row's plate — the one place ranks 4–10 still carry a rail, kept so the
 *  seven of them read as a column rather than as seven unattached tiles. */
const PLATE_EDGE = 'rgba(255, 255, 255, 0.16)'

/** How far across a row the leader's own track runs. NOT 100, and this is load-bearing: at full
 *  width the leader's terminus line lands on top of its own score — the one numeral the bar is a
 *  picture of. 76% of the row is everything left of the score column. */
const TRACK_SPAN_PCT = 76

export function Standings({
  entries, deltas, gains, beat,
}: {
  entries: LeaderboardRow[]
  /**
   * RETAINED FOR THE CALL SITE, DELIBERATELY NOT RENDERED — which is why it is not destructured
   * below. The header used to print `CASE 03 / 09` on its right-hand side, but the projector's HUD
   * band already prints that counter a few inches above this component, and one number printed
   * twice on one screen sends the room hunting for a difference between the two copies. The HUD is
   * now the single place the case counter lives. The prop stays because app/tv/page.tsx passes it.
   */
  caseOrder: number
  /** Previous rank minus current rank, by codename. Positive is a climb. */
  deltas?: RankDeltas
  /** What each row scored on the case just closed — the `+300` beside the name. */
  gains?: RankDeltas
  /** Changes once per reveal; restarts the beat. The question's order is the natural value. */
  beat: number
}) {
  /* NOT ten open seats. A board with nobody on it renders nothing at all — `RevealStage` guards on
     `top.length > 0` as well, and ten numbered empty strips during a reveal where no one has
     scored says something worse than saying nothing. */
  if (entries.length === 0) return null
  const rows = entries.slice(0, STANDINGS_PLACES)
  /* Every track is measured against the LEADER, not against the maximum score the game can award:
     the question the room is asking at this moment is "how far behind is everyone", and a board
     early in the workshop would otherwise draw ten stubs and say nothing. */
  const lead = entries[0]?.score ?? 0
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center px-[7vh]">
      {/* THE HEADER IS A TITLE WITH A RULE UNDER IT, not a stacked centred title. `w-full` on the
          header is the load-bearing part: the parent centres its children, so a header without it
          shrinks to its own text and the gold rule ends where the words do. The rule has to run
          the FULL width of the board — that edge-to-edge line is what makes the ten rows below
          read as a table under a heading rather than a list floating under a word. The title
          itself is left-aligned inside that full width, which is why nothing here needs
          `justify-between` any more: there is only one group left to place.

          `paddingTop`: Thai upper vowels and tone marks sit ABOVE the em box, and this title's
          glow reaches into whatever is directly above it. The padding is the clearance. */}
      <header
        className="w-full shrink-0"
        style={{
          borderBottom: '0.45vh solid rgba(255, 215, 0, .5)',
          paddingBottom: '0.8vh',
          paddingTop: '1.2vh',
        }}
      >
        <h2 className="flex items-baseline gap-[1.6vh]">
          <span
            style={{
              fontFamily: 'var(--font-thai), system-ui, sans-serif',
              fontWeight: 800,
              fontSize: '6.4vh',
              lineHeight: 1,
              color: 'var(--det-gold)',
              textShadow: '0.5vh 0.5vh 0 #705400, 0 0 2vh rgba(255, 215, 0, .5)',
            }}
          >
            อันดับตอนนี้
          </span>
          {/* English, because `.det-pixel` is Press Start 2P and that face carries no Thai glyphs
              at all — a Thai word set in it silently loses every vowel mark. */}
          <span className="det-pixel" style={{ fontSize: '2.2vh', color: 'var(--det-cyan)' }}>THE BOARD</span>
        </h2>
      </header>

      {/* `1fr` ROWS, AND EXACTLY ONE GRID ITEM PER ROW. The slide below is
          `translateY(rowsMoved * 100%)`, which travels exactly one row ONLY because a grid item's
          own height IS the pitch. Flex plus `gap`, or an outer margin on a row, makes every climb
          land off-slot — and nothing errors when it does.

          TEN TRACKS, ALWAYS — `STANDINGS_PLACES`, never `rows.length`. With four players on the
          board a ten-track grid keeps the pitch it will have on the day; a four-track one gives
          each row two and a half times its height and the rehearsal is looking at a different
          design from the event. It also keeps the slide honest: `translateY(100%)` is the same
          distance with four people in the room as with a hundred, so what the host rehearses is
          what the room sees. */}
      <ol
        className="grid min-h-0 w-full flex-1"
        style={{ gridTemplateRows: `repeat(${STANDINGS_PLACES}, minmax(0, 1fr))` }}
      >
        {rows.map((row) => (
          <StandingRow
            key={row.codename}
            row={row}
            delta={deltas?.[row.codename]}
            gain={gains?.[row.codename]}
            beat={beat}
            lead={lead}
          />
        ))}
        {Array.from({ length: STANDINGS_PLACES - rows.length }, (_, i) => (
          <OpenSeat key={`open-seat-${rows.length + i + 1}`} rank={rows.length + i + 1} />
        ))}
      </ol>
    </div>
  )
}

/**
 * AN OPEN SEAT — one of the places nobody has scored their way into yet.
 *
 * The board is always ten places. It draws its remaining slots rather than simply being short,
 * because a short list is not a smaller board, it is a different one: four rows at `1fr` of the
 * whole stage are two and a half times their real height, and a rehearsal with four people would
 * be looking at a design the event never shows.
 *
 * IT CARRIES A NUMERAL AND NOTHING ELSE. Six blank strips read as a rendering fault; six NUMBERED
 * blank strips read as "seats 5 to 10 are open", which is the true statement. No track — there is
 * no score to draw a share of. No arrow — nobody moved. No avatar, no codename, no total.
 *
 * AND IT CARRIES ITS OWN GROUND, for the reason the dark rows do. This first shipped as the dark
 * row's fill under `opacity: 0.34`, which is not a dim row — it is a 29%-alpha wash, and a wash
 * takes its colour from whatever is behind it. On the lit cork of the upper two thirds of
 * `DESK_GROUND` the seats composited to within a few points of the wall itself and simply were not
 * there; on the near-black below the desk cut they were fine. That is the same defect, in the same
 * repo, that once made the whole leaderboard "disappear", and the owner asked for แถบว่างไว้ให้ครบ
 * — visible empty bars. A strip nobody can see is not an empty bar, it is a missing row.
 *
 * So the ground is opaque and DARKER than a filled row rather than fainter: an empty socket, not a
 * ghost. Darker also happens to be the safe direction, because the band where a seat is hardest to
 * see is the lightest part of the wall.
 *
 * NO HOOKS, DELIBERATELY, and that is why this is its own component rather than a flag on
 * {@link StandingRow}. A placeholder is not a row that happens to be empty: it never travels, so it
 * has no beat to settle after, no number to count up to and no arrow to fade in. Passing empty
 * values into `useCountUp` and `useAfterFirstFrame` would still mount ten timers and a frame
 * callback per reveal to animate nothing. It also cannot enter the slide, because there is no
 * previous board on which an empty seat held a different place.
 *
 * `aria-hidden`, because a screen reader announcing six empty ranks is describing the furniture.
 */
function OpenSeat({ rank }: { rank: number }) {
  return (
    <li aria-hidden="true" className="flex list-none items-center">
      <div
        className="flex w-full items-center"
        style={{
          /* The dark row's exact height and radius — an open seat has to sit on the same baseline
             grid as a filled one, or the eye reads the board as two different lists. */
          height: 'min(5.6vh, 80%)',
          borderRadius: '0 0.5vh 0.5vh 0',
          /* OPAQUE, and a shade below the dark row's `rgba(6, 8, 20, 0.86)` rather than a faded
             copy of it. NO `opacity` ANYWHERE ON THIS ELEMENT: an opacity would put the wall back
             through the fill and undo the whole point. */
          background: 'rgba(3, 4, 11, 0.96)',
          overflow: 'hidden',
          lineHeight: 1,
        }}
      >
        <span
          className="flex h-full shrink-0 items-center justify-center"
          style={{
            width: '6vh',
            /* The plate recedes by being quieter than a filled row's, not by being transparent —
             a filled plate is `.06` over `.16`, an empty one half of each. */
            background: 'rgba(255, 255, 255, .03)',
            borderLeft: '0.7vh solid rgba(255, 255, 255, 0.08)',
            /* Legible from the back of the hall, and still plainly not a player: a filled row's
               numeral is `#c7d0e8` against the same ground, so this reads as the same column
               turned down rather than as a different kind of text. */
            color: '#8792ad',
          }}
        >
          <span
            className="text-center tabular-nums"
            style={{ width: '5.2vh', fontFamily: 'var(--font-retro), monospace', fontSize: '3.6vh' }}
          >
            {rank}
          </span>
        </span>
      </div>
    </li>
  )
}

/**
 * WHICH RANK THIS ROW IS WEARING RIGHT NOW — the old one until the MIDPOINT of the beat, the new
 * one after it. THE ONLY PLACE THAT SCHEDULE IS WRITTEN, and it has to stay that way.
 *
 * This began as private state inside {@link RankNumeral}, so the numeral flipped at the midpoint
 * while everything keyed off `rank` — the plate's metal, and with the paper redesign the row's
 * whole material — switched at the start of the beat instead. For the first 475ms of every reveal
 * rank 1 was a GOLD PLATE READING "3", rank 2 a silver plate reading "1", and a row crossing 3↔4
 * changed from cream to dark while still showing the rank it no longer held. Two schedules for one
 * fact, and the louder one was wrong.
 *
 * Now the metal, the paper-or-screen material and the numeral all change on this one value, at the
 * closed frame of the flip, as a single event: the row lands in its new slot and turns gold in the
 * same instant. Anything that asks "is this row on paper" must ask THIS and not `row.rank`, and if
 * the beat is ever retuned there is exactly one timer to retune with it.
 *
 * Under reduced motion there is no travel to be halfway through, so the new rank is what the row
 * wears from the first frame. A row with `delta === undefined` is new to the board, has no previous
 * rank to wear, and gets its own from the first frame for the same reason.
 */
function useWornRank(rank: number, delta: number | undefined, beat: number): number {
  const reduced = usePrefersReducedMotion()
  /* `delta` is previous minus current, so the previous rank is current plus delta. A row that did
     not move, and a row that is new to the board, have no previous rank to wear: `previous`
     collapses onto `rank` and nothing below can make the two differ. */
  const previous = delta !== undefined && delta !== 0 ? rank + delta : rank

  /*
   * WHAT IS STORED IS "HAS THIS BEAT PASSED ITS MIDPOINT" — a marker, not the rank itself — and
   * that is the whole trick.
   *
   * Storing the rank meant initialising it to `rank` and having an effect correct it back to
   * `previous`. A passive effect runs AFTER the browser has painted, so the first painted frame
   * was the FINISHED board: on two loads in three, measured, roughly 60ms of gold plate, cream
   * paper and final numerals flashing up before the beat snapped back to the previous standings
   * and started travelling. The room got shown the answer and then watched it be revealed.
   *
   * Derived from props, the first paint IS the start of the beat and there is nothing to correct.
   * The marker carries every input, so a board that changes under a row restarts that row's flip
   * instead of stranding it mid-way.
   */
  const beatKey = `${beat}:${previous}:${rank}`
  const [flipped, setFlipped] = useState('')

  useEffect(() => {
    if (reduced || previous === rank) return
    const id = setTimeout(() => setFlipped(beatKey), STANDINGS_BEAT_MS / 2)
    return () => clearTimeout(id)
  }, [beatKey, previous, rank, reduced])

  return reduced || flipped === beatKey ? rank : previous
}

function StandingRow({
  row, delta, gain, beat, lead,
}: {
  row: LeaderboardRow
  delta: number | undefined
  gain: number | undefined
  beat: number
  /** The top score on this board — the denominator every score track is drawn against. */
  lead: number
}) {
  const reduced = usePrefersReducedMotion()
  const settled = useAfterFirstFrame(`${beat}:${row.codename}`)
  const score = useCountUp(row.score, STANDINGS_BEAT_MS)
  /* Everything below that distinguishes a paper row from a screen row reads `worn`, never
     `row.rank`: the material and the numeral are one event. The lower bound is not paranoia —
     `worn` is `rank` plus a delta the projector computed, and a stale diff that put it below 1
     would index off the front of METAL and blank the plate. A dark row is the safe fallback. */
  const worn = useWornRank(row.rank, delta, beat)
  const top3 = worn >= 1 && worn <= 3
  const pct = lead > 0 ? Math.round((row.score / lead) * TRACK_SPAN_PCT) : 0

  /* The slide. A grid item's own height IS the pitch, so `translateY(100%)` is exactly one row —
     no pitch value has to be threaded through, and it stays correct when the grid is given less
     height than the design's pitch. A climb (`delta > 0`) started BELOW its new slot, so it enters
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
        className="flex w-full items-center gap-[2.1vh]"
        style={{
          /* A percentage of the pitch with a line-height of 1 keeps the text inside the box at
             every stage height and still leaves a visible gap between every pair — which is what
             the spec's 2.4vh out of the 8.0vh pitch was protecting: no two rows ever touch. The
             paper strips are the taller of the two because they carry a border and a drop shadow
             that a dark row does not. */
          height: top3 ? 'min(6.4vh, 88%)' : 'min(5.6vh, 80%)',
          lineHeight: 1,
          /* Everything that follows sits ON the score track, which is absolutely positioned. This
             is the containing block that makes that true. */
          position: 'relative',
          overflow: 'hidden',
          paddingRight: '2.6vh',
          /* THE TOP THREE ARE PAPER, ranks 4–10 are screen. Cream against near-black is the one
             difference that is legible from the back of the hall before any numeral is.

             OPAQUE, not a translucent white wash. A 6% white overlay reads as a row on flat black
             and as nothing at all on the brown wall the whole game now stands on — the top six
             rows disappeared into it entirely while the four below the desk cut stayed visible,
             which is what "the leaderboard is gone" looked like. A dark row must carry its own
             ground so it cannot depend on what happens to be behind it. */
          background: top3 ? 'var(--det-paper)' : 'rgba(6, 8, 20, 0.86)',
          color: top3 ? 'var(--det-paper-ink)' : undefined,
          borderRadius: top3 ? '0.4vh' : '0 0.5vh 0.5vh 0',
          border: top3 ? '0.3vh solid #382c1f' : undefined,
          boxShadow: top3 ? '0.5vh 0.5vh 0 rgba(0, 0, 0, .5)' : undefined,
          fontFamily: 'var(--font-thai), system-ui, sans-serif',
          fontWeight: 700,
          fontSize: top3 ? '3.3vh' : '3.1vh',
        }}
      >
        {/*
          * THE SCORE TRACK — the gap, not the order. A ten-row board of numbers says who is ahead
          * but never by how much, and "second place is one question behind" and "second place is
          * five questions behind" are different rooms. The bar is this row's share of the leader's
          * score, drawn behind everything else the row carries.
          *
          * THE GRADIENT IS FAINTEST AT ITS START AND DENSEST AT ITS TERMINUS, which is the
          * opposite of the obvious direction. Fading OUT toward the right would put the faintest
          * ink exactly where the eye needs the end of the bar, and the row would read as "dark on
          * the right" — a shape with no edge — instead of "filled up to here".
          */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: '0 auto 0 0',
            width: `${pct}%`,
            background: top3
              ? 'linear-gradient(90deg, rgba(140, 89, 59, .04) 0%, rgba(140, 89, 59, .20) 100%)'
              : 'linear-gradient(90deg, rgba(120, 150, 220, .04) 0%, rgba(120, 150, 220, .24) 100%)',
            borderRight: top3
              ? '0.3vh solid rgba(140, 89, 59, .6)'
              : '0.35vh solid rgba(150, 175, 235, .6)',
          }}
        />

        {/* THE RANK PLATE — the metal and the numeral as ONE object, both read off this row's
            `rank`. They were a coloured rail and a separate number once, which is two places for
            the same fact to be written and two places for it to be wrong. The plate owns the ink
            as well as the ground, so {@link RankNumeral} must not set a colour of its own: gold on
            gold is invisible.

            Every sibling from here down carries `position: relative` so it paints above the track;
            an absolutely-positioned box otherwise sits over static in-flow siblings, and one
            forgotten `relative` puts the bar on top of a name. */}
        <span
          className="flex h-full shrink-0 items-center justify-center"
          style={{
            position: 'relative',
            width: top3 ? '7vh' : '6vh',
            background: top3 ? METAL[worn - 1] : 'rgba(255, 255, 255, .06)',
            color: top3 ? '#150f02' : '#c7d0e8',
            borderRight: top3 ? '0.3vh solid #382c1f' : undefined,
            borderLeft: top3 ? undefined : `0.7vh solid ${PLATE_EDGE}`,
          }}
        >
          <RankNumeral rank={row.rank} worn={worn} settled={settled} size={top3 ? '5vh' : '3.6vh'} />
        </span>

        {/*
          * THE RANK-CHANGE INDICATOR STAYS FIRST after the plate (spec §5) — before the avatar and
          * before the name. The eye should learn who climbed before it learns who they are. It
          * fades in over the same beat everything else moves on, so the arrow arrives as the row
          * settles rather than announcing the move before it happens.
          *
          * It carries HOW FAR, not just which way: a row that climbed four places and one that
          * climbed one are different events, and the artifact prints the distance beside the
          * arrowhead. A held place renders a dash in transparent ink so the column keeps its width
          * without saying anything.
          *
          * The neon palette does not exist on cream — `--det-green` on paper is a highlighter, not
          * a mark — so the three paper rows climb and fall in printer's ink instead.
          */}
        <span
          data-rank-change={direction}
          aria-hidden="true"
          className="w-[7.4vh] shrink-0 text-center"
          style={{
            position: 'relative',
            fontFamily: 'var(--font-retro), monospace',
            fontSize: top3 ? '3.2vh' : '3vh',
            opacity: reduced || settled ? 1 : 0,
            transition: reduced ? 'none' : `opacity ${STANDINGS_BEAT_MS}ms ease-out`,
            color:
              direction === 'up' ? (top3 ? '#1a7a35' : 'var(--det-green)')
                : direction === 'down' ? (top3 ? '#b3123c' : 'var(--det-pink)')
                  : 'transparent',
          }}
        >
          {direction === 'up' ? `▲${rowsMoved}` : direction === 'down' ? `▼${-rowsMoved}` : '–'}
        </span>

        {/* On paper the avatar is ringed, so it reads as a photograph clipped to the file rather
            than as an emoji dropped on a document. On the dark rows it stays the bare glyph.

            5.2vh, not the 6vh this was drawn at: the strip is `min(6.4vh, 88%)` and spends 0.6vh
            of it on its border, leaving 5.8vh of content box, so a 6vh ring was being shaved top
            and bottom by the row's own `overflow: hidden` — under a pixel at 900px, but a circle
            with two flats is a circle that looks slightly wrong for no reason anyone can name.
            5.2vh clears by 0.3vh on each side, which survives the row being squeezed as well. */}
        {top3 ? (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center"
            style={{
              position: 'relative',
              width: '5.2vh',
              height: '5.2vh',
              borderRadius: '50%',
              fontSize: '3.6vh',
              background: 'rgba(0, 0, 0, .06)',
              border: '0.28vh solid #8c593b',
            }}
          >
            {row.avatar}
          </span>
        ) : (
          <span aria-hidden="true" className="shrink-0" style={{ position: 'relative', fontSize: '3.4vh' }}>
            {row.avatar}
          </span>
        )}

        <span className="min-w-0 truncate" style={{ position: 'relative' }}>{row.codename}</span>

        {/* WHAT THIS ROW JUST SCORED, in the climb's own ink, SITTING AGAINST THE TOTAL rather than
            in a column of its own on the far side of the name. `+150` and `1,240` are one thought
            — what this question added, and what it added up to — and separating them made the eye
            travel the width of the row to join them. The pair is pushed right together by
            `ml-auto` on their wrapper, so the two numerals stay adjacent at any row width and the
            name keeps all the slack. Absent renders nothing: a player who scored zero on this
            question did not gain, and "+0" is a different statement from silence. */}
        <span className="ml-auto flex shrink-0 items-baseline gap-[1.4vh]" style={{ position: 'relative' }}>
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-retro), monospace',
              fontSize: '3.2vh',
              color: top3 ? '#1a7a35' : 'var(--det-green)',
              opacity: reduced || settled ? 1 : 0,
              transition: reduced ? 'none' : `opacity ${STANDINGS_BEAT_MS}ms ease-out`,
            }}
          >
            {gain !== undefined && gain > 0 ? `+${gain}` : ''}
          </span>
          <span
            className="tabular-nums"
            style={{
              fontFamily: 'var(--font-retro), monospace',
              fontSize: top3 ? '5vh' : '4.6vh',
              color: top3 ? '#8c593b' : '#e3e9f8',
            }}
          >
            {score.toLocaleString('en-US')}
          </span>
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
 * THE SCHEDULE IS NOT HERE. `worn` arrives from {@link useWornRank}, because the plate this
 * numeral sits on and the material the whole row is made of turn on the very same value at the
 * very same instant. Reimplementing the timer here is how the metal and the number came to
 * disagree for the first half of every beat; there must stay exactly one of it.
 *
 * `rank` is still taken, and only for `data-rank`: the attribute the tests query has to name the
 * rank this row actually holds, not the one it is mid-flip through.
 *
 * It sets NO colour of its own: it renders inside the rank plate, which owns both the ground and
 * the ink for all ten places. `size` is threaded in for the same reason — the plate decides how
 * big its own number is, and the numeral does not need to know which three places are on paper.
 */
function RankNumeral({ rank, worn, settled, size }: { rank: number; worn: number; settled: boolean; size: string }) {
  const reduced = usePrefersReducedMotion()
  /* The flip itself: the numeral closes to a line and opens on the other value, and the swap in
     `useWornRank` is timed to the closed frame. `worn !== rank` is only ever true while the beat
     is in its first half and the row actually moved — under reduced motion, on a held place and
     on a new arrival the hook returns `rank` and nothing closes. A cross-fade would leave both
     numbers legible at once, which is the ambiguity this is here to remove.

     `settled` is what makes the CLOSE animate rather than start closed. A CSS transition needs a
     painted frame to travel from, and the closed state is now correct on the very first render —
     so without one frame of `scaleY(1)` first, the old numeral would be a flat line for the whole
     first half of the beat and unreadable. This is the same one-frame trick the row's own slide
     uses, off the same flag, so the two cannot drift out of step. */
  const closing = settled && worn !== rank
  return (
    <span
      data-rank={rank}
      className="shrink-0 text-center tabular-nums"
      style={{
        width: '5.2vh',
        fontFamily: 'var(--font-retro), monospace',
        fontSize: size,
        display: 'inline-block',
        transform: closing ? 'scaleY(0.05)' : 'scaleY(1)',
        transition: reduced ? 'none' : `transform ${STANDINGS_BEAT_MS / 2}ms ease-in`,
      }}
    >
      {worn}
    </span>
  )
}

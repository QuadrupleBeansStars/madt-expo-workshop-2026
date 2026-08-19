'use client'
import { useCountUp, usePrefersReducedMotion, useStaggeredReveal } from './motion'

/**
 * No `playerId` (IMPORTANT 2, final whole-branch review) — `Podium` already keyed every row on
 * `rank`, never on the id, so there was nothing here that needed it. `/api/stats` stopped sending
 * it entirely; see components/game/Standings.tsx's LeaderboardRow for the full reasoning.
 */
export type PodiumEntry = {
  codename: string
  avatar: string
  score: number
  rank: number
}

/**
 * THREE DISTINCT WIDTHS, not three heights (spec §6). Container units, so the three cards keep
 * their proportions to each other and to the stage on any screen — the shape IS the ranking, and
 * it has to read from the back of a hall without anyone comparing numbers.
 */
const WIDTH: Record<number, string> = { 1: '29cqw', 2: '21cqw', 3: '17cqw' }
/** First place is lifted furthest, second half as far, third stands on the floor. */
const LIFT: Record<number, string> = { 1: '-9cqh', 2: '-3cqh', 3: '0cqh' }

// Visual left-to-right order (silver, gold, bronze) — classic podium shape, first place centre.
const VISUAL_ORDER = [2, 1, 3] as const

/**
 * The order the cards LAND in: third, then second, then first after a longer beat, then the
 * stamp. The gap before first place is the announcement; closing it makes the podium a list.
 *
 * Indexed by "how many have landed", so `revealed >= 1` is third place, `>= 3` is first, and
 * `>= 4` is the CASE CLOSED stamp. Under `prefers-reduced-motion` every step is taken on the
 * first effect — the end state, with no travel (see `useStaggeredReveal`).
 */
const LANDINGS = [350, 1250, 2600, 3500] as const
const LANDED_ORDER: Record<number, number> = { 3: 1, 2: 2, 1: 3 }

/**
 * The closing screen — the whole room's final standings, three deep.
 *
 * THE CARDS ARE PINNED EVIDENCE CARDS, not three coloured plinths (spec §6). A plinth is
 * game-show language; the pinned card is the same object the lobby board is made of, so the end
 * of the game is visibly the same world as the start. First place additionally gets a crown, a
 * gold border, a glow and a spotlight — and the spotlight lights only when the card lands, so it
 * reads as an arrival rather than as a lit stage that happened to gain a card.
 *
 * EACH SCORE COUNTS UP FROM ZERO AS ITS CARD LANDS. The climbing number is the announcement; a
 * number already sitting there when the card appears throws away half the beat.
 *
 * `top` may be shorter than three (a workshop that never reached three scoring players) — a
 * missing rank renders an empty slot rather than crashing or guessing a name.
 */
export function Podium({ top, detectives }: { top: PodiumEntry[]; detectives: number }) {
  const reduced = usePrefersReducedMotion()
  const revealed = useStaggeredReveal(LANDINGS)
  const byRank = (rank: number) => top.find((entry) => entry.rank === rank)

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-between">
      <h1 className="det-screen-title shrink-0">
        คดีปิดแล้ว
        {/* English — `.det-screen-title small` is Press Start 2P, which has no Thai glyphs. */}
        <small>{`TOP 3 OF ${detectives} DETECTIVES`}</small>
      </h1>

      {/*
        * THE CONTAINER the `cqw`/`cqh` above resolve against, and the reason it is TWO elements.
        *
        * `container-type: size` (not `inline-size`) is what makes `cqh` exist at all — inline-size
        * gives width units only. But a size container's block size has to be DEFINITE, and a
        * height that merely comes out of `flex: 1 1 0%` is not: measured in Chrome, `9cqw`
        * resolved correctly while `9cqh` resolved to ZERO on exactly this markup, so every lift
        * below silently became `translateY(0)` and the podium rendered as three cards standing on
        * one line. Nothing errored, and no unit test could have seen it.
        *
        * An absolutely-positioned box with `inset: 0` takes its height from its containing block
        * rather than from the flex algorithm, which IS definite — same measurement, `9cqh` = 35px.
        * So the outer element owns the flex slot and the inner one owns the container.
        */}
      <div className="relative min-h-0 w-full flex-1">
        <div
          className="absolute inset-0 flex items-end justify-center gap-[3cqw]"
          style={{ containerType: 'size' }}
        >
          {VISUAL_ORDER.map((rank) => (
            <PodiumCard
              key={rank}
              rank={rank}
              entry={byRank(rank)}
              landed={revealed >= LANDED_ORDER[rank]}
              reduced={reduced}
            />
          ))}
        </div>
      </div>

      {/* The stamp lands last, over the whole screen's worth of result. `.stamp-slam` is the same
          motion the reveal's verdict uses, and app/globals.css already collapses it under
          `prefers-reduced-motion` — the JS above is what keeps its TIMING honest there too. */}
      <div className="flex h-[12vh] shrink-0 items-center justify-center">
        {revealed >= 4 ? (
          <div
            className="stamp-slam"
            style={{
              fontFamily: 'var(--font-pixel), monospace',
              fontSize: '5.4vh',
              letterSpacing: '0.4vh',
              color: '#b32d2d',
              border: '0.6vh solid #b32d2d',
              borderRadius: '1vh',
              padding: '1vh 3vh',
              background: 'rgba(255, 251, 242, 0.94)',
            }}
          >
            CASE CLOSED
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PodiumCard({
  rank, entry, landed, reduced,
}: {
  rank: number
  entry: PodiumEntry | undefined
  landed: boolean
  reduced: boolean
}) {
  const first = rank === 1
  const score = useCountUp(entry?.score ?? 0, 900, landed)
  /* A card is pinned, so it hangs at a slight angle — alternating by seat so the three do not read
     as a printed table. Small enough (±1.4°) that nothing collides with its neighbour. */
  const tilt = rank === 2 ? -1.4 : rank === 3 ? 1.4 : 0

  return (
    <div
      className="relative flex flex-col items-center"
      style={{
        width: WIDTH[rank],
        transform: `translateY(${landed ? LIFT[rank] : '4cqh'})`,
        opacity: landed ? 1 : 0,
        transition: reduced ? 'none' : 'transform 0.55s cubic-bezier(0.2, 1.3, 0.4, 1), opacity 0.35s ease-out',
      }}
    >
      {/* The spotlight, first place only, lit only once the card has landed. Behind the card and
          pointer-events-free, so it can never eat a click or a measurement. */}
      {first ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-[-6cqw] bottom-[-2cqh] top-[-6cqh]"
          style={{
            background: 'radial-gradient(ellipse at 50% 30%, rgba(255,215,0,0.30), rgba(255,215,0,0) 68%)',
            opacity: landed ? 1 : 0,
            transition: reduced ? 'none' : 'opacity 0.7s ease-out',
          }}
        />
      ) : null}

      {first ? (
        <div aria-hidden="true" className="relative" style={{ fontSize: '6vh', lineHeight: 1 }}>👑</div>
      ) : null}

      <div
        className="det-paper relative w-full"
        style={{
          transform: `rotate(${tilt}deg)`,
          border: first ? '0.5vh solid var(--det-gold)' : '0.4vh solid #382c1f',
          borderRadius: '1vh',
          boxShadow: first
            ? '0.6vh 0.6vh 0 rgba(0,0,0,0.5), 0 0 4vh rgba(255,215,0,0.55)'
            : '0.6vh 0.6vh 0 rgba(0,0,0,0.5)',
          padding: '2vh 1.2vh 1.6vh',
          fontFamily: 'var(--font-thai), system-ui, sans-serif',
          fontWeight: 700,
          textAlign: 'center',
        }}
      >
        {/* The pin head — the same object the lobby board pins its name cards with. */}
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-[-1.1vh] block rounded-full"
          style={{
            width: '2.2vh', height: '2.2vh', marginLeft: '-1.1vh',
            background: first ? '#b32d2d' : '#7a5a3a',
            boxShadow: '0 0.3vh 0 rgba(0,0,0,0.45)',
          }}
        />
        <div
          className="det-term"
          style={{ fontSize: first ? '4.6vh' : '3.6vh', color: '#8c593b', lineHeight: 1 }}
        >
          {`#${rank}`}
        </div>
        {entry ? (
          <>
            <div style={{ fontSize: first ? '6vh' : '4.6vh', lineHeight: 1.1 }} aria-hidden="true">{entry.avatar}</div>
            <div className="truncate" style={{ fontSize: first ? '4.2vh' : '3.4vh', lineHeight: 1.2 }}>
              {entry.codename}
            </div>
            <div
              className="det-term tabular-nums"
              style={{ fontSize: first ? '5.4vh' : '4.2vh', color: '#b32d2d', lineHeight: 1.1 }}
            >
              {score}
            </div>
          </>
        ) : (
          <div style={{ fontSize: '3.4vh', color: '#8c593b' }}>—</div>
        )}
      </div>
    </div>
  )
}

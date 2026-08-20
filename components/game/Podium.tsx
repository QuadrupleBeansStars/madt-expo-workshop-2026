'use client'
import { useCountUp, usePrefersReducedMotion, useStaggeredReveal } from './motion'

/**
 * No `playerId` (IMPORTANT 2, final whole-branch review) — `Podium` already keyed every row on
 * `rank`, never on the id, so there was nothing here that needed it. `/api/stats` stopped sending
 * it entirely; see components/game/Standings.tsx for the full reasoning.
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
/** First place is lifted furthest, second a third as far, third stands on the floor. */
const LIFT: Record<number, string> = { 1: '-9cqh', 2: '-3cqh', 3: '0cqh' }
/** A pinned card hangs at a slight angle, alternating by seat so the three do not read as a
 *  printed table. First place hangs straight — it is the one the room is looking at. */
const TILT: Record<number, number> = { 1: 0, 2: -2.5, 3: 2.5 }

/**
 * GOLD, SILVER, BRONZE — the same three metals the standings' rails already use, so a room that
 * has watched nine leaderboards reads the podium's three places without comparing any numbers.
 * First place additionally keeps its glow; the other two are frames only.
 */
const FRAME: Record<number, string> = { 1: 'var(--det-gold)', 2: '#cdd4e0', 3: '#c07f3a' }

/**
 * The width of the SLOT each flanking card sits in, not of the card. Both flanks take the wider of
 * the two, so first place lands exactly on the centre line of the stage instead of being pushed
 * off it by 4cqw of difference between second and third. The cards keep their own three distinct
 * widths inside those slots — the shape IS the ranking.
 */
const FLANK_SLOT = '21cqw'

/**
 * EVERY SIZE ON THE CARDS IS `cqh`/`cqw`, NOT `vh`. The three widths already were, so sizing the
 * type in `vh` meant the type and the card it sits in scaled against two different things: on a
 * stage shorter than the viewport (which is every stage here — the HUD and the status band are
 * paid for first) the name outgrew its own card. The container is declared once, below.
 */
const TYPE: Record<number, { rank: string; avatar: string; name: string; score: string }> = {
  1: { rank: '3cqh', avatar: '13cqh', name: '4.4cqh', score: '6.4cqh' },
  2: { rank: '2.2cqh', avatar: '8cqh', name: '3.3cqh', score: '4.6cqh' },
  3: { rank: '2cqh', avatar: '6cqh', name: '2.9cqh', score: '4cqh' },
}
const LABEL: Record<number, string> = { 1: '1ST', 2: '2ND', 3: '3RD' }

// Visual left-to-right order (silver, gold, bronze) — classic podium shape, first place centre.
const VISUAL_ORDER = [2, 1, 3] as const

/**
 * The order the cards LAND in: third, then second, then first after a longer beat, then the title,
 * then the stamp. The gap before first place is the announcement; closing it makes the podium a
 * list. The artifact's own schedule is a 1150ms step with first place at step x 3.5, the title at
 * x 4.3 and the stamp at x 4.9.
 *
 * Indexed by "how many have landed", so `revealed >= 1` is third place, `>= 3` is first, `>= 4` is
 * the title and `>= 5` is the CASE CLOSED stamp. Under `prefers-reduced-motion` every step is
 * taken on the first effect — the end state, with no travel (see `useStaggeredReveal`).
 */
const STEP = 1150
const LANDINGS = [STEP, STEP * 2, STEP * 3.5, STEP * 4.3, STEP * 4.9] as const
const LANDED_ORDER: Record<number, number> = { 3: 1, 2: 2, 1: 3 }

/**
 * The closing screen — the whole room's final standings, three deep.
 *
 * THE CARDS ARE PINNED EVIDENCE CARDS, not three coloured plinths (spec §6). A plinth is
 * game-show language; the pinned card is the same object the lobby board is made of, so the end of
 * the game is visibly the same world as the start. First place additionally gets a crown ABOVE the
 * card rather than in the flow above it, a gold border, a glow and a spotlight — and the spotlight
 * lights only when the card lands, so it reads as an arrival rather than as a lit stage that
 * happened to gain a card.
 *
 * EACH SCORE COUNTS UP FROM ZERO AS ITS CARD LANDS. The climbing number is the announcement; a
 * number already sitting there when the card appears throws away half the beat.
 *
 * THE STAMP LANDS OVER THE CARDS, centred on the screen and rotated -11 degrees, slamming in from
 * three times its size — not in a reserved band underneath them, where it was one more row in a
 * column rather than something stamped on the result.
 *
 * `top` may be shorter than three (a workshop that never reached three scoring players) — a
 * missing rank renders an empty slot rather than crashing or guessing a name.
 */
export function Podium({ top, detectives }: { top: PodiumEntry[]; detectives: number }) {
  const reduced = usePrefersReducedMotion()
  const revealed = useStaggeredReveal(LANDINGS)
  const byRank = (rank: number) => top.find((entry) => entry.rank === rank)

  return (
    /*
     * TWO ELEMENTS, and the reason is measured rather than stylistic.
     *
     * `container-type: size` (not `inline-size`) is what makes `cqh` exist at all — inline-size
     * gives width units only. But a size container's block size has to be DEFINITE, and a height
     * that merely comes out of `flex: 1 1 0%` is not: measured in Chrome, `9cqw` resolved correctly
     * while `9cqh` resolved to ZERO on exactly this markup, so every lift silently became
     * `translateY(0)` and the podium rendered as three cards standing on one line. Nothing errored,
     * and no unit test could have seen it.
     *
     * An absolutely-positioned box with `inset: 0` takes its height from its containing block
     * rather than from the flex algorithm, which IS definite. So the outer element owns the flex
     * slot and the inner one owns the container.
     */
    <div className="relative min-h-0 w-full flex-1">
      <div className="absolute inset-0" style={{ containerType: 'size' }}>
        {/* The spotlight, first place only, lit only once its card has landed. Bottom-anchored and
            behind everything, so it reads as a beam from above rather than as a glow on the card. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: '46cqw',
            height: '74cqh',
            /* A RADIAL cone, not a linear wash inside a box: the linear one faded at the top and
               kept two hard vertical edges all the way down, which on a flat ground reads as a
               grey rectangle rather than as light. */
            background: 'radial-gradient(ellipse 58% 100% at 50% 100%, rgba(255,231,178,0.30), rgba(255,231,178,0) 72%)',
            opacity: revealed >= 3 ? 1 : 0,
            transition: reduced ? 'none' : 'opacity 0.6s ease',
          }}
        />

        <h1
          /* NO `-translate-x-1/2` HERE. Tailwind v4 emits that utility as the standalone
             `translate` property, which COMPOSES with `transform` rather than being overridden by
             it — so this title, which needs an inline `transform` for its landing animation, was
             shifted by half its width twice and sat 405px left of centre (measured). The inline
             transform below owns the centring; the utility would silently double it. */
          className="det-screen-title absolute text-center" 
          style={{
            top: '4cqh',
            left: '50%',
            opacity: revealed >= 4 ? 1 : 0,
            transform: `translateX(-50%) scale(${revealed >= 4 ? 1 : 0.86})`,
            transition: reduced ? 'none' : 'opacity 0.5s ease, transform 0.5s cubic-bezier(0.2, 1.5, 0.4, 1)',
          }}
        >
          คดีปิดแล้ว
          {/* English — `.det-screen-title small` is Press Start 2P, which has no Thai glyphs. */}
          <small>{`TOP 3 OF ${detectives} DETECTIVES`}</small>
        </h1>

        {/* CENTRED ON BOTH AXES. The group used to be pinned to `bottom: 13cqh`, which left it
            sitting low with a band of desk under it and the title floating a long way above; and
            because second and third are different widths, `justify-center` on the row put first
            place off the centre line. Equal flanking slots fix the second half of that. */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* `translateY` compensates for the LIFTS: they raise the cards visually without
              changing the row's layout height, so a row centred by the flexbox sits high on the
              screen by half the largest lift. Half of 9cqh puts the group's visible centre on the
              stage's. */}
          <div className="flex items-end justify-center gap-[2.6cqw]" style={{ transform: 'translateY(4.5cqh)' }}>
            {VISUAL_ORDER.map((rank) => (
              <div
                key={rank}
                className="flex justify-center"
                style={{ width: rank === 1 ? undefined : FLANK_SLOT }}
              >
                <PodiumCard
                  rank={rank}
                  entry={byRank(rank)}
                  landed={revealed >= LANDED_ORDER[rank]}
                  reduced={reduced}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Last, over the whole screen's worth of result. */}
        <div
          aria-hidden={revealed >= 5 ? undefined : 'true'}
          /* Same Tailwind v4 trap as the title above: `left` goes inline, never as a utility
             paired with an inline `transform`. */
          className="absolute z-30"
          style={{
            /* ON THE DESK, below the cards — not across the top of first place.
               At 24cqh it landed straight through "คดีปิดแล้ว", through the cyan TOP 3 OF n line
               and over the crown and the 1ST label: four things unreadable at once, because the
               cards sit higher here than in the sketch and the stamp had nothing to land on but
               content. The desk band under the cards was carrying nothing at all, which is what
               the room reads as "the layout is not centred". One move fixes both. */
            top: '85cqh',
            left: '50%',
            fontFamily: 'var(--font-pixel), monospace',
            fontSize: '5.6cqh',
            letterSpacing: '0.08em',
            color: 'rgba(206, 46, 46, 0.92)',
            border: '0.8cqh solid rgba(206, 46, 46, 0.88)',
            borderRadius: '1cqh',
            padding: '2cqh 3cqw',
            whiteSpace: 'nowrap',
            opacity: revealed >= 5 ? 1 : 0,
            transform: `translate(-50%, -50%) rotate(-11deg) scale(${revealed >= 5 ? 1 : 3})`,
            transition: reduced ? 'none' : 'opacity 0.12s ease, transform 0.4s cubic-bezier(0.2, 1.6, 0.35, 1)',
          }}
        >
          CASE CLOSED
        </div>
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
  const type = TYPE[rank]

  return (
    <div
      className="det-paper relative"
      style={{
        width: WIDTH[rank],
        padding: '2cqh 1.2cqw 1.6cqh',
        textAlign: 'center',
        fontFamily: 'var(--font-thai), system-ui, sans-serif',
        fontWeight: 700,
        borderRadius: '0.6cqh',
        border: `0.6cqh solid ${FRAME[rank]}`,
        /* NO DROP SHADOW. The pin, the tilt and the paper are what make these cards physical; the
           shadow under them only muddied the three metal frames the ranking is now encoded in.
           First place keeps its GLOW, which is light rather than shadow and is the announcement. */
        boxShadow: first ? '0 0 4cqh rgba(255,215,0,0.5)' : undefined,
        opacity: landed ? 1 : 0,
        transform: landed
          ? `translateY(${LIFT[rank]}) scale(1) rotate(${TILT[rank]}deg)`
          : `translateY(16cqh) scale(0.75) rotate(${TILT[rank]}deg)`,
        transition: reduced ? 'none' : 'opacity 0.45s ease, transform 0.75s cubic-bezier(0.2, 1.45, 0.4, 1)',
      }}
    >
      {/* The pin head — the same object the lobby board pins its name cards with, in the same red. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 block rounded-full"
        style={{
          top: '-1.1cqh', width: '2cqh', height: '2cqh', marginLeft: '-1cqh',
          background: '#d4342f',
          boxShadow: 'inset -0.35cqh -0.35cqh 0 rgba(0,0,0,0.35), 0 0.3cqh 0.5cqh rgba(0,0,0,0.5)',
        }}
      />

      {/* The crown sits ABOVE the card, clear of it, rather than as a row inside the flow — it is
          on the winner's head, not printed on their file. */}
      {first ? (
        <span
          aria-hidden="true"
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: '-6cqh', fontSize: '5cqh', lineHeight: 1 }}
        >
          👑
        </span>
      ) : null}

      {/* Latin — the pixel face has no Thai glyphs. */}
      <div
        className="det-pixel"
        style={{ fontSize: type.rank, letterSpacing: '0.06em', color: first ? '#a8801a' : '#8a6a52' }}
      >
        {LABEL[rank]}
      </div>
      {entry ? (
        <>
          <div style={{ fontSize: type.avatar, lineHeight: 1.1, margin: '0.5cqh 0' }} aria-hidden="true">
            {entry.avatar}
          </div>
          <div className="truncate" style={{ fontSize: type.name, lineHeight: 1.2 }}>{entry.codename}</div>
          <div
            className="det-term tabular-nums"
            style={{ fontSize: type.score, color: '#8a6a00', lineHeight: 1.1 }}
          >
            {score.toLocaleString('en-US')}
          </div>
        </>
      ) : (
        <div style={{ fontSize: type.name, color: '#8a6a52' }}>—</div>
      )}
    </div>
  )
}

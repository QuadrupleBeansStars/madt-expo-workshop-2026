import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'
import { currentQuestion, LOBBY_CARDS, STANDINGS_PLACES } from '@/lib/game'

export const dynamic = 'force-dynamic'

export async function GET() {
  const store = getStore()
  const q = currentQuestion(store.getGameState())
  return NextResponse.json({
    // Ten places (v3.2 §5). A hundred names still do not fit a projector; ten do, and the
    // count is pinned in lib/game.ts beside the renderer's own so the two cannot drift.
    //
    // NO playerId. This is an unauthenticated GET reachable by any phone on the LAN, and
    // /api/answer's first-wins semantics accept ANY playerId with no ownership check — publishing
    // the top five's real ids here would let a phone read them off this payload and lock a wrong
    // answer in for someone else before they tap. /tv never needed the id: it only ever used it
    // as a React key (TopFive, the lobby's player list), and Podium already keyed on `rank`
    // instead — everything now does. `getLeaderboard()` itself still returns `playerId`; only this
    // wire projection drops it, because `getPublicState`'s own `you` lookup needs it internally.
    leaderboard: store.getLeaderboard().slice(0, STANDINGS_PLACES).map(({ playerId, ...row }) => row),
    /*
     * The lobby's pinned name cards (spec §4) — the MOST RECENT arrivals, in join order, capped at
     * LOBBY_CARDS. This cannot be read off `leaderboard` above, and the difference
     * is the whole point: in a lobby nobody has scored yet, so `getLeaderboard`'s tie-break sorts
     * by codename, and a top-5 slice of that is the five alphabetically-first names in the room.
     * A player who joins as "วิทยา" would watch eleven other people appear and never see
     * themself — the exact opposite of what this screen is for ("your name appeared, you are in").
     *
     * "Top 5 only" is not in tension with this: that rule is about the ranked board, which this is
     * not. The authoritative room size is still `playerCount` below, printed as a number.
     *
     * Sliced HERE rather than on the projector so the cap has one home and an unbounded roster
     * never goes over the wire every 1.5s. Destructured into a
     * fresh object, never spread-and-omitted, so `id`, `joinedAt` and `spectator` cannot ride
     * along — the same no-playerId rule the leaderboard above follows, for the same reason.
     */
    recent: store.getPlayers().filter((p) => !p.spectator).slice(-LOBBY_CARDS)
      .map(({ codename, avatar }) => ({ codename, avatar })),
    split: q ? store.getSplit(q.id) : null,
    roomWrongPass: store.getRoomWrongPass(),
    playerCount: store.getPlayers().filter((p) => !p.spectator).length,
  })
}

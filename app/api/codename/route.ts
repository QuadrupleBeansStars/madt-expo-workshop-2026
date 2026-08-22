import { NextResponse } from 'next/server'
import { getStore } from '@/lib/store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/codename — one free codename, dealt from the pool. The server half of the 🎲 button.
 *
 * The phone used to draw locally out of a 15-name list, which collides: 100 independent draws from
 * 150 names produce only ~73 distinct ones, so about 27 people would carry `นักสืบราเมง 2` on the
 * projector. Only the room knows what is already taken, so the room deals —
 * `MemoryRoomStore#dealCodename` carries the full reasoning, including what happens at player 151
 * and why a dealt name is deliberately NOT reserved.
 *
 * IT RETURNS NOTHING BUT A NAME. No playerId, no roster, no counts, not even the number of names
 * left. This is an unauthenticated GET reachable by any phone on the LAN — the same class as
 * /api/state and /api/stats — and app/api/stats/route.ts spells out the reason its leaderboard
 * drops `playerId`: /api/answer accepts ANY playerId with no ownership check, so anything that
 * publishes real ids lets a phone lock a wrong answer in for someone else. The same reasoning
 * applies to every field that could ride along here, and the cheapest way to honour it on a route
 * whose entire job is one string is to send one string. `app/api/routes.test.ts` asserts the
 * response has exactly one key, so a later "while we're here, send the count too" cannot pass
 * quietly.
 *
 * `force-dynamic` for the same reason as its neighbours: this reads live room state and must run
 * per request. A cached response would hand every phone in the venue the same name, which is the
 * precise failure the route exists to prevent.
 *
 * NOT AUTHENTICATED, unlike /api/control and /api/reset. There is nothing to protect: the reply is
 * a name from a list that is in the public repo, it mutates nothing, and the join path validates
 * whatever finally arrives regardless of where the player got it.
 */
export async function GET() {
  return NextResponse.json({ codename: getStore().dealCodename() })
}

import { NextResponse } from 'next/server'
import { getRoomStore } from '@/lib/room-store'

/**
 * The lobby board's names, and nothing else.
 *
 * A ROUTE OF ITS OWN rather than a field on `/api/room/state`, for the same reason AI Detective
 * keeps `/api/stats` apart from `/api/state`: two hundred phones poll the state endpoint once a
 * second and none of them draws a name board. A hundred thirty-character names is a few kilobytes
 * — trivial for the one projector that wants them, and 200×/second of pure waste over a venue LAN
 * for everyone who does not.
 *
 * NAMES ONLY. No ids, no answers, no join times: this is the one endpoint that is not behind the
 * facilitator token (the projector reads it before a host has typed anything), so it must not be
 * able to tell anyone anything a person in the room cannot already read off the wall.
 *
 * JOIN ORDER, oldest first. The board seats arrivals as they come and keeps every card where it
 * was put; a re-sorted list would reshuffle the whole wall between polls.
 */
export async function GET() {
  return NextResponse.json({ names: getRoomStore().getPlayers().map((p) => p.name) })
}

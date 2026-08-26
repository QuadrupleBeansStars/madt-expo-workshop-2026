/**
 * How long a player's name may be, in BOTH workshops.
 *
 * TWENTY, and the number is a display decision rather than a storage one. The lobby board shows
 * the name a player typed IN FULL — the host reads them out and teases the room with them, which
 * is most of what the join screen is for — so the cap is whatever the board can seat, and the
 * board is what was measured to pick it: at thirty, a room of a hundred could not be drawn at a
 * size the back of a hall can read; at twenty it can. Both boards page rather than truncate — a
 * room of 200 at this length is five pages on either projector, and every name reaches the wall.
 * `components/game/lobby-packer.test.ts` checks the packer never overlaps two of them, and
 * `npm run check:projector` measures the lobby with a hundred of them in it.
 *
 * It is enforced at the DOOR (app/api/join, app/api/room/join) and nowhere else. A name that
 * reached the store longer than this would be truncated on the board with an ellipsis, and a
 * player looking for a name that does not match what they typed is the failure this prevents.
 * The phone's own `maxLength` is a courtesy on top of it, never the guard.
 */
export const NAME_MAX = 20

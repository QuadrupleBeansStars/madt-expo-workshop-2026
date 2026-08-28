/**
 * How long a player's name may be, in BOTH workshops.
 *
 * THIRTY, raised from twenty at the team's request, and the number is a display decision rather
 * than a storage one. The lobby board shows the name a player typed IN FULL — the host reads them
 * out and teases the room with them, which is most of what the join screen is for — so the cap is
 * whatever the board can seat.
 *
 * WHAT THE EXTRA TEN CHARACTERS COST. Twenty was picked by measuring the board: it is the length
 * at which a room of a hundred still draws at a size the back of a hall can read. At thirty the
 * same hundred names take about half again as much width, so the packer seats fewer per shelf and
 * the board pages sooner — the room still sees every name, it just takes more pages to get there.
 * That is the trade the team made knowingly, and Café Persona is the reason: its field asks for a
 * SHOP name now ("ชื่อร้านของคุณ"), not a nickname, and shop names are longer than nicknames.
 *
 * Both boards page rather than truncate, so no name is ever cut off. `lobby-packer.test.ts` checks
 * the packer never overlaps two of them, and `npm run check:projector` measures the lobby with a
 * hundred of them in it — run it after changing this number, because it is the only thing that
 * actually sees the board.
 *
 * It is enforced at the DOOR (app/api/join, app/api/room/join) and nowhere else. A name that
 * reached the store longer than this would be truncated on the board with an ellipsis, and a
 * player looking for a name that does not match what they typed is the failure this prevents.
 * The phone's own `maxLength` is a courtesy on top of it, never the guard.
 */
export const NAME_MAX = 30

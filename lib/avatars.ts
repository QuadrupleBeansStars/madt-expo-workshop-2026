import { emojiFor } from './codenames'

/**
 * THE FACE COMES FROM THE NAME. `avatarFor` takes a CODENAME, not a playerId — that argument
 * change is the whole point of this file and not a refactor.
 *
 * It used to hash the playerId, which is a random UUID, so `นักสืบราเมง` got 🎩 or 🧭 or whatever
 * else the bag held — a name about ramen next to a face about hats, on the projector, in front of
 * the room. Now a name from the 150-strong pool in lib/codenames.ts carries its own emoji and
 * nothing else can be handed to it.
 *
 * Still derived, never chosen: a character-select step costs a screen and thirty seconds of a
 * workshop that has eight minutes, and buys nothing — the avatar exists so a player can find
 * themselves in the leaderboard and on the podium, not to express anything.
 *
 * THREE CASES, and all three arrive here:
 *
 *   1. A NAME FROM THE POOL (`นักสืบราเมง`) — its own emoji, 🍜, every process, every restart,
 *      every machine. This is what the 🎲 button deals.
 *   2. THE SAME NAME AFTER THE STORE SUFFIXED IT (`นักสืบราเมง 2`) — the SAME 🍜. See below.
 *   3. A NAME THE PLAYER TYPED (`เป็ดทอง`) — the fallback set, hashed. The COMMON case: most
 *      players type something of their own, and the dice is the shortcut for the ones who do not.
 */

/**
 * The fallback faces: detective props, deliberately generic, for a name this file cannot know
 * anything about.
 *
 * A TYPED NAME CANNOT GET A MATCHING EMOJI and there is no clever way around it. Matching means
 * understanding the word — `เป็ดทอง` is a golden duck, `น้องหมี` is a bear, `Ratchada 5` is a road
 * — and the only mechanisms available are a dictionary of every Thai noun (which does not exist
 * here) or an LLM call on the join path (which would put a network round-trip and a bill in front
 * of a player standing at a booth). So typed names get a prop from the kit instead: not related to
 * the name, but stable, legible and unmistakably part of the same game as the pool's faces.
 *
 * Six of these ten also appear in the pool (🔍 แว่นขยาย, 🎩 หมวกสืบ, 🧭 เข็มทิศ, 🗝️ กุญแจ,
 * 📎 คลิปหนีบ, 🕯️ ลอยกระทง) and that overlap is accepted: the pool's own 150 faces are unique
 * AMONG THEMSELVES, which is what stops two dealt names sharing a face. A typed name colliding
 * with a dealt one is a different, much rarer picture, and the two rows still read as two
 * different names.
 */
export const AVATARS = ['🕵️', '🔍', '🎩', '🧢', '🥸', '🦉', '🧭', '🗝️', '🕯️', '📎'] as const

/**
 * Strips a trailing ` <digits>`, which is the shape `MemoryRoomStore#uniqueCodename` appends to
 * the second and third holder of a name: `นักสืบราเมง` -> `นักสืบราเมง 2` -> `นักสืบราเมง 3`.
 *
 * WITHOUT THIS, matching on the exact string, `นักสืบราเมง` would get the ramen bowl and
 * `นักสืบราเมง 2` would fall through to the hash and get a hat — two rows on the same leaderboard
 * reading as the same detective with two different faces, which is the confusion the pool exists
 * to remove.
 *
 * THIS COUPLES TO `uniqueCodename`'s FORMAT AND THE TWO MUST CHANGE TOGETHER. If the store ever
 * switches to `นักสืบราเมง (2)` or `นักสืบราเมง#2`, this regex silently stops matching and every
 * duplicate quietly goes back to a mismatched face — no error, no test failure unless one is
 * written against the store's actual output (lib/avatars.test.ts has one).
 *
 * Applied ONCE, not in a loop, and to typed names too. That leaves one case it cannot win:
 * someone who types `Agent 007` bases to `Agent`, while the second such player (`Agent 007 2`,
 * per `uniqueCodename`'s own worked example) bases to `Agent 007` — so those two get different
 * faces. That ambiguity is undecidable from the string alone and `uniqueCodename` already owns
 * the same one, for the same reason: stripping harder turns a second `Agent 007` into `Agent 8`,
 * which is not that player's name at all.
 */
function baseCodename(codename: string): string {
  return codename.replace(/ \d+$/, '')
}

export function avatarFor(codename: string): string {
  const base = baseCodename(codename)
  const own = emojiFor(base)
  if (own) return own

  /*
   * A typed name. FNV-1a over the CODENAME, not the playerId: deterministic across processes and
   * restarts (which `Math.random()` would not be, and which the persisted room state depends on),
   * and now stable per NAME — the same typed name gets the same face in every room, on every
   * machine, and the suffixed form gets its base's face because `base` is what is hashed.
   */
  let h = 0x811c9dc5
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return AVATARS[Math.abs(h) % AVATARS.length]
}

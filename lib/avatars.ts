/**
 * Detective avatars, assigned at join from the playerId.
 *
 * Derived rather than chosen on purpose: a character-select step costs a screen and thirty seconds
 * of a workshop that has eight minutes, and buys nothing — the avatar exists so a player can find
 * themselves in the leaderboard and on the podium, not to express anything.
 */
export const AVATARS = ['🕵️', '🔍', '🎩', '🧢', '🥸', '🦉', '🧭', '🗝️', '🕯️', '📎'] as const

export function avatarFor(playerId: string): string {
  // FNV-1a. Deterministic across processes and restarts, which Math.random() would not be.
  let h = 0x811c9dc5
  for (let i = 0; i < playerId.length; i++) {
    h ^= playerId.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return AVATARS[Math.abs(h) % AVATARS.length]
}

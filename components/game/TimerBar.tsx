/**
 * The question clock: a cyan bar along the very bottom edge of the screen, the full width of it,
 * draining left to right.
 *
 * IT MOVED THERE FROM A FRAMED BADGE IN THE TOP-LEFT CORNER, and that is the approved artifact's
 * arrangement rather than a preference. This bar is the one affordance on the projector that means
 * "you may answer now" — spec §2 turns on that being unmistakable, which is also why `reading` has
 * no bar at all and gets ten dots instead. At the full width of the screen the room cannot miss it
 * starting, and a shrinking edge is read without being looked at; a 16vw bar inside a badge beside
 * a phase plate had to be found first.
 *
 * Purely presentational: `remainingMs`/`totalMs` come from `PublicGameState.remainingMs` and
 * `lib/game.ts`'s `QUESTION_MS`, both server-authoritative. This component does no counting of its
 * own — the width just reflects whatever the last poll said.
 *
 * The fill's `width`/`background` tween lives in the `.timer-fill` CLASS (app/globals.css), not an
 * inline `style.transition` — an inline style always beats a stylesheet selector on specificity,
 * so `prefers-reduced-motion: reduce` could never have overridden it from a class rule if the
 * transition itself stayed inline. The width/colour still snap to the correct value on every poll
 * under reduced motion; only the interpolation between polls goes away.
 */
export function TimerBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const clamped = Math.max(0, Math.min(remainingMs, totalMs))
  const pct = totalMs > 0 ? (clamped / totalMs) * 100 : 0
  const seconds = Math.ceil(clamped / 1000)
  /* The last quarter turns alarm-coloured. A room glancing up in the last four seconds gets the
     urgency from the colour before it gets it from the length. */
  const urgent = pct <= 25

  return (
    <div
      className="w-full shrink-0 overflow-hidden"
      style={{ height: '1.8vh', background: 'rgba(255, 255, 255, 0.12)' }}
      role="progressbar"
      aria-valuenow={seconds}
      aria-valuemin={0}
      aria-valuemax={Math.ceil(totalMs / 1000)}
    >
      <div
        className="timer-fill h-full"
        style={{ width: `${pct}%`, background: urgent ? 'var(--det-pink)' : 'var(--det-cyan)' }}
      />
    </div>
  )
}

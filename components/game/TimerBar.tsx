/**
 * The question clock. Replaces v2's `Countdown` (deleted with this task) with a BAR, not just
 * digits — a shrinking bar reads at a glance from the back of a room, a number has to be read.
 *
 * Purely presentational: `remainingMs`/`totalMs` come from `PublicGameState.remainingMs` and
 * `lib/game.ts`'s `QUESTION_MS`, both server-authoritative. This component does no counting of
 * its own — the width just reflects whatever the last poll said.
 *
 * Placed at the LEFT of the question header, beside the question number — never on the right,
 * where the host's control bar is pinned (`absolute right-4 top-4`). That exact right-hand spot
 * is what swallowed v2's clock whole (commit 691ab7f: measured occlusion, clock x1190-1334 vs
 * bar x1097-1350, one full workshop run with no visible countdown at all).
 *
 * Narrower since v3.1 (was 28vw/260px): this now sits inside the HUD's framed timer badge, and
 * `.det-hud`'s `justify-content: space-between` only lands the phase plate near the middle of the
 * screen while the two outer slots are comparable widths. At 260px the badge was half again as
 * wide as the host's control panel opposite it and pushed the plate visibly off centre. The bar is
 * still the affordance that reads from the back of the room — a shrinking bar needs length, not
 * height — and the seconds beside it are unchanged.
 *
 * The fill's `width`/`background` tween lives in the `.timer-fill` CLASS (app/globals.css), not
 * an inline `style.transition` — an inline style always beats a stylesheet selector on
 * specificity, so `prefers-reduced-motion: reduce` could never have overridden it from a class
 * rule if the transition itself stayed inline. The width/colour still snap to the correct value
 * on every poll under reduced motion; only the interpolation between polls goes away.
 */
export function TimerBar({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const clamped = Math.max(0, Math.min(remainingMs, totalMs))
  const pct = totalMs > 0 ? (clamped / totalMs) * 100 : 0
  const seconds = Math.ceil(clamped / 1000)
  const urgent = pct <= 25

  return (
    <div className="flex items-center gap-3">
      <div
        className="h-[1.6vh] w-[16vw] overflow-hidden rounded-full"
        style={{ background: 'var(--rt-border)' }}
        role="progressbar"
        aria-valuenow={seconds}
        aria-valuemin={0}
        aria-valuemax={Math.ceil(totalMs / 1000)}
      >
        <div
          className="timer-fill h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: urgent ? 'var(--rt-pink)' : 'var(--rt-cyan)',
          }}
        />
      </div>
      <span
        className="pixel-title tabular-nums"
        style={{ fontSize: '3.6vh', color: urgent ? 'var(--rt-pink)' : 'var(--rt-gold)' }}
      >
        {seconds}s
      </span>
    </div>
  )
}

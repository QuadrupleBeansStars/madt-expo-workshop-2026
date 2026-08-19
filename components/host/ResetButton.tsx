'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

/**
 * The host's reset control, armed in two steps.
 *
 * Reset is the only host action with NO undo. `advance` moves forward and a mis-tap costs one
 * slide; reset ejects every phone in the room back to the join screen and throws away the
 * leaderboard. On a laptop sitting next to a projector, one stray click during a live session
 * would end the workshop, so the first click only ARMS it — the second, within
 * {@link ARM_WINDOW_MS}, actually fires.
 *
 * It disarms on a timeout and on blur, so walking away from a half-pressed button is safe.
 *
 * Shared by both workshops on purpose, unlike the Storyboard/CaseFile split: this is a control,
 * not typography, and the two rooms must not drift on what "reset" means or on how hard it is to
 * hit by accident. The ENDPOINT differs and is passed in — `/api/reset` for AI Detective,
 * `/api/room/reset` for The Decision Room. They are separate stores; calling the wrong one resets
 * the other workshop and reports success.
 */
export const ARM_WINDOW_MS = 4000

export function ResetButton({
  endpoint, token, label, armedLabel, ariaLabel, className, style, onDone,
}: {
  endpoint: string
  token: string
  label: string
  /** Shown once armed — must read as a confirmation, not a repeat of `label`. */
  armedLabel: string
  /** Required when `label` is a bare glyph: the accessible name must still be words. */
  ariaLabel?: string
  className?: string
  /** `.host-reset` (app/globals.css) pins this control at 12px. `/tv` projects to a hundred people
   *  and needs it on the same `vh` scale as every other host control (spec §1), and that
   *  stylesheet is out of bounds for this pass — so the caller passes the size in. */
  style?: CSSProperties
  onDone?: (ok: boolean) => void
}) {
  const [armed, setArmed] = useState(false)
  const ref = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), ARM_WINDOW_MS)
    return () => clearTimeout(id)
  }, [armed])

  const click = useCallback(async () => {
    if (!armed) { setArmed(true); return }
    setArmed(false)
    /*
     * Give up focus before the request, not after.
     *
     * /biz listens for Space and ArrowRight on `window` to advance the deck. A focused button
     * ALSO fires its own click on Space — so a host who pressed reset and then tapped Space to
     * move on would advance the room and re-arm this button in the same keystroke. The keydown
     * handler now ignores BUTTON as well, and this blur closes the other half.
     */
    ref.current?.blur()
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'x-facilitator-token': token } })
      onDone?.(res.ok)
    } catch {
      onDone?.(false)
    }
  }, [armed, endpoint, token, onDone])

  return (
    <button
      ref={ref}
      type="button"
      data-testid="reset-button"
      data-armed={armed ? 'true' : 'false'}
      aria-live="polite"
      aria-label={ariaLabel ?? undefined}
      title={ariaLabel ?? undefined}
      className={className}
      style={style}
      onClick={() => void click()}
      onBlur={() => setArmed(false)}
    >
      {armed ? armedLabel : label}
    </button>
  )
}

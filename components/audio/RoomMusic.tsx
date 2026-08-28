'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The instrumental bed both projectors run under the workshop. One file, on loop, quiet.
 *
 * WHY IT STARTS ON `armed` AND NOT ON A PHASE. Chrome refuses `play()` on a page that has never
 * received a user gesture, and it refuses it silently — the promise rejects and nothing on screen
 * says why. Both projectors happen to have exactly one gesture before the room sees anything: the
 * host submitting the token gate. `armed` is that gate falling away (`token` going from `''` to a
 * real value), so the first play attempt lands inside the activation that gesture grants. Hanging
 * it on a phase change instead would work on the host's first login of the day and fail on every
 * reload after.
 *
 * THE RELOAD PATH IS STILL COVERED. A projector that wakes up with the token already in
 * localStorage arms with no gesture at all, so `play()` rejects — and rather than leave the room
 * in silence with no tell, that rejection paints the corner control amber and says what to press.
 *
 * Volume is deliberately low: this plays under a live MC, and the hall's own mixer is the loud
 * knob. `M` mutes from anywhere on the page, because "no way to kill the music" is a real risk in
 * front of two hundred people. Phones never get this component — a hundred handsets playing the
 * same loop a half-second apart is noise, which is the whole reason the bed is instrumental.
 *
 * No stylesheet on purpose. `app/biz/deck.css` and `components/room/stages.css` tie on specificity
 * constantly (see the note atop app/biz/page.tsx); a third sheet in that fight is a bug waiting for
 * a projector. Everything here is inline and cannot be reached by either.
 */

/** Under a live microphone. Raise it in the hall's mixer, not here. */
export const BED_VOLUME = 0.12
/** Long enough that the bed arrives rather than switches on, short enough not to feel broken. */
const FADE_MS = 1600

/**
 * The two ways the room ends up silent, kept apart because they are fixed by different things.
 * `blocked` is the browser withholding permission and one click grants it; `error` is the file
 * itself — a 404 from an image that shipped without `/public`, a truncated re-encode — and a click
 * can only re-request it. Collapsing them into one flag would have the projector tell the host to
 * press a button that cannot possibly work.
 */
type Problem = null | 'blocked' | 'error'

export function RoomMusic({ src, armed, volume = BED_VOLUME }: {
  src: string
  /** The host is through the token gate — for a fresh login, this flips inside the gate's gesture. */
  armed: boolean
  volume?: number
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [muted, setMuted] = useState(false)
  const [problem, setProblem] = useState<Problem>(null)
  /*
   * WHICH PLAY ATTEMPT IS STILL THE CURRENT ONE.
   *
   * `play()` returns a promise that can still be pending when the element gives up on the file and
   * fires `error` — and a resolution arriving after that would clear the very problem it was just
   * told about, leaving the projector showing a healthy speaker over a room in silence. Both the
   * error handler and every fresh `start()` bump this, so a settled promise from a superseded
   * attempt is discarded instead of overwriting what we now know.
   */
  const attempt = useRef(0)

  const start = useCallback(() => {
    const el = ref.current
    if (!el) return
    const mine = ++attempt.current
    el.volume = 0
    const done = el.play()
    // Older Safari returns undefined here rather than a promise.
    if (!done) { el.volume = volume; setProblem(null); return }
    done.then(() => {
      if (attempt.current !== mine) return
      setProblem(null)
      const t0 = performance.now()
      const step = () => {
        if (!ref.current || attempt.current !== mine) return
        const k = Math.min(1, (performance.now() - t0) / FADE_MS)
        ref.current.volume = volume * k
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }).catch(() => {
      if (attempt.current !== mine) return
      // A missing file rejects here too on some browsers; `error` on the element is the surer
      // signal, so only claim `blocked` when the element itself has no complaint.
      setProblem(ref.current?.error ? 'error' : 'blocked')
    })
  }, [volume])

  const retry = useCallback(() => {
    ref.current?.load()
    start()
  }, [start])

  useEffect(() => {
    if (!armed) {
      ref.current?.pause()
      return
    }
    start()
  }, [armed, start])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [muted])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // `code`, not `key`: on a Thai layout `key` is "สวย", not "m". The target guard is the one
      // app/biz/page.tsx uses on its own host keys, minus that handler's BUTTON case — that case
      // exists because a focused button fires its own click on Space, which M does not do.
      if (event.code !== 'KeyM') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      setMuted((m) => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!armed) return null

  const label = problem === 'error' ? 'ลองโหลดเพลงพื้นหลังใหม่'
    : problem === 'blocked' ? 'เปิดเพลงพื้นหลัง'
    : muted ? 'เปิดเสียงเพลง (M)'
    : 'ปิดเสียงเพลง (M)'
  /** Silent for any reason — no sound is reaching the room until the host presses this. */
  const silent = problem !== null || muted

  return (
    <>
      {/* `loop` is the whole point: nobody advances this. `preload="auto"` so the file is in
          memory before the lobby ends rather than buffering under the first question.
          `onError` is not defensive noise: without it a missing file looks EXACTLY like working
          music with the hall's fader down — a dim speaker icon and no sound — and the host would
          spend the workshop hunting a mixer that was never the problem. */}
      <audio
        ref={ref}
        src={src}
        loop
        preload="auto"
        aria-hidden
        onError={() => { attempt.current += 1; setProblem('error') }}
      />
      <button
        type="button"
        title={label}
        aria-label={label}
        onClick={() => {
          if (problem === 'error') retry()
          else if (problem === 'blocked') start()
          else setMuted((m) => !m)
        }}
        style={{
          position: 'fixed',
          /*
           * BOTTOM-RIGHT, AND THE CORNER IS THE WHOLE REASON THIS COMMENT EXISTS.
           *
           * It sat bottom-LEFT first, and the tests were green and the button was in the DOM and
           * on a real projector it was not there: `next dev` parks its own round badge in that
           * corner and swallows both the pixels and the clicks. Dev-only, but rehearsal happens
           * on `npm run dev`, and the state this control exists to announce is the state where
           * the room is silent. Bottom-right is clear on both projectors in every phase — /tv's
           * host controls and /biz's `pp-host` bar are both top-right.
           */
          right: '1.2vh',
          bottom: '1.2vh',
          zIndex: 50,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          lineHeight: 1,
          /*
           * BARE ICON, NO CHROME. No plate, no border, no ring — the team asked for the speaker and
           * nothing else, and this sits in the corner of a screen two hundred people are reading.
           * The glyph is an emoji, so it keeps its own colours and stays legible on both projectors
           * without a plate behind it: /tv's dark brown desk and /biz's cream paper.
           */
          padding: '1vh',
          border: 0,
          background: 'none',
          appearance: 'none',
          WebkitAppearance: 'none',
          fontSize: '2.2vh',
          minWidth: 30,
          minHeight: 30,
          // Silence is the state that has to carry across a room, and opacity is the only dial
          // left once the plate is gone: full weight when nothing is playing, faded when it is.
          opacity: silent ? 1 : 0.45,
        }}
      >
        <span aria-hidden>{silent ? '🔇' : '🔊'}</span>
      </button>
    </>
  )
}

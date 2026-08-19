'use client'
import { useCountUp } from './motion'

/** ~2s (spec §9). Long enough that the room watches it arrive, short enough that the host is not
 *  standing in silence waiting for their own closing line. */
const TALLY_COUNT_MS = 2000

/**
 * The room tally — ONE number, per the brief: how many times, across everyone, a wrong pass got
 * through (`roomWrongPass` from `/api/stats`). Not a leaderboard, not per-player — the point of
 * this phase is the room seeing itself as one thing before the podium splits it back into
 * individuals.
 *
 * IT COUNTS UP (spec §9). This is the number the entire workshop walks toward, and a number that
 * is simply there when the screen appears has already been read and dismissed before the host has
 * drawn breath. The climb is what makes the room watch it arrive. `useCountUp` holds still under
 * `prefers-reduced-motion` — that check has to be in JS, because no CSS rule can reach a value
 * React is re-rendering.
 *
 * `wrongPass` renders alone in its own element — no unit, no label sharing the node — so it can
 * be asserted on its own (`screen.findByText('12')`); the context line naming the total number of
 * decisions the room made is a separate paragraph underneath it.
 *
 * Spec §2/§5a: this is the screen the host delivers the workshop's one closing sentence over, and
 * that sentence has to be ON screen, not just in the host's head — the framed line below is it,
 * with `wrongPass` substituted for N. It is ONE text node (a template string, not a separate
 * `{wrongPass}` child) so it never collides with the bare-number assertion above: a second element
 * whose own exact text is `12` would make `findByText('12')` ambiguous. The framed line carries the
 * FINAL value, never the climbing one, for exactly that reason — a mid-climb number appearing in
 * two places would be two different numbers.
 */
export function Tally({ wrongPass, decisions }: { wrongPass: number; decisions: number }) {
  const shown = useCountUp(wrongPass, TALLY_COUNT_MS)
  return (
    /* Centred in the full stage and scaled up into it (spec §8). v3 sized this for the top ~45% of
       the screen and left the bottom half black, which held the type smaller than it needed to be
       on one of the two screens the room reads longest. */
    <div
      className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center gap-[2vh] text-center"
      style={{ fontFamily: 'var(--font-thai), sans-serif', fontWeight: 700 }}
    >
      {/* Thai, so it cannot use the pixel face — Press Start 2P carries no Thai glyphs. */}
      <div className="det-thai" style={{ fontSize: '4.6vh', color: 'var(--det-gold)' }}>สรุปผลทั้งห้อง</div>
      <div
        className="det-term tabular-nums"
        style={{ fontSize: '26vh', lineHeight: 0.9, color: 'var(--rt-pink)' }}
      >
        {shown}
      </div>
      <p style={{ fontSize: '4.6vh' }}>ครั้งที่ทั้งห้องเชื่อ AI แล้วพลาด</p>
      <p style={{ color: 'var(--rt-cyan)', fontSize: '3.1vh' }}>
        จากทั้งหมด {decisions} การตัดสินใจทั่วห้อง
      </p>
      {/* The closing line, framed. Its STRUCTURE is spec §5a and untouched — one text node, with
          wrongPass interpolated, so the bare-number assertion above stays unambiguous. Only the
          type scale moves, and it stays the most compact thing on this screen: the <main> here is
          min-h-screen overflow-hidden, so anything past the fold is clipped, not scrolled
          (npm run check:projector is the real gate; see app/tv/page.tsx's Stage comment). */}
      <div
        className="max-w-4xl rounded-[1.2vh] px-[3vh] py-[1.6vh]"
        style={{ border: '0.3vh solid var(--rt-gold)', background: 'rgba(255,215,0,0.08)' }}
      >
        <p style={{ color: 'var(--rt-gold)', fontSize: '3.1vh', lineHeight: 1.45 }}>
          {`ถ้านี่เป็นงานจริง — คือข้อมูลผิด ${wrongPass} ชิ้นที่ถูกส่งออกไปในชื่อของเรา`}
        </p>
      </div>
    </div>
  )
}

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
 * `wrongPass` renders alone in its own element — no unit, no label sharing the node — so it can be
 * asserted on its own (`screen.findByText('12')`); the context line naming the total number of
 * decisions the room made is a separate paragraph underneath it.
 *
 * Spec §2/§5a: this is the screen the host delivers the workshop's closing sentence over, and that
 * sentence has to be ON screen, not just in the host's head — the framed line is it, with
 * `wrongPass` substituted for N. It is ONE text node (a template string, not a separate
 * `{wrongPass}` child) so it never collides with the bare-number assertion above: a second element
 * whose own exact text is `12` would make `findByText('12')` ambiguous. The framed line carries the
 * FINAL value, never the climbing one, for exactly that reason.
 *
 * THE TEAM'S CLOSING REMARK (`CLOSING_LINES`, content/questions.ts) SHARES THAT FRAME. It is the
 * last thing said in the workshop and it was exported with nothing rendering it. It goes inside
 * the gold frame rather than under it, because the frame is the only weighty object on this screen
 * and a line dropped below it in plain type would read as a footnote to the sentence it is
 * actually the conclusion of. A rule separates the room's own number from what to do about it.
 */
export function Tally({
  wrongPass, decisions, closing,
}: {
  wrongPass: number
  decisions: number
  /** content/questions.ts's `CLOSING_LINES`. Rendered in order, each on its own line. */
  closing?: readonly string[]
}) {
  const shown = useCountUp(wrongPass, TALLY_COUNT_MS)
  return (
    /* Centred in the full stage and scaled up into it (spec §8). v3 sized this for the top ~45% of
       the screen and left the bottom half black, which held the type smaller than it needed to be
       on one of the two screens the room reads longest. */
    <div
      className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-center gap-[1.6vh] text-center"
      style={{ fontFamily: 'var(--font-thai), system-ui, sans-serif', fontWeight: 700 }}
    >
      {/* The eyebrow is Latin and cyan, like the act card's — the artifact's own treatment for
          "what screen is this". Thai could not use this face at all: Press Start 2P has no Thai
          glyphs, and the Thai line the room actually reads is under the number. */}
      <div className="det-pixel" style={{ fontSize: '3.4vh', color: 'var(--det-cyan)', letterSpacing: '0.14em' }}>
        ROOM TALLY
      </div>

      <div
        className="det-term tabular-nums"
        style={{ fontSize: '24vh', lineHeight: 0.95, color: 'var(--det-pink)' }}
      >
        {shown}
      </div>

      <p style={{ fontSize: '3.6vh', color: '#8b95b5' }}>ครั้งที่ทั้งห้องกด &quot;ผ่าน&quot; ให้ข้อมูลผิด</p>
      <p style={{ color: 'var(--det-cyan)', fontSize: '3.1vh' }}>
        จากทั้งหมด {decisions} การตัดสินใจทั่วห้อง
      </p>

      <div
        className="max-w-5xl"
        style={{
          border: '0.5vh solid var(--det-gold)',
          borderRadius: '1vh',
          padding: '1.8vh 3vw',
          background: 'rgba(255, 215, 0, 0.08)',
        }}
      >
        <p style={{ color: '#ffe9a8', fontSize: '3.4vh', lineHeight: 1.35 }}>
          {`ถ้านี่เป็นงานจริง — คือข้อมูลผิด ${wrongPass} ชิ้นที่ถูกส่งออกไปในชื่อของเรา`}
        </p>
        {closing && closing.length > 0 && (
          <>
            <hr style={{ border: 0, borderTop: '0.25vh solid rgba(255,215,0,0.4)', margin: '1.4vh 0' }} />
            {closing.map((line) => (
              <p key={line} style={{ color: 'var(--det-gold)', fontSize: '3.1vh', lineHeight: 1.4 }}>
                {line}
              </p>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

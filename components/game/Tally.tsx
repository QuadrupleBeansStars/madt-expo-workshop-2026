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
 *
 * Spec §2/§5a: this is the screen the host delivers the workshop's closing sentence over, and that
 * sentence has to be ON screen, not just in the host's head — the framed line is it, with
 *
 * THE TEAM'S CLOSING REMARK (`CLOSING_LINES`, content/questions.ts) SHARES THAT FRAME. It is the
 * last thing said in the workshop and it was exported with nothing rendering it. It goes inside
 * the gold frame rather than under it, because the frame is the only weighty object on this screen
 * and a line dropped below it in plain type would read as a footnote to the sentence it is
 * actually the conclusion of. A rule separates the room's own number from what to do about it.
 */
export function Tally({
  accuracy, closing,
}: {
  /** Every answer the room actually gave, split by whether it was right. */
  accuracy: { correct: number; wrong: number }
  /** content/questions.ts's `CLOSING_LINES`. Rendered in order, each on its own line. */
  closing?: readonly string[]
}) {
  const answered = accuracy.correct + accuracy.wrong
  const wrongPct = answered > 0 ? Math.round((accuracy.wrong / answered) * 100) : 0
  const shown = useCountUp(wrongPct, TALLY_COUNT_MS)

  /* Said at the scale of one desk, not one room. A rate is a fact about a hundred people; "one in
     five that passed your desk" is the same fact about you, and this is the screen where it has to
     land on a person rather than on a crowd.
     The bands exist because "ทุก 1 ชิ้น" and "ทุก 100 ชิ้น" are both true sentences and neither is
     a useful one — at the extremes the ratio stops being the honest way to say it. */
  const oneIn = wrongPct > 0 ? Math.round(100 / wrongPct) : 0
  const atWorkLine =
    wrongPct === 0
      ? 'ถ้านี่เป็นงานจริง — ห้องนี้ไม่ปล่อยข้อมูลผิดออกไปสักชิ้น'
      : wrongPct >= 50
        ? 'ถ้านี่เป็นงานจริง — มากกว่าครึ่งของสิ่งที่ผ่านมือเรา มีข้อมูลผิดอยู่ข้างใน'
        : `ถ้านี่เป็นงานจริง — ทุก ${oneIn} ชิ้นที่ผ่านมือเรา จะมี 1 ชิ้นที่ผิดหลุดออกไป`
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
        style={{ fontSize: '22vh', lineHeight: 0.95, color: 'var(--det-pink)' }}
      >
        {shown}%
      </div>

      <p style={{ fontSize: '3.6vh', color: '#8b95b5' }}>ของคำตอบทั้งห้อง คือคำตอบที่ผิด</p>

      {/* THE SAME BAR THE REVEAL USES, over the whole game rather than one case. Nine reveals have
          taught the room to read this shape — green is what it got right, pink is what it did not —
          so the closing figure lands as the sum of nine bars it has already seen, rather than as a
          new kind of chart on the last screen of the day.

          Proportions come from answers actually given, never from playerCount x QUESTION_COUNT: a
          player who ran out of time is not a player who was wrong, and at an eight-second window
          that difference is large enough to change the number the whole workshop walks toward. */}
      <div
        className="flex w-full max-w-5xl overflow-hidden"
        style={{ height: '7vh', borderRadius: '0.6vh', border: '0.4vh solid rgba(255,255,255,0.3)' }}
        role="img"
        aria-label={`ตอบผิด ${wrongPct}% จาก ${answered} คำตอบ`}
      >
        <div
          className="flex items-center justify-center"
          style={{ width: `${100 - wrongPct}%`, background: 'var(--det-green)', color: '#04120a', fontSize: '3.4vh' }}
        >
          {100 - wrongPct >= 12 ? `ถูก ${100 - wrongPct}%` : null}
        </div>
        <div
          className="flex items-center justify-center"
          style={{ width: `${wrongPct}%`, background: 'var(--det-pink)', color: '#fff', fontSize: '3.4vh' }}
        >
          {wrongPct >= 12 ? `ผิด ${wrongPct}%` : null}
        </div>
      </div>

      <p style={{ color: 'var(--det-cyan)', fontSize: '3.1vh' }}>
        จากทั้งหมด {answered} คำตอบทั่วห้อง
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
        {/* THE SAME NUMBER AS THE BAR, said as a person experiences it.
            This used to read "คือข้อมูลผิด N ชิ้นที่ถูกส่งออกไปในชื่อของเรา", counting `wrongPass`
            across the whole room — so the closing screen carried TWO numbers measuring different
            things: a rate above and a count below, and at a hundred players the count ran into the
            hundreds and meant nothing to anyone. "One in five of the things that passed your desk"
            is the same fact at the scale a person actually works at, and it is the bar's own
            number restated rather than a second statistic to reconcile. */}
        <p style={{ color: '#ffe9a8', fontSize: '3.4vh', lineHeight: 1.35 }}>{atWorkLine}</p>
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

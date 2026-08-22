'use client'

/**
 * THE CLOSING SCREEN. One question, the size of the wall, and everything else on the screen
 * working for it.
 *
 * WHAT THIS REPLACED, AND WHY. Until now this screen was a REPORT: a percentage counting up to
 * 22vh, a green/pink bar of the whole game, and a line translating the rate into "one in five
 * things that passed your desk". Every one of those is a fact about the past hour, and nobody
 * walks out of an expo hall carrying a fact about the past hour. The team picked design H off the
 * fifth review board — the takeaway becomes the screen, and the room's own number drops to one
 * line of evidence under it. It is the last thing 100 people see before they stand up, and the
 * only thing they can still repeat on Tuesday is three words long.
 *
 * NOTHING ON THIS SCREEN MOVES. The count-up that used to live here (`useCountUp`, ~2s) was the
 * right call while the number WAS the screen — a number simply present has been read and dismissed
 * before the host draws breath. It is the wrong call for a number in a supporting line: a digit
 * ticking under the question pulls every eye off the question during the exact seconds the host is
 * delivering the closing sentence over it. So the percentage is just there, small, done.
 *
 * THAI LINE HEIGHTS ARE NOT DECORATION HERE, and they were set from screenshots of a real 1024x768
 * rather than from arithmetic. Thai stacks marks above AND below the letter — `รู้` carries one of
 * each — so a 16vh line at the 1.05 that suits Latin display type drops the vowel of one line onto
 * the sentence under it. Nothing on this screen sits below 1.4, the display line sits at 1.5, and
 * the two lines that mix sizes (a 5vh figure inside 4vh text) are looser still so the taller glyph
 * fits inside its own line box instead of climbing out of it.
 */
export function Tally({
  accuracy, caseCount, unbacked, closing,
}: {
  /** Every answer the room actually gave, split by whether it was right. */
  accuracy: { correct: number; wrong: number }
  /** How many times the duck gave evidence — `QUESTION_COUNT`, passed in, never hardcoded. */
  caseCount: number
  /**
   * How many of those it could not have answered "รู้ได้ยังไง" for: the cases whose correct action
   * is ตีกลับ. DERIVED AND PASSED IN, for one specific reason — `content/questions.ts` carries an
   * open decision to add a third true case, and the day that lands, a `7` typed into this file
   * becomes a false claim on a projector in front of a hundred people, with no test to catch it.
   */
  unbacked: number
  /** content/questions.ts's `CLOSING_LINES`. Rendered in order, each on its own line. */
  closing?: readonly string[]
}) {
  const answered = accuracy.correct + accuracy.wrong
  const wrongPct = answered > 0 ? Math.round((accuracy.wrong / answered) * 100) : 0

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-center gap-[2vh] text-center"
      style={{ fontFamily: 'var(--font-thai), system-ui, sans-serif', fontWeight: 700 }}
    >
      <p style={{ margin: 0, fontSize: '4.4vh', lineHeight: 1.4, color: '#c7d0e8' }}>
        ก่อนเชื่อ AI — ถามคำเดียว
      </p>

      {/* THE WHOLE SCREEN. Gold, because gold is what this room has been taught to read as "this
          is the thing" for nine reveals, and the hard offset shadow is the same one the leaderboard
          title carries — it is the app's display treatment, not a new one invented for the finale. */}
      <p
        style={{
          margin: 0,
          fontSize: '16vh',
          /* 1.5, and measured on a real 1024x768 rather than reasoned about: at 1.25 the sara-u
             under `รู` came down through the line box and sat on top of the sentence below it.
             Latin display type is happy at 1.05 here; Thai puts marks above AND below the letter,
             so the same number that looks generous in Latin clips both ends at once. */
          lineHeight: 1.5,
          color: 'var(--det-gold)',
          textShadow: '0.7vh 0.7vh 0 #705400, 0 0 4vh rgba(255, 215, 0, 0.5)',
        }}
      >
        “รู้ได้ยังไง?”
      </p>

      {/* THE EVIDENCE THAT THE QUESTION WORKS, said as counts rather than a rate — nine and seven
          are things the room watched happen, and neither needs arithmetic in anyone's head. */}
      <p style={{ margin: 0, fontSize: '4vh', lineHeight: 1.6, color: '#e8ecfa' }}>
        วันนี้เป็ดให้การ{' '}
        <span className="det-term tabular-nums" style={{ fontSize: '5vh', color: 'var(--det-cyan)' }}>{caseCount}</span>{' '}
        ครั้ง — มี{' '}
        <span className="det-term tabular-nums" style={{ fontSize: '5vh', color: 'var(--det-pink)' }}>{unbacked}</span>{' '}
        ครั้งที่มันตอบคำนี้ไม่ได้
      </p>

      {/* THE ROOM'S OWN NUMBER, DEMOTED ON PURPOSE (design H3). It used to be 22vh of counting pink
          at the top of this screen; it is now one grey line of evidence under the question, and
          that is the whole point of the redesign — the number serves the takeaway rather than
          being it. Proportions come from answers actually GIVEN, never from playerCount x
          QUESTION_COUNT: a player who ran out of time is not a player who was wrong, and at an
          eight-second window that difference is large enough to change the number.

          Rendered only when somebody answered. A room that produced no answers at all gets no
          line, rather than a confident "0% of 0" — an empty room and a perfect room must not read
          the same from the back of a hall. */}
      {answered > 0 && (
        <p style={{ margin: 0, fontSize: '3.2vh', lineHeight: 1.6, color: '#c7d0e8' }}>
          และห้องนี้เชื่อมันไป{' '}
          {/* The DIGITS are terminal-face, the percent sign is not: VT323's `%` reads as an X at
              this size on a projector, which turns the one number on the line into a typo. */}
          <span className="det-term tabular-nums" style={{ fontSize: '4.2vh', color: 'var(--det-pink)' }}>{wrongPct}</span>
          <span style={{ color: 'var(--det-pink)' }}>%</span>{' '}
          ของคำตอบทั้งหมด{' '}
          <span className="det-term tabular-nums" style={{ fontSize: '3.6vh' }}>{answered}</span> คำตอบ
        </p>
      )}

      {/* THE TEAM'S CLOSING REMARK (`CLOSING_LINES`), all three lines of it, inside the one gold
          frame on the screen. It was exported with nothing rendering it and its own comment asks
          whoever wires it up to import rather than retype, so it arrives here as a prop from the
          page that owns the content.

          The rule inside the frame is doing work: above it are the two sentences about what just
          happened in this room, below it is the one sentence the team asked to be the last thing
          said in the workshop — bigger, and alone, because that is how they weighted it. */}
      {closing && closing.length > 0 && (
        <div
          style={{
            marginTop: '0.6vh',
            border: '0.45vh solid var(--det-gold)',
            borderRadius: '0.8vh',
            background: 'rgba(255, 215, 0, 0.1)',
            padding: '1.6vh 4vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4vh',
          }}
        >
          {closing.slice(0, -1).map((line) => (
            <p key={line} style={{ margin: 0, fontSize: '2.9vh', lineHeight: 1.45, color: '#ffe9a8' }}>
              {line}
            </p>
          ))}
          {closing.length > 1 && (
            <hr style={{ border: 0, borderTop: '0.25vh solid rgba(255,215,0,0.4)', width: '100%', margin: '0.5vh 0' }} />
          )}
          <p style={{ margin: 0, fontSize: '3.5vh', lineHeight: 1.4, color: 'var(--det-gold)' }}>
            {closing[closing.length - 1]}
          </p>
        </div>
      )}
    </div>
  )
}

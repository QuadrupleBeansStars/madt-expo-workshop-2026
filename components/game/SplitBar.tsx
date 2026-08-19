import type { Verdict } from '@/lib/types'

/**
 * How the room split on this question: how many tapped ผ่าน vs ตีกลับ. `split` is `null` when
 * `/api/stats` had no current question to measure (defensive only — `RevealStage` only mounts
 * this with a real question in hand).
 *
 * COLOURED BY CORRECTNESS, NOT BY ACTION, and deliberately out of step with the phone's two
 * buttons, which are green for ผ่าน because approve/reject reads as go/stop on a control you press
 * (spec §7). On a question whose correct verdict is `reject`, the share that pressed ตีกลับ renders
 * green and the share that pressed ผ่าน renders pink.
 *
 * v3 coloured this bar by action. So a reveal where 68% of the room approved a fabricated answer
 * rendered as a wall of green — the colour of "well done" — underneath a sentence telling them
 * they had just been fooled. This bar's job is to show the room what it did, and being mostly
 * alarm-coloured is the honest rendering of a room that was fooled. The labels name the action, so
 * nobody has to work out which share is which from the colour.
 *
 * The pass/reject LABELS live outside the growing fill — `.bar-grow` animates `transform: scaleX`
 * on the fill divs, and text inside a scaled element gets squashed with it. Labels also carry an
 * icon and a count, never the bare word ผ่าน/ตีกลับ alone: `VerdictStamp` above already owns that
 * exact two-word text on this same screen, and a second element with the identical bare text
 * would make it ambiguous which one is "the verdict". Each label stays ONE text node for the same
 * reason — splitting the count into its own element would reintroduce that ambiguity.
 *
 * `data-share` and `data-correct` are on the fills so a test can assert which share was marked
 * correct without depending on a class name or on a colour value.
 */
export function SplitBar({
  split, verdict,
}: {
  split: { pass: number; reject: number } | null
  /** The question's CORRECT verdict — the whole basis for the colouring. */
  verdict: Verdict
}) {
  const pass = split?.pass ?? 0
  const reject = split?.reject ?? 0
  const total = pass + reject
  const passPct = total > 0 ? Math.round((pass / total) * 100) : 0
  const rejectPct = total > 0 ? 100 - passPct : 0
  const colourFor = (share: Verdict) => (share === verdict ? 'var(--rt-green)' : 'var(--rt-pink)')

  return (
    <div className="w-full" style={{ fontFamily: 'var(--font-thai), sans-serif', fontWeight: 700 }}>
      <div className="mb-[0.8vh] flex justify-between text-[3.1vh] font-bold">
        <span style={{ color: colourFor('pass') }}>✓ ผ่าน {pass}</span>
        <span style={{ color: colourFor('reject') }}>✕ ตีกลับ {reject}</span>
      </div>
      <div
        className="flex h-[4vh] w-full overflow-hidden rounded-full"
        style={{ background: 'var(--rt-border)' }}
      >
        {/* Pass first, always: the reveal test reads these two fills positionally to check the
            percentage arithmetic, and the order is what makes that assertion mean anything. */}
        <div
          className="bar-grow h-full"
          data-share="pass"
          data-correct={verdict === 'pass' ? 'true' : 'false'}
          style={{ width: `${passPct}%`, background: colourFor('pass') }}
        />
        <div
          className="bar-grow h-full"
          data-share="reject"
          data-correct={verdict === 'reject' ? 'true' : 'false'}
          style={{ width: `${rejectPct}%`, background: colourFor('reject') }}
        />
      </div>
    </div>
  )
}

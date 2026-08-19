import type { Verdict } from '@/lib/types'

/**
 * How the room split on this question: how many tapped ผ่าน vs ตีกลับ. `split` is `null` when
 * `/api/stats` had no current question to measure (defensive only — `RevealStage` only mounts
 * this with a real question in hand).
 *
 * ONE BAR, WITH THE LABELS INSIDE IT. The approved artifact draws a single full-width bar whose
 * two fills each carry their own label centred in them; the labels used to sit in a separate row
 * above, which made the bar a decoration of a caption rather than the thing being read. Inside,
 * the share and its size are the same object.
 *
 * That is also why the fills no longer carry `.bar-grow`: that class animates `transform: scaleX`,
 * and text inside a scaled element is squashed with it. The width transition does the same work
 * without touching the type, and `prefers-reduced-motion` collapses it here rather than in the
 * stylesheet because the declaration is inline.
 *
 * COLOURED BY CORRECTNESS, NOT BY ACTION, and deliberately out of step with the phone's two
 * stamps, which are green for ผ่าน because approve/reject reads as go/stop on a control you press
 * (spec §7). On a question whose correct verdict is `reject`, the share that pressed ตีกลับ renders
 * green and the share that pressed ผ่าน renders pink.
 *
 * v3 coloured this bar by action. So a reveal where 68% of the room approved a fabricated answer
 * rendered as a wall of green — the colour of "well done" — underneath a sentence telling them
 * they had just been fooled. This bar's job is to show the room what it did, and being mostly
 * alarm-coloured is the honest rendering of a room that was fooled. The labels name the action, so
 * nobody has to work out which share is which from the colour.
 *
 * Each label carries an icon and a PERCENTAGE, never the bare word ผ่าน/ตีกลับ alone: the reveal's
 * own verdict headline above this owns that exact two-word text, and a second element with the
 * identical bare text would make it ambiguous which one is "the verdict". Each label stays ONE
 * text node for the same reason.
 *
 * `data-share` and `data-correct` are on the fills so a test can assert which share was marked
 * correct, and the percentage arithmetic, without depending on a class name or on a colour value.
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
  const correct = (share: Verdict) => share === verdict

  const fill = (share: Verdict, pct: number, label: string) => (
    <div
      data-share={share}
      data-correct={correct(share) ? 'true' : 'false'}
      className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap"
      style={{
        width: `${pct}%`,
        background: correct(share) ? 'var(--det-green)' : 'var(--det-pink)',
        /* Ink, not a palette token: neon green needs near-black on it and hot pink needs white,
           and both are contrast decisions about THIS pair rather than theme colours. */
        color: correct(share) ? '#04120a' : '#ffffff',
        transition: 'width 0.6s ease-out',
      }}
    >
      {label}
    </div>
  )

  return (
    <div
      className="flex w-full overflow-hidden"
      style={{
        height: '7vh',
        borderRadius: '0.6vh',
        border: '0.4vh solid rgba(255, 255, 255, 0.3)',
        fontFamily: 'var(--font-thai), system-ui, sans-serif',
        fontWeight: 800,
        fontSize: '3.4vh',
      }}
    >
      {/*
        * NOBODY ANSWERED. Both fills would be 0% wide, and since the labels now live INSIDE them
        * the bar rendered as an empty outlined box — which reads as a broken widget rather than as
        * a fact. Found on a real reveal where the room had not voted. It says so instead.
        *
        * Not folded into the two fills as a "0%" label: 0% of nothing is not 0%, and a bar showing
        * two zero shares implies two shares were counted.
        */}
      {total === 0 ? (
        <div
          data-share="none"
          className="flex h-full w-full items-center justify-center"
          style={{ color: '#8b95b5' }}
        >
          ยังไม่มีใครตอบข้อนี้
        </div>
      ) : (
        <>
          {/* Pass first, always: the reveal test reads these two fills positionally to check the
              percentage arithmetic, and the order is what makes that assertion mean anything. */}
          {fill('pass', passPct, `✓ ผ่าน ${passPct}%`)}
          {fill('reject', rejectPct, `✗ ตีกลับ ${rejectPct}%`)}
        </>
      )}
    </div>
  )
}

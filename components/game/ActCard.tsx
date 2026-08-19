import type { Act } from '@/lib/types'

/**
 * The teaching beat that closes every three questions — content/questions.ts's `ACTS`. This is
 * "the lesson" `/tv` carries: what the last three questions were actually testing (`nameTh`/
 * `body`), named again for a projector at the back of the hall (`nameEn`, set in mono/uppercase
 * tracking — Latin reads fine that way, Thai does not, which is why `nameTh` stays untouched),
 * and the line the host's closing riffs on (`atWork`) — "if this were a real job...".
 *
 * The panel RISES (`.block-rise`) rather than sliding or fading — the same motion the podium's
 * cards use, at a different size. It is deliberately the only thing on screen: the phone goes
 * dark here too (`app/page.tsx`'s `LookUpPanel`, "ดูจอใหญ่") so the room reads this together
 * instead of on ten different schedules.
 *
 * EVERY SIZE HERE IS PLAIN `vh` (spec §1). The `min(<n>vh, <n>px)` tiers this used to carry froze
 * at their pixel ceiling somewhere around a 1000px-tall screen, so on a 1080p projector — let
 * alone a 4K panel — the lesson got relatively smaller as the screen got bigger. `nameEn` and the
 * chips sit on the 3.1vh floor; nothing on `/tv` goes below it.
 */
export function ActCard({ act }: { act: Act | undefined }) {
  // `app/tv/page.tsx` passes `ACTS[state.actIndex ?? 0]`, which is `undefined` for any
  // out-of-range index — a corrupt/stale `actIndex` from a mid-flight poll, for instance. Every
  // sibling stage guards the same way (`SplitBar` accepts `null`, `Podium` tolerates a short
  // list, `RevealStage`/`QuestionStage` early-return on a null question); without this, an
  // unhandled `act.nameEn` throw white-screens the whole `/tv` render tree in front of the room,
  // recoverable only by a reload the host will not think to make mid-session.
  if (!act) return null
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col items-center justify-center gap-[2.4vh] text-center">
      <div
        className="block-rise retro-panel w-full p-[4vh]"
        style={{ fontFamily: 'var(--font-thai), sans-serif', fontWeight: 700 }}
      >
        <div
          className="pixel-title mb-[1.4vh]"
          style={{ fontSize: '3.1vh', letterSpacing: '0.14em' }}
        >
          {act.nameEn}
        </div>
        <h1
          className="mb-[2vh] font-bold"
          style={{ fontSize: '5.7vh', lineHeight: 1.25, color: 'var(--rt-cyan)' }}
        >
          {act.nameTh}
        </h1>
        <p className="mb-[2.2vh]" style={{ fontSize: '3.6vh', lineHeight: 1.45 }}>
          {act.body}
        </p>
        <div className="mb-[2vh] flex flex-wrap justify-center gap-[1.2vh]">
          {act.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full px-[1.6vh] py-[0.6vh]"
              style={{ background: 'var(--rt-border)', fontSize: '3.1vh' }}
            >
              {chip}
            </span>
          ))}
        </div>
        <p className="font-bold" style={{ color: 'var(--rt-gold)', fontSize: '3.6vh' }}>
          {act.atWork}
        </p>
      </div>
    </div>
  )
}

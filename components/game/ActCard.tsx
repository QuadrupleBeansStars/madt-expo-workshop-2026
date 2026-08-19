import type { Act } from '@/lib/types'

/**
 * The teaching beat that closes every three questions — content/questions.ts's `ACTS`. This is
 * "the lesson" `/tv` carries: what the last three questions were actually testing (`nameTh`/
 * `body`), named again for a projector at the back of the hall (`nameEn`), and the line the host's
 * closing riffs on (`atWork`) — "if this were a real job...".
 *
 * NO PANEL. The approved artifact draws this as centred content on the room's own ground — a cyan
 * eyebrow, a large GOLD title, and three outlined chips. It used to sit in a bordered dark box
 * with the colours the other way round (gold eyebrow, cyan title), which made the smallest line on
 * the screen the loudest colour and boxed the one beat that wants the whole wall.
 *
 * `nameEn` is Latin and set in the pixel face; `nameTh`, `body` and `atWork` are Thai and set in
 * `--font-thai`, which is the only face here with Thai glyphs.
 *
 * EVERY SIZE IS PLAIN `vh` (spec §1). The `min(<n>vh, <n>px)` tiers this used to carry froze at
 * their pixel ceiling somewhere around a 1000px-tall screen, so on a 1080p projector — let alone a
 * 4K panel — the lesson got relatively smaller as the screen got bigger.
 */
export function ActCard({ act }: { act: Act | undefined }) {
  // `app/tv/page.tsx` passes `ACTS[state.actIndex ?? 0]`, which is `undefined` for any
  // out-of-range index — a corrupt/stale `actIndex` from a mid-flight poll, for instance. Every
  // sibling stage guards the same way (`SplitBar` accepts `null`, `Podium` tolerates a short
  // list, `RevealStage` early-returns on a null question); without this, an unhandled
  // `act.nameEn` throw white-screens the whole `/tv` render tree in front of the room,
  // recoverable only by a reload the host will not think to make mid-session.
  if (!act) return null
  return (
    <div
      className="mx-auto flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-[3vh] px-[5vw] text-center"
      style={{ fontFamily: 'var(--font-thai), system-ui, sans-serif', fontWeight: 700 }}
    >
      <div className="det-pixel" style={{ fontSize: '3.4vh', color: 'var(--det-cyan)', letterSpacing: '0.14em' }}>
        {act.nameEn}
      </div>

      <h1 className="block-rise" style={{ fontSize: '7vh', lineHeight: 1.25, color: 'var(--det-gold)', fontWeight: 800 }}>
        {act.nameTh}
      </h1>

      <p className="max-w-6xl" style={{ fontSize: '3.6vh', lineHeight: 1.45 }}>{act.body}</p>

      {/* Outlined pills, not filled ones: they are labels on the wall, not buttons. */}
      <div className="flex flex-wrap justify-center gap-[1.4vw]">
        {act.chips.map((chip) => (
          <span
            key={chip}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '0.35vh solid var(--det-border)',
              borderRadius: '5vh',
              padding: '1.2vh 2vw',
              fontSize: '3.2vh',
            }}
          >
            {chip}
          </span>
        ))}
      </div>

      <p style={{ color: 'var(--det-gold)', fontSize: '3.6vh', lineHeight: 1.35 }}>{act.atWork}</p>
    </div>
  )
}

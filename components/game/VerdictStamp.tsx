import type { Verdict } from '@/lib/types'

/**
 * The reveal's headline: ผ่าน or ตีกลับ, stamped in — the one word every phone already showed
 * that player as YOUR verdict; this is the ROOM's verdict, same two words, same button copy as
 * the phone (`app/page.tsx`'s `.verdict-btn` labels), so nobody has to translate between screens.
 *
 * `verdict` is the CORRECT ACTION (spec's rule, restated in content/questions.ts), not "was the
 * duck right" — this stamp and the phone's buttons must never drift on what the two words mean.
 *
 * `tone` exists because v3.1 slams this over the case file rather than onto the black ground
 * (the team's scene note), and the screen palette does not survive the trip: `--rt-green`
 * (#39ff14) on `#fffbf2` cream is barely visible from the third row. `paper` swaps in a rubber
 * stamp's own two inks — the reference's stamp red `#b32d2d`, which is the exact colour its
 * CLASSIFIED DOSSIER stamp is printed in, and this repo's `--ok` green — and gives the badge the
 * paper's own background so the half of it that overhangs the sheet still reads. The HUE
 * semantics are unchanged (spec §7: reject reads as alarm, pass reads as clear), only the
 * lightness needed for ink on paper instead of light on a dark screen.
 */
export function VerdictStamp({ verdict, tone = 'screen' }: { verdict: Verdict; tone?: 'screen' | 'paper' }) {
  const isPass = verdict === 'pass'
  const onPaper = tone === 'paper'
  const ink = onPaper
    ? (isPass ? 'var(--ok)' : '#b32d2d')
    : (isPass ? 'var(--rt-green)' : 'var(--rt-pink)')

  return (
    <div
      className="stamp-slam mx-auto w-fit rounded-[1vh] px-[4vw] py-[1.4vh]"
      style={{
        fontFamily: 'var(--font-pixel), monospace',
        fontSize: '6vh',
        letterSpacing: '0.25vh',
        color: ink,
        border: `0.5vh solid ${ink}`,
        background: onPaper ? 'var(--det-paper)' : undefined,
      }}
    >
      {isPass ? 'ผ่าน' : 'ตีกลับ'}
    </div>
  )
}

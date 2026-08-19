'use client'
import { useState } from 'react'
import { t } from '@/lib/i18n'
import { randomCodename } from '@/lib/codenames'

/*
 * THE JOIN SCREEN — the first thing every player sees, and until v3.2 the only screen on the phone
 * still wearing v2's Decision Room palette (`bg-brand-orange`, `text-brand-navy`, `border-line`,
 * `bg-surface`). v3.1 rebuilt every other phone screen in the case-folder language and never
 * reached this one, so a player's first impression was a different product from the one they then
 * played. Spec §7.
 *
 * It is now the same object as the rest of the phone: a folder tab, a sheet of ruled paper under
 * it, and one gold control. The tab CARRIES THE CODENAME as it is typed — the folder the player is
 * about to be filed under is labelled with the name they are choosing, so the screen states its own
 * purpose without a second line of copy.
 *
 * NO `lang` PROP. It used to take one and thread it through `t()` and `randomCodename()`. v3 is
 * Thai-only for everything player-facing, and there was never a toggle in the DOM to remove — the
 * prop WAS the bilingual control, and a caller could still have passed `"en"` and produced an
 * English join screen in a Thai-only game. Latin type survives here in exactly one place, the pixel
 * kicker, because Press Start 2P has no Thai glyphs at all (see app/globals.css's `.det-pixel`).
 *
 * SIZES: nothing below 16px. The 8H projector rule does not apply to a screen held at arm's length,
 * but a phone in a dark hall is not a desk either, and 16px is also the threshold below which iOS
 * Safari zooms the page on focusing an input — which on this screen would throw the layout away at
 * the exact moment the player starts typing.
 *
 * COLOURS come from `.det`'s own custom properties (app/globals.css), which <main> carries. The
 * paper inks (`#544132`, `#8c593b`, `#382c1f`) are the dossier's, verbatim — nothing on cream may
 * use the screen palette, where cyan and neon green are invisible.
 */

const PAPER = 'var(--det-paper, #fffbf2)'
const INK = 'var(--det-paper-ink, #1e1713)'
const INK_HEAD = '#544132'
const INK_LABEL = '#8c593b'
const INK_EDGE = '#382c1f'
const THAI = 'var(--font-thai), system-ui, sans-serif'

/** The faint blue-book rules under the form. Cosmetic; it is what makes the panel read as paper. */
const RULED: React.CSSProperties['background'] =
  `repeating-linear-gradient(to bottom, transparent 0 31px, rgba(140, 89, 59, 0.16) 31px 32px), ${PAPER}`

export function CodenameScreen({
  onJoin,
  message,
}: {
  onJoin: (codename: string) => void
  message?: string
}) {
  const [name, setName] = useState('')
  const ready = name.trim().length > 0
  const submit = () => { if (ready) onJoin(name.trim()) }

  return (
    /*
     * `relative z-10` for the same reason every other direct child of <main> carries it: the room
     * canvas is `absolute inset-0` behind the whole screen and a static sibling loses to it in
     * paint order regardless of source position.
     *
     * `min-h-dvh`, NOT `min-h-screen`. Tailwind's `screen` is `100vh`, which on every mobile
     * browser means "the viewport with the URL bar COLLAPSED" — so with the bar showing, a
     * `100vh` column is taller than the screen and a centred child sits low, and the dead band
     * appears and disappears as the bar hides. `dvh` is the viewport as it actually is, right now.
     *
     * And NO `justify-center`. The folder is not an object floating on a desk with equal air above
     * and below it — it IS the screen: the tab starts at the top edge and the paper runs off the
     * bottom. Centring a child with its own intrinsic height is what produced the letterboxing;
     * the paper stretches (`flex-1`, below) and its CONTENT distributes inside it instead.
     */
    <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-3">
      {/* THE FOLDER TAB. Thai face, because it holds a Thai codename — the pixel face has no Thai
          glyphs and would drop every vowel mark in the name the player just typed. Truncated
          rather than wrapped: a tab is one line by construction, and `join()` accepts 40
          characters (app/api/join/route.ts), which is far more than fits here. */}
      <div
        className="inline-flex max-w-full items-center gap-2 self-start overflow-hidden"
        style={{
          background: PAPER,
          color: INK,
          border: `3px solid ${INK_EDGE}`,
          borderBottom: 'none',
          borderRadius: '10px 10px 0 0',
          padding: '8px 16px 10px',
          fontFamily: THAI,
          fontWeight: 700,
          fontSize: 18,
          whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden="true">📁</span>
        <span className="overflow-hidden text-ellipsis">{name.trim() || 'แฟ้มคดีใหม่'}</span>
      </div>

      {/* THE SHEET. Square top-left corner, so the tab above and this read as one folder — the
          reference's `.case-file-document-horizontal` does the same thing. The shadow is SOFT
          here, unlike the dossier's hard 6px offset: this sheet is lying on a desk under a lamp,
          not pinned flat to a board, and it is the only object on the screen.

          `flex-1`, and it runs OFF the bottom of the screen — no bottom border, no bottom radius.
          A sheet whose bottom edge is visible is an object on a page; a sheet that continues past
          the frame is the surface you are working on. It also means there is no band of wall left
          under it at any screen height. */}
      <div
        className="flex flex-1 flex-col gap-5"
        style={{
          background: RULED,
          color: INK,
          border: `4px solid ${INK_EDGE}`,
          borderBottom: 'none',
          borderRadius: '0 14px 0 0',
          boxShadow: '0 -6px 45px rgba(0, 0, 0, 0.6)',
          padding: '22px 20px 26px',
        }}
      >
        <div>
          {/* The one Latin string on the screen, and the only place the pixel face is used —
              English only, by the same rule the tab follows. */}
          <p className="det-pixel" style={{ color: INK_HEAD, fontSize: 16 }}>CASE FILE</p>
          <h1 className="mt-3" style={{ fontFamily: THAI, fontWeight: 800, fontSize: 30, lineHeight: 1.2 }}>
            {t('appTitle', 'th')}
          </h1>
          <p className="mt-2" style={{ fontFamily: THAI, fontSize: 17, color: INK_LABEL }}>
            {t('tagline', 'th')}
          </p>
        </div>

        {/* The join failure and the host-reset notice both land here. Red ink on paper, not the
            screen palette's pink — this is a sheet of paper. */}
        {message && (
          <p
            style={{
              fontFamily: THAI, fontWeight: 700, fontSize: 16, color: '#b32d2d',
              background: 'rgba(179, 45, 45, 0.08)', borderLeft: '4px solid #b32d2d',
              borderRadius: '0 8px 8px 0', padding: '10px 12px',
            }}
          >
            {message}
          </p>
        )}

        {/* THE ONE THING ON THE SCREEN. Everything above is context; this is the interaction, so
            it gets the room — a full-width field at 22px with its own label above it.

            It sits with the header rather than floating: the label, the field and the dice below
            it are one object, and a field centred in its own band of slack reads as a thing that
            wandered. The slack goes BELOW them instead, and the start button takes the bottom of
            the sheet under a thumb (`mt-auto`) — so a short screen and a tall one both look
            deliberate, and the blank middle is just unwritten case file. */}
        <div>
          <label
            htmlFor="codename"
            className="block"
            style={{ fontFamily: THAI, fontWeight: 700, fontSize: 18, color: INK_LABEL }}
          >
            {t('enterCodename', 'th')}
          </label>
          <input
            id="codename"
            value={name}
            onChange={(e) => setName(e.target.value)}
            /* Enter submits. On a phone keyboard the Go key is right under the thumb that just
               finished typing, and reaching past it to a button below is a step nobody needs. */
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            maxLength={40}
            autoComplete="off"
            enterKeyHint="go"
            className="mt-3 w-full"
            style={{
              fontFamily: THAI, fontWeight: 700, fontSize: 22, color: INK,
              background: 'rgba(255, 255, 255, 0.75)',
              border: `3px solid ${INK_EDGE}`, borderRadius: 10,
              padding: '14px 16px', outline: 'none',
            }}
          />
        </div>

        {/* Secondary, and it looks it, and it stays WITH the field: pressing it fills that field
            in, so it is part of the same object rather than an action at the end of the screen.
            `--det-btn-size`/`--det-btn-pad` are the hooks `.det-btn` already exposes for exactly
            this (see app/globals.css). */}
        <button
          type="button"
          onClick={() => setName(randomCodename('th'))}
          className="det-btn det-btn-thai self-start"
          style={{ '--det-btn-size': '16px', '--det-btn-pad': '10px 18px' } as React.CSSProperties}
        >
          {t('randomName', 'th')}
        </button>

        {/* WHAT THE BLANK MIDDLE OF THE SHEET IS. On a tall phone the slack between the form and
            the start button is most of the page, and blank ruled paper reads as an unfinished
            screen unless something says otherwise. A case file with nobody on it says so itself,
            in the same rubber ink as the dossier's own CLASSIFIED mark — and it is the folder
            tab's promise restated: this file has no name on it until you give it one.
            `m-auto` centres it in whatever slack there is, so it absorbs the difference between a
            390x844 phone and a 412x915 one instead of leaving a band.

            IT CHANGES WHEN THE FIELD DOES, and that is not decoration. A stamp reading UNASSIGNED
            on a folder whose tab already carries `นักสืบมะม่วง` is two elements on one sheet
            stating opposite facts — in a workshop about noticing exactly that. So it flips to
            ASSIGNED, in the pass stamp's own green ink, the moment the file has a name on it.
            English, because this is the pixel face and it has no Thai glyphs. */}
        <p
          className="det-pixel m-auto"
          aria-hidden="true"
          style={{
            fontSize: 20,
            color: ready ? '#146c43' : '#b32d2d',
            border: `3px solid ${ready ? '#146c43' : '#b32d2d'}`,
            borderRadius: 6,
            padding: '8px 14px', transform: 'rotate(-8deg)', opacity: 0.4,
          }}
        >
          {ready ? 'ASSIGNED' : 'UNASSIGNED'}
        </p>

        {/* The gold control, with the dark ink globals.css already carries (spec §2). Full width
            and at the bottom of the sheet: it is the end of this screen and the start of the game,
            and it is where a thumb already is. */}
        <button
          type="button"
          disabled={!ready}
          onClick={submit}
          className="det-btn det-btn-gold det-btn-thai mt-auto w-full"
          style={{ '--det-btn-size': '18px', '--det-btn-pad': '16px 24px' } as React.CSSProperties}
        >
          {t('startMission', 'th')}
        </button>
      </div>
    </div>
  )
}

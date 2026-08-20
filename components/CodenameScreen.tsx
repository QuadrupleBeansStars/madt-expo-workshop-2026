'use client'
import { useState } from 'react'
import { randomCodename } from '@/lib/codenames'

/*
 * THE JOIN SCREEN — the first thing every player sees, and the screen the approved artifact
 * (`final-book.html`, figure JOIN) draws as the plainest of all of them: a tan folder tab reading
 * `แฟ้มใหม่`, a sheet of ruled paper under it, and four things on the sheet in this order —
 * `NEW DETECTIVE`, the question, the field, the dice — then all the slack, then one gold button
 * on the bottom edge.
 *
 * WHAT WAS DELETED, AND WHY IT IS NOT A LOSS. This screen used to also carry the app title, the
 * tagline, a `CASE FILE` kicker and a rotated `UNASSIGNED` rubber stamp filling the middle. Each
 * had a paragraph of justification and the artifact overrides all of them: the tab already says
 * this is a new file, and a stamp invented to fill the blank middle stops being needed the moment
 * the sheet's own `margin-top: auto` distribution puts that slack where it belongs. The tab is
 * the artifact's static `📁 แฟ้มใหม่`, not the typed name — the folder is not labelled until the
 * player is filed, which is what pressing the button does.
 *
 * The shell (`.det-ph` / `.det-ftab` / `.det-fbody`) is in app/globals.css, shared byte-for-byte
 * with the in-game screens in app/page.tsx: the first screen a player sees is the same object as
 * every screen after it, and there is one place to change it.
 *
 * NO `lang` PROP, and Thai only for everything player-facing. Latin survives in exactly one place,
 * the `NEW DETECTIVE` header, because that is the pixel face and Press Start 2P has no Thai
 * glyphs at all (see app/globals.css's `.det-pixel`).
 */
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
    <div className="det-ph">
      <span className="det-ftab">
        <span aria-hidden="true">📁</span>
        <span>แฟ้มใหม่</span>
      </span>

      <div className="det-fbody">
        <div className="det-fhd">NEW DETECTIVE</div>

        {/* The label IS the question line — one element, not a heading plus a smaller label under
            it, which is what the artifact draws and what keeps the field and its prompt reading as
            one object. */}
        <label className="det-fq" htmlFor="codename">ตั้งชื่อรหัสของคุณ</label>

        <input
          id="codename"
          className="det-fin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          /* Enter submits. On a phone keyboard the Go key is right under the thumb that just
             finished typing, and reaching past it to a button below is a step nobody needs. */
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          maxLength={40}
          autoComplete="off"
          enterKeyHint="go"
        />

        {/* Secondary, and it looks it, and it stays WITH the field: pressing it fills that field
            in, so it is part of the same object rather than an action at the end of the screen. */}
        <button type="button" className="det-fdice" onClick={() => setName(randomCodename('th'))}>
          🎲 สุ่มให้
        </button>

        {message && <p className="det-fmsg">{message}</p>}

        {/* `.det-fgo` carries `margin-top: auto`: the slack between the form above and this lands
            in the middle of the sheet as unwritten case file, and the control sits on the bottom
            edge where a thumb already is. A 390x844 phone and a 412x915 one differ only in how
            much blank paper is between the two. */}
        <button type="button" className="det-fgo" disabled={!ready} onClick={submit}>
          เริ่มภารกิจ
        </button>
      </div>
    </div>
  )
}

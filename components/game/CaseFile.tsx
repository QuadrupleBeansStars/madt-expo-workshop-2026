import type { CaseDoc, DetectiveCase, Lang } from '@/lib/types'
import { t } from '@/lib/i18n'

/**
 * AI Detective's case file, sized for the projector.
 *
 * This is the evidence the room reads together: the retrieval manifest (which documents the AI
 * found, and the one it did NOT) and the documents themselves. It used to live on the phone via
 * `components/game/EvidenceList.tsx`, which is now unused by any route — the team's note after the
 * run-through was that the context belongs on the big screen, and the phone is for tapping.
 *
 * Deliberately NOT `components/CaseFileDoc.tsx` with a size prop. That component is `text-sm` body
 * and a `break-all` `text-xs` URL — sized for a hand at arm's length, and unreadable from the back
 * of a room. Same call, and for the same reason, as `components/game/Storyboard.tsx`: the TYPE is
 * shared, the rendering is not. One component taking an `onProjector` flag is how the two surfaces
 * start rendering each other's typography.
 *
 * Every size below is capped by viewport HEIGHT (`min(Nvh, Npx)`), never width. A projector is wide
 * and SHORT; this panel shares ~460px of vertical budget with the question and the duck, and the
 * case that binds is `citation` — four manifest rows and three documents. `npm run check:projector`
 * is the gate. Tailwind's width breakpoints cannot see this problem.
 */
/**
 * Cases carry two, three or four documents, and the tall ones do not fit at the roomy scale.
 * Measured at 1366x768 with `citation` (four manifest rows, three documents): at one size for
 * everything the host's "close it now" button was cut off by 36px, and at 1600x900 it landed
 * exactly ON the fold. Rather than shrink all five cases to fit the worst one, the scale steps
 * down only when the document count demands it — `artemis` and `novabrew` keep 137px of clearance.
 *
 * Three is the threshold because that is where it actually broke, not a round number.
 */
const TIGHT_FROM_DOCS = 3

export function CaseFile({ detectiveCase, lang }: { detectiveCase: DetectiveCase; lang: Lang }) {
  const found = detectiveCase.docs.filter((d) => d.found)
  const tight = found.length >= TIGHT_FROM_DOCS

  return (
    <section
      data-testid="case-file"
      data-tight={tight ? 'true' : 'false'}
      className={`retro-panel flex min-h-0 flex-col p-[min(2vh,20px)] ${tight ? 'gap-[min(1vh,10px)]' : 'gap-[min(1.4vh,14px)]'}`}
    >
      {/*
        The manifest comes first and is never the thing that shrinks. The `✗ NOT FOUND` line IS the
        lesson in cases 1-3 — the host points at it — so it holds its size while the documents below
        give up pixels if the budget gets tight.
      */}
      <div style={{ fontFamily: 'var(--font-retro), monospace' }}>
        <div
          className="mb-[min(1vh,10px)] font-bold"
          style={{ fontSize: 'min(2.2vh, 22px)', color: 'var(--rt-gold)' }}
        >
          🔍 {t('retrieving', lang)}
        </div>
        <ul className="flex flex-col gap-[min(0.6vh,6px)]">
          {detectiveCase.docs.map((d) => (
            <li
              key={d.filename}
              className="flex items-baseline justify-between gap-4"
              style={{ fontSize: tight ? 'min(1.65vh, 17px)' : 'min(1.9vh, 19px)' }}
            >
              <span className="min-w-0 truncate">{d.filename}</span>
              <span
                className="shrink-0 font-bold"
                style={{ color: d.found ? 'var(--rt-green)' : 'var(--rt-pink)' }}
              >
                {d.found ? `✓ ${t('retrieved', lang)}` : `✗ ${t('notFound', lang)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className={`flex min-h-0 flex-col ${tight ? 'gap-[min(0.9vh,9px)]' : 'gap-[min(1.2vh,12px)]'}`}>
        {found.map((doc) => (
          <ProjectorDoc key={doc.filename} doc={doc} lang={lang} tight={tight} />
        ))}
      </div>
    </section>
  )
}

function ProjectorDoc({ doc, lang, tight }: { doc: CaseDoc; lang: Lang; tight: boolean }) {
  return (
    <article
      className={`rounded-md px-[min(1.6vh,16px)] ${tight ? 'py-[min(0.9vh,9px)]' : 'py-[min(1.2vh,12px)]'}`}
      style={{
        background: 'rgba(255,255,255,0.06)',
        borderLeft: '4px solid var(--rt-cyan)',
        fontFamily: 'var(--font-thai), sans-serif',
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-bold" style={{ fontSize: tight ? 'min(1.8vh, 18px)' : 'min(2vh, 20px)', lineHeight: 1.25 }}>
          {doc.title[lang]}
        </h3>
        {doc.fictional ? (
          <span
            className="shrink-0 rounded px-2 py-0.5 font-bold uppercase tracking-wide"
            style={{ fontSize: 'min(1.4vh, 14px)', background: 'var(--rt-pink)', color: '#fff' }}
          >
            {t('fictional', lang)}
          </span>
        ) : null}
      </header>
      {doc.body ? (
        <p
          className={`whitespace-pre-wrap ${tight ? 'mt-[min(0.5vh,5px)]' : 'mt-[min(0.8vh,8px)]'}`}
          style={{ fontSize: tight ? 'min(1.6vh, 16px)' : 'min(1.8vh, 18px)', lineHeight: tight ? 1.3 : 1.35, color: 'var(--rt-text)' }}
        >
          {doc.body[lang]}
        </p>
      ) : null}
      {doc.sourceUrl ? (
        /*
          The SOURCE, not the URL. `https://www.nasa.gov/mission/apollo-17/` wrapped across two
          lines is ~40px of a budget measured in tens, and nobody in row twelve is reading a path
          segment or typing it in — the projector is not a device you click. The host says "this
          one is from NASA" and the domain is what backs that up. The full `sourceUrl` is untouched
          in `content/cases.ts` and still renders in full wherever a doc is read close up.
        */
        <div
          className={`truncate ${tight ? 'mt-[min(0.4vh,4px)]' : 'mt-[min(0.6vh,6px)]'}`}
          style={{ fontSize: tight ? 'min(1.35vh, 13px)' : 'min(1.5vh, 15px)', fontFamily: 'var(--font-retro), monospace', color: 'var(--rt-cyan)' }}
        >
          {sourceLabel(doc.sourceUrl)}
        </div>
      ) : null}
    </article>
  )
}

/** `https://www.nasa.gov/mission/apollo-17/` → `nasa.gov`. Falls back to the raw string. */
export function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

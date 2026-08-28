// Café Persona — everything the room sees on the projector. `app/biz/page.tsx` owns the poll,
// the clock and the keyboard; this file renders one frame and nothing else.
//
// Four views, one per stage kind: lobby (QR + the name board), ask (data hook + choices), reveal
// (the room's split), result (the 2×2 map).
//
// THE REVEAL SHOWS THE SPLIT AND NOTHING ELSE. `question.smallTalk` is still authored, in
// content/persona.ts, and is still where the teaching lives — but it is the HOST's line now, not a
// paragraph on the wall. A room reading a paragraph is a room that has stopped listening to the
// person delivering it, and the bars are what they should be looking at while it is said.
//
// NO PERSONA COLOUR BEFORE THE FINAL MAP. The reveal used to paint each bar in its choice's persona
// colour, and that handed the room the answer key: purple keeps turning out to be the careful
// option, orange the fast one, and by q3 people are picking the colour they want to be instead of
// the thing they would actually do. The reveal now has ONE accent — amber, on the bar the room
// picked most — which says "this is where the room landed" and nothing about anybody's type. The
// four mascot colours appear for the first time on the result map, where the types are the point.


import { useLayoutEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AUDIENCE } from '@/content/audience'
import { BUCKET_LABELS, FIELD_TITLES, ORDINAL_FIELDS } from '@/content/audience-labels'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { UI } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import { AXIS_LABELS } from '@/lib/room-types'
import { ASK_MS } from '@/lib/room'
import type { PersonaId, Question } from '@/lib/room-types'
import type { PublicRoomState } from '@/lib/room-store'
// LAST import, deliberately: under cssChunking:'strict' sheet order is import order, and this
// sheet must land AFTER app/biz/deck.css (imported first by app/biz/page.tsx) to win its ties.
import './stages.css'

export type RoomFrame = PublicRoomState

type StagesProps = {
  frame: RoomFrame
  /** Where phones join. Computed client-side by the page — its absence means hydration failed. */
  joinUrl: string
  /** Locally interpolated between polls; display-only (spec §2). */
  remainingMs: number
  /**
   * Everyone in the room, in join order, for the lobby's name board. Polled separately from the
   * frame (`/api/room/players`) because only this one screen wants them — see that route.
   */
  names?: string[]
  /** The lobby's Start button. Absent in tests and anywhere the room is rendered read-only. */
  onStart?: () => void
}

/**
 * Look the question up by id, never by index — the projector's content bundle and the server's
 * can skew across a deploy mid-session, and an id miss holds the screen where an index miss
 * would put the wrong question on the wall.
 */
function questionById(id: string | null): Question | null {
  if (!id) return null
  return QUESTIONS.find((q) => q.id === id) ?? null
}

export function Stages({ frame, joinUrl, remainingMs, names = [], onStart }: StagesProps) {
  if (frame.phase === 'done') return <ResultView frame={frame} />

  const question = questionById(frame.questionId)
  if (frame.phase === 'lobby' || !question) {
    return <LobbyView frame={frame} joinUrl={joinUrl} names={names} onStart={onStart} />
  }

  if (frame.stageKind === 'ask') {
    return <AskView frame={frame} question={question} remainingMs={remainingMs} />
  }
  return <RevealView frame={frame} question={question} />
}

// ── lobby ───────────────────────────────────────────────────────────────────

/**
 * The name board's paging.
 *
 * IT IS A PAGE, NOT A SCROLL, and the arithmetic is why. A name may be twenty characters
 * (lib/names.ts) and a projector is 1366×768; a hundred of those drawn at once works out to type
 * a projector-room cannot read from the back, which is the same as not drawing them. Paging keeps
 * every name at a size the back row can read and shows the room in turns instead.
 *
 * A PAGE IS "WHATEVER FIT", NOT A FIXED COUNT — the same rule AI Detective's board uses. A fixed
 * thirty-six had to be safe against a room where every name is twenty characters, so in the room
 * you actually get, where most people type "ปุ๊ก", it left the bottom half of the board empty. The
 * board is handed a WINDOW of candidates, draws as many as physically fit, and the next page
 * starts at the first one that did not.
 *
 * The window is a runaway guard, not a target: it only has to exceed what any projector could
 * possibly draw.
 */
const NAMES_WINDOW = 240
/*
 * THE HOST TURNS THE BOARD, not a timer.
 *
 * It cycled on its own for a while and the problem was the same one the projector always has: the
 * person who can see the room is the only one who knows when the page is done. On a timer they
 * cannot hold a page to read a name out, and cannot skip ahead once everybody has found
 * themselves. The counter under the board is the control — there is no second button, because a
 * lobby with two host controls in it is a lobby where one of them gets pressed by mistake.
 */

function LobbyView({ frame, joinUrl, names, onStart }: {
  frame: RoomFrame
  joinUrl: string
  names: string[]
  onStart?: () => void
}) {
  /*
   * EVERY PLAYER SEES THEIR OWN NAME — that is this stage's whole job, and the reason the board
   * pages rather than showing the newest arrivals and dropping the rest. Nobody is left off; the
   * host walks the room through the pages.
   */
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)
  const boardRef = useRef<HTMLUListElement | null>(null)
  /** How many of the window are actually inside the board — the length of this page. */
  const fitRef = useRef(0)

  // A cursor past the end (the room was reset under it) goes back to the top rather than showing
  // an empty board.
  const start = cursor < names.length ? cursor : 0
  const shown = names.slice(start, start + NAMES_WINDOW)

  /*
   * MEASURED, not calculated. How many names fit depends on how long they are, and a room is a
   * mix — three twenty-character names or seven nicknames on the same row. The board draws the
   * window, `overflow: hidden` clips whatever spills, and this counts what is actually inside so
   * the next page can start there.
   *
   * A LAYOUT EFFECT, so the count is taken from a real box before paint. It stores rather than
   * sets state: nothing on screen depends on the number, only the next press does, and setting
   * state here would re-render the board on every poll for no visible change.
   */
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) { fitRef.current = 0; return }
    const bottom = board.getBoundingClientRect().bottom
    let fit = 0
    for (const li of board.children) {
      if (li.getBoundingClientRect().bottom > bottom + 1) break
      fit++
    }
    fitRef.current = fit
  })

  const turnPage = () => {
    const fit = Math.max(1, fitRef.current)
    const next = start + fit
    if (next >= names.length) { setPage(0); setCursor(0); return }
    setPage((p) => p + 1)
    setCursor(next)
  }

  /** The board is turning at all only when it could not draw everyone at once. */
  const paging = names.length > 0 && (start > 0 || fitRef.current < names.length)

  return (
    <section className="pp-stage pp-lobby" data-testid="stage-lobby">
      <div className="pp-lobby__grid">
        {/* LEFT: what a person has to act on — what this is, where to join, how many already did.
            It never changes while the board on the right cycles. */}
        <div className="pp-lobby__left">
          {/* The same mark the phone wears on its join screen and in its counter strip. It is the
              one thing carried across both surfaces, so a person looking up from the QR they just
              scanned finds the wall showing what their hand is showing. */}
          <svg className="pp-lobby__cup" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M17 10.5h1.6a2.4 2.4 0 0 1 0 4.8H17" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 2.5c-.9 1.2-.9 2.3 0 3.5M12 2.5c-.9 1.2-.9 2.3 0 3.5"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <h1 className="pp-lobby__title">{UI.title.th}</h1>
          <p className="pp-lobby__sub"><Bilingual text={UI.joinTitle} as="hero" /></p>

          {/* Client-side only, and that is the point: no QR on the projector means client JS never
              ran, which is the diagnostic the host needs before doors open. */}
          {joinUrl ? (
            <div className="pp-lobby__qr-box" data-testid="join-qr" aria-label="Join QR code">
              <QRCodeSVG value={joinUrl} size={320} level="M" />
            </div>
          ) : null}

          <p className="pp-lobby__count">
            <b data-testid="player-count">{frame.playerCount}</b>
            <Bilingual text={UI.inTheRoom} as="label" />
          </p>
        </div>

        {/*
          * RIGHT: THE ROOM, ARRIVING. This screen is up for several minutes before the host starts
          * and used to say only how many people had joined — a number nobody watches. A player
          * looks for the name THEY typed, which is the only reason a hundred people look at a wall
          * with no game on it yet, and it is what the host teases the room with while waiting.
          *
          * It gets the wider half: the QR only has to be scannable, the board has to hold a room.
          *
          * Names are drawn IN FULL: the twenty-character cap lives at the join route
          * (lib/names.ts) precisely so this board never has to hang an ellipsis on somebody.
          *
          * `key` is the name plus its position in join order, never the name alone — two people in
          * a room of two hundred type the same nickname, and a duplicate React key would drop one
          * of them off the board.
          */}
        <div className="pp-lobby__right">
          <ul className="pp-names" data-testid="lobby-names" ref={boardRef}>
            {shown.map((name, i) => (
              <li className="pp-names__one" key={`${name}-${start + i}`}>{name}</li>
            ))}
          </ul>

          {paging ? (
            <button
              type="button"
              className="pp-names__page"
              data-testid="lobby-names-page"
              onClick={turnPage}
              lang="th"
            >
              {UI.namesPage.th} {page + 1} ▸
            </button>
          ) : null}
        </div>
      </div>

      {/* The lobby's one big control, across the bottom of the screen rather than in the corner
          bar — this is the press that starts the workshop and it should not be a 2vh glyph
          sharing a pill with reset. `ถัดไป` in the bar still does the same thing. */}
      {onStart ? (
        <button type="button" className="pp-lobby__start" data-testid="start-button" onClick={onStart}>
          <span lang="th">{UI.startBtn.th}</span>
        </button>
      ) : null}
    </section>
  )
}

/**
 * Where the room is in the eight.
 *
 * Fifteen minutes with no visible end is longer than fifteen minutes with one. This is the only
 * thing on either in-game stage that says how much is left, and it costs one line at the bottom
 * of the screen — filled behind, wide and accented on the current question, empty ahead.
 */
function Progress({ index }: { index: number }) {
  return (
    <p className="pp-progress" data-testid="progress" aria-hidden>
      {QUESTIONS.map((q, i) => (
        <i key={q.id} data-on={i < index ? 'true' : undefined} data-now={i === index ? 'true' : undefined} />
      ))}
    </p>
  )
}

// ── ask ─────────────────────────────────────────────────────────────────────

function AskView({
  frame, question, remainingMs,
}: {
  frame: RoomFrame
  question: Question
  remainingMs: number
}) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000))
  const mmss = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  /*
   * The last third of the window — ten seconds of a thirty-second ask, and still ten seconds if
   * ASK_MS moves, which a fixed millisecond threshold would not be. The phone draws its own bar
   * off the same fraction (components/room/PhoneBody.tsx), so the wall and every phone in the
   * room turn colour on the same beat rather than a second apart.
   */
  const low = remainingMs <= ASK_MS / 3

  return (
    <section className="pp-stage pp-ask" data-testid="stage-ask">
      {/* The strip and its bar are ONE block. As siblings of the stage they each collected the
          stage's own 1.8vh gap, and the second one was enough to push the tallest ask (q4) four
          pixels past the fold on both projector shapes — caught by `npm run check:projector`,
          invisible to every unit test in the repo. */}
      <div className="pp-strip-block">
      <header className="pp-strip">
        <span className="pp-strip__q" data-testid="question-counter" lang="th">
          {UI.questionOf.th} {(frame.questionIndex ?? 0) + 1}/{QUESTIONS.length}
        </span>
        {/*
          * Display-only (spec §2): reaching 0:00 changes nothing — the host closes voting.
          *
          * IT IS NO LONGER RED THE WHOLE TIME. Alert red from the first second is a colour that
          * means "a clock is running", which the room can already see; spent that way it has
          * nothing left to say at the moment it matters. Ink until the last third, then red.
          */}
        <span className="pp-strip__clock" data-testid="countdown" data-low={low ? '1' : '0'}>
          {mmss}
        </span>
        <span className="pp-strip__votes" lang="th">
          <b data-testid="vote-count">{frame.voteCount}</b> {UI.votesIn.th}
        </span>
      </header>

      {/*
        * The clock, drawn. Same object as the bar on every phone in the room, and it borrows no
        * new colour to be one — ink draining to red, against the line grey already on this deck.
        * The four persona colours stay the only meaningful hues here, which is the rule the vote
        * counter below is written to protect.
        */}
      <div className="pp-drain" data-testid="ask-drain" aria-hidden>
        <div
          className="pp-drain__fill"
          data-low={low ? '1' : '0'}
          style={{ width: `${Math.max(0, Math.min(1, remainingMs / ASK_MS)) * 100}%` }}
        />
      </div>
      </div>

      {/*
        * TWO COLUMNS, and the order is the argument: EVIDENCE FIRST, then the decision it bears on.
        * The chart takes the left, where a Thai reader starts, so the room has the room's own
        * numbers in hand before it reads what it is being asked to decide; the brief takes the
        * right and the wider half, because it is still the thing they act on and it still carries
        * the larger type. Stacked, they were the same width and the same weight, and the chart —
        * being taller — read as the more important of the two.
        *
        * DOM ORDER IS THE REAL ORDER. Do not swap these back with CSS `order`: the phone renders
        * the scenario from the same content and a screen reader would then meet them in the
        * opposite sequence to the wall.
        */}
      <div className="pp-ask__body">
        <DataChart hook={question.dataHook} />
        <p className="pp-scenario" lang="th">{question.scenario}</p>
      </div>

      <ol className="pp-choices">
        {question.choices.map((choice, i) => (
          // NEUTRAL on ask — no data-persona until the reveal.
          <li className="pp-choice" data-testid={`ask-choice-${i}`} key={choice.label}>
            <span className="pp-choice__letter">{String.fromCharCode(65 + i)}</span>
            <span className="pp-choice__label" lang="th">{choice.label}</span>
          </li>
        ))}
      </ol>

      <Progress index={frame.questionIndex ?? 0} />
    </section>
  )
}

/**
 * The full distribution, plotted — the room reads a graph and decides, never just a headline
 * figure. Bars derive from AUDIENCE at render, so a survey re-import updates every chart.
 * Highlighted buckets take the data accent; the rest stay muted. Ordinal fields keep the form's
 * bucket order (a time axis sorted by popularity is nonsense); categorical fields sort by count.
 *
 * THE LABEL SITS ABOVE ITS OWN BAR, and `hook.caption` IS NOT RENDERED AT ALL. Both come from the
 * same instruction: make the graph the thing the room reads.
 *
 * The old card gave a third of its width to a label column and printed a sentence underneath —
 * "รสชาติมีผลกับทั้ง 50 จาก 50 คน" — which is the conclusion, handed over before anyone has looked
 * at the bars. A room reading that sentence has stopped reading the chart. Labels moved above
 * full-width bars, the highlighted row got thicker, and the sentence's only load-bearing part (the
 * figure) moved onto the bar it describes: `50 จาก 50`, where it cannot be read without also seeing
 * how long that bar is next to the others.
 *
 * `caption` STAYS AUTHORED in content/persona.ts for the same reason `smallTalk` does: it is the
 * host's line to say out loud, not the wall's to print.
 *
 * ONLY A SOLE HIGHLIGHT GETS "n จาก N". Where a scenario turns on several buckets at once (q4
 * highlights tea + juice + milk) no single bar carries that total, and printing "จาก 50" on each of
 * three bars would read as three separate claims about the whole room.
 */
function DataChart({ hook }: { hook: Question['dataHook'] }) {
  const dist = AUDIENCE[hook.field] as Record<string, number>
  const labels = BUCKET_LABELS[hook.field]
  const entries = Object.entries(dist)
  const ordered = ORDINAL_FIELDS.has(hook.field) ? entries : [...entries].sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...entries.map(([, v]) => v))
  /** See the note above: "n จาก N" only where exactly one bucket is highlighted. */
  const solo = hook.highlight.length === 1

  return (
    <div className="pp-chart" data-testid="data-chart">
      <p className="pp-chart__title" lang="th">
        {FIELD_TITLES[hook.field].th}
        {/*
          * THE TITLE IS THE WHOLE HEADER. Every piece of survey notation that used to sit beside it
          * — "N=50", "ตอบได้หลายข้อ", "ข้อมูลตัวอย่าง" — is off the wall by the owner's call, on
          * the same instruction that cut the caption: the room is here to read a shape, and
          * notation beside the title is method rather than evidence. The sample size is still said
          * once, where it means something: "50 จาก 50" on the bar it describes.
          *
          * WHICH FIELDS ARE STAND-INS IS STILL TRACKED, in content/audience.ts (`MOCK_FIELDS`) and
          * on the question itself (content/persona.ts, q4) — it is simply not printed. Anyone
          * retiring a stand-in works from those two places; nothing on this screen reports it.
          */}
      </p>
      <div className="pp-chart__rows">
        {ordered.map(([key, count]) => {
          const hi = hook.highlight.includes(key)
          return (
            <div
              className="pp-chart__row"
              data-testid={`chart-bar-${key}`}
              data-highlight={hi ? 'true' : 'false'}
              key={key}
            >
              <p className="pp-chart__lab">
                <span className="pp-chart__label" lang="th">{labels[key]?.th ?? key}</span>
                <b className="pp-chart__count" lang="th">
                  {hi && solo ? `${count} จาก ${AUDIENCE.respondents}` : count}
                </b>
              </p>
              <span className="pp-chart__track">
                <span className="pp-chart__bar" style={{ width: `${(count / max) * 100}%` }} />
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── reveal ──────────────────────────────────────────────────────────────────

function RevealView({ frame, question }: { frame: RoomFrame; question: Question }) {
  const split = frame.split ?? [0, 1, 2, 3].map((i) => ({ choiceIndex: i, count: 0 }))
  const total = split.reduce((n, s) => n + s.count, 0)
  /*
   * WHICH ONE THE ROOM ACTUALLY PICKED, said in words rather than left to be eyeballed. From the
   * back of a hall two bars a few percent apart are the same bar. `null` when nothing was voted on
   * and when there is a tie at the top — announcing a winner that is not one is worse than
   * announcing none.
   */
  const topCount = Math.max(...split.map((s) => s.count))
  const leaders = split.filter((s) => s.count === topCount)
  const topIndex = total > 0 && leaders.length === 1 ? leaders[0].choiceIndex : null

  return (
    <section className="pp-stage pp-reveal" data-testid="stage-reveal">
      <header className="pp-strip">
        <span className="pp-strip__q" lang="th">
          {UI.questionOf.th} {(frame.questionIndex ?? 0) + 1}/{QUESTIONS.length}
        </span>
        <span className="pp-strip__votes" lang="th">{UI.roomPicked.th}</span>
      </header>

      <div className="pp-split">
        {/* The brief, back on screen at reading size. The room is looking at four answers to a
            question it read forty seconds ago against a clock; without it the bars are answers to
            nothing. */}
        <p className="pp-split__q" lang="th">{question.scenario}</p>
        {split.map(({ choiceIndex, count }) => {
          const choice = question.choices[choiceIndex]
          if (!choice) return null
          // Guard total === 0: a reveal nobody voted on renders empty bars, never NaN.
          const pct = total === 0 ? 0 : Math.round((count / total) * 100)
          return (
            <div
              className="pp-split__row"
              data-testid={`split-bar-${choiceIndex}`}
              data-top={choiceIndex === topIndex ? 'true' : undefined}
              key={choiceIndex}
            >
              <span className="pp-split__letter">{String.fromCharCode(65 + choiceIndex)}</span>
              <span className="pp-split__track">
                {/* SHARE OF THE ROOM, not share of the winner. The bar used to be drawn against
                    the largest count, so the top answer was always full width whether it took 39%
                    or 90% — the shape of a split room and a decided one looked identical. */}
                <span className="pp-split__bar" style={{ width: `${pct}%` }} />
                <span className="pp-split__face">
                  <span className="pp-split__label" lang="th">{choice.label}</span>
                  {choiceIndex === topIndex ? (
                    <span className="pp-split__flag" lang="th">{UI.mostPicked.th}</span>
                  ) : null}
                  <b className="pp-split__pct">{pct}%</b>
                  <span className="pp-split__cnt" lang="th">{count} คน</span>
                </span>
              </span>
            </div>
          )
        })}
      </div>

      <Progress index={frame.questionIndex ?? 0} />
    </section>
  )
}

// ── result — the 2×2 map ────────────────────────────────────────────────────

/** Quadrant grid order: top row is MOVE FAST, left column is GUT. */
const QUADRANT_ORDER: PersonaId[] = ['pioneer', 'sprinter', 'guardian', 'analyst']

function ResultView({ frame }: { frame: RoomFrame }) {
  const result = frame.result ?? {
    counts: { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 },
    dots: [] as PersonaId[],
  }
  /*
   * NO DOT FIELD. Each quadrant used to draw one dot per person, and at the scale this runs at it
   * was neither a headcount (nobody counts forty dots from the back of a hall) nor a shape (they
   * wrapped into a rough block). The number is already printed at the size of a fist, so the dots
   * were the same fact told worse — and they were what kept the mascot small. `result.dots` is
   * still carried by the store: it is the per-person record the phone card reads.
   */
  const headcount = result.dots.length

  return (
    <section className="pp-stage pp-result" data-testid="stage-result">
      <h1 className="pp-result__title" lang="th">{UI.resultTitle.th}</h1>

      <div className="pp-map">
        <span className="pp-map__axis pp-map__axis--top">{AXIS_LABELS.pace.fast}</span>
        <span className="pp-map__axis pp-map__axis--bottom">{AXIS_LABELS.pace.slow}</span>
        <span className="pp-map__axis pp-map__axis--left">{AXIS_LABELS.trust.gut}</span>
        <span className="pp-map__axis pp-map__axis--right">{AXIS_LABELS.trust.data}</span>

        <div className="pp-map__grid">
          {QUADRANT_ORDER.map((id) => {
            const p = PERSONAS[id]
            return (
              <div className="pp-quadrant" data-persona={id} data-testid={`quadrant-${id}`} key={id}>
                <p className="pp-quadrant__head">
                  <span className="pp-quadrant__name">{p.mascot.name}</span>
                </p>
                {/* The archetype alone. `label` (THE PIONEER) and `coffee` (เอสเพรสโซ่) are still
                    authored — they are the host's words now, not the wall's. Three names for one
                    quadrant was two too many to read from the back of a hall. */}
                <p className="pp-quadrant__coffee" lang="th">{p.archetype}</p>
                <p className="pp-quadrant__big">
                  <b className="pp-quadrant__count">{result.counts[id]}</b>
                  <span lang="th">คน</span>
                </p>
                {/* The share, along the quadrant's bottom edge. Four numerals in four corners of a
                    map do not compare themselves; four bars on a common baseline do. */}
                <span className="pp-quadrant__meter" aria-hidden>
                  <i style={{ width: headcount === 0 ? '0%' : `${(result.counts[id] / headcount) * 100}%` }} />
                </span>
                {/* Anchored to the corner and deliberately overhanging it — `overflow: hidden` on
                    the quadrant is what makes that safe. `aria-hidden` because the quadrant already
                    names itself in text; the picture is the room's shortcut, not the record. */}
                <span className="pp-quadrant__halo" aria-hidden />
                <img className="pp-quadrant__art" src={p.mascot.art} alt="" aria-hidden />
              </div>
            )
          })}
        </div>
      </div>

      <p className="pp-result__hint" lang="th">{UI.resultHint.th}</p>
    </section>
  )
}

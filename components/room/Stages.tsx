// Café Persona — everything the room sees on the projector. `app/biz/page.tsx` owns the poll,
// the clock and the keyboard; this file renders one frame and nothing else.
//
// Four views, one per stage kind: lobby (QR), ask (data hook + choices), reveal (split + small
// talk), result (the 2×2 map). The persona palette first appears on the REVEAL bars — ask-stage
// choice cards are neutral, or the room could reverse-engineer the choice→type mapping by q3.

import { QRCodeSVG } from 'qrcode.react'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { UI } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import { AXIS_LABELS } from '@/lib/room-types'
import type { PersonaId, Question } from '@/lib/room-types'
import type { PublicRoomState } from '@/lib/room-store'

export type RoomFrame = PublicRoomState

type StagesProps = {
  frame: RoomFrame
  /** Where phones join. Computed client-side by the page — its absence means hydration failed. */
  joinUrl: string
  /** Locally interpolated between polls; display-only (spec §2). */
  remainingMs: number
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

export function Stages({ frame, joinUrl, remainingMs }: StagesProps) {
  if (frame.phase === 'done') return <ResultView frame={frame} />

  const question = questionById(frame.questionId)
  if (frame.phase === 'lobby' || !question) return <LobbyView frame={frame} joinUrl={joinUrl} />

  if (frame.stageKind === 'ask') {
    return <AskView frame={frame} question={question} remainingMs={remainingMs} />
  }
  return <RevealView frame={frame} question={question} />
}

// ── lobby ───────────────────────────────────────────────────────────────────

function LobbyView({ frame, joinUrl }: { frame: RoomFrame; joinUrl: string }) {
  return (
    <section className="pp-stage pp-lobby" data-testid="stage-lobby">
      <h1 className="pp-lobby__title">{UI.title.th}</h1>
      <p className="pp-lobby__sub"><Bilingual text={UI.joinTitle} as="hero" /></p>

      <div className="pp-lobby__qr">
        {/* Client-side only, and that is the point: no QR on the projector means client JS never
            ran, which is the diagnostic the host needs before doors open. */}
        {joinUrl ? (
          <div className="pp-lobby__qr-box" data-testid="join-qr" aria-label="Join QR code">
            <QRCodeSVG value={joinUrl} size={280} level="M" />
          </div>
        ) : null}
        <p className="pp-lobby__hint">
          <Bilingual text={UI.scanHint} as="label" />
          <span className="pp-lobby__url">{joinUrl}</span>
        </p>
      </div>

      <p className="pp-lobby__count">
        <b data-testid="player-count">{frame.playerCount}</b>
        <Bilingual text={UI.inTheRoom} as="label" />
      </p>
    </section>
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

  return (
    <section className="pp-stage pp-ask" data-testid="stage-ask">
      <header className="pp-strip">
        <span className="pp-strip__q" data-testid="question-counter" lang="th">
          {UI.questionOf.th} {(frame.questionIndex ?? 0) + 1}/{QUESTIONS.length}
        </span>
        {/* Display-only (spec §2): reaching 0:00 changes nothing — the host closes voting. */}
        <span className="pp-strip__clock" data-testid="countdown">{mmss}</span>
        <span className="pp-strip__votes" lang="th">
          <b data-testid="vote-count">{frame.voteCount}</b> {UI.votesIn.th}
        </span>
      </header>

      <div className="pp-hook">
        <p className="pp-hook__figure" data-testid="data-figure">{question.dataHook.figure}</p>
        <p className="pp-hook__caption" lang="th">{question.dataHook.caption}</p>
      </div>

      <p className="pp-scenario" lang="th">{question.scenario}</p>

      <ol className="pp-choices">
        {question.choices.map((choice, i) => (
          // NEUTRAL on ask — no data-persona until the reveal.
          <li className="pp-choice" data-testid={`ask-choice-${i}`} key={choice.label}>
            <span className="pp-choice__letter">{String.fromCharCode(65 + i)}</span>
            <span className="pp-choice__label" lang="th">{choice.label}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ── reveal ──────────────────────────────────────────────────────────────────

function RevealView({ frame, question }: { frame: RoomFrame; question: Question }) {
  const split = frame.split ?? [0, 1, 2, 3].map((i) => ({ choiceIndex: i, count: 0 }))
  const total = split.reduce((n, s) => n + s.count, 0)
  const max = Math.max(1, ...split.map((s) => s.count))

  return (
    <section className="pp-stage pp-reveal" data-testid="stage-reveal">
      <header className="pp-strip">
        <span className="pp-strip__q" lang="th">
          {UI.questionOf.th} {(frame.questionIndex ?? 0) + 1}/{QUESTIONS.length}
        </span>
        <span className="pp-strip__votes" lang="th">{UI.roomPicked.th}</span>
      </header>

      <div className="pp-split">
        {split.map(({ choiceIndex, count }) => {
          const choice = question.choices[choiceIndex]
          if (!choice) return null
          // Guard total === 0: a reveal nobody voted on renders empty bars, never NaN.
          const pct = total === 0 ? 0 : Math.round((count / total) * 100)
          return (
            <div
              className="pp-split__row"
              data-testid={`split-bar-${choiceIndex}`}
              data-persona={choice.persona}
              key={choiceIndex}
            >
              <span className="pp-split__letter">{String.fromCharCode(65 + choiceIndex)}</span>
              <span className="pp-split__label" lang="th">{choice.label}</span>
              <span className="pp-split__track">
                <span className="pp-split__bar" style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="pp-split__nums">
                <b>{count}</b> · {pct}%
              </span>
            </div>
          )
        })}
      </div>

      <div className="pp-talk">
        <p className="pp-talk__title" lang="th">{UI.smallTalkTitle.th}</p>
        <p className="pp-talk__body" lang="th">{question.smallTalk}</p>
      </div>
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
  // Dots arrive sorted by persona (store guarantees it); index them per-quadrant for keys.
  const dotsBy: Record<PersonaId, number> = { pioneer: 0, sprinter: 0, analyst: 0, guardian: 0 }
  for (const d of result.dots) dotsBy[d]++

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
                  <span className="pp-quadrant__emoji" aria-hidden>{p.emoji}</span>
                  <span className="pp-quadrant__label">{p.label}</span>
                  <b className="pp-quadrant__count">{result.counts[id]}</b>
                </p>
                <p className="pp-quadrant__coffee" lang="th">{p.coffee} · {p.archetype}</p>
                <div className="pp-quadrant__dots">
                  {Array.from({ length: dotsBy[id] }, (_, i) => (
                    <span
                      className="pp-dot"
                      data-persona={id}
                      data-testid={`result-dot-${id}-${i}`}
                      key={i}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="pp-result__hint" lang="th">{UI.resultHint.th}</p>
    </section>
  )
}

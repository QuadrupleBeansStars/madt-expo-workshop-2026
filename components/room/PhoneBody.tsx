// Café Persona — the phone's screen, rendered from one server frame. `app/play/page.tsx` owns
// identity, polling and the vote queue; this file renders and nothing else.
//
// Choice buttons are NEUTRAL during ask — persona colors on the phone mid-game would leak the
// choice→type mapping to anyone who noticed four consistent colors. The persona palette appears
// exactly once on this screen: the final card.

import { PHONE } from '@/content/room-labels'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { Bilingual } from '@/components/deck/Bilingual'
import { AXIS, AXIS_LABELS } from '@/lib/room-types'
import type { PublicRoomState } from '@/lib/room-store'
import type { PersonaId, Question } from '@/lib/room-types'
import type { LocalizedText } from '@/lib/types'
import './phone.css'

export type PhoneFrame = PublicRoomState

type PhoneBodyProps = {
  /** The player's name, as this phone knows it. */
  name: string
  /** `null` until the first poll lands — the phone holds rather than blanking. */
  frame: PhoneFrame | null
  /** Locally interpolated countdown; falls back to the figure in the frame. */
  remainingMs?: number
  /** The choice this phone tapped, until the server confirms it in `frame.you`. */
  picked: number | null
  onVote: (questionId: string, choiceIndex: number) => void
  /** Shown as a quiet line, never as a screen of its own — the room keeps moving. */
  notice?: LocalizedText | null
  offline?: boolean
}

/**
 * Look the question up by id, never by index — the phone's content bundle and the server's can
 * skew across a reload mid-session, and an id miss holds the screen where an index miss would put
 * the wrong question, with the wrong choices, in front of a player who is about to tap one.
 */
function questionById(id: string | null | undefined): Question | null {
  if (!id) return null
  return QUESTIONS.find((q) => q.id === id) ?? null
}

export function PhoneBody({
  name, frame, remainingMs, picked, onVote, notice, offline,
}: PhoneBodyProps) {
  const question = questionById(frame?.questionId)
  const you = frame?.you ?? null

  // Branch on `phase` first. `stageKind` is null in BOTH `lobby` and `done`, and `done` is the
  // moment the player most wants their card — a kind-only branch would blank it.
  if (frame?.phase === 'done') {
    return (
      <Shell name={name} notice={notice} offline={offline} testId="phone-final">
        {you?.persona ? <PersonaCard persona={you.persona} /> : <LateJoiner />}
      </Shell>
    )
  }

  if (!frame || frame.phase === 'lobby' || !question) {
    return (
      <Shell name={name} notice={notice} offline={offline} testId="phone-holding">
        <div className="phone-hold">
          <Bilingual text={PHONE.waitHost} as="hero" />
        </div>
      </Shell>
    )
  }

  if (frame.stageKind === 'ask') {
    return (
      <Shell name={name} notice={notice} offline={offline} testId="phone-ask">
        <AskView
          question={question}
          frame={frame}
          remainingMs={remainingMs ?? frame.remainingMs}
          picked={picked}
          onVote={onVote}
        />
      </Shell>
    )
  }

  // reveal — eyes up, with a reminder of your own pick.
  const chosen = you?.pickedChoiceIndex ?? picked
  return (
    <Shell name={name} notice={notice} offline={offline} testId="phone-reveal">
      <div className="phone-hold">
        <Bilingual text={PHONE.watchScreen} as="hero" />
        {chosen !== null && question.choices[chosen] ? (
          <p className="phone-yourpick" data-testid="your-pick">
            <Bilingual text={PHONE.youPicked} as="label" />
            <span lang="th" className="phone-yourpick__label">{question.choices[chosen].label}</span>
          </p>
        ) : null}
      </div>
    </Shell>
  )
}

/** Name, notices, and the body of the screen. */
function Shell({
  name, notice, offline, testId, children,
}: {
  name: string
  notice?: LocalizedText | null
  offline?: boolean
  testId: string
  children: React.ReactNode
}) {
  return (
    <div className="phone-root" data-testid={testId}>
      <header className="phone-head">
        <span className="phone-head__name" data-testid="player-name">{name}</span>
        {offline ? (
          <span className="phone-head__offline" data-testid="phone-offline" role="status">
            <Bilingual text={PHONE.offline} as="label" />
          </span>
        ) : null}
      </header>

      {notice ? (
        <p className="phone-notice" data-testid="phone-notice" role="status">
          <Bilingual text={notice} as="label" />
        </p>
      ) : null}

      <main className="phone-main">{children}</main>
    </div>
  )
}

function AskView({
  question, frame, remainingMs, picked, onVote,
}: {
  question: Question
  frame: PhoneFrame
  remainingMs: number
  picked: number | null
  onVote: (questionId: string, choiceIndex: number) => void
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  // Server truth wins; the local pick only covers the gap while the vote is in flight or queued.
  const chosen = frame.you?.pickedChoiceIndex ?? picked
  // The countdown is DISPLAY-ONLY (spec §2): buttons never disable on 0 — only the host closes
  // voting, by advancing to the reveal, and the server 409s anything that slips past that.

  return (
    <div className="phone-ask">
      <div className="phone-ask__head">
        <Bilingual text={PHONE.pickOne} as="label" className="phone-ask__kicker" />
        <p className="phone-ask__scenario" lang="th">{question.scenario}</p>
        {seconds > 0 ? (
          <p className="phone-clock" data-testid="phone-countdown">{seconds}</p>
        ) : null}
      </div>

      <ol className="phone-options">
        {question.choices.map((choice, i) => (
          <li key={choice.label}>
            <button
              type="button"
              className="phone-option"
              data-testid={`choice-${i}`}
              aria-pressed={chosen === i}
              onClick={() => onVote(question.id, i)}
            >
              <span className="phone-option__letter">{String.fromCharCode(65 + i)}</span>
              <span lang="th" className="phone-option__label">{choice.label}</span>
            </button>
          </li>
        ))}
      </ol>

      {chosen !== null ? (
        <p className="phone-picked" data-testid="pick-saved">
          <Bilingual text={PHONE.picked} as="label" />
        </p>
      ) : null}
    </div>
  )
}

/** The MBTI-style result card — the one place the persona palette touches the phone. */
function PersonaCard({ persona }: { persona: PersonaId }) {
  const p = PERSONAS[persona]
  const axis = AXIS[persona]
  const partner = PERSONAS[p.partner]
  return (
    <section className="phone-card" data-testid="persona-card" data-persona={persona}>
      <p className="phone-card__kicker"><Bilingual text={PHONE.yourType} as="label" /></p>
      <p className="phone-card__emoji" aria-hidden>{p.emoji}</p>
      <h1 className="phone-card__label">{p.label}</h1>
      <p className="phone-card__coffee" lang="th">{p.coffee} · {p.archetype}</p>
      <p className="phone-card__axis">
        {AXIS_LABELS.trust[axis.trust]} × {AXIS_LABELS.pace[axis.pace]}
      </p>
      <p className="phone-card__desc" lang="th">{p.description}</p>
      <dl className="phone-card__facts">
        <div>
          <dt><Bilingual text={PHONE.strength} as="label" /></dt>
          <dd lang="th">{p.strength}</dd>
        </div>
        <div>
          <dt><Bilingual text={PHONE.caution} as="label" /></dt>
          <dd lang="th">{p.caution}</dd>
        </div>
        <div>
          <dt><Bilingual text={PHONE.partner} as="label" /></dt>
          <dd data-testid="partner">{partner.emoji} {partner.label}</dd>
        </div>
      </dl>
    </section>
  )
}

function LateJoiner() {
  return (
    <div className="phone-hold" data-testid="late-joiner">
      <p className="phone-late" lang="th">{PHONE.lateJoiner.th}</p>
    </div>
  )
}

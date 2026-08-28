// Café Persona — the phone's screen, rendered from one server frame. `app/play/page.tsx` owns
// identity, polling and the vote queue; this file renders and nothing else.
//
// Choice buttons are NEUTRAL during ask — persona colors on the phone mid-game would leak the
// choice→type mapping to anyone who noticed four consistent colors. The persona palette appears
// exactly once on this screen: the final card, which is also the only place the phone shows a
// mascot (public/personas/*.png, mapped in content/persona.ts).

import { PHONE } from '@/content/room-labels'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { Bilingual } from '@/components/deck/Bilingual'
import { AXIS, AXIS_LABELS } from '@/lib/room-types'
import { ASK_MS } from '@/lib/room'
import type { PublicRoomState } from '@/lib/room-store'
import type { PersonaId, Question } from '@/lib/room-types'
import type { LocalizedText } from '@/lib/types'
import './phone.css'

export type PhoneFrame = PublicRoomState

/**
 * When the drain bar turns from coffee brown to alarm orange, as a fraction of the whole window.
 *
 * A THIRD, so it is ten seconds of a thirty-second ask — and it stays ten seconds of a forty-five
 * second one if `ASK_MS` ever moves again, because a fixed millisecond threshold would silently
 * become "the last quarter" or "the last half" the moment that constant changed.
 */
const LOW_TIME_FRACTION = 1 / 3

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
  /* 1-based, and `null` off-stage so the counter strip carries nothing on the lobby and the final
     card — neither is "question N of eight" and a stale 8/8 over a persona card reads as a score. */
  const step = frame && frame.phase === 'stage' && frame.questionIndex !== null
    ? frame.questionIndex + 1
    : null

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

  /*
   * THE CLOCK CLOSES THIS PHONE, NOT THE POLL.
   *
   * The projector ends an `ask` when the countdown hits zero, but the phone only learns that on
   * its next poll — up to a second later — and for that second it sat there with a live countdown
   * reading 0 and four buttons that still took a tap. That is the worst second of the screen: it
   * looks open, it reads closed, and a vote landing in it is decided by network luck.
   *
   * So the phone leaves the question on its own clock. `remainingMs` is interpolated from the
   * SERVER's figure in the last frame rather than from a wall clock, so a phone whose time is
   * wrong does not close early or late.
   *
   * DERIVED, NEVER STORED. A host pressing `back` re-opens the stage with a fresh countdown, and
   * because this is recomputed from the frame every render the phone simply comes back — where a
   * `closed` flag would have to be remembered to clear.
   *
   * The server still accepts a vote for as long as the stage is an `ask` (lib/room.ts#askOpen).
   * That is deliberate and unchanged: a phone that tapped at 29.9s has its POST in flight, and
   * this only stops taps that start after the window is over.
   */
  const clock = remainingMs ?? frame.remainingMs
  if (frame.stageKind === 'ask' && clock > 0) {
    return (
      <Shell
        name={name}
        notice={notice}
        offline={offline}
        testId="phone-ask"
        step={step}
        /* ASK_MS is the denominator, and it has to be: `frame.remainingMs` is what is LEFT at the
           last poll, so dividing by it yields ~1 on every frame and paints a bar that never
           drains. Importing the constant is the honest version — lib/room.ts is pure, and the
           projector's own countdown reads the same number. */
        progress={clock / ASK_MS}
      >
        <AskView
          question={question}
          frame={frame}
          remainingMs={clock}
          picked={picked}
          onVote={onVote}
        />
      </Shell>
    )
  }

  // reveal, and a timed-out ask — eyes up, with a reminder of your own pick.
  const chosen = you?.pickedChoiceIndex ?? picked
  return (
    <Shell name={name} notice={notice} offline={offline} testId="phone-reveal" step={step}>
      <div className="phone-hold">
        {/* This screen has exactly one job: get a head to come up off a phone. The dots are the
            part that does it — a still page reads as one that has finished loading, and a player
            who thinks their phone is done watches it instead of the room. */}
        <span className="phone-hold__dots" aria-hidden><i /><i /><i /></span>
        <Bilingual text={PHONE.watchScreen} as="hero" />
        {chosen !== null && question.choices[chosen] ? (
          /* Their own answer, handed back on a receipt. It is what a table argues over while the
             projector does the reveal, and it is why the choice is worth showing at all here. */
          <p className="phone-receipt" data-testid="your-pick">
            <Bilingual text={PHONE.youPicked} as="label" />
            <span lang="th" className="phone-receipt__label">{question.choices[chosen].label}</span>
          </p>
        ) : null}
      </div>
    </Shell>
  )
}

/** The shop mark. Inline rather than a file so the phone's first screen needs no second request
 *  on a hall wifi that a hundred people just joined at once. */
function CupMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M17 10.5h1.6a2.4 2.4 0 0 1 0 4.8H17" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 2.5c-.9 1.2-.9 2.3 0 3.5M12 2.5c-.9 1.2-.9 2.3 0 3.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The counter strip, the notices, and the body.
 *
 * `step` is "which of the eight am I on", and it is the thing this screen was missing: without it
 * a player cannot tell whether the workshop is two questions in or nearly over. That count lives
 * on the projector, which is exactly where they are not looking while they answer.
 *
 * `progress` is the ask clock as a fraction, drawn as a bar that drains. It replaces a bare number
 * floating off the right edge with something readable out of the corner of an eye, and it changes
 * colour under ten seconds so "hurry up" does not have to be read to be felt.
 */
function Shell({
  name, notice, offline, testId, step, progress, children,
}: {
  name: string
  notice?: LocalizedText | null
  offline?: boolean
  testId: string
  /** 1-based question number, or null off-stage. */
  step?: number | null
  /** 1 -> full, 0 -> out of time. `null` on every screen that has no clock. */
  progress?: number | null
  children: React.ReactNode
}) {
  return (
    <div className="phone-root" data-testid={testId}>
      <header className="phone-head">
        <span className="phone-head__shop">
          <CupMark className="phone-head__mark" />
          <span className="phone-head__name" data-testid="player-name">{name}</span>
        </span>
        {offline ? (
          <span className="phone-head__offline" data-testid="phone-offline" role="status">
            <Bilingual text={PHONE.offline} as="label" />
          </span>
        ) : step ? (
          <span className="phone-head__step" data-testid="phone-step">
            <b>{step}</b> / {QUESTIONS.length}
          </span>
        ) : null}
      </header>

      {progress !== null && progress !== undefined ? (
        <div className="phone-bar" data-testid="phone-bar">
          <div
            className="phone-bar__fill"
            data-low={progress <= LOW_TIME_FRACTION ? '1' : '0'}
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      ) : null}

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
  // Buttons are never disabled here. The window closes by leaving this view entirely (see the
  // clock branch in PhoneBody), and the server 409s anything that slips past that.

  return (
    <div className="phone-ask">
      {/* The question on a ticket rather than as loose text: it is the one thing on screen that is
          NOT the player's to act on, and a card is what says so without a word of instruction. */}
      <div className="phone-ticket">
        <Bilingual text={PHONE.pickOne} as="label" className="phone-ticket__kicker" />
        <p className="phone-ticket__q" lang="th">{question.scenario}</p>
      </div>

      {/* The number survives for a screen reader and for anyone who wants the digit — the bar in
          the Shell is this same value drawn. Visually hidden, not removed. */}
      <p className="phone-sr" data-testid="phone-countdown" role="status">{seconds}</p>

      {/* This list GROWS into whatever height is left and shares it between the four rows. The old
          one sat at its content height and left the bottom 40% of the screen empty — under the
          thumb that was supposed to be reaching the options. */}
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
              <span className="phone-option__tick" aria-hidden>✓</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Always rendered, empty until there is a pick: a line that appears would push four
          full-height buttons up by its own height the instant a player taps one. */}
      <p className="phone-picked" data-testid="pick-saved" role="status">
        {chosen !== null ? <Bilingual text={PHONE.picked} as="label" /> : null}
      </p>
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
      {/* The character's own line from the MAD+ profile — the one place it appears, so a player
          who walked past the booth recognises the card as the same world. */}
      <p className="phone-card__quote">{p.mascot.quote}</p>
      {/* The mascot IS the reveal: it rises first, the words follow. `alt` is empty because the
          name is the next line and a screen reader would otherwise say the character twice. */}
      <span className="phone-card__art" aria-hidden>
        <img src={p.mascot.art} alt="" />
      </span>
      <h1 className="phone-card__name">{p.mascot.name}</h1>
      {/* The archetype alone. `label` and `coffee` stay authored in content/persona.ts as the
          host's language; the card carries the character's name and what that character is. */}
      <p className="phone-card__coffee" lang="th">{p.archetype}</p>
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
          <dd data-testid="partner">{partner.mascot.name} · {partner.archetype}</dd>
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

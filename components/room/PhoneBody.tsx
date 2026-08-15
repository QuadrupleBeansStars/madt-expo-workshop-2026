'use client'

// The Decision Room — what one player holds in their hand.
//
// A pure renderer, exactly like `Stages.tsx` is for the projector: a frame of server state in, a
// screen out. It owns no state, fetches nothing and touches no storage — `app/play/page.tsx` owns
// the identity, the poll and the vote queue, so every screen below can be rendered in a test at
// any stage without a network.
//
// Three rules:
//   1. Both languages render at once. No `lang` prop, no toggle (spec §7).
//   2. The narrative lives on the big screen. Between decisions this page says so, and shows the
//      one thing the projector cannot show a person: their own shop.
//   3. Touch targets are large. This is a phone at arm's length in a dark room, and a mis-tap
//      costs a player a whole round.

import { STAGES } from '@/content/room'
import { KPI_LABELS, PHONE, UI } from '@/content/room-labels'
import { Bilingual } from '@/components/deck/Bilingual'
import { evidenceFigures } from './evidence'
import { PlaceholderBadge } from './PlaceholderBadge'
import type { PublicRoomState } from '@/lib/room-store'
import type { DecideStage, Stage } from '@/lib/room-types'
import type { LocalizedText } from '@/lib/types'
import './phone.css'

/** Exactly what `GET /api/room/state?playerId=…` returns, minus the board the phone ignores. */
export type PhoneFrame = PublicRoomState

type PhoneBodyProps = {
  /** The shop's name, as this phone knows it. */
  name: string
  /** `null` until the first poll lands — the phone holds rather than blanking. */
  frame: PhoneFrame | null
  /** Locally interpolated countdown; falls back to the figure in the frame. */
  remainingMs?: number
  /** The option this phone tapped, until the server confirms it in `frame.you`. */
  picked: string | null
  onVote: (stageId: string, optionId: string) => void
  /** Shown as a quiet line, never as a screen of its own — the room keeps moving. */
  notice?: LocalizedText | null
  offline?: boolean
}

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/**
 * Look the stage up by id, never by index — the phone's content bundle and the server's can skew
 * across a reload mid-session, and an id miss holds the screen where an index miss would put the
 * wrong question, with the wrong options, in front of a player who is about to tap one.
 */
function stageById(id: string | null | undefined): Stage | null {
  if (!id) return null
  return STAGES.find((s) => s.id === id) ?? null
}

export function PhoneBody({
  name, frame, remainingMs, picked, onVote, notice, offline,
}: PhoneBodyProps) {
  const stage = stageById(frame?.stageId)
  const you = frame?.you ?? null

  // Branch on `phase` first. `stageKind` is null in BOTH `lobby` and `done`, and `done` is the
  // moment the player most wants their own number — a kind-only branch would blank it.
  if (!frame || frame.phase === 'done' || frame.phase === 'lobby' || !stage) {
    const final = frame?.phase === 'done'
    return (
      <Shell name={name} you={you} notice={notice} offline={offline} testId={final ? 'phone-final' : 'phone-holding'}>
        <div className="phone-hold">
          <Bilingual text={final ? PHONE.finalTitle : PHONE.lookUp} as="hero" />
          <Bilingual
            text={final ? PHONE.thanks : frame && frame.phase !== 'lobby' ? PHONE.waiting : UI.waitingForHost}
            as="body"
            className="phone-hold__sub"
          />
        </div>
      </Shell>
    )
  }

  if (stage.kind === 'decide') {
    return (
      <Shell name={name} you={you} notice={notice} offline={offline} testId="phone-decide">
        <DecideView
          stage={stage}
          frame={frame}
          remainingMs={remainingMs ?? frame.remainingMs}
          picked={picked}
          onVote={onVote}
        />
      </Shell>
    )
  }

  return (
    <Shell name={name} you={you} notice={notice} offline={offline} testId="phone-holding">
      <div className="phone-hold">
        <Bilingual text={PHONE.lookUp} as="hero" />
        <Bilingual text={PHONE.waiting} as="body" className="phone-hold__sub" />
      </div>
    </Shell>
  )
}

/** Name, notices, the body of the screen, and the player's own shop underneath all of it. */
function Shell({
  name, you, notice, offline, testId, children,
}: {
  name: string
  you: PhoneFrame['you'] | null
  notice?: LocalizedText | null
  offline?: boolean
  testId: string
  children: React.ReactNode
}) {
  return (
    <div className="phone-root" data-testid={testId}>
      <header className="phone-head">
        <span className="phone-head__name" data-testid="shop-name">{name}</span>
        {offline ? (
          <span className="phone-head__offline" data-testid="phone-offline" role="status">
            <Bilingual text={UI.offline} as="label" />
          </span>
        ) : null}
      </header>

      {notice ? (
        <p className="phone-notice" data-testid="phone-notice" role="status">
          <Bilingual text={notice} as="label" />
        </p>
      ) : null}

      <main className="phone-main">{children}</main>

      <YourShop you={you} />
    </div>
  )
}

/**
 * The reason a phone is worth looking at between decisions: this player's own cafe.
 *
 * `waste` carries its "lower is better" label from `KPI_LABELS` for the same reason the projector
 * board does — a bare number beside three bigger-is-better ones reads as a shop doing badly when
 * it is doing well.
 */
function YourShop({ you }: { you: PhoneFrame['you'] | null }) {
  if (!you) {
    return (
      <section className="phone-shop phone-shop--empty" data-testid="your-shop">
        <Bilingual text={PHONE.notTradingYet} as="label" />
      </section>
    )
  }

  return (
    <section className="phone-shop" data-testid="your-shop">
      <div className="phone-shop__top">
        <Bilingual text={PHONE.yourShop} as="label" className="phone-shop__title" />
        <p className="phone-shop__score">
          <b data-testid="you-score">{num.format(Math.round(you.score))}</b>
          <span className="phone-shop__score-k" lang="th">{UI.score.th}</span>
        </p>
        <p className="phone-shop__rank">
          <span className="phone-shop__rank-k" lang="th">{PHONE.rank.th}</span>
          <b data-testid="you-rank">{you.rank}</b>
        </p>
      </div>

      <dl className="phone-kpis">
        {(['revenue', 'profit', 'satisfaction', 'waste'] as const).map((key) => (
          <div className="phone-kpis__item" key={key}>
            <dt>
              <span lang="th">{KPI_LABELS[key].th}</span>
            </dt>
            <dd data-testid={`kpi-${key}`}>{num.format(Math.round(you.kpi[key]))}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/**
 * The evidence, as much of it as belongs on a phone.
 *
 * Two or three counts as text — NOT the projector's charts. The options have to stay above the
 * fold: a player who has to scroll before they can tap misses the round, and the big screen is
 * already showing the full distributions in a size this one cannot match. The figures come from
 * the stage's own `evidence` list through `evidenceFigures`, the same list the projector charts,
 * so the two screens can never quote different numbers at the room.
 *
 * `DataPanel` carries the PLACEHOLDER guard for the projector; this strip is not a `DataPanel`,
 * so it renders the badge itself. Audience figures never appear anywhere without it.
 */
function EvidenceStrip({ stage }: { stage: DecideStage }) {
  const figures = evidenceFigures(stage.evidence)
  if (figures.length === 0) return null

  return (
    <section className="phone-evidence" data-testid="phone-evidence">
      <div className="phone-evidence__head">
        <Bilingual text={PHONE.fromYourAnswers} as="label" className="phone-evidence__title" />
        <PlaceholderBadge />
      </div>
      <ul className="phone-evidence__list">
        {figures.map((figure) => (
          <li className="phone-evidence__item" key={figure.key} data-testid={`phone-evidence-${figure.key}`}>
            <b className="phone-evidence__value">{num.format(figure.value)}</b>
            <Bilingual text={figure.label} as="label" className="phone-evidence__label" />
          </li>
        ))}
      </ul>
      {/* The phone must not quote a multi-select count as if it were a share of the room — the
          projector says so beside the same chart, and these are the same numbers. */}
      {figures.some((f) => f.multiSelect) ? (
        <p className="phone-evidence__note" data-testid="phone-multi-select-note">
          <Bilingual text={PHONE.multiSelectNote} as="label" />
        </p>
      ) : null}
    </section>
  )
}

function DecideView({
  stage, frame, remainingMs, picked, onVote,
}: {
  stage: DecideStage
  frame: PhoneFrame
  remainingMs: number
  picked: string | null
  onVote: (stageId: string, optionId: string) => void
}) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  // The server owns the clock, but a phone whose countdown has run out must not accept a tap it
  // is about to be told was too late. Either signal closes the buttons.
  const open = frame.votingOpen && seconds > 0
  // Server truth wins; the local pick only covers the gap while the vote is in flight or queued.
  const chosen = frame.you?.votedOptionId ?? picked
  const chosenOption = stage.options.find((o) => o.id === chosen) ?? null

  return (
    <div className="phone-decide">
      <div className="phone-decide__head">
        <Bilingual text={stage.prompt} as="hero" className="phone-decide__prompt" />
        <Bilingual text={stage.context} as="body" className="phone-decide__context" />
        <p className="phone-clock" data-open={open}>
          <b data-testid="phone-countdown">{seconds}</b>
          <Bilingual text={UI.seconds} as="label" />
        </p>
      </div>

      <EvidenceStrip stage={stage} />

      <ol className="phone-options">
        {stage.options.map((option) => (
          <li key={option.id}>
            <button
              type="button"
              className="phone-option"
              data-testid={`option-${option.id}`}
              aria-pressed={chosen === option.id}
              disabled={!open}
              onClick={() => onVote(stage.id, option.id)}
            >
              <Bilingual text={option.label} as="body" className="phone-option__label" />
            </button>
          </li>
        ))}
      </ol>

      {chosenOption ? (
        <p className="phone-picked" data-testid="your-pick">
          <Bilingual text={PHONE.youPicked} as="label" />
          <Bilingual text={chosenOption.label} as="body" />
        </p>
      ) : (
        <p className="phone-picked phone-picked--empty">
          <Bilingual text={open ? PHONE.tapOne : PHONE.locked} as="label" />
        </p>
      )}
    </div>
  )
}

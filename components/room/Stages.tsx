'use client'

// The Decision Room — everything the projector puts in front of the room.
//
// One pure component: given a frame of server state, render the stage the host is on. It holds no
// state of its own and fetches nothing — `app/biz/page.tsx` owns the poll, the clock and the
// keyboard, so this file can be rendered directly in a test at any stage without a network.
//
// Three rules the whole file obeys:
//   1. Both languages render at once. No `lang` prop, no toggle (spec §7).
//   2. Every sentence comes from `content/room.ts`; the captions around them from
//      `content/room-labels.ts`. Nothing here invents narrative copy.
//   3. The round 1 result is a simulation over the audience's own registration answers. It is
//      never described as anything cleverer than that.

import type { CSSProperties } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { AUDIENCE } from '@/content/audience'
import { ARCHETYPES, STAGES } from '@/content/room'
import { KPI_LABELS, NARRATED_DISCOUNT_PRICE, NARRATED_HELD_PRICE, TRACE_LABELS, UI } from '@/content/room-labels'
import { STAGE_COUNT } from '@/lib/room'
import type { LeaderboardEntry, PublicRoomState } from '@/lib/room-store'
import type {
  CloseStage, DataStage, DecideStage, EvidenceKey, IntroStage, Kpi, KpiDelta, OutcomeStage, Stage,
} from '@/lib/room-types'
import type { LocalizedText, StoryPanel } from '@/lib/types'
import { simulatePricing } from '@/lib/pricing'
import { Bilingual } from '@/components/deck/Bilingual'
import { DataPanel } from './DataPanel'
import { evidencePanels } from './evidence'
import { Leaderboard } from './Leaderboard'
import { PlaceholderBadge } from './PlaceholderBadge'
import './stages.css'

/** Exactly what `GET /api/room/state` returns. */
export type RoomFrame = PublicRoomState & { leaderboard: LeaderboardEntry[] }

type StagesProps = {
  frame: RoomFrame
  /**
   * Where phones join, e.g. `http://10.0.0.5:3000/play`. Empty until the client has hydrated —
   * the QR is deliberately client-only, so a missing QR on the projector is the diagnostic tell
   * that hydration failed (see the LAN section of README.md).
   */
  joinUrl: string
  /** Locally interpolated countdown; falls back to the server figure in the frame. */
  remainingMs?: number
}

const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** One accent per stage kind, so the room feels the shape of the session without being told. */
const ACCENT: Record<Stage['kind'], string> = {
  intro: 'var(--deck-blue)',
  data: 'var(--deck-green)',
  decide: 'var(--deck-mango)',
  outcome: 'var(--deck-berry)',
  close: 'var(--deck-blue)',
}

/** Eyebrow above each stage. Chrome, not narrative — the script stays in content/room.ts. */
const EYEBROW: Record<Stage['kind'], LocalizedText> = {
  intro: { en: 'Welcome', th: 'เริ่มต้น' },
  data: { en: 'Your own data', th: 'ข้อมูลของพวกคุณเอง' },
  decide: { en: 'Your decision', th: 'ถึงตาคุณตัดสินใจ' },
  outcome: { en: 'What happened', th: 'ผลที่เกิดขึ้น' },
  close: { en: 'Take it with you', th: 'เก็บกลับไป' },
}

/**
 * Look the stage up by id, not by index. The projector's content bundle and the server's could
 * skew across a redeploy mid-session; an id miss renders nothing, where an index miss would
 * confidently render the wrong slide to 200 people.
 */
function stageById(id: string | null): Stage | null {
  if (!id) return null
  return STAGES.find((s) => s.id === id) ?? null
}

function decideStageFor(outcome: OutcomeStage): DecideStage | null {
  const stage = STAGES.find((s) => s.id === outcome.forStageId)
  return stage && stage.kind === 'decide' ? stage : null
}

/** `+1,400` / `-500`. ASCII minus on purpose: it has to read as arithmetic, not as a dash. */
function signed(value: number): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${num.format(Math.abs(value))}`
}

export function Stages({ frame, joinUrl, remainingMs }: StagesProps) {
  const stage = stageById(frame.stageId)

  // Branch on `phase` FIRST. `stageKind` is null in both `lobby` and `done`, and on `done`
  // `stageIndex` still points at the last stage — switching on kind alone blanks the projector at
  // the exact moment the room is looking for its final board.
  if (frame.phase === 'lobby' || !stage) {
    if (frame.phase === 'done') {
      const close = STAGES.find((s): s is CloseStage => s.kind === 'close')
      return (
        <StageShell kind="close" index={STAGE_COUNT - 1}>
          {close ? <CloseView stage={close} frame={frame} /> : <Leaderboard entries={frame.leaderboard} />}
        </StageShell>
      )
    }
    return (
      <StageShell kind="intro" index={0}>
        <JoinView
          headline={{ en: 'The Decision Room', th: 'ห้องแห่งการตัดสินใจ' }}
          body={UI.waitingForHost}
          joinUrl={joinUrl}
          playerCount={frame.playerCount}
        />
      </StageShell>
    )
  }

  return (
    <StageShell kind={stage.kind} index={frame.stageIndex}>
      {stage.kind === 'intro' ? <IntroView stage={stage} joinUrl={joinUrl} frame={frame} /> : null}
      {stage.kind === 'data' ? <DataView stage={stage} /> : null}
      {stage.kind === 'decide' ? (
        <DecideView stage={stage} frame={frame} remainingMs={remainingMs ?? frame.remainingMs} />
      ) : null}
      {stage.kind === 'outcome' ? <OutcomeView stage={stage} frame={frame} /> : null}
      {stage.kind === 'close' ? <CloseView stage={stage} frame={frame} /> : null}
    </StageShell>
  )
}

/**
 * The slide chrome, built from `app/biz/deck.css`'s existing classes rather than SlideFrame:
 * SlideFrame's prev button and its "use ← / →" hint promise a backward step, and the room's
 * control API has only `advance`. Advertising a control that cannot exist is worse than omitting
 * it.
 */
function StageShell({
  kind, index, children,
}: { kind: Stage['kind']; index: number; children: React.ReactNode }) {
  const progress = STAGE_COUNT > 0 ? Math.min(1, (index + 1) / STAGE_COUNT) : 0
  return (
    <section
      className="deck-slide room-slide"
      data-testid="stage-shell"
      data-stage-kind={kind}
      style={{ '--deck-clr': ACCENT[kind], '--deck-progress': progress } as CSSProperties}
    >
      <div className="deck-rail" aria-hidden="true"><span className="deck-rail__fill" /></div>
      <span className="deck-ghost" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>

      <div className="deck-stage">
        <Bilingual text={EYEBROW[kind]} as="label" className="deck-eyebrow" />
        <div className="deck-body">{children}</div>
      </div>

      <footer className="deck-chrome">
        <p className="deck-title">The Decision Room · ห้องแห่งการตัดสินใจ</p>
        <p className="deck-counter" data-testid="stage-counter">
          <span className="deck-counter__now">{index + 1}</span>
          <span className="deck-counter__slash"> / </span>
          <span className="deck-counter__all">{STAGE_COUNT}</span>
        </p>
      </footer>
    </section>
  )
}

// ── intro / lobby ───────────────────────────────────────────────────────────

function IntroView({ stage, joinUrl, frame }: { stage: IntroStage; joinUrl: string; frame: RoomFrame }) {
  return <JoinView headline={stage.headline} body={stage.body} joinUrl={joinUrl} playerCount={frame.playerCount} />
}

function JoinView({
  headline, body, joinUrl, playerCount,
}: { headline: LocalizedText; body: LocalizedText; joinUrl: string; playerCount: number }) {
  return (
    <div className="room-join">
      <div className="room-join__words">
        <Bilingual text={headline} as="hero" />
        <Bilingual text={body} as="body" className="room-join__body" />
        <p className="room-join__count">
          <span className="room-join__count-n" data-testid="player-count">{playerCount}</span>
          <Bilingual text={UI.inTheRoom} as="label" />
        </p>
      </div>

      <div className="room-join__qr">
        <Bilingual text={UI.joinTitle} as="label" />
        {/* Client-side only, and that is the point: no QR on the projector means client JS never
            ran (README, "The LAN gotcha"). Do not move this to the server. */}
        {joinUrl ? (
          <>
            <div className="room-join__qr-box" data-testid="join-qr" aria-label="Join QR code">
              <QRCodeSVG value={joinUrl} size={280} level="M" />
            </div>
            <p className="room-join__url">{joinUrl}</p>
            <Bilingual text={UI.scanHint} as="label" className="room-join__hint" />
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── data ────────────────────────────────────────────────────────────────────

/**
 * Which registration questions each data stage puts on screen.
 *
 * Deliberately not "all five": the panels exist to back the points the host reads out, and every
 * extra panel is another red PLACEHOLDER badge and another thing to look at. `data-competitor`
 * shows queue patience alone — the same chart as the round before, because the whole stage is
 * about the meaning of that number changing while the number does not.
 */
const PANELS: Record<string, EvidenceKey[]> = {
  // The two questions round 1 turns on. `data-you` sets them up, `decide-price` shows them again
  // beside the vote — deliberately the same charts, because the room is being asked to recognise
  // an answer it gave weeks ago rather than to remember a screen from two stages back.
  'data-you': ['spend', 'mainFactor'],
  'data-competitor': ['queuePatience'],
}

/**
 * A storyboard: two to four captioned frames, read left to right.
 *
 * The team's note after the run-through was that a bilingual question reads as a wall of text on a
 * projector at the back of a hall. This is the answer — the same words, broken into frames with a
 * character in each.
 *
 * `art` is the upgrade path and is expected to be empty today: the emoji IS the character, so the
 * panels work with no illustration and nothing waits on a designer. Point `art` at a file in
 * /public and it takes over, with no change here. A plain <img> rather than next/image because
 * these are decorative, above the fold, and must not be the thing that delays a stage appearing.
 */
function Storyboard({ panels }: { panels?: StoryPanel[] }) {
  if (!panels?.length) return null
  return (
    <ol className="room-story" data-testid="storyboard" data-count={panels.length}>
      {panels.map((panel) => (
        <li className="room-story__panel" key={panel.caption.en}>
          <div className="room-story__art" aria-hidden="true">
            {panel.art
              ? <img className="room-story__img" src={panel.art} alt="" />
              : <span className="room-story__emoji">{panel.emoji}</span>}
          </div>
          <Bilingual text={panel.caption} as="body" className="room-story__caption" />
        </li>
      ))}
    </ol>
  )
}

function DataView({ stage }: { stage: DataStage }) {
  const panels = evidencePanels(PANELS[stage.id])
  return (
    <div className="room-data">
      <Storyboard panels={stage.storyboard} />
      <div className="room-data__words">
        <Bilingual text={stage.headline} as="hero" />
        <Bilingual text={stage.body} as="body" className="room-data__lead" />
        <ul className="room-points">
          {stage.points.map((point) => (
            <li className="room-points__item" key={point.en}>
              <Bilingual text={point} as="body" />
            </li>
          ))}
        </ul>
        {stage.id === 'data-competitor' ? (
          <p className="room-data__gap"><Bilingual text={UI.outsideTheData} as="label" /></p>
        ) : null}
      </div>

      <div className="room-data__panels">
        {panels.map((panel) => (
          <DataPanel key={panel.key} question={panel.question} data={panel.data} labels={panel.labels} multiSelect={panel.multiSelect} />
        ))}
      </div>
    </div>
  )
}

// ── decide ──────────────────────────────────────────────────────────────────

/**
 * The left column of the decide screen: the distributions this decision actually rests on
 * (spec §2 — "the question, the data that bears on it, a live timer").
 *
 * This is the screen the room reasons from, so it reuses `DataPanel` rather than drawing a second
 * kind of chart: the bars here are the same bars, at the same scale, with the same bucket words
 * and the same PLACEHOLDER guard the audience saw on the data stage. A player looking at
 * `decide-staffing` can read 90 people at the counter between 07:00 and 09:00 against 70 who will
 * not wait three minutes, and get to three baristas without being told.
 */
function DecideEvidence({ evidence }: { evidence: EvidenceKey[] | undefined }) {
  const panels = evidencePanels(evidence)
  if (panels.length === 0) return null

  return (
    <section className="room-evidence" data-testid="decide-evidence">
      <Bilingual text={UI.whatYouKnow} as="label" className="room-evidence__title" />
      {panels.map((panel) => (
        <div className="room-evidence__panel" key={panel.key} data-testid={`evidence-${panel.key}`}>
          <DataPanel question={panel.question} data={panel.data} labels={panel.labels} multiSelect={panel.multiSelect} />
        </div>
      ))}
    </section>
  )
}

function DecideView({
  stage, frame, remainingMs,
}: { stage: DecideStage; frame: RoomFrame; remainingMs: number }) {
  const counts = new Map(frame.tallies.map((t) => [t.optionId, t.count]))
  const max = Math.max(1, ...frame.tallies.map((t) => t.count))
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const hasEvidence = (stage.evidence ?? []).length > 0

  return (
    <div className="room-decide" data-evidence={hasEvidence}>
      <Storyboard panels={stage.storyboard} />
      <DecideEvidence evidence={stage.evidence} />

      <div className="room-decide__vote">
        <header className="room-decide__head">
          <div>
            <Bilingual text={stage.prompt} as="hero" />
            <Bilingual text={stage.context} as="body" className="room-decide__context" />
          </div>
          <div className="room-decide__clock" data-open={frame.votingOpen}>
            <span className="room-decide__seconds" data-testid="countdown">{seconds}</span>
            <Bilingual text={UI.seconds} as="label" />
            <Bilingual text={frame.votingOpen ? UI.votingOpen : UI.votingClosed} as="label" className="room-decide__state" />
          </div>
        </header>

        <ol className="room-options">
          {stage.options.map((option) => {
            const count = counts.get(option.id) ?? 0
            return (
              <li className="room-options__row" key={option.id}>
                <Bilingual text={option.label} as="body" className="room-options__label" />
                <div className="room-options__track">
                  <div className="room-options__fill" style={{ width: `${(count / max) * 100}%` }} />
                </div>
                <span className="room-options__count" data-testid={`tally-${option.id}`}>{count}</span>
              </li>
            )
          })}
        </ol>

        <p className="room-decide__votes">
          <span data-testid="vote-count">{frame.voteCount}</span>
          <span className="room-decide__of"> / {frame.playerCount}</span>
          <Bilingual text={UI.votesIn} as="label" />
        </p>
      </div>
    </div>
  )
}

// ── outcome — the teaching screen ───────────────────────────────────────────

/**
 * One link in the causal chain: an oversized figure and the sentence it belongs to.
 * `tone` colours the two links the whole lesson turns on — who was lost, and who is still waiting.
 */
function TraceStep({
  step, value, label, testId, tone,
}: { step: number; value: string; label: LocalizedText; testId: string; tone?: 'loss' | 'wait' }) {
  return (
    <li className="room-trace__step" data-tone={tone} data-testid={testId}>
      <span className="room-trace__idx" aria-hidden="true">{step}</span>
      <span className="room-trace__value">{value}</span>
      <Bilingual text={label} as="body" className="room-trace__label" />
    </li>
  )
}

/**
 * Round 1's outcome, rendered from the simulator's own trace rather than from written numbers.
 *
 * The chain it draws is the DISCOUNT, not the winner: people who walked past → who could afford
 * it → who was priced out → what was binned — and then the two figures the whole screen exists to
 * put beside each other, the customers the discount actually won and the profit it cost to win
 * them. Showing the winning price's chain would be showing a shop that worked; the teaching is in
 * the one that did not.
 *
 * Both traces are recomputed here from `NARRATED_DISCOUNT_PRICE` and `NARRATED_HELD_PRICE`, the
 * two numbers the body copy on this stage quotes. They cannot come from the frame: `tallies` is
 * empty on an outcome stage by construction, and the room's own vote is not the subject of this
 * screen — the cautionary case is.
 *
 * `buyers + pricedOut === footfall` always, and every figure renders even at zero, so nobody
 * visibly disappears between two numbers on a projector.
 */
function PricingTrace() {
  const cut = simulatePricing(NARRATED_DISCOUNT_PRICE, AUDIENCE)
  const held = simulatePricing(NARRATED_HELD_PRICE, AUDIENCE)

  const extraCustomers = cut.trace.buyers - held.trace.buyers
  const profitGivenUp = held.profit - cut.profit

  return (
    <section className="room-trace">
      <header className="room-trace__head">
        {/* This screen makes the workshop's strongest claim — "these are your own answers played
            forward". The badge reads IS_PLACEHOLDER itself and disappears when that flag flips. */}
        <PlaceholderBadge />
        <Bilingual text={UI.whatHappened} as="label" />
        <p className="room-trace__staffing">
          <b>฿{NARRATED_DISCOUNT_PRICE}</b>
          <Bilingual text={UI.onTheBoard} as="label" />
          <Bilingual text={UI.heldAt} as="label" />
          <b>฿{NARRATED_HELD_PRICE}</b>
        </p>
      </header>

      <ol className="room-trace__steps">
        <TraceStep step={1} value={num.format(cut.trace.footfall)} label={TRACE_LABELS.footfall} testId="trace-footfall" />
        <TraceStep step={2} value={num.format(cut.trace.buyers)} label={TRACE_LABELS.buyers} testId="trace-buyers" />
        <TraceStep step={3} value={num.format(cut.trace.pricedOut)} label={TRACE_LABELS.pricedOut} testId="trace-pricedOut" tone="loss" />
        <TraceStep step={4} value={num.format(cut.trace.unsold)} label={TRACE_LABELS.unsold} testId="trace-unsold" tone="wait" />
        {/* The comparison. These two are the argument; everything above is how they were reached. */}
        <TraceStep step={5} value={num.format(extraCustomers)} label={TRACE_LABELS.extraCustomers} testId="trace-extraCustomers" />
        <TraceStep step={6} value={num.format(profitGivenUp)} label={TRACE_LABELS.profitGivenUp} testId="trace-profitGivenUp" tone="loss" />
      </ol>

      <p className="room-trace__sum" data-testid="trace-accounting">
        <span className="room-trace__eq">
          {num.format(cut.trace.buyers)} + {num.format(cut.trace.pricedOut)}
          {' = '}{num.format(cut.trace.footfall)}
        </span>
        <Bilingual text={UI.accounting} as="label" />
      </p>
    </section>
  )
}

const FX_KEYS: (keyof Kpi)[] = ['revenue', 'profit', 'satisfaction', 'waste']

/**
 * Rounds 2 and 3: what each option did, as signed figures.
 *
 * Not `Bars`: those deltas go negative (`price.fx.profit` is -500, `equipment.fx.waste` is -1200)
 * and `Bars` sizes a fill by `value / max * 100`, which a browser drops as an invalid width. A
 * shop-improving move would render as an empty track.
 */
function FixedOutcomes({ stage }: { stage: DecideStage }) {
  if (stage.resolve !== 'fixed') return null
  return (
    <section className="room-fx">
      <Bilingual text={UI.whatEachChoiceDid} as="label" />
      <ul className="room-fx__list">
        {stage.options.map((option) => (
          <li className="room-fx__card" key={option.id} data-testid={`fx-${option.id}`}>
            <Bilingual text={option.label} as="body" className="room-fx__label" />
            <dl className="room-fx__deltas">
              {FX_KEYS.map((key) => {
                const value = (option.fx as KpiDelta)[key] ?? 0
                if (value === 0) return null
                // `waste` is inverted: less waste is a better shop, so a negative delta is good.
                const good = key === 'waste' ? value < 0 : value > 0
                return (
                  <div className="room-fx__delta" key={key} data-good={good}>
                    <dt>
                      <span lang="en">{KPI_LABELS[key].en}</span>
                      <span lang="th">{KPI_LABELS[key].th}</span>
                    </dt>
                    <dd>{signed(value)}</dd>
                  </div>
                )
              })}
            </dl>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OutcomeView({ stage, frame }: { stage: OutcomeStage; frame: RoomFrame }) {
  const decide = decideStageFor(stage)
  const simulated = decide?.resolve === 'simulate-pricing'

  return (
    <div className="room-outcome">
      <div className="room-outcome__words">
        <Bilingual text={stage.headline} as="hero" />
        <Bilingual text={stage.body} as="body" className="room-outcome__body" />
      </div>

      {simulated ? <PricingTrace /> : decide ? <FixedOutcomes stage={decide} /> : null}

      <p className="room-lesson">
        <Bilingual text={UI.theLesson} as="label" className="room-lesson__eyebrow" />
        <Bilingual text={stage.lesson} as="hero" className="room-lesson__text" />
      </p>

      <Leaderboard entries={frame.leaderboard} limit={5} />
    </div>
  )
}

// ── close ───────────────────────────────────────────────────────────────────

function CloseView({ stage, frame }: { stage: CloseStage; frame: RoomFrame }) {
  return (
    <div className="room-close">
      <div className="room-close__words">
        <Bilingual text={stage.headline} as="hero" />
        <Bilingual text={stage.body} as="body" className="room-close__lead" />
        <ol className="room-takeaways">
          {stage.takeaways.map((takeaway, i) => (
            <li className="room-takeaways__item" key={takeaway.en}>
              <span className="room-takeaways__n" aria-hidden="true">{i + 1}</span>
              <Bilingual text={takeaway} as="body" />
            </li>
          ))}
        </ol>
      </div>

      <div className="room-close__side">
        <section className="room-archetypes">
          <Bilingual text={UI.yourArchetype} as="label" />
          <ul className="room-archetypes__list">
            {(Object.keys(ARCHETYPES) as (keyof typeof ARCHETYPES)[]).map((key) => (
              <li className="room-archetypes__item" key={key}>
                <span className="room-archetypes__name">
                  <span lang="en">{ARCHETYPES[key].name.en}</span>
                  <span lang="th">{ARCHETYPES[key].name.th}</span>
                </span>
                <Bilingual text={ARCHETYPES[key].sting} as="body" className="room-archetypes__sting" />
              </li>
            ))}
          </ul>
        </section>

        {/* Six, not the default eight. The close stage runs three columns, so the board gets a
            third of the screen; at eight rows it is 118px taller than a 1366x768 projector and
            the bottom two ranks are below a fold nobody can scroll. Six rows fit with room to
            spare. Everyone else still has a shop and a score — they are just not on the wall.
            `npm run check:projector` seats nine players precisely to hold this honest. */}
        <Leaderboard entries={frame.leaderboard} limit={6} />
      </div>
    </div>
  )
}

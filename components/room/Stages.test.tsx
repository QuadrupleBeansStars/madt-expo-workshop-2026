import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AUDIENCE } from '@/content/audience'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { UI } from '@/content/room-labels'
import { Stages, type RoomFrame } from '@/components/room/Stages'

const lobbyFrame: RoomFrame = {
  seq: 1,
  phase: 'lobby',
  stageIndex: 0,
  stageKind: null,
  questionId: null,
  questionIndex: null,
  votingOpen: false,
  remainingMs: 0,
  playerCount: 7,
  voteCount: 0,
}

const askFrame: RoomFrame = {
  ...lobbyFrame,
  phase: 'stage',
  stageKind: 'ask',
  questionId: 'q1',
  questionIndex: 0,
  votingOpen: true,
  remainingMs: 30_000,
  voteCount: 5,
}

const revealFrame: RoomFrame = {
  ...lobbyFrame,
  phase: 'stage',
  stageIndex: 1,
  stageKind: 'reveal',
  questionId: 'q1',
  questionIndex: 0,
  voteCount: 4,
  split: [
    { choiceIndex: 0, count: 2 },
    { choiceIndex: 1, count: 0 },
    { choiceIndex: 2, count: 1 },
    { choiceIndex: 3, count: 1 },
  ],
}

const doneFrame: RoomFrame = {
  ...lobbyFrame,
  phase: 'done',
  result: {
    counts: { pioneer: 2, sprinter: 1, analyst: 3, guardian: 1 },
    dots: ['pioneer', 'pioneer', 'sprinter', 'analyst', 'analyst', 'analyst', 'guardian'],
  },
}

function renderStages(frame: RoomFrame, remainingMs = frame.remainingMs) {
  return render(<Stages frame={frame} joinUrl="http://example.test/play" remainingMs={remainingMs} />)
}

describe('lobby', () => {
  it('renders the QR, the join hint and the player count', () => {
    renderStages(lobbyFrame)
    expect(screen.getByTestId('join-qr')).toBeInTheDocument()
    expect(screen.getByText(UI.joinTitle.th)).toBeInTheDocument()
    expect(screen.getByText('http://example.test/play')).toBeInTheDocument()
    expect(screen.getByTestId('player-count')).toHaveTextContent('7')
  })
})

describe('ask', () => {
  it('renders the derived data hook, scenario, and all four choices without persona attributes', () => {
    renderStages(askFrame)
    // The figure is computed from AUDIENCE — assert the derivation, not a hand-typed string.
    expect(screen.getByTestId('data-figure'))
      .toHaveTextContent(`${AUDIENCE.mainFactor.taste}/${AUDIENCE.respondents}`)
    expect(screen.getByText(QUESTIONS[0].dataHook.caption)).toBeInTheDocument()
    expect(screen.getByText(QUESTIONS[0].scenario)).toBeInTheDocument()
    for (const c of QUESTIONS[0].choices) expect(screen.getByText(c.label)).toBeInTheDocument()
    // No mapping leak mid-question: choice cards carry no persona attribute during ask.
    for (const card of screen.getAllByTestId(/^ask-choice-/)) {
      expect(card).not.toHaveAttribute('data-persona')
    }
  })

  it('shows the question counter, vote counter and the soft countdown', () => {
    renderStages(askFrame)
    expect(screen.getByTestId('question-counter'))
      .toHaveTextContent(`${UI.questionOf.th} 1/${QUESTIONS.length}`)
    expect(screen.getByTestId('vote-count')).toHaveTextContent('5')
    expect(screen.getByTestId('countdown')).toHaveTextContent('0:30')
  })
})

describe('reveal', () => {
  it('renders the split with counts, percents and persona-colored bars, plus the small talk', () => {
    renderStages(revealFrame)
    for (const c of QUESTIONS[0].choices) expect(screen.getByText(c.label)).toBeInTheDocument()
    expect(screen.getByText(QUESTIONS[0].smallTalk)).toBeInTheDocument()
    expect(screen.getByText(UI.smallTalkTitle.th)).toBeInTheDocument()
    // Bars carry the persona of their choice — this is where the palette first appears.
    const bar0 = screen.getByTestId('split-bar-0')
    expect(bar0).toHaveAttribute('data-persona', QUESTIONS[0].choices[0].persona)
    expect(bar0).toHaveTextContent('2')
    expect(bar0).toHaveTextContent('50%')
  })

  it('renders a zero-vote reveal without NaN', () => {
    renderStages({
      ...revealFrame,
      voteCount: 0,
      split: [0, 1, 2, 3].map((i) => ({ choiceIndex: i, count: 0 })),
    })
    expect(screen.queryByText(/NaN/)).toBeNull()
  })
})

describe('result', () => {
  it('renders the 2x2 map with English axes, all four personas, counts and dots', () => {
    renderStages(doneFrame)
    expect(screen.getByText(UI.resultTitle.th)).toBeInTheDocument()
    for (const label of ['GUT', 'DATA', 'MOVE FAST', 'WAIT & SEE']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    for (const id of ['pioneer', 'sprinter', 'analyst', 'guardian'] as const) {
      expect(screen.getByText(PERSONAS[id].label)).toBeInTheDocument()
    }
    expect(screen.getByTestId('quadrant-analyst')).toHaveTextContent('3')
    expect(screen.getAllByTestId(/^result-dot-/)).toHaveLength(7)
    expect(screen.getByText(UI.resultHint.th)).toBeInTheDocument()
  })
})

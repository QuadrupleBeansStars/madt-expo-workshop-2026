import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PHONE } from '@/content/room-labels'
import { PERSONAS, QUESTIONS } from '@/content/persona'
import { PhoneBody, type PhoneFrame } from '@/components/room/PhoneBody'

const baseFrame: PhoneFrame = {
  seq: 1,
  phase: 'lobby',
  stageIndex: 0,
  stageKind: null,
  questionId: null,
  questionIndex: null,
  votingOpen: false,
  remainingMs: 0,
  playerCount: 3,
  voteCount: 0,
}

const askFrame: PhoneFrame = {
  ...baseFrame,
  phase: 'stage',
  stageKind: 'ask',
  questionId: 'q1',
  questionIndex: 0,
  votingOpen: true,
  remainingMs: 30_000,
  you: { answeredCount: 0, pickedChoiceIndex: null, persona: null },
}

function renderBody(frame: PhoneFrame, extra: Partial<Parameters<typeof PhoneBody>[0]> = {}) {
  const onVote = vi.fn()
  render(
    <PhoneBody
      name="สมชาย"
      frame={frame}
      remainingMs={frame.remainingMs}
      picked={null}
      onVote={onVote}
      {...extra}
    />,
  )
  return { onVote }
}

describe('lobby', () => {
  it('holds with the wait-for-host line', () => {
    renderBody(baseFrame)
    expect(screen.getByTestId('phone-holding')).toBeInTheDocument()
    expect(screen.getByText(PHONE.waitHost.th)).toBeInTheDocument()
  })
})

describe('ask', () => {
  it('renders the scenario and all four choices, and votes by (questionId, index)', async () => {
    const user = userEvent.setup()
    const { onVote } = renderBody(askFrame)
    expect(screen.getByText(QUESTIONS[0].scenario)).toBeInTheDocument()
    for (const c of QUESTIONS[0].choices) {
      expect(screen.getByText(c.label)).toBeInTheDocument()
    }
    await user.click(screen.getByText(QUESTIONS[0].choices[2].label))
    expect(onVote).toHaveBeenCalledWith('q1', 2)
  })

  it('choice buttons carry NO persona attribute mid-game (no mapping leak)', () => {
    renderBody(askFrame)
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).not.toHaveAttribute('data-persona')
    }
  })

  it('shows the saved notice once a pick is confirmed, and buttons stay enabled at 0s', () => {
    renderBody(
      { ...askFrame, remainingMs: 0, you: { answeredCount: 1, pickedChoiceIndex: 1, persona: null } },
    )
    expect(screen.getByText(PHONE.picked.th)).toBeInTheDocument()
    // Display-only timer: 0 remaining must NOT disable voting (the host closes it, not the clock).
    for (const btn of screen.getAllByRole('button')) expect(btn).toBeEnabled()
  })
})

describe('reveal', () => {
  it('shows watch-screen and what you picked', () => {
    renderBody({
      ...askFrame,
      stageKind: 'reveal',
      votingOpen: false,
      remainingMs: 0,
      you: { answeredCount: 1, pickedChoiceIndex: 3, persona: null },
    })
    expect(screen.getByTestId('phone-reveal')).toBeInTheDocument()
    expect(screen.getByText(PHONE.watchScreen.th)).toBeInTheDocument()
    expect(screen.getByText(PHONE.youPicked.th)).toBeInTheDocument()
    expect(screen.getByText(QUESTIONS[0].choices[3].label)).toBeInTheDocument()
  })
})

describe('done', () => {
  it('renders the persona card with the mascot, the archetype, strengths and partner', () => {
    renderBody({
      ...baseFrame,
      phase: 'done',
      you: { answeredCount: 8, pickedChoiceIndex: null, persona: 'analyst' },
    })
    const card = screen.getByTestId('persona-card')
    expect(card).toHaveAttribute('data-persona', 'analyst')
    // The mascot's name and what that character IS — not the framework label, and not the coffee.
    // Both are still authored (content/persona.ts) as the host's lines.
    expect(screen.getByText(PERSONAS.analyst.mascot.name)).toBeInTheDocument()
    expect(screen.getByText(PERSONAS.analyst.archetype)).toBeInTheDocument()
    expect(screen.queryByText('THE ANALYST')).toBeNull()
    expect(screen.queryByText(/โคลด์บริว/)).toBeNull()
    expect(screen.getByText(PERSONAS.analyst.description)).toBeInTheDocument()
    expect(screen.getByText(PERSONAS.analyst.strength)).toBeInTheDocument()
    expect(screen.getByText(PERSONAS.analyst.caution)).toBeInTheDocument()
    // Partner is the diagonal: BIGLOK, the PIONEER quadrant.
    expect(screen.getByTestId('partner')).toHaveTextContent(PERSONAS.pioneer.mascot.name)
    // Axis line in English framework language.
    expect(screen.getByText(/DATA/)).toBeInTheDocument()
    expect(screen.getByText(/WAIT & SEE/)).toBeInTheDocument()
  })

  it('a zero-answer player gets the graceful late state, never a card', () => {
    renderBody({
      ...baseFrame,
      phase: 'done',
      you: { answeredCount: 0, pickedChoiceIndex: null, persona: null },
    })
    expect(screen.queryByTestId('persona-card')).toBeNull()
    expect(screen.getByText(PHONE.lateJoiner.th)).toBeInTheDocument()
  })
})

describe('chrome', () => {
  it('shows the player name, offline badge and a notice', () => {
    renderBody({ ...baseFrame }, { notice: PHONE.tooLate, offline: true })
    expect(screen.getByTestId('player-name')).toHaveTextContent('สมชาย')
    expect(screen.getByTestId('phone-offline')).toBeInTheDocument()
    expect(screen.getByTestId('phone-notice')).toHaveTextContent(PHONE.tooLate.th)
  })
})

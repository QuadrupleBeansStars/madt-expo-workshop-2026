import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AUDIENCE, MOCK_FIELDS } from '@/content/audience'
import { BUCKET_LABELS, FIELD_TITLES } from '@/content/audience-labels'
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
  it('renders the QR, the name board and the player count', () => {
    renderStages(lobbyFrame)
    expect(screen.getByTestId('join-qr')).toBeInTheDocument()
    expect(screen.getByText(UI.joinTitle.th)).toBeInTheDocument()
    expect(screen.getByTestId('player-count')).toHaveTextContent('7')
  })
})

describe('ask', () => {
  it('plots the full distribution, scenario, and all four choices without persona attributes', () => {
    renderStages(askFrame)
    // q1 charts mainFactor: the survey question is the title, every bucket is a bar with its
    // real count, and the scenario's bucket is highlighted.
    expect(screen.getByText(new RegExp(FIELD_TITLES.mainFactor.th))).toBeInTheDocument()
    // NO SURVEY NOTATION ON THE WALL — "N=50" and the multi-select caveat were cut with the
    // caption. The sample size is said on the bar that uses it; the caveat is the host's line.
    expect(screen.queryByText(/ตอบได้หลายข้อ/)).toBeNull()
    expect(screen.getByTestId('data-chart')).not.toHaveTextContent('N=')
    for (const [key, count] of Object.entries(AUDIENCE.mainFactor)) {
      const bar = screen.getByTestId(`chart-bar-${key}`)
      expect(bar).toHaveTextContent(BUCKET_LABELS.mainFactor[key].th)
      expect(bar).toHaveTextContent(String(count))
      expect(bar).toHaveAttribute('data-highlight', key === 'taste' ? 'true' : 'false')
    }
    // THE CAPTION IS NOT ON THE WALL. It stays authored (it is the host's line) and the one
    // load-bearing part of it — the figure — moved onto the bar it describes.
    expect(screen.queryByText(QUESTIONS[0].dataHook.caption)).toBeNull()
    expect(screen.getByTestId('chart-bar-taste'))
      .toHaveTextContent(`${AUDIENCE.mainFactor.taste} จาก ${AUDIENCE.respondents}`)
    expect(screen.getByText(QUESTIONS[0].scenario)).toBeInTheDocument()
    for (const c of QUESTIONS[0].choices) expect(screen.getByText(c.label)).toBeInTheDocument()
    // No mapping leak mid-question: nothing on an ask screen carries a persona attribute.
    for (const card of screen.getAllByTestId(/^ask-choice-/)) {
      expect(card).not.toHaveAttribute('data-persona')
    }
    expect(screen.getByTestId('data-chart').querySelector('[data-persona]')).toBeNull()
  })

  it('a multi-highlight chart marks every named bucket (q2: under5 + under10)', () => {
    renderStages({ ...askFrame, stageIndex: 2, questionId: 'q2', questionIndex: 1 })
    expect(screen.getByTestId('chart-bar-under5')).toHaveAttribute('data-highlight', 'true')
    expect(screen.getByTestId('chart-bar-under10')).toHaveAttribute('data-highlight', 'true')
    expect(screen.getByTestId('chart-bar-any')).toHaveAttribute('data-highlight', 'false')
  })

  it('shows the question counter, vote counter and the soft countdown', () => {
    renderStages(askFrame)
    expect(screen.getByTestId('question-counter'))
      .toHaveTextContent(`${UI.questionOf.th} 1/${QUESTIONS.length}`)
    expect(screen.getByTestId('vote-count')).toHaveTextContent('5')
    expect(screen.getByTestId('countdown')).toHaveTextContent('0:30')
  })
})

describe('the mocked chart', () => {
  /*
   * q4 asks what the room BUYS first, not what it drinks first, and the distribution behind it has
   * no column on the registration form yet. Two things must hold together or the stage lies to the
   * room: the chart has to plot the buying question, and it has to SAY that these bars are a
   * stand-in. The second one is the one worth a test — it is the difference between a placeholder
   * and a fabrication presented as the audience's own answer.
   */
  it('plots what the room buys and highlights the non-coffee buyers', () => {
    const q4 = QUESTIONS.find((q) => q.id === 'q4')!
    expect(q4.dataHook.field).toBe('firstBuy')
    expect([...q4.dataHook.highlight].sort()).toEqual(['juice', 'milk', 'tea'])
    expect(MOCK_FIELDS.has(q4.dataHook.field)).toBe(true)

    renderStages({ ...askFrame, questionId: 'q4', questionIndex: 3 })
    // The stand-in is tracked in content/audience.ts (MOCK_FIELDS), asserted above — the wall
    // itself prints no notation at all now, badge included.
    expect(screen.getByTestId('data-chart')).not.toHaveTextContent('ข้อมูลตัวอย่าง')
    // Water is gone from this question entirely — it was the bar that inflated the signal.
    expect(screen.queryByTestId('chart-bar-water')).toBeNull()
    for (const bucket of ['coffee', 'tea', 'juice', 'milk', 'none']) {
      expect(screen.getByTestId(`chart-bar-${bucket}`), bucket).toBeInTheDocument()
    }
    for (const bucket of ['tea', 'juice', 'milk']) {
      expect(screen.getByTestId(`chart-bar-${bucket}`)).toHaveAttribute('data-highlight', 'true')
    }
    expect(screen.getByTestId('chart-bar-coffee')).toHaveAttribute('data-highlight', 'false')
  })

  it('quotes only the highlighted sum, never a figure that folds in the muted bars', () => {
    // The defect this replaced: the caption summed water + tea and called it "not coffee", which
    // was true and pointed at a conclusion the number did not support.
    const q4 = QUESTIONS.find((q) => q.id === 'q4')!
    const nonCoffee = AUDIENCE.firstBuy.tea + AUDIENCE.firstBuy.juice + AUDIENCE.firstBuy.milk
    expect(q4.dataHook.caption).toContain(String(nonCoffee))
    expect(q4.dataHook.caption).not.toContain(String(AUDIENCE.firstBuy.coffee + nonCoffee))
  })
})

describe('reveal', () => {
  it('renders the split with counts and percents, no talk panel, and NO persona colour', () => {
    renderStages(revealFrame)
    for (const c of QUESTIONS[0].choices) expect(screen.getByText(c.label)).toBeInTheDocument()
    // The small talk is the HOST's line, said over the bars — never printed beside them.
    expect(screen.queryByText(QUESTIONS[0].smallTalk)).toBeNull()
    // The brief comes back at reading size: four answers to a question the room read a minute ago.
    expect(screen.getByText(QUESTIONS[0].scenario)).toBeInTheDocument()
    const bar0 = screen.getByTestId('split-bar-0')
    expect(bar0).toHaveTextContent('2')
    expect(bar0).toHaveTextContent('50%')
    /*
     * THE MAPPING MUST NOT LEAK HERE EITHER. Persona-coloured bars taught the room the choice→type
     * key by q3, and a room that knows the key picks the colour it wants to be instead of the
     * thing it would do. The palette appears on the result map and nowhere earlier.
     */
    expect(screen.getByTestId('stage-reveal').querySelector('[data-persona]')).toBeNull()
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
  it('renders the 2x2 map with English axes, all four personas and their counts', () => {
    renderStages(doneFrame)
    expect(screen.getByText(UI.resultTitle.th)).toBeInTheDocument()
    for (const label of ['GUT', 'DATA', 'MOVE FAST', 'WAIT & SEE']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    /*
     * TWO LINES PER QUADRANT, NOT FOUR: the mascot's name and the Thai archetype. `label`
     * (THE PIONEER) and `coffee` (เอสเพรสโซ่) are still authored and are the host's to say —
     * this asserts they are not ALSO on the wall, which is what made the quadrant unreadable
     * from the back of the room.
     */
    for (const id of ['pioneer', 'sprinter', 'analyst', 'guardian'] as const) {
      const quadrant = screen.getByTestId(`quadrant-${id}`)
      expect(quadrant).toHaveTextContent(PERSONAS[id].mascot.name)
      expect(quadrant).toHaveTextContent(PERSONAS[id].archetype)
      expect(quadrant).not.toHaveTextContent(PERSONAS[id].label)
      expect(quadrant).not.toHaveTextContent(PERSONAS[id].coffee)
    }
    expect(screen.getByTestId('quadrant-analyst')).toHaveTextContent('3')
    // NO DOT FIELD. One dot per person said the same thing as the numeral, worse, and it was
    // what kept the mascot small — Stages.tsx says why.
    expect(screen.queryAllByTestId(/^result-dot-/)).toHaveLength(0)
    expect(screen.getByText(UI.resultHint.th)).toBeInTheDocument()
  })
})

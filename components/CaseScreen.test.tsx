import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CaseScreen } from './CaseScreen'
import { getCase } from '@/content/cases'

const artemis = getCase('artemis')!

describe('CaseScreen', () => {
  it('shows the AI answer and options only after the retrieval animation completes', async () => {
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} onRestart={() => {}} />)

    // Immediately after mount, we're still retrieving: no AI answer, no verdict options yet.
    expect(screen.queryByText(artemis.aiAnswer.en)).not.toBeInTheDocument()
    expect(screen.queryByText(artemis.options[0].label.en)).not.toBeInTheDocument()

    // Retrieval must finish (and reveal the NOT FOUND gap) first.
    await waitFor(() => expect(screen.getByText(/NOT FOUND/i)).toBeInTheDocument(), { timeout: 6000 })

    // Only after that does the AI answer and the verdict options appear.
    await waitFor(() => expect(screen.getByText(artemis.aiAnswer.en)).toBeInTheDocument(), { timeout: 6000 })
    expect(screen.getByText(artemis.options[0].label.en)).toBeInTheDocument()
  }, 15000)

  it('commits the selected option with a finite elapsedMs after the player decides', async () => {
    const onCommit = vi.fn()
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={onCommit} onRestart={() => {}} />)

    await waitFor(() => expect(screen.getByText(artemis.aiAnswer.en)).toBeInTheDocument(), { timeout: 6000 })

    const { fireEvent } = await import('@testing-library/react')
    fireEvent.click(screen.getByText(artemis.options[1].label.en))
    fireEvent.click(screen.getByText('Commit to your verdict'))

    expect(onCommit).toHaveBeenCalledTimes(1)
    const [optionId, elapsedMs] = onCommit.mock.calls[0]
    expect(optionId).toBe(artemis.options[1].id)
    expect(typeof elapsedMs).toBe('number')
    expect(Number.isFinite(elapsedMs)).toBe(true)
    expect(elapsedMs).toBeGreaterThanOrEqual(0)
  }, 15000)

  it('the submit button stays disabled until an option is selected', async () => {
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} onRestart={() => {}} />)
    await waitFor(() => expect(screen.getByText(artemis.aiAnswer.en)).toBeInTheDocument(), { timeout: 6000 })
    expect(screen.getByText('Commit to your verdict')).toBeDisabled()
  }, 15000)

  it('translates the case label in Thai mode instead of hard-coding English "Case"', () => {
    render(<CaseScreen detectiveCase={artemis} lang="th" onCommit={() => {}} onRestart={() => {}} />)
    expect(screen.getByText(/คดี 1 \/ 5/)).toBeInTheDocument()
    expect(screen.queryByText(/Case 1 \/ 5/)).not.toBeInTheDocument()
  })

  it('the restart control requires a confirming click before firing onRestart', () => {
    const onRestart = vi.fn()
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} onRestart={onRestart} />)

    fireEvent.click(screen.getByText('Restart'))
    expect(onRestart).not.toHaveBeenCalled()
    expect(screen.getByText('Yes, restart')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Yes, restart'))
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('cancelling the restart confirmation does not fire onRestart', () => {
    const onRestart = vi.fn()
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} onRestart={onRestart} />)

    fireEvent.click(screen.getByText('Restart'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onRestart).not.toHaveBeenCalled()
    expect(screen.getByText('Restart')).toBeInTheDocument()
    expect(screen.queryByText('Yes, restart')).not.toBeInTheDocument()
  })
})

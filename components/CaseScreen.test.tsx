import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CaseScreen } from './CaseScreen'
import { getCase } from '@/content/cases'

const artemis = getCase('artemis')!

describe('CaseScreen', () => {
  it('shows the AI answer and options only after the retrieval animation completes', async () => {
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} />)

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
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={onCommit} />)

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
    render(<CaseScreen detectiveCase={artemis} lang="en" onCommit={() => {}} />)
    await waitFor(() => expect(screen.getByText(artemis.aiAnswer.en)).toBeInTheDocument(), { timeout: 6000 })
    expect(screen.getByText('Commit to your verdict')).toBeDisabled()
  }, 15000)
})

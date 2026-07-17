import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Countdown, formatClock } from './Countdown'

describe('Countdown', () => {
  it('formats ms as M:SS', () => {
    expect(formatClock(75_000)).toBe('1:15')
    expect(formatClock(9_000)).toBe('0:09')
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(-5)).toBe('0:00')
  })
  it('renders the initial remaining time', () => {
    const { getByText } = render(<Countdown remainingMs={45_000} />)
    expect(getByText('0:45')).toBeInTheDocument()
  })
})

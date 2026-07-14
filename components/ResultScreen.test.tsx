import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ResultScreen } from './ResultScreen'

describe('ResultScreen', () => {
  it('translates the case label in Thai mode instead of hard-coding English "Case"', () => {
    render(<ResultScreen answers={[]} lang="th" />)
    expect(screen.getByText('คดี 1')).toBeInTheDocument()
    expect(screen.queryByText('Case 1')).not.toBeInTheDocument()
  })
})

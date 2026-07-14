import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ResultScreen } from './ResultScreen'

describe('ResultScreen', () => {
  it('shows the score without a per-case breakdown (spoiler protection for early finishers)', () => {
    render(<ResultScreen answers={[]} lang="th" onNewDetective={() => {}} />)
    expect(screen.queryByText('คดี 1')).not.toBeInTheDocument()
    expect(screen.queryByText('✅')).not.toBeInTheDocument()
    expect(screen.queryByText('❌')).not.toBeInTheDocument()
  })

  it('clicking "New detective" invokes the callback', () => {
    const onNewDetective = vi.fn()
    render(<ResultScreen answers={[]} lang="th" onNewDetective={onNewDetective} />)
    fireEvent.click(screen.getByText('เริ่มใหม่ (นักสืบคนใหม่)'))
    expect(onNewDetective).toHaveBeenCalledTimes(1)
  })
})

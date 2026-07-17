import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AnswerCards } from './AnswerCards'
import type { CaseOption } from '@/lib/types'

const opts: CaseOption[] = [
  { id: 'a', label: { th: 'ก', en: 'Aye' }, correct: false },
  { id: 'b', label: { th: 'ข', en: 'Bee' }, correct: true },
  { id: 'c', label: { th: 'ค', en: 'Cee' }, correct: false },
  { id: 'd', label: { th: 'ง', en: 'Dee' }, correct: false },
]

describe('AnswerCards', () => {
  it('renders all options and reports picks', () => {
    const onPick = vi.fn()
    const { getByText } = render(<AnswerCards options={opts} lang="en" onPick={onPick} />)
    fireEvent.click(getByText('Bee'))
    expect(onPick).toHaveBeenCalledWith('b')
  })
  it('does not fire onPick when disabled', () => {
    const onPick = vi.fn()
    const { getByText } = render(<AnswerCards options={opts} lang="en" disabled onPick={onPick} />)
    fireEvent.click(getByText('Bee'))
    expect(onPick).not.toHaveBeenCalled()
  })
  it('marks the correct and the wrongly-selected option at reveal', () => {
    const { getByText } = render(
      <AnswerCards options={opts} lang="en" disabled selectedId="a" correctId="b" onPick={() => {}} />,
    )
    expect(getByText('Bee').closest('button')!.className).toContain('selected-correct')
    expect(getByText('Aye').closest('button')!.className).toContain('selected-incorrect')
  })
})

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlideFrame } from './SlideFrame'
import { Bilingual } from './Bilingual'

const chapter = { en: 'Data in Business', th: 'ข้อมูลกับธุรกิจ' }

describe('Bilingual', () => {
  it('renders the Thai string and NOT the English one', () => {
    // The English half is still carried in the props and in every label file — it is simply not
    // rendered. Asserting its absence here is what stops it drifting back in.
    render(<Bilingual text={{ en: 'What is it worth?', th: 'มันมีค่าเท่าไร?' }} as="hero" />)
    expect(screen.getByText('มันมีค่าเท่าไร?')).toBeDefined()
    expect(screen.queryByText('What is it worth?')).toBeNull()
  })

  it('marks the line with lang="th" for correct font shaping', () => {
    // Without this the browser can font-match Thai against a Latin-only face and fall back
    // mid-line, which is a live defect on the sibling app.
    render(<Bilingual text={{ en: 'Hello', th: 'สวัสดี' }} as="body" />)
    expect(screen.getByText('สวัสดี').closest('[lang="th"]')).not.toBeNull()
  })
})

describe('SlideFrame', () => {
  const frame = (over: Partial<React.ComponentProps<typeof SlideFrame>> = {}) => (
    <SlideFrame
      chapter={chapter} chapterNumber="01" accent="#f2941b"
      slideNumber={4} slideTotal={10} {...over}
    >
      <p>slide body</p>
    </SlideFrame>
  )

  it('renders its children', () => {
    render(frame())
    expect(screen.getByText('slide body')).toBeDefined()
  })

  it('shows the eyebrow chapter label in Thai only', () => {
    render(frame())
    expect(screen.getByText('ข้อมูลกับธุรกิจ')).toBeDefined()
    expect(screen.queryByText('Data in Business')).toBeNull()
  })

  it('shows the ghost chapter numeral', () => {
    render(frame())
    expect(screen.getByTestId('ghost-numeral').textContent).toBe('01')
  })

  it('shows the slide counter', () => {
    render(frame())
    expect(screen.getByTestId('slide-counter').textContent).toMatch(/4\s*\/\s*10/)
  })

  it('applies the accent colour as a CSS custom property', () => {
    render(frame({ accent: '#12925a' }))
    const root = screen.getByTestId('slide-frame')
    expect(root.style.getPropertyValue('--deck-clr')).toBe('#12925a')
  })

  it('never renders the AI Detective pixel font', () => {
    const { container } = render(frame())
    expect(container.innerHTML).not.toContain('Press Start 2P')
  })
})

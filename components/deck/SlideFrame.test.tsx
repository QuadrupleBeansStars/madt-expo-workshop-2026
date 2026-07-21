import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlideFrame } from './SlideFrame'
import { Bilingual } from './Bilingual'

const chapter = { en: 'Data in Business', th: 'ข้อมูลกับธุรกิจ' }

describe('Bilingual', () => {
  it('renders BOTH languages at once — there is no toggle', () => {
    render(<Bilingual text={{ en: 'What is it worth?', th: 'มันมีค่าเท่าไร?' }} as="hero" />)
    expect(screen.getByText('What is it worth?')).toBeDefined()
    expect(screen.getByText('มันมีค่าเท่าไร?')).toBeDefined()
  })

  it('marks each language with its lang attribute for correct font shaping', () => {
    render(<Bilingual text={{ en: 'Hello', th: 'สวัสดี' }} as="body" />)
    expect(screen.getByText('Hello').closest('[lang="en"]')).not.toBeNull()
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

  it('shows the eyebrow chapter label in both languages', () => {
    render(frame())
    expect(screen.getByText('Data in Business')).toBeDefined()
    expect(screen.getByText('ข้อมูลกับธุรกิจ')).toBeDefined()
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

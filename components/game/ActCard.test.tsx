import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
// No global setupFiles registers jest-dom matchers — see app/page.test.tsx, app/tv/tv.test.tsx.
import '@testing-library/jest-dom/vitest'
import { ActCard } from './ActCard'
import { ACTS } from '@/content/questions'

describe('ActCard', () => {
  // CRITICAL 2: app/tv/page.tsx passes `ACTS[state.actIndex ?? 0]`, which is `undefined` for any
  // out-of-range index — an unhandled `act.nameEn` dereference white-screens the whole /tv render
  // tree in front of the room. Every sibling stage guards a missing/short input the same way.
  it('renders nothing instead of throwing when act is undefined', () => {
    expect(() => render(<ActCard act={undefined} />)).not.toThrow()
    const { container } = render(<ActCard act={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the act name and at-work line for a real act', () => {
    const { getByText } = render(<ActCard act={ACTS[0]} />)
    expect(getByText(ACTS[0].nameTh)).toBeInTheDocument()
    expect(getByText(ACTS[0].atWork)).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/font/google', () => ({
  Press_Start_2P: () => ({ variable: 'font-pixel', className: 'font-pixel' }),
  VT323: () => ({ variable: 'font-retro', className: 'font-retro' }),
  Sarabun: () => ({ variable: 'font-thai', className: 'font-thai' }),
}))

import RootLayout from './layout'

describe('RootLayout', () => {
  it('renders children inside the body', () => {
    const { getByText } = render(<RootLayout><p>hello detective</p></RootLayout>)
    expect(getByText('hello detective')).toBeInTheDocument()
  })
})

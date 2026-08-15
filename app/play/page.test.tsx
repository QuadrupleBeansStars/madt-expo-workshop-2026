import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PlayPage from './page'

/**
 * Regression guard for a bug that shipped past the whole component suite and was
 * only caught by looking at the running app.
 *
 * `components/room/phone.css` hangs every `--phone-*` design token AND the
 * `.deck-bi` script-stacking rules off `.phone-root`. The join screen rendered
 * with `.phone-join` alone, so it inherited neither: Thai ran inline after English
 * on one line ("Run your own cafeเปิดร้านกาแฟของคุณเอง") and the surface lost its
 * colours entirely.
 *
 * jsdom applies no CSS, so no assertion about appearance can catch this. What IS
 * checkable is the contract the stylesheet depends on: the join surface must carry
 * `phone-root`. That is what these tests pin.
 */
describe('play page join surface', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('no server in test'))))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('carries phone-root so the phone tokens and bilingual stacking apply', async () => {
    render(<PlayPage />)
    const join = await screen.findByTestId('phone-join')
    expect(join.classList.contains('phone-root')).toBe(true)
    expect(join.classList.contains('phone-join')).toBe(true)
  })

  it('renders Thai only — the English half of every label is carried but not shown', async () => {
    const { container } = render(<PlayPage />)
    await waitFor(() => expect(screen.getByTestId('phone-join')).toBeTruthy())

    const en = container.querySelectorAll('[lang="en"]')
    const th = container.querySelectorAll('[lang="th"]')
    expect(en.length).toBe(0)
    expect(th.length).toBeGreaterThan(0)

    // Thai must also not have absorbed the English string into the same node — the failure this
    // would look like is one run of text reading "ScoreคะแนนRank" rather than a missing element.
    for (const node of th) {
      expect(node.textContent ?? '').not.toMatch(/[A-Za-z]{4,}/)
    }
  })
})

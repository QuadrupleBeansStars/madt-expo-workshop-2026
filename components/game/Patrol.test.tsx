import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { Patrol } from './Patrol'

/*
 * jsdom performs no layout and ships no canvas implementation, so nothing here can assert what the
 * patrol LOOKS like — that is a real-browser question (`npm run check:projector`, and the
 * screenshot comparison against the team's reference file).
 *
 * What can be asserted, and is the only thing worth asserting, is the accessibility behaviour:
 * `prefers-reduced-motion: reduce` must stop the animation loop. A CSS media query cannot reach a
 * canvas, so unlike every other motion in this repo that preference is honoured by a `matchMedia`
 * check in component code — which means it is code that can regress silently, and therefore code
 * that needs a test.
 */

const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((q: string) => ({
    matches: reduced, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))

/*
 * Without this, `getContext('2d')` returns null under jsdom and the component bails before it ever
 * reaches `requestAnimationFrame` — which would make the reduced-motion assertion below pass
 * whether or not the preference were being read at all. The stub is what makes the pair of tests
 * a real control: same component, same environment, only the preference differs.
 */
function stubCanvas2d() {
  const ctx = new Proxy({}, { get: () => () => undefined }) as unknown as CanvasRenderingContext2D
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Patrol', () => {
  it('renders a canvas', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    stubCanvas2d()
    const { container } = render(<Patrol />)
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('is hidden from assistive technology — it is decoration, and it says nothing', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    stubCanvas2d()
    const { container } = render(<Patrol />)
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
  })

  it('animates when motion is allowed', () => {
    vi.stubGlobal('matchMedia', matchMedia(false))
    stubCanvas2d()
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    render(<Patrol />)
    expect(raf).toHaveBeenCalled()
  })

  it('does not start an animation loop under prefers-reduced-motion', () => {
    vi.stubGlobal('matchMedia', matchMedia(true))
    stubCanvas2d()
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    render(<Patrol />)
    // The characters still draw — they hold frame 0 instead of walking, so the strip is not
    // suddenly empty for the people this preference exists for.
    expect(raf).not.toHaveBeenCalled()
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { IS_PLACEHOLDER } from '@/content/audience'
import { Bars, type BarRow } from './Bars'
import { DataPanel } from './DataPanel'

const rows: BarRow[] = [
  { key: 'walk', label: { en: 'Walk', th: 'เดิน' }, value: 40 },
  { key: 'train', label: { en: 'Train', th: 'รถไฟ' }, value: 90 },
  { key: 'car', label: { en: 'Car', th: 'รถยนต์' }, value: 30 },
  { key: 'moto', label: { en: 'Moto', th: 'มอเตอร์ไซค์' }, value: 20 },
]

describe('Bars', () => {
  it('renders exactly one row per bucket', () => {
    render(<Bars rows={rows} />)
    rows.forEach((r) => {
      expect(screen.getByTestId(`bar-fill-${r.key}`)).toBeInTheDocument()
    })
  })

  it('sizes bar widths proportionally to the largest bucket', () => {
    render(<Bars rows={rows} />)
    const max = Math.max(...rows.map((r) => r.value))
    rows.forEach((r) => {
      const el = screen.getByTestId(`bar-fill-${r.key}`)
      const expectedPct = (r.value / max) * 100
      expect(el.style.width).toBe(`${expectedPct}%`)
    })
  })

  it('gives the largest bucket a full-width bar so it reads instantly', () => {
    render(<Bars rows={rows} />)
    const el = screen.getByTestId('bar-fill-train')
    expect(el.style.width).toBe('100%')
  })

  it('labels every row in Thai, and not in English', () => {
    render(<Bars rows={rows} />)
    expect(screen.getByText('เดิน')).toBeInTheDocument()
    expect(screen.getByText('รถไฟ')).toBeInTheDocument()
    expect(screen.queryByText('Walk')).toBeNull()
    expect(screen.queryByText('Train')).toBeNull()
  })

  it('never renders the AI Detective pixel font', () => {
    const { container } = render(<Bars rows={rows} />)
    expect(container.innerHTML).not.toContain('Press Start 2P')
  })
})

describe('PlaceholderBadge', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders the badge when IS_PLACEHOLDER is true', async () => {
    vi.doMock('@/content/audience', () => ({ IS_PLACEHOLDER: true }))
    const { PlaceholderBadge } = await import('./PlaceholderBadge')
    render(<PlaceholderBadge />)
    expect(screen.getByText(/ข้อมูลตัวอย่าง ยังไม่ใช่ของจริง/)).toBeInTheDocument()
  })

  it('renders nothing when IS_PLACEHOLDER is false', async () => {
    vi.doMock('@/content/audience', () => ({ IS_PLACEHOLDER: false }))
    const { PlaceholderBadge } = await import('./PlaceholderBadge')
    const { container } = render(<PlaceholderBadge />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('DataPanel', () => {
  const question = { en: 'How do you get to work?', th: 'คุณเดินทางมาทำงานอย่างไร?' }
  const data = { walk: 40, train: 90, car: 30, moto: 20 }
  const labels = {
    walk: { en: 'Walk', th: 'เดิน' },
    train: { en: 'Train', th: 'รถไฟ' },
    car: { en: 'Car', th: 'รถยนต์' },
    moto: { en: 'Moto', th: 'มอเตอร์ไซค์' },
  }

  it('renders the question title in Thai only', () => {
    render(<DataPanel question={question} data={data} labels={labels} />)
    expect(screen.getByText('คุณเดินทางมาทำงานอย่างไร?')).toBeInTheDocument()
    expect(screen.queryByText('How do you get to work?')).toBeNull()
  })

  it('renders one bar row per bucket in the data', () => {
    render(<DataPanel question={question} data={data} labels={labels} />)
    Object.keys(data).forEach((key) => {
      expect(screen.getByTestId(`bar-fill-${key}`)).toBeInTheDocument()
    })
  })

  it('renders the badge iff the real IS_PLACEHOLDER — survives the flip to false', () => {
    render(<DataPanel question={question} data={data} labels={labels} />)
    expect(!!screen.queryByTestId('placeholder-badge')).toBe(IS_PLACEHOLDER)
  })

  it('never renders the AI Detective pixel font', () => {
    const { container } = render(<DataPanel question={question} data={data} labels={labels} />)
    expect(container.innerHTML).not.toContain('Press Start 2P')
  })
})

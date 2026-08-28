import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomMusic } from '@/components/audio/RoomMusic'

/*
 * BEHAVIOUR ONLY — nothing here asserts a size, a colour or the fade. jsdom implements no media
 * pipeline at all (`play` is not even defined on HTMLMediaElement), so the audible half of this
 * component is out of reach here by construction; what IS worth pinning is the part that decides
 * whether the room hears anything: when we try to play, what happens when the browser says no,
 * and whether the host can still kill it.
 */

let play: ReturnType<typeof vi.fn>

beforeEach(() => {
  play = vi.fn(() => Promise.resolve())
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, writable: true, value: play })
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, writable: true, value: vi.fn() })
})

afterEach(() => vi.restoreAllMocks())

describe('RoomMusic', () => {
  it('stays silent and invisible behind the token gate', () => {
    render(<RoomMusic src="/audio/x.mp3" armed={false} />)
    expect(play).not.toHaveBeenCalled()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('starts once the host is through the gate', async () => {
    const { rerender } = render(<RoomMusic src="/audio/x.mp3" armed={false} />)
    rerender(<RoomMusic src="/audio/x.mp3" armed />)
    expect(play).toHaveBeenCalled()
    expect(await screen.findByRole('button', { name: /ปิดเสียงเพลง/ })).toBeInTheDocument()
  })

  it('mutes and unmutes from the M key, wherever the focus is', async () => {
    const user = userEvent.setup()
    const { container } = render(<RoomMusic src="/audio/x.mp3" armed />)
    const audio = container.querySelector('audio') as HTMLAudioElement
    expect(audio.muted).toBe(false)

    await user.keyboard('m')
    expect(audio.muted).toBe(true)
    expect(screen.getByRole('button', { name: /เปิดเสียงเพลง/ })).toBeInTheDocument()

    await user.keyboard('m')
    expect(audio.muted).toBe(false)
  })

  it('leaves the token being typed alone', async () => {
    const user = userEvent.setup()
    render(
      <>
        <input aria-label="token" />
        <RoomMusic src="/audio/x.mp3" armed />
      </>,
    )
    await user.click(screen.getByLabelText('token'))
    await user.keyboard('madt')
    expect((document.querySelector('audio') as HTMLAudioElement).muted).toBe(false)
  })

  it('offers a click when the browser refuses to autoplay — the reload path', async () => {
    // A projector woken up with the token already in localStorage has had no gesture at all.
    play.mockRejectedValueOnce(new DOMException('gesture required', 'NotAllowedError'))
    const user = userEvent.setup()
    render(<RoomMusic src="/audio/x.mp3" armed />)

    const unlock = await screen.findByRole('button', { name: 'เปิดเพลงพื้นหลัง' })
    await user.click(unlock)
    expect(play).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('button', { name: /ปิดเสียงเพลง/ })).toBeInTheDocument()
  })

  it('says the file is missing rather than pretending to be muted', async () => {
    // The failure that has no sound and no error: an image built without /public. A dim speaker
    // icon would send the host to the hall's mixer for a problem the mixer cannot reach.
    const { container } = render(<RoomMusic src="/audio/gone.mp3" armed />)
    fireEvent.error(container.querySelector('audio') as HTMLAudioElement)

    // The control carries no visible words — it is a bare speaker glyph by request — so the
    // distinction lives where a host hovering it and a screen reader both find it.
    expect(await screen.findByRole('button', { name: 'ลองโหลดเพลงพื้นหลังใหม่' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ปิดเสียงเพลง/ })).not.toBeInTheDocument()
  })
})

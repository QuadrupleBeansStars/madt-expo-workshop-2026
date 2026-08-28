/**
 * jsdom ships no media pipeline: `HTMLMediaElement.play()` exists but throws its "not implemented"
 * notice straight at the console. Both projectors mount `components/audio/RoomMusic.tsx`, so every
 * test that renders `/tv` or `/biz` printed that notice — fourteen lines of noise around a green
 * run, which is exactly the kind of output that trains you to stop reading it.
 *
 * This is a stub, not a mock: it makes the call quiet and resolvable. Tests that care what play()
 * DID (RoomMusic.test.tsx) install their own spy over this one.
 */
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  writable: true,
  value: () => Promise.resolve(),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  writable: true,
  value: () => {},
})

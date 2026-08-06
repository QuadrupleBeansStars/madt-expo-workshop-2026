/*
 * Does every stage of The Decision Room fit on the projector?
 *
 * WHY THIS EXISTS. On 2026-07-31 nine of ten stages overflowed the screen — the outcome stages
 * by more than 1,500px on a 900px-tall projector, putting THE LESSON and THE LEADERBOARD below
 * a fold that a projector cannot scroll past. The full vitest suite passed throughout. It always
 * will: jsdom performs no layout, so no assertion written against it can measure a height.
 *
 * This is the only check in the repo that runs real layout in a real browser. It is deliberately
 * NOT part of `npm test` — it needs a built server on a port and a system Chrome, and a unit
 * suite that depends on either is a unit suite that gets skipped. Run it before the workshop and
 * after any change to a stage layout:
 *
 *     npm run build
 *     FACILITATOR_TOKEN=... npm start &
 *     npm run check:projector
 *
 * Exits non-zero, listing every stage that overflows, so it can gate a release.
 */

import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const TOKEN = process.env.FACILITATOR_TOKEN ?? ''

/*
 * The two shapes a venue projector actually is. 1366x768 is not a legacy concern — it is what
 * most fixed lecture-hall projectors still are, and it is the harsher of the two, so a stage that
 * clears it clears the room.
 */
const VIEWPORTS = [
  { width: 1600, height: 900 },
  { width: 1366, height: 768 },
]

/* Sub-pixel rounding from `clamp()` type scales lands within a pixel of exact. Anything above
 * this is real content below the fold, not a rounding artefact. */
const TOLERANCE_PX = 2

const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-facilitator-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => r.json().catch(() => ({})))

const roomState = () => fetch(`${BASE}/api/room/state`).then((r) => r.json())


/*
 * AI Detective's projector (`/tv`). Same question, different app: does every phase fit on the
 * screen the room is looking at? This walk was added after the /biz overflow hunt, when it turned
 * out /tv had never been measured at all — the identical bug class, sitting unchecked on the other
 * workshop. It found a real overflow on its first run.
 *
 * WHY THIS ONE IS SLOW, and why it is structured differently to the /biz walk. AI Detective's
 * rounds end on a server-side timer (75s each, lib/game.ts) — `/api/control` can only `start` and
 * `next`, and `next` is refused outside `reveal`. There is no way to skip the clock over HTTP, so
 * this waits it out: about six minutes for five cases. Run it before the workshop, not in a loop.
 *
 * Because the wait is the expensive part, this drives ONE room and measures BOTH projector shapes
 * at every phase, rather than walking the game twice. That also happens to be the more faithful
 * test: one room, two screens looking at it.
 */
async function checkDetectiveTv(browser, failures) {
  console.log('\n\n## AI Detective  /tv')
  console.log('(rounds end on a 75s server timer that cannot be skipped — this takes ~6 minutes)')

  await post('/api/reset')

  /* A populated board is the tall case here too: an empty room measures a short screen and would
   * clear a layout that breaks the moment anyone joins. */
  const players = []
  for (const codename of ['ปุ๊ก', 'Beam', 'Nott', 'Mint', 'Ohm', 'Fern', 'Guide', 'Pim', 'Tar']) {
    const joined = await post('/api/join', { codename })
    if (joined?.player?.id) players.push(joined.player.id)
  }

  /* One page per projector shape, both pointed at the same room. */
  const screens = []
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(`${BASE}/tv`, { waitUntil: 'domcontentloaded' })
    screens.push({ context, page, label: `${viewport.width}x${viewport.height}` })
  }
  await screens[0].page.waitForTimeout(1500)

  const measure = async (where) => {
    for (const screen of screens) {
      const box = await screen.page.evaluate(() => ({
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      const overflowY = box.scrollHeight - box.clientHeight
      const overflowX = box.scrollWidth - box.clientWidth
      if (overflowY > TOLERANCE_PX || overflowX > TOLERANCE_PX) {
        failures.push({ viewport: screen.label, stage: `tv ${where}`, overflowY, overflowX })
        console.log(`  ✗ ${screen.label}  ${where}  +${overflowY}px down  +${overflowX}px across`)
      } else {
        console.log(`  ✓ ${screen.label}  ${where}`)
      }
    }
  }

  const detState = () => fetch(`${BASE}/api/state`).then((r) => r.json())
  const settle = () => screens[0].page.waitForTimeout(1500)

  try {
    await settle()
    await measure('lobby')

    await post('/api/control', { action: 'start' })

    /* Cap on phases, not on cases: adding a case to content/cases.ts must extend this walk on its
     * own rather than silently leave the new one unmeasured. */
    const MAX_PHASES = 40
    for (let i = 0; i < MAX_PHASES; i++) {
      let state = await detState()
      if (state.phase === 'lobby') break

      const where = `${state.phase}${state.caseId ? `:${state.caseId}` : ''}`
      await settle()

      /* Answer before measuring the reveal: the results board and the leaderboard only have rows
       * once people have answered, and rows are what overflow. */
      if (state.phase === 'investigate' && state.caseId) {
        for (const playerId of players) {
          await post('/api/answer', { playerId, caseId: state.caseId, optionId: 'ai' })
        }
        await settle()
      }

      await measure(where)

      if (state.phase === 'final') break

      if (state.phase === 'investigate') {
        /* Wait out the round timer. `tick()` runs lazily on any poll, so keep polling. */
        for (let w = 0; w < 200; w++) {
          state = await detState()
          if (state.phase !== 'investigate') break
          await screens[0].page.waitForTimeout(1000)
        }
      } else {
        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(800)
      }
    }
  } finally {
    for (const screen of screens) await screen.context.close()
  }
}

async function main() {
  if (!TOKEN) {
    console.error('FACILITATOR_TOKEN is not set. The host controls are disabled without it and')
    console.error('this script cannot advance the room past the lobby.')
    process.exit(2)
  }

  const probe = await fetch(`${BASE}/biz`).catch(() => null)
  if (!probe?.ok) {
    console.error(`No server at ${BASE}. Run \`npm run build && npm start\` first.`)
    process.exit(2)
  }

  const browser = await chromium.launch({ channel: 'chrome' })
  const failures = []

  try {
    await checkDetectiveTv(browser, failures)

    console.log('\n\n## The Decision Room  /biz')
    for (const viewport of VIEWPORTS) {
      await post('/api/room/reset')

      /* Players matter to the measurement: an empty leaderboard is short, and the board is the
       * tallest thing on both the outcome and the close stage. Measuring an empty room would
       * clear a layout that breaks the moment anyone joins.
       *
       * MORE PLAYERS THAN THE BOARD SHOWS, deliberately. `Leaderboard` defaults to `limit = 8`
       * and the close stage takes that default, so a nine-player room is what renders the tallest
       * board this deck can ever produce. Seating five — which this script used to do — measured a
       * five-row board and would have passed a close stage that overflows in a real room. */
      const players = []
      const NAMES = ['ปุ๊ก', 'Beam', 'Nott', 'Mint', 'Ohm', 'Fern', 'Guide', 'Pim', 'Tar']
      for (const name of NAMES) {
        const joined = await post('/api/room/join', { name })
        if (joined?.player?.id) players.push(joined.player.id)
      }

      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      await page.goto(`${BASE}/biz`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)

      const label = `${viewport.width}x${viewport.height}`
      console.log(`\n=== ${label} ===`)

      /* Walk until the room reports itself finished, rather than counting to a hard-coded ten:
       * adding a stage to `content/room.ts` must extend this check automatically, not silently
       * leave the new stage unmeasured. The cap is a runaway guard only. */
      const MAX_STAGES = 40
      for (let i = 0; i < MAX_STAGES; i++) {
        const state = await roomState()
        const stage = state.stageId ?? state.phase

        /* Vote before measuring. Tally bars and the player's own KPI row only exist once someone
         * has decided, and both add height. */
        if (state.votingOpen && Array.isArray(state.tallies)) {
          const options = state.tallies.map((t) => t.optionId)
          for (let k = 0; k < players.length; k++) {
            await post('/api/room/vote', {
              playerId: players[k],
              stageId: state.stageId,
              optionId: options[Math.min(k, options.length - 1)],
            })
          }
        }

        await page.waitForTimeout(1200)
        const box = await page.evaluate(() => ({
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))

        const overflowY = box.scrollHeight - box.clientHeight
        const overflowX = box.scrollWidth - box.clientWidth

        if (overflowY > TOLERANCE_PX || overflowX > TOLERANCE_PX) {
          failures.push({ viewport: label, stage, overflowY, overflowX })
          console.log(`  ✗ ${stage}  +${overflowY}px down  +${overflowX}px across`)
        } else {
          console.log(`  ✓ ${stage}`)
        }

        if (state.phase === 'done') break
        await post('/api/room/control', { action: 'advance' })
        await page.waitForTimeout(600)
      }

      await context.close()
    }
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} stage/viewport combinations overflow the projector.`)
    console.error('A projector does not scroll: everything past the fold is invisible to the room.')
    process.exit(1)
  }

  console.log('\nEvery stage fits on both projector shapes.')
}

await main()

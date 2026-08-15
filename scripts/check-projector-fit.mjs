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
 * THIS USED TO TAKE SIX MINUTES. AI Detective's rounds end on a server-side timer, and
 * `/api/control` accepted only `start` and `next` — with `next` refused outside `reveal`, there
 * was no way to skip the clock over HTTP, so this walk sat through every round in real time.
 *
 * `action: 'reveal'` (lib/store.ts `revealNow`) exists now, for the host's "close it, reveal now"
 * button, and this walk uses it: the same button the host will press on the day, exercised on
 * every run. The fallback below still waits the timer out if the action is ever refused, because a
 * layout check that silently stops walking would report success on a game it never finished.
 *
 * It drives ONE room and measures BOTH projector shapes at every phase rather than walking the
 * game twice. That is also the more faithful test: one room, two screens looking at it.
 */
async function checkDetectiveTv(browser, failures) {
  console.log('\n\n## AI Detective  /tv')
  console.log('(closes each question with the host reveal action — no longer waits out the timers)')

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

  /*
   * The document-height metric above CANNOT see this one, and that is why it exists separately.
   *
   * `/tv`'s <main> is `min-h-screen overflow-hidden`. When a stage grows past the screen, the
   * overflow is CLIPPED rather than scrolled — so scrollHeight stays pinned at clientHeight and
   * every stage reports a tidy ✓ while the bottom of the screen is being cut off. The case file
   * moving onto the projector is what surfaced it: `citation` (four documents) pushed the host's
   * "close it now" button 36px below the fold at 1366x768, and the walk above passed all 24
   * combinations without a murmur.
   *
   * A host who cannot see the button cannot end the question. That is a hard failure, not a
   * warning — unlike the phone checks below, where a player can at least scroll.
   */
  const checkHostControl = async (where) => {
    for (const screen of screens) {
      const m = await screen.page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null)
        if (buttons.length === 0) return null
        const last = buttons[buttons.length - 1].getBoundingClientRect()
        return { bottom: Math.round(last.bottom), fold: document.documentElement.clientHeight }
      })
      if (!m) continue
      const clearance = m.fold - m.bottom
      if (clearance < 0) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (host control)`, overflowY: -clearance, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where}  host control cut off by ${-clearance}px`)
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
      await checkHostControl(where)

      if (state.phase === 'final') break

      if (state.phase === 'investigate') {
        /* Close the question the way the host will, instead of sitting out the clock. */
        await post('/api/control', { action: 'reveal' })
        await screens[0].page.waitForTimeout(400)

        /* Fallback: if `reveal` was refused for any reason, wait the timer out rather than
         * spinning on a phase that will never change. `tick()` runs lazily on any poll, so
         * polling is what advances it. */
        for (let w = 0; w < 200; w++) {
          state = await detState()
          if (state.phase !== 'investigate') break
          if (w === 0) console.log('   (reveal action had no effect — falling back to the timer)')
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


/*
 * The PHONES. A different question from the projector's, and it needs saying, because the naive
 * reading of a phone check is "phones scroll, so nothing can be wrong".
 *
 * What is measured here is not overflow — it is whether the LAST VOTE BUTTON is reachable without
 * scrolling. A player has 40-45 seconds, in a dark room, on a screen they are holding at arm's
 * length. An option they have to go looking for is an option that gets fewer votes than it should,
 * and that skews the tally the host is about to read out loud. That is a silent failure: nothing
 * errors, the round just quietly mis-measures the room.
 *
 * This was added after storyboards went in above the question on both phones and a fourth option
 * went into two Decision Room rounds — all four changes push the buttons down, and none of them
 * could be seen by a suite that renders in jsdom.
 *
 * 390x844 is an iPhone 12/13/14 in portrait, the smallest common screen in a Thai lecture hall.
 * A warning rather than a failure: unlike a projector, a phone CAN scroll, so this is friction to
 * be judged, not a fold that hides content forever.
 */
const PHONE_VIEWPORT = { width: 390, height: 844 }

async function checkPhones(browser) {
  console.log('\n\n## Phones  390x844')
  const warnings = []

  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true })

  /* The Decision Room's phone, on its first decide stage — the one that now carries a storyboard,
   * an evidence strip and four options. */
  try {
    await post('/api/room/reset')
    const joined = await post('/api/room/join', { name: 'ผู้เล่น' })
    const page = await context.newPage()
    await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      (id) => localStorage.setItem('decisionroom.player', JSON.stringify({ playerId: id, name: 'ผู้เล่น' })),
      joined?.player?.id,
    )

    for (let i = 0; i < 20; i++) {
      const state = await roomState()
      if (state.stageKind === 'decide') break
      await post('/api/room/control', { action: 'advance' })
      await page.waitForTimeout(150)
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await measureLastOption(page, '/play  decide', warnings)
  } catch (err) {
    console.log(`  ! /play could not be measured: ${err.message}`)
  }

  /* AI Detective's phone, mid-case: storyboard, question, the duck, evidence, four answer cards. */
  try {
    await post('/api/reset')
    const joined = await post('/api/join', { codename: 'นักสืบ' })
    await post('/api/control', { action: 'start' })
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      (id) => localStorage.setItem('aidet.run', JSON.stringify({ playerId: id, codename: 'นักสืบ' })),
      joined?.player?.id,
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await measureLastOption(page, '/  investigate', warnings)
  } catch (err) {
    console.log(`  ! / could not be measured: ${err.message}`)
  }

  await context.close()
  return warnings
}

/** How far below the fold the last tappable option sits, if at all. */
async function measureLastOption(page, label, warnings) {
  const result = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height > 28)
    if (buttons.length === 0) return null
    const last = buttons[buttons.length - 1].getBoundingClientRect()
    return { count: buttons.length, bottom: Math.round(last.bottom), fold: window.innerHeight }
  })

  if (!result) {
    console.log(`  ? ${label}  no tappable options found — check the fixture, not the layout`)
    return
  }

  const below = result.bottom - result.fold
  if (below > 0) {
    warnings.push({ label, below })
    console.log(`  ! ${label}  ${result.count} options, last one ${below}px below the fold (scroll needed)`)
  } else {
    console.log(`  \u2713 ${label}  ${result.count} options, all reachable without scrolling`)
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

  let phoneWarnings = []

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

    phoneWarnings = await checkPhones(browser)
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} stage/viewport combinations overflow the projector.`)
    console.error('A projector does not scroll: everything past the fold is invisible to the room.')
    process.exit(1)
  }

  console.log('\nEvery stage fits on both projector shapes.')

  /* Phones are a WARNING, never an exit code: a phone scrolls, so this is friction to weigh rather
   * than content lost behind a fold. It still gets said out loud, because an option a player has
   * to hunt for during a 45-second window collects fewer votes than it deserves — and the host
   * reads that tally to the room as if it meant something. */
  if (phoneWarnings.length > 0) {
    console.log(`\n${phoneWarnings.length} phone screen(s) need a scroll to reach the last option:`)
    for (const w of phoneWarnings) console.log(`  ${w.label}  +${w.below}px`)
    console.log('Not fatal — phones scroll — but worth a look before the day.')
  }
}

await main()

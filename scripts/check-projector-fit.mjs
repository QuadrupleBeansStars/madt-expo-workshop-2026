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
import { readFileSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const TOKEN = process.env.FACILITATOR_TOKEN ?? ''

/*
 * The name cap, READ OUT OF lib/names.ts rather than copied.
 *
 * That file's own comment names this script as the thing that decides whether a cap is safe — so
 * a number pasted here would let the two drift, and the drift would be silent in exactly the
 * direction that matters: the check would keep measuring the OLD length and keep passing while
 * the real lobby got longer names. It is a build script, so parsing a constant out of source is
 * cheaper and truer than any of the alternatives.
 */
const NAME_MAX = (() => {
  const src = readFileSync(new URL('../lib/names.ts', import.meta.url), 'utf8')
  const m = src.match(/export const NAME_MAX = (\d+)/)
  if (!m) throw new Error('could not read NAME_MAX out of lib/names.ts')
  return Number(m[1])
})()

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
 * v3 replaced the five untimed `investigate`/`reveal` cases with phase kinds — v3.1's full set is
 * `lobby → reading → question → reveal → actcard → tally → podium`, an act card after every third
 * question — and
 * replaced `/api/control`'s `reveal` action with a plain `next` that also works mid-`question`
 * (`lib/game.ts#nextState`). There is no more six-minute problem: `next` already closes a question
 * early exactly the way the host will on the day, so this walk drives the whole game — all nine
 * questions and reveals, all three act cards, the tally, the podium — start to finish, in real
 * time, without waiting out a single clock. `reveal` additionally gets `hold`ed the instant it is
 * reached (REVEAL_MS is 12s and this phase carries a multi-step probe below) — the same escape
 * hatch the host has for "the room is still talking about this one".
 *
 * It drives ONE room and measures BOTH projector shapes at every phase rather than walking the
 * game twice. That is also the more faithful test: one room, two screens looking at it.
 */
async function checkDetectiveTv(browser, failures) {
  console.log('\n\n## AI Detective  /tv')
  console.log('(walks every reading/question/reveal in content/questions.ts, all 3 act cards, the tally and the podium — every phase measured, not sampled)')

  await post('/api/reset')

  /* A populated board is the tall case here too: an empty room measures a short screen and would
   * clear a layout that breaks the moment anyone joins. `/api/stats` slices its leaderboard to 5,
   * so nine joined players is enough to render TopFive at its tallest. */
  const players = []
  for (const codename of ['ปุ๊ก', 'Beam', 'Nott', 'Mint', 'Ohm', 'Fern', 'Guide', 'Pim', 'Tar']) {
    const joined = await post('/api/join', { codename })
    if (joined?.player?.id) players.push(joined.player.id)
  }

  /* One page per projector shape, both pointed at the same room.
   *
   * SEEDING THE HOST TOKEN IS NOT OPTIONAL (v3.1). `/tv` now opens on a full-screen login gate and
   * renders NOTHING else until `aidet.hostToken` resolves out of localStorage — so without this,
   * every phase below would faithfully measure the same 620px login form and report a clean bill
   * of health for a game it never actually looked at. Same goto/seed/reload shape the phone check
   * further down already uses for `aidet.run`. */
  const screens = []
  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto(`${BASE}/tv`, { waitUntil: 'domcontentloaded' })
    await page.evaluate((tok) => localStorage.setItem('aidet.hostToken', tok), TOKEN)
    await page.reload({ waitUntil: 'domcontentloaded' })
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
   * every stage reports a tidy ✓ while the bottom of the screen is being cut off.
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

  /*
   * THE BOTTOM OF THE SCENE, which nothing above this could see either.
   *
   * v3.1 frames every in-game phase between a HUD band and a status line (`.det-status`,
   * app/globals.css). The status line is the LOWEST element on the stage, so it is the first thing
   * a stage that grew too tall loses — and it loses it silently: `measure` is blind by design
   * (<main> is `overflow-hidden`, so scrollHeight never exceeds clientHeight), and
   * `checkHostControl` now measures a panel that lives in the HUD at the TOP of the screen and
   * cannot be pushed anywhere. Without this probe, "make the dossier fill the middle of the stage"
   * could push the case number clean off a 768px projector and every existing metric would still
   * report a tidy tick.
   */
  const checkStatusLine = async (where) => {
    for (const screen of screens) {
      const m = await screen.page.evaluate(() => {
        const el = document.querySelector('.det-status')
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { bottom: Math.round(r.bottom), top: Math.round(r.top), fold: document.documentElement.clientHeight }
      })
      if (!m) { console.log(`  ? ${screen.label}  ${where}  no status line on this phase`); continue }
      const clearance = m.fold - m.bottom
      if (clearance < 0) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (status line)`, overflowY: -clearance, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where}  status line cut off by ${-clearance}px`)
      } else {
        console.log(`  ✓ ${screen.label}  ${where} (status line)  ${clearance}px clear of the fold`)
      }
    }
  }

  const detState = () => fetch(`${BASE}/api/state`).then((r) => r.json())
  const settle = () => screens[0].page.waitForTimeout(1200)

  /* The host control panel is found off live markup with no test-only hook: `Hold` is the only
   * button on the page carrying `aria-pressed`, and its parent IS the panel (app/tv/page.tsx's
   * `HostControls`) — `document.querySelector('button[aria-pressed]').parentElement`. Order inside
   * it is [Next, Hold, Reset]; v3's leading `Start` moved to the middle of the lobby in v3.1, so
   * every button index below shifted down by one. Getting that wrong is silent: index 2 used to be
   * Hold and is now the RESET button. */

  /*
   * The host control bar's WORST shape, not its resting one — and in v3.1 that shape moved.
   *
   * v3 hung a "รหัสผู้ดำเนินรายการไม่ถูกต้อง" row underneath the three buttons, which was survivable
   * while the panel floated over the stage on `absolute`; the risk it carried was OVERLAP with the
   * reveal's standings column, and that is what this used to check. The panel is now a flow item in
   * the HUD, where a second row would instead grow the band and shove the entire stage — dossier,
   * status line and all — down toward a fold it has ~40px of clearance from. So the message moved
   * to the HUD's own centre slot, replacing the phase plate rather than joining it, and what this
   * probe now asserts is that the band's HEIGHT is unchanged between the two states.
   *
   * There is also no token field left to mistype (spec §3 removed it; the login gate is the only
   * way a token gets in), so the 403 is produced by intercepting `/api/control` on this page
   * alone. Nothing reaches the server, so the room's own phase is untouched either way.
   */
  const checkBadTokenState = async (where) => {
    for (const screen of screens) {
      const before = await screen.page.evaluate(() => {
        const hud = document.querySelector('.det-hud')
        return hud ? Math.round(hud.getBoundingClientRect().height) : null
      })

      await screen.page.route('**/api/control', (route) =>
        route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"forbidden"}' }))
      await screen.page.evaluate(() => {
        const panel = document.querySelector('button[aria-pressed]')?.parentElement
        panel?.querySelectorAll('button')[0]?.click() // [Next, Hold, Reset]
      })
      await screen.page.waitForTimeout(500)

      const r = await screen.page.evaluate(() => {
        const panel = document.querySelector('button[aria-pressed]')?.parentElement
        const hud = document.querySelector('.det-hud')
        const ol = document.querySelector('ol')
        const col = ol ? ol.parentElement : null
        if (!panel || !hud) return null
        const p = panel.getBoundingClientRect()
        let intersects = false
        if (col) {
          const c = col.getBoundingClientRect()
          intersects = !(p.right < c.left || p.left > c.right || p.bottom < c.top || p.top > c.bottom)
        }
        return {
          bottom: Math.round(p.bottom),
          fold: window.innerHeight,
          intersects,
          hudHeight: Math.round(hud.getBoundingClientRect().height),
          errorShown: document.body.innerText.includes('รหัสผู้ดำเนินรายการไม่ถูกต้อง'),
        }
      })

      await screen.page.unroute('**/api/control')

      if (!r) { console.log(`  ? ${screen.label}  ${where} (bad token)  control panel not found`); continue }
      const clearance = r.fold - r.bottom
      if (!r.errorShown) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (bad token, no message)`, overflowY: 0, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where} (bad token)  a rejected token said nothing on screen`)
      } else if (clearance < 0) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (bad token, control cut off)`, overflowY: -clearance, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where} (bad token)  control panel cut off by ${-clearance}px`)
      } else if (r.intersects) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (bad token, overlaps standings)`, overflowY: 0, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where} (bad token)  control panel overlaps the standings column`)
      } else if (before !== null && r.hudHeight !== before) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (bad token, HUD grew ${r.hudHeight - before}px)`, overflowY: r.hudHeight - before, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where} (bad token)  the HUD grew ${r.hudHeight - before}px and pushed the stage down`)
      } else {
        console.log(`  ✓ ${screen.label}  ${where} (bad token)  message shown, HUD still ${r.hudHeight}px, stage did not move`)
      }
    }

    /* Restore: the intercept is already gone, so one real request through the panel clears
     * `tokenError`. Hold, never Next — Next has a real, phase-advancing side effect, and two
     * independent UI clicks racing that on two screens is how you skip a phase. Hold's own toggle
     * parity gets corrected afterward over the direct API rather than trusted, because two screens
     * each toggling once is not guaranteed to land back where it started. */
    for (const screen of screens) {
      await screen.page.evaluate(() => {
        const panel = document.querySelector('button[aria-pressed]')?.parentElement
        panel?.querySelectorAll('button')[1]?.click() // Hold
      })
      await screen.page.waitForTimeout(400)
    }
    const afterRestore = await detState()
    if (afterRestore.holding) await post('/api/control', { action: 'hold' })
  }

  /*
   * The Next button's label swaps to `✓ ส่งแล้ว` for ~700ms while a click is in flight (see
   * NEXT_GUARD_MS in app/tv/page.tsx) — a WIDTH change on a panel that now lives in the HUD's
   * right slot, which the scroll-based height metric above cannot see at all. In v3 the risk was
   * the widened panel running off the right edge; in v3.1 it is that it squeezes the HUD's centre
   * plate, so both the panel's right edge AND the band's height are read back. Delaying the
   * request lets the check actually observe that state instead of racing a same-machine round trip
   * that usually resolves first. Run on `actcard` — untimed, host-only-advanced, so nothing
   * expires underneath the probe.
   *
   * The intercept FULFILS a 200 rather than reaching the server: the label swap does not depend on
   * where the response came from, and a real advance here would move the room out from under the
   * measurement. A 403 would work for the label too, but it would leave `tokenError` set and put
   * the HUD into the state the probe above already owns.
   */
  const checkNextPendingWidth = async (where) => {
    for (const screen of screens) {
      await screen.page.route('**/api/control', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 700))
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
      })
      await screen.page.evaluate(() => {
        const panel = document.querySelector('button[aria-pressed]')?.parentElement
        panel?.querySelectorAll('button')[0]?.click() // [Next, Hold, Reset]
      })
      await screen.page.waitForTimeout(150)
      const r = await screen.page.evaluate(() => {
        const panel = document.querySelector('button[aria-pressed]')?.parentElement
        const hud = document.querySelector('.det-hud')
        if (!panel) return null
        const p = panel.getBoundingClientRect()
        return {
          bottom: Math.round(p.bottom),
          right: Math.round(p.right),
          fold: window.innerHeight,
          width: window.innerWidth,
          hudHeight: hud ? Math.round(hud.getBoundingClientRect().height) : 0,
        }
      })
      await screen.page.waitForTimeout(700)
      await screen.page.unroute('**/api/control')
      if (!r) { console.log(`  ? ${screen.label}  ${where} (next pending)  control panel not found`); continue }
      const clearance = r.fold - r.bottom
      const edge = r.right > r.width ? 'past the right edge' : `${r.width - r.right}px clear of the right edge`
      if (clearance < 0) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (next pending, wide control)`, overflowY: -clearance, overflowX: 0 })
        console.log(`  ✗ ${screen.label}  ${where} (next pending)  control panel cut off by ${-clearance}px`)
      } else if (r.right > r.width) {
        failures.push({ viewport: screen.label, stage: `tv ${where} (next pending, past right edge)`, overflowY: 0, overflowX: r.right - r.width })
        console.log(`  ✗ ${screen.label}  ${where} (next pending)  control panel runs ${r.right - r.width}px past the right edge`)
      } else {
        console.log(`  ✓ ${screen.label}  ${where} (next pending)  widened panel ${edge}, HUD still ${r.hudHeight}px`)
      }
    }
  }

  try {
    await settle()
    await measure('lobby')
    await checkHostControl('lobby')

    await post('/api/control', { action: 'start' })

    let revealChecked = false
    let actcardChecked = false
    /* Cap on phases, not on questions: adding a question to content/questions.ts must extend this
     * walk on its own rather than silently leave the new one unmeasured. v3.1 added a SEVENTH
     * phase — the five-second `reading` beat before every answer window — so the arithmetic is now
     * 10 questions × 3 phases + the rules screen + 3 act cards + tally + podium = 36 real
     * transitions at the current content; 80 leaves headroom for the re-checks below without
     * masking a runaway loop. It is a CAP, not a count — the walk follows real room state, so a
     * new question extends it by itself and only a runaway loop hits this number.
     *
     * That extra phase is also why every branch below must EXIST. A phase with no branch falls
     * through to the bottom of the loop with nothing awaited and re-polls at fetch speed, so nine
     * unhandled readings would burn the whole cap before the walk ever reached the podium — and
     * the failure would look like "the check just stopped", not like a missing branch. */
    const MAX_PHASES = 80
    for (let i = 0; i < MAX_PHASES; i++) {
      let state = await detState()
      if (state.phase === 'lobby') break

      /*
       * THE RULES SCREEN (v3.2, spec §3). Entered once, between `lobby` and the first `reading`.
       *
       * IT MUST HAVE A BRANCH, and this is the phase that proves why the comment above the loop
       * insists on it. `rules` is UNTIMED and host-advanced: it never expires on its own, so a
       * walk with no branch for it does not merely skip a measurement — it re-polls the same
       * phase at fetch speed until MAX_PHASES runs out and then reports a clean bill of health
       * for a game it never got past the first screen of. No tsc error, no failing test, no
       * output that looks wrong. A silently blind check is the defect class this whole script
       * exists to close.
       */
      if (state.phase === 'rules') {
        await settle()
        await measure('rules')
        await checkHostControl('rules')
        await checkStatusLine('rules')
        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      /*
       * THE WORKED EXAMPLE, the second untimed pre-game screen, and the tallest thing on the
       * projector that is not a full-bleed stage: three panels side by side, each with a sheet in
       * it, under a title and over a caption. It is the phase most likely to overflow a 768px
       * projector after a content edit — the captions and the example question are the only text
       * on this screen that anyone will ever retype — so it is measured like any other.
       *
       * Same untimed hazard as `rules` above: no branch here and the walk spins on this phase
       * until the cap runs out, reporting a clean bill of health for a game it never started.
       */
      if (state.phase === 'tutorial') {
        await settle()
        await measure('tutorial')
        await checkHostControl('tutorial')
        await checkStatusLine('tutorial')
        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      /*
       * THE READING BEAT (v3.1, lib/game.ts's READING_MS). The room reads the question and the
       * duck's answer with no button to press. It carries the same case-file scene as `question`
       * with the timer bar swapped for a dot countdown, so it can fail to fit in exactly the same
       * ways and gets exactly the same three measurements.
       */
      if (state.phase === 'reading') {
        const where = `reading:${state.questionId}`
        await settle()
        /* READING_MS is 10s and `settle` is 1.2s, but a slow first paint could still straddle the
         * auto-advance. Re-read rather than trust the state from the top of the loop. */
        state = await detState()
        if (state.phase !== 'reading') continue
        await measure(where)
        await checkHostControl(where)
        await checkStatusLine(where)
        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      if (state.phase === 'question') {
        const where = `question:${state.questionId}`
        await settle()
        /* QUESTION_MS is 15s — short enough that the settle above could, in principle, straddle
         * an auto-expiry (every open /tv tab polls once a second, and any poll runs `tick()`).
         * Re-read rather than trust the state from the top of the loop. */
        state = await detState()
        if (state.phase !== 'question') continue
        await measure(where)
        await checkHostControl(where)
        await checkStatusLine(where)

        /* Answer before leaving: the reveal's split bar and TopFive only have rows once people
         * have answered, and rows are what overflow. The verdict itself does not matter for a
         * layout check — every player presses ผ่าน uniformly; lib/scoring.test.ts is what proves
         * the scoring is correct, not this script. */
        for (const playerId of players) {
          await post('/api/answer', { playerId, questionId: state.questionId, verdict: 'pass' })
        }
        /* `shouldExpire` flips the instant answeredCount === activeCount — poll our own state
         * rather than wait out the clock. */
        for (let w = 0; w < 30; w++) {
          state = await detState()
          if (state.phase !== 'question') break
          await screens[0].page.waitForTimeout(200)
        }
        continue
      }

      if (state.phase === 'reveal') {
        const where = `reveal:${state.questionId}`
        // Freeze immediately — REVEAL_MS is 12s and the first reveal below runs a multi-step probe.
        await post('/api/control', { action: 'hold' })
        await settle()
        await measure(where)
        await checkHostControl(where)
        await checkStatusLine(where)

        if (!revealChecked) {
          revealChecked = true
          await checkBadTokenState(where) // leaves `holding` = false when it returns
        } else {
          await post('/api/control', { action: 'hold' }) // un-hold
        }

        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      if (state.phase === 'actcard') {
        const where = `actcard:act${state.actIndex}`
        await settle()
        await measure(where)
        await checkHostControl(where)
        await checkStatusLine(where)

        if (!actcardChecked) {
          actcardChecked = true
          await checkNextPendingWidth(where)
        }

        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      if (state.phase === 'tally') {
        await settle()
        await measure('tally')
        await checkHostControl('tally')
        await checkStatusLine('tally')
        await post('/api/control', { action: 'next' })
        await screens[0].page.waitForTimeout(500)
        continue
      }

      if (state.phase === 'podium') {
        await settle()
        await measure('podium')
        await checkHostControl('podium')
        await checkStatusLine('podium')
        break
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

async function checkPhones(browser, failures) {
  console.log('\n\n## Phones  390x844')
  const warnings = []

  const context = await browser.newContext({ viewport: PHONE_VIEWPORT, isMobile: true, hasTouch: true })

  /* Café Persona's phone, on its first ask stage — scenario plus four choice buttons. */
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
      if (state.stageKind === 'ask') break
      await post('/api/room/control', { action: 'advance' })
      await page.waitForTimeout(150)
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await measureLastOption(page, '/play  ask', warnings)
  } catch (err) {
    console.log(`  ! /play could not be measured: ${err.message}`)
  }

  /*
   * AI Detective's phone, on its two live phases: the five-second `reading` beat (locked buttons,
   * a dot countdown and the patrol filling the column above them) and the `question` window that
   * follows it, two full-width buttons and nothing else. QUESTION_MS is 15s and READING_MS is 5s —
   * far too short to load a page inside — so the phone is seeded and parked on "waiting for the
   * host" FIRST and the game is started underneath it, rather than racing a reload against a clock
   * that has already begun. `reading` is then advanced by an explicit `next` instead of waiting out
   * its five seconds, the same escape the host has.
   *
   * Assert the phase rather than let a missed window read as "no tappable options found — check
   * the fixture, not the layout": that message was written for a genuinely button-less phase
   * (reveal/actcard/tally have none), and silently reusing it for a timing race would hide a real
   * failure behind a shrug instead of failing loudly.
   */
  try {
    await post('/api/reset')
    const joined = await post('/api/join', { codename: 'นักสืบ' })
    const page = await context.newPage()
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      (id) => localStorage.setItem('aidet.run', JSON.stringify({ playerId: id, codename: 'นักสืบ' })),
      joined?.player?.id,
    )
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)

    await post('/api/control', { action: 'start' })
    await page.waitForTimeout(1600)   // one phone poll (POLL_MS is 1200) plus slack

    /*
     * `start` NO LONGER LANDS ON `reading` (v3.2): it lands on the rules screen, which sits once
     * between the lobby and the first reading and is host-advanced with no clock of its own. The
     * phone follows the projector onto it, so it is measured here rather than skipped — and then
     * advanced, or every probe below would report a phase drift for a game that is working
     * perfectly. Conditional rather than an unconditional extra `next`, so this still measures the
     * right screens if the phase is ever removed again.
     */
    const briefing = await fetch(`${BASE}/api/state`).then((r) => r.json())
    if (briefing.phase === 'rules') {
      await measureFill(page, '/  rules')
      await post('/api/control', { action: 'next' })
      await page.waitForTimeout(1600)
    }

    /* The tutorial, the same shape: the phone holds on it exactly as it holds on the rules sheet,
     * and it is measured here rather than skipped for the same reason — otherwise every probe
     * below reports a phase drift for a game that is working perfectly. Conditional, so this walk
     * still measures the right screens if either pre-game screen is ever removed again. */
    const tutorial = await fetch(`${BASE}/api/state`).then((r) => r.json())
    if (tutorial.phase === 'tutorial') {
      await measureFill(page, '/  tutorial')
      await post('/api/control', { action: 'next' })
      await page.waitForTimeout(1600)
    }

    const reading = await fetch(`${BASE}/api/state`).then((r) => r.json())
    if (reading.phase !== 'reading') {
      console.log(`  ! /  reading  phase was "${reading.phase}" when the phone was measured — skipped`)
    } else {
      await measureLastOption(page, '/  reading', warnings)
      await measureFill(page, '/  reading')
    }

    await post('/api/control', { action: 'next' })
    await page.waitForTimeout(1600)

    const state = await fetch(`${BASE}/api/state`).then((r) => r.json())
    if (state.phase !== 'question') {
      failures.push({ viewport: 'phone', stage: `/  question (phase drifted to "${state.phase}")`, overflowY: 0, overflowX: 0 })
      console.log(`  ✗ /  question  phase was "${state.phase}" by the time the phone loaded — investigate the timing, not the layout`)
    } else {
      await measureLastOption(page, '/  question', warnings)
    }
  } catch (err) {
    console.log(`  ! / could not be measured: ${err.message}`)
  }

  await context.close()
  return warnings
}

/**
 * How much of the phone's column is not inside any element at all.
 *
 * Reported, never failed: it is a composition note, not a fold. The `reading` beat had roughly 40%
 * of the space above the two buttons sitting empty black — a real complaint from the team, and one
 * no fold-based metric can express, because empty space never overflows anything.
 *
 * READ IT FOR WHAT IT IS. This measures ELEMENT coverage inside the column, not painted pixels.
 * It answers "is anything allocated to this space", which is the layout question; "does it look
 * empty" is still a screenshot question, and the screenshot comparison against the team's
 * reference file is where that gets answered.
 *
 * AND SINCE v3.1'S ROOM, THE TWO ANSWERS DIVERGE ON PURPOSE. The investigation room is painted by
 * a full-bleed `<canvas>` behind <main> (components/game/Patrol.tsx), NOT by anything inside this
 * column — so the reported number went UP (roughly 40% to 65%) at the same time as the screen
 * stopped being empty. Every one of those pixels is now wall, floor, or someone walking on it. A
 * high number here is only a complaint if the screenshot also looks bare.
 */
async function measureFill(page, label) {
  const r = await page.evaluate(() => {
    const col = document.querySelector('main > div')
    if (!col) return null
    const kids = [...col.children].filter((el) => el.getBoundingClientRect().height > 0)
    if (kids.length === 0) return null
    const box = col.getBoundingClientRect()
    const first = kids[0].getBoundingClientRect()
    const painted = kids.reduce((sum, el) => sum + el.getBoundingClientRect().height, 0)
    return {
      gapAtTop: Math.round(first.top - box.top),
      empty: Math.round(box.height - painted),
      height: Math.round(box.height),
    }
  })
  if (!r) return
  const pct = Math.round((r.empty / r.height) * 100)
  console.log(`  · ${label}  column ${r.height}px, ${r.empty}px outside any element (${pct}%), ${r.gapAtTop}px above the first one`)
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

/*
 * IMPORTANT 4 (final whole-branch review): "every animation collapses under
 * `prefers-reduced-motion: reduce`" (app/globals.css:318-327) is a binding constraint — a room of
 * 100 people is exactly the audience that setting exists for, and it produced an upheld finding
 * earlier in this branch — but nothing verified it. jsdom cannot: it does no layout and does not
 * evaluate `@media` queries against a simulated `prefers-reduced-motion`, so no unit assertion can
 * see this at all. `playwright-core` is already a dependency and already opens a context per
 * viewport elsewhere in this script; `browser.newContext({ reducedMotion: 'reduce' })` is the one
 * extra context this needs.
 *
 * WHAT THIS CHECKS, AND THE TRADEOFF. No single /tv phase carries both `.timer-fill` (question
 * only) and one of the phase-change classes (`.stamp-slam`/`.bar-grow`/`.row-slide`/`.block-rise`/
 * `.hop-in` — reveal/actcard/podium only), so coordinating this probe with the game's own phase
 * timing would mean racing clocks this script elsewhere goes out of its way to avoid waiting on.
 * Instead this injects a throwaway element per class directly via `page.evaluate` and reads its
 * computed style — which tests exactly the thing the finding is actually about (does the
 * reduced-motion override win the cascade for these selectors), but does NOT prove that a real
 * rendered phase still carries that class name; `checkDetectiveTv`'s phase walk above is what
 * covers that.
 *
 * `transition: none` does NOT make `getComputedStyle(el).transition` read back as the string
 * `"none"` in Chromium — it resolves to something like `"all 0s ease 0s"`. `transitionDuration`
 * is the property whose computed value actually collapses to `"0s"`, so that is what gets
 * asserted for `.timer-fill`. `animationName` DOES resolve to the literal `"none"`, so the five
 * keyframe classes are checked directly.
 */
async function checkReducedMotion(browser, motionFailures) {
  console.log('\n\n## Reduced motion  (prefers-reduced-motion: reduce)')

  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  try {
    // Any page that loads app/globals.css works — this probes the stylesheet's cascade, not
    // anything about /tv's own markup or game state. /biz is visited below for the other sheet.
    await page.goto(`${BASE}/tv`, { waitUntil: 'domcontentloaded' })

    const result = await page.evaluate(() => {
      const computedFor = (className, prop) => {
        const el = document.createElement('div')
        el.className = className
        document.body.appendChild(el)
        const value = getComputedStyle(el)[prop]
        el.remove()
        return value
      }
      return {
        'timer-fill': computedFor('timer-fill', 'transitionDuration'),
        'stamp-slam': computedFor('stamp-slam', 'animationName'),
        'bar-grow': computedFor('bar-grow', 'animationName'),
        'row-slide': computedFor('row-slide', 'animationName'),
        'block-rise': computedFor('block-rise', 'animationName'),
        'hop-in': computedFor('hop-in', 'animationName'),
      }
    })

    /*
     * Café Persona's motion lives in components/room/stages.css, which /tv does not load — so this
     * has to visit /biz as well or the room workshop's animations are simply unmeasured. They were,
     * the day the mascots landed. Its classes need `.room-root` as an ancestor (that is where the
     * --pp-* tokens and the sheet's scoping hang), so each probe is built inside one.
     */
    await page.goto(`${BASE}/biz`, { waitUntil: 'domcontentloaded' })
    const room = await page.evaluate(() => {
      const root = document.createElement('div')
      root.className = 'room-root'
      document.body.appendChild(root)
      const computedFor = (className, prop) => {
        const el = document.createElement('div')
        el.className = className
        root.appendChild(el)
        const value = getComputedStyle(el)[prop]
        el.remove()
        return value
      }
      const out = {
        'pp-names__one': computedFor('pp-names__one', 'animationName'),
        'pp-chart__bar': computedFor('pp-chart__bar', 'animationName'),
        'pp-split__bar': computedFor('pp-split__bar', 'animationName'),
        'pp-dot': computedFor('pp-dot', 'animationName'),
        // The drifting-bean layers are pseudo-elements on .room-root itself — two of them, big
        // beans and small, and a check that only read one would clear a screen still moving.
        'room-root::before': getComputedStyle(root, '::before').animationName,
        'room-root::after': getComputedStyle(root, '::after').animationName,
      }
      root.remove()
      return out
    })

    const expectations = [
      ['.timer-fill transition-duration', result['timer-fill'], '0s'],
      ['.stamp-slam animation-name', result['stamp-slam'], 'none'],
      ['.bar-grow animation-name', result['bar-grow'], 'none'],
      ['.row-slide animation-name', result['row-slide'], 'none'],
      ['.block-rise animation-name', result['block-rise'], 'none'],
      ['.hop-in animation-name', result['hop-in'], 'none'],
      ['.room-root::before animation-name', room['room-root::before'], 'none'],
      ['.room-root::after animation-name', room['room-root::after'], 'none'],
      ['.pp-names__one animation-name', room['pp-names__one'], 'none'],
      ['.pp-chart__bar animation-name', room['pp-chart__bar'], 'none'],
      ['.pp-split__bar animation-name', room['pp-split__bar'], 'none'],
      ['.pp-dot animation-name', room['pp-dot'], 'none'],
    ]
    for (const [label, actual, expected] of expectations) {
      if (actual !== expected) {
        motionFailures.push({ check: label, expected, actual })
        console.log(`  ✗ ${label}  expected "${expected}", computed "${actual}"`)
      } else {
        console.log(`  ✓ ${label}`)
      }
    }
  } finally {
    await context.close()
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
  // Separate from `failures`: a motion-invariant miss is not a projector overflow, and the exit
  // summary below says so explicitly rather than folding it into "N stage/viewport combinations
  // overflow the projector" (which would be a true count of failures but a false description).
  const motionFailures = []

  let phoneWarnings = []

  try {
    await checkDetectiveTv(browser, failures)
    await checkReducedMotion(browser, motionFailures)

    console.log('\n\n## Café Persona  /biz')
    for (const viewport of VIEWPORTS) {
      await post('/api/room/reset')

      /* Players matter to the measurement: reveal bars only have height once someone voted, and
       * the result map's dot field only exists for typed players. Nine players, spread across all
       * four choices below, renders every quadrant non-empty — an empty room would clear a layout
       * that breaks the moment anyone joins. */
      const players = []
      const NAMES = ['ปุ๊ก', 'Beam', 'Nott', 'Mint', 'Ohm', 'Fern', 'Guide', 'Pim', 'Tar']
      for (const name of NAMES) {
        const joined = await post('/api/room/join', { name })
        if (joined?.player?.id) players.push(joined.player.id)
      }

      const context = await browser.newContext({ viewport })
      const page = await context.newPage()
      /* /biz is behind a login gate (app/biz/page.tsx). Without a token in storage every stage
       * below would measure the same closed door and report a tidy tick for a deck nobody looked
       * at. `addInitScript` runs before the page's own scripts, so the first render is already the
       * room — no gate flash to race. */
      await context.addInitScript((value) => {
        try { localStorage.setItem('decisionroom.hostToken', value) } catch { /* ignore */ }
      }, TOKEN)
      await page.goto(`${BASE}/biz`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(1500)

      const label = `${viewport.width}x${viewport.height}`
      console.log(`\n=== ${label} ===`)

      /*
       * THE LOBBY, WITH A FULL ROOM IN IT — measured before the walk and separately from it.
       *
       * The walk below seats nine players, which is the tall case for the RESULT map and the
       * short case for the lobby: nine name cards is a third of a board, and a lobby that fits
       * nine can still hang its Start button below the fold at a hundred. That is exactly what it
       * did. A hundred join here, the lobby is measured, and they are cleared again so the walk
       * gets the room it expects.
       */
      {
        /* Every name is EXACTLY NAME_MAX long. A hundred short names is not the case that breaks
           a shelf-packed board — a hundred names at the cap is, and the cap is the number this
           check exists to justify. Padding rather than slicing is what guarantees it. */
        for (let i = 0; i < 100; i++) {
          const name = `ผู้ร่วมงานคนที่ ${i} ร้านกาแฟมุมถนนสายเก่า`.slice(0, NAME_MAX).padEnd(NAME_MAX, 'ก')
          await post('/api/room/join', { name })
        }
        await page.waitForTimeout(2600)
        const full = await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="start-button"]')
          return {
            overflowY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
            clearance: btn ? Math.round(document.documentElement.clientHeight - btn.getBoundingClientRect().bottom) : null,
          }
        })
        if (full.overflowY > TOLERANCE_PX) {
          failures.push({ viewport: label, stage: 'lobby (100 players)', overflowY: full.overflowY, overflowX: 0 })
          console.log(`  ✗ lobby (100 players)  +${full.overflowY}px down`)
        } else if (full.clearance !== null && full.clearance < 0) {
          failures.push({ viewport: label, stage: 'lobby (100 players, Start below the fold)', overflowY: -full.clearance, overflowX: 0 })
          console.log(`  ✗ lobby (100 players)  Start button cut off by ${-full.clearance}px`)
        } else {
          console.log(`  ✓ lobby (100 players)  Start ${full.clearance}px clear of the fold`)
        }

        // Back to the nine the walk was written for.
        await post('/api/room/reset')
        players.length = 0
        for (const name of NAMES) {
          const joined = await post('/api/room/join', { name })
          if (joined?.player?.id) players.push(joined.player.id)
        }
        await page.waitForTimeout(1400)
      }

      /* Walk until the room reports itself finished, rather than counting to a hard-coded ten:
       * adding a stage to `content/room.ts` must extend this check automatically, not silently
       * leave the new stage unmeasured. The cap is a runaway guard only. */
      const MAX_STAGES = 40
      for (let i = 0; i < MAX_STAGES; i++) {
        const state = await roomState()
        const stage = state.questionId ? `${state.stageKind}:${state.questionId}` : state.phase

        /* Vote before measuring. Reveal bars and result dots only exist once someone has voted.
         * k % 4 spreads nine players across all four choices, so every bar and every quadrant
         * renders with content — the tall case. */
        if (state.votingOpen && state.questionId) {
          for (let k = 0; k < players.length; k++) {
            await post('/api/room/vote', {
              playerId: players[k],
              questionId: state.questionId,
              choiceIndex: k % 4,
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

    phoneWarnings = await checkPhones(browser, failures)
  } finally {
    await browser.close()
  }

  if (motionFailures.length > 0) {
    console.error(`\n${motionFailures.length} reduced-motion check(s) failed:`)
    for (const f of motionFailures) console.error(`  ${f.check}  expected "${f.expected}", computed "${f.actual}"`)
    console.error('prefers-reduced-motion: reduce must collapse every animation/transition; it did not.')
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} stage/viewport combinations overflow the projector.`)
    console.error('A projector does not scroll: everything past the fold is invisible to the room.')
  }

  if (failures.length > 0 || motionFailures.length > 0) process.exit(1)

  console.log('\nEvery stage fits on both projector shapes, and reduced motion collapses everything it should.')

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

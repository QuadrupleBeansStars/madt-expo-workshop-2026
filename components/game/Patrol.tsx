'use client'
import { useEffect, useRef } from 'react'

/*
 * THE ROOM. A wall, a floor, and a detective walking it with a duck in tow — painted full-bleed
 * behind the whole screen, not as a strip inside the layout.
 *
 * This is the structural difference the team named: *"พื้นหลังควรเป็นฟีลห้องสืบสวน"*. Ours read as
 * text on black because the characters lived in a band at the bottom of the flow; the reference
 * (`ai_detective_premium_edition-3.html`) puts its `.canvas-wrapper` at `position:absolute;
 * inset:0; z-index:1` and floats `.title-overlay-container` over it at `z-index:5` with
 * `pointer-events:none`. The canvas IS the ground everything else stands on, so the slide reads as
 * a space rather than a page. Callers mount this once, absolutely positioned, behind their content.
 *
 * LIFTED FROM THE REFERENCE — `drawSherlockSprite`, `drawDuckSprite` and `updateAndRenderPatrol`,
 * at the bottom of its <script>. The two sprite functions are its fill calls in its order with its
 * colours. The wall (`#040612`), the floor (`#101220`), the follow easing (0.055), the walk bounce
 * (sin(frame * 0.22) * 3), the leg swing (sin(frame * 0.22) * 12) and the duck's idle bounce
 * (sin(frame * 0.28) * 3) are its constants.
 *
 * NOT painted behind `reveal`, `actcard`, `tally` or `podium`: those screens carry the content the
 * room exists to frame, and a moving floor competes with them. They keep `.det`'s own wall colour
 * and nothing else — which is why the predicate lives at the call site and not in here.
 */

/* ── The reference's own coordinate space ─────────────────────────────────────────────────────
 * Every number below is read off its 1280x720 slide, and everything in this file works in those
 * units; `scale` (further down) is the only place they meet device pixels. */
const REF_W = 1280
const REF_H = 720
/** `ctx.fillRect(0, 520, w, h - 520)` — the floor line, 72.2% down the reference's own slide. */
const REF_FLOOR = 520
const FLOOR_FRACTION = REF_FLOOR / REF_H

const WALL = '#040612'
const FLOOR = '#101220'

/*
 * Both characters are positioned RELATIVE TO THE FLOOR LINE, not to the bottom of the canvas. The
 * reference hard-codes `player.y = 535` and `duck.y = 585` against a floor at 520, so the man
 * stands 15 units into the floor band and the duck 65 — the duck reads as standing further back in
 * the room, which is the whole reason they are not on one baseline. Anchoring to the canvas bottom
 * instead would collapse that the moment the canvas is not 720 tall.
 */
const MAN = { w: 75, h: 135, speed: 1.5, top: 535 - REF_FLOOR }
const DUCK = { w: 45, h: 55, top: 585 - REF_FLOOR }

/** `duck.x` chases `player.x - player.direction * 70`. */
const FOLLOW = 70
/** `if (player.x > w - 130) turn; else if (player.x < 50) turn` — the walkable margins. */
const EDGE_LEFT = 50
const EDGE_RIGHT = 130

/*
 * How big the reference's scene is drawn, per device pixel of canvas WIDTH.
 *
 * THIS IS THE PHONE FIX, and it is worth being exact about why the obvious version is wrong. The
 * duck's clearance behind the detective is `FOLLOW - 62` scene units (the duck's beak reaches +25
 * from its own centre, the detective's coat -22, and their boxes differ by 15) — so scaling the
 * follow distance ALONE to the canvas width, `70 * 390/1280 = 21`, puts the duck's beak inside the
 * coat. What has to scale is the SCENE: the sprites and the 70/50/130 constants together, so the
 * whole convoy keeps the reference's own proportions at any width.
 *
 * `W / 1280` is 1.07 on a 1366 projector and 1.25 on a 1600 one — the reference's proportions
 * exactly. It is 0.30 on a 390px phone, which is a legible sprite but a very small one, so the
 * floor stops it there: at 0.6 the detective is 81px tall, the duck trails him by ~58px, and he
 * has 470 scene units of floor to walk. Nothing is pinned to a constant sized for a projector.
 */
const MIN_SCALE = 0.6

/**
 * `x`/`y` are the sprite's BOUNDING-BOX TOP-LEFT, not a baseline — both functions translate to
 * `(x + width/2, y + height/2)` before drawing, exactly as the reference does. Getting this wrong
 * draws the character half a box too low.
 */
function drawSherlockSprite(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  direction: number, frame: number,
) {
  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.scale(direction, 1)
  const bounce = Math.sin(frame * 0.22) * 3

  ctx.fillStyle = '#4a382d'
  ctx.fillRect(-20, -10 + bounce, 40, 55)
  ctx.fillStyle = '#5c4639'
  ctx.fillRect(-22, 10 + bounce, 44, 38)

  const legWalk = Math.sin(frame * 0.22) * 12
  ctx.fillStyle = '#1e1612'
  ctx.fillRect(-14, 48 + legWalk, 8, 18)
  ctx.fillRect(6, 48 - legWalk, 8, 18)

  ctx.fillStyle = '#ffdbac'
  ctx.fillRect(-12, -35 + bounce, 24, 25)
  ctx.fillStyle = '#111'
  ctx.fillRect(5, -28 + bounce, 4, 4)

  ctx.fillStyle = '#5c4639'
  ctx.fillRect(-16, -44 + bounce, 32, 11)
  ctx.fillRect(-22, -36 + bounce, 44, 4)

  ctx.restore()
}

function drawDuckSprite(
  ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  direction: number, frame: number,
) {
  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.scale(direction, 1)
  const bounce = Math.sin(frame * 0.28) * 3

  ctx.fillStyle = '#ffd23f'
  ctx.beginPath()
  ctx.arc(0, 0 + bounce, 16, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(8, -16 + bounce, 10, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#ff7f50'
  ctx.fillRect(16, -18 + bounce, 9, 5)

  ctx.restore()
}

export function Patrol({ className = '', floor = FLOOR_FRACTION }: {
  /** Positioning belongs to the caller — this is a backdrop, so it wants `absolute inset-0`. */
  className?: string
  /**
   * Where the floor line sits, as a fraction of the canvas height. `0.722` is the reference's own
   * `fillRect(0, 520, …)` on a 720-tall slide, and is what `/tv` uses unchanged.
   *
   * A PROP because a 16:9 constant does not survive the trip to 9:19.5. On a 390x844 phone the
   * bottom 28% is where the two vote buttons live (2 x 104px + a 20px gap + 24px of padding, so
   * they start at y≈592) — a floor line at 0.722 puts it at 608 and hides both characters behind
   * the buttons entirely. The phone passes a smaller fraction so they stand on the floor line
   * BEHIND the buttons rather than underneath them; see app/page.tsx's own note.
   */
  floor?: number
}) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return

    /*
     * A CSS rule cannot reach a canvas, so the preference is read here — and read BEFORE anything
     * that can bail out, so "did we start a loop?" is decided by the preference and not by whether
     * a 2D context happened to be available. The room does not empty out under reduced motion:
     * frame 0 is painted once and never advances, so the characters are present, just still.
     */
    const reduced = typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches

    const ctx = cv.getContext('2d')

    const man = { x: EDGE_LEFT, dir: 1 }
    let duckX = man.x - man.dir * FOLLOW
    let frame = 0
    let raf = 0

    /* Scene geometry, recomputed whenever the canvas changes size. `scale` folds the device-pixel
     * ratio into the same transform, so the pixel-art edges stay hard on a phone. */
    let vw = 0
    let vh = 0
    let floorY = 0
    let scale = 1

    const measure = () => {
      const dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1
      const W = cv.clientWidth
      const H = cv.clientHeight
      cv.width = Math.max(1, Math.round(W * dpr))
      cv.height = Math.max(1, Math.round(H * dpr))

      const fit = Math.max(MIN_SCALE, W / REF_W)
      scale = dpr * fit
      vw = W / fit
      vh = H / fit
      floorY = vh * floor
      // A resize must not strand the detective outside the new walkable range, or he spends the
      // next few seconds marching back in from off-screen.
      man.x = Math.min(Math.max(man.x, EDGE_LEFT), Math.max(EDGE_LEFT, vw - EDGE_RIGHT))
    }

    const paint = () => {
      if (!ctx) return
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.clearRect(0, 0, vw, vh)
      // The reference's two fills, in its order: the wall over everything, then the floor over the
      // bottom of it. Nothing else — the room is those two rectangles and the two characters.
      ctx.fillStyle = WALL
      ctx.fillRect(0, 0, vw, vh)
      ctx.fillStyle = FLOOR
      ctx.fillRect(0, floorY, vw, vh - floorY)
      drawDuckSprite(ctx, duckX, floorY + DUCK.top, DUCK.w, DUCK.h, man.dir, frame)
      drawSherlockSprite(ctx, man.x, floorY + MAN.top, MAN.w, MAN.h, man.dir, frame)
    }

    measure()

    /* Re-measure on resize, and REPAINT — never restart the loop from here. A projector that
     * changes mode and a phone that rotates both land here; a handler that called `tick()` would
     * start a second animation loop, and under reduced motion would start the first one. */
    const onResize = () => { measure(); paint() }
    addEventListener('resize', onResize)
    const stopListening = () => removeEventListener('resize', onResize)

    if (reduced) { paint(); return stopListening }
    if (!ctx) return stopListening   // no drawing surface: there is nothing for a loop to do

    const tick = () => {
      frame++
      man.x += MAN.speed * man.dir
      if (man.x > vw - EDGE_RIGHT && man.dir === 1) man.dir = -1
      else if (man.x < EDGE_LEFT && man.dir === -1) man.dir = 1
      duckX += ((man.x - man.dir * FOLLOW) - duckX) * 0.055
      paint()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); stopListening() }
  }, [floor])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}

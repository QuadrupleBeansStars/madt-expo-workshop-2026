# The TV overflows the projector on 9 of 10 stages

Found 2026-07-31 by walking all ten stages in Chrome at two projector sizes and measuring
`documentElement.scrollHeight - clientHeight`. Not caught by any test: jsdom has no layout,
and every prior screenshot run stopped at stage 3 (`shots.mjs` closed the browser early).

## Measured overflow

| Stage | 1600×900 | 1366×768 |
|---|---|---|
| intro-join | — | +108px |
| data-you | **+663** | **+926** |
| decide-staffing | +70 | +107 |
| **outcome-staffing** | **+1576** | **+2066** |
| data-competitor | **+475** | **+749** |
| decide-defend | +22 | +65 |
| **outcome-defend** | **+1366** | **+1550** |
| decide-invest | +25 | +62 |
| **outcome-invest** | **+1375** | **+1475** |
| close-takeaways | **+595** | **+901** |

## Why it matters

A projector does not scroll. On the outcome stages the visible top third is the headline and
the paragraph; **the KPI strip, the accounting line, THE LESSON and THE LEADERBOARD are all
below the fold.** Those are the payoff of the round — the lesson is the teaching, and the
leaderboard is the reason anyone played. Neither is on screen.

The decide stages overflow by only 22–107px, which costs the bottom of the last option row.
Still wrong, but recoverable; the outcome stages are not.

## Root cause

Stage layouts size to content and let the page grow. Nothing constrains a stage to the
viewport. The pattern works on a laptop, where the presenter scrolls without noticing, and
fails on the one screen it was built for.

## Not a bug (checked and cleared)

- `฿` renders correctly. Content holds U+0E3F; it simply looks like a stroked `B` at small
  sizes, which is the correct glyph.
- The phone's evidence strip is a deliberate subset of the projector's charts — see the
  contract documented in `components/room/evidence.ts`. Phone and TV cannot disagree.

## Open design question

`decide-invest` names one evidence key (`buyTime`) where the other two decide stages name two.
The left column renders a single chart against ~370px of empty space, and buy-time is weak
evidence for "where do you spend ฿20,000". Either give it a second distribution or reflow the
column when only one panel is present.

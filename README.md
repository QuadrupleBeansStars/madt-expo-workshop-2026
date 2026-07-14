# 🕵️ AI Detective — MADT Expo, 23 Aug 2026

> Think with AI, not just trust AI.

## Run it

```bash
npm install
npm run dev:lan          # binds 0.0.0.0 so other laptops can reach it
ipconfig getifaddr en0   # your IP — players go to http://<that-ip>:3000
```

| URL | Who | What |
| --- | --- | --- |
| `http://<ip>:3000` | Players | Codename → 5 cases → score |
| `http://<ip>:3000/dashboard` | Projector | Stats Wall / Leaderboard — press **L** to switch |
| `http://<ip>:3000/reveal` | Projector | The reveal — **← →** to move between cases |

## Clearing the room between sessions

`/api/reset` is **token-protected** — it will not clear the room, and will not
even respond to a plain `curl -X POST`, unless a facilitator token is set.

1. Before starting the server, set `FACILITATOR_TOKEN` to any secret string you choose:

   ```bash
   FACILITATOR_TOKEN=some-secret npm run dev:lan
   ```

   If `FACILITATOR_TOKEN` is left unset, `/api/reset` is **disabled** and always
   returns `403` — this is intentional (see "Why reset needs a token" below).

2. To actually reset between sessions, send the same token back as a header:

   ```bash
   curl -X POST http://localhost:3000/api/reset \
     -H "x-facilitator-token: some-secret"
   ```

   A `200 {"ok":true}` means the room was cleared. Any other response means it
   was **not** cleared — check the token matches exactly what you started the
   server with.

Write the token down somewhere before the event (sticky note on the laptop is fine)
— you will need to type it every time you reset between sessions.

### Why reset needs a token

An earlier version of this endpoint tried to allow resets "from localhost only,"
on the theory that only the facilitator's own machine would be trusted. That
check was removed: in Next.js route handlers, `req.url`'s hostname is **always**
`localhost`, regardless of which machine on the LAN actually sent the request or
what `Host` header it carried — because the dev server runs with `-H 0.0.0.0`
precisely so other laptops can reach it. That "localhost" check was therefore
inert, and would have let **any laptop on the LAN wipe the live room** at any
time, by design flaw rather than by attack. The token is the only thing standing
between "any player's laptop" and "resets the whole room," so treat it as you
would any other shared secret for the day.

## Player experience notes

Each player's progress through the 5 cases is saved to their own browser's
`localStorage` as they go, so a reload (or a flaky wifi reconnect) resumes them
where they left off — nobody has to restart a run because their laptop napped.

If you reset the room while someone's browser still has an in-progress run saved,
that browser's next request to the server will be rejected (the player id no
longer exists). The app detects this automatically, clears that stale local
state, and sends the player back to the codename screen with a message that the
session was reset — this is expected and not a bug. Tell players to just re-enter
a codename and start again if they see that message right after you reset.

## ⚠️ Before the day — test the network

The failure mode is **client isolation**: wifi that gives every laptop internet but
blocks laptop-to-laptop traffic. Your server becomes invisible to players and
there is **no fix on the day**.

1. Put two laptops on the venue wifi. Run the server on one (`npm run dev:lan`).
   Open `http://<host-ip>:3000` on the other.
2. If it fails → run a **phone hotspot** and have all laptops (including the
   host) join that instead. Test this too, in advance, not on the day.

## Editing the cases

All content is in `content/cases.ts` — bilingual (th/en), no code changes needed.
`npx vitest run content/` validates every case (one correct option, both languages
present, real sources cited).

**Content rules:** never fabricate evidence imitating a real outlet. Real cases cite
real URLs; fictional evidence (NovaBrew) is flagged `fictional: true` and renders a
FICTIONAL badge.

## Swapping in a live model later

`lib/ai-answer.ts` is the seam. It is already async. Replace its body with a real
model call and nothing else changes.

Note the tradeoff the pre-written answer is buying: the group reveal needs every
player to have seen the *same* AI answer, and a live model may also (correctly)
refuse to hallucinate — leaving you with no demo, in front of an audience.

## Development

```bash
npm run dev        # localhost only, for local development
npm run dev:lan    # binds 0.0.0.0, for the actual workshop
npm run build       # production build
npm start           # run a production build (after `npm run build`)
npm test             # npx vitest run — full suite
```

Type-check with `npx tsc --noEmit`.

Styling is Tailwind v4, which is CSS-first: the theme lives entirely in
`app/globals.css` (`@import "tailwindcss"` + `@theme inline`). There is no
`tailwind.config.ts` — Tailwind v4 doesn't need one unless you add an explicit
`@config` directive, which this project does not.

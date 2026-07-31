# Deploying both workshops to GCP

Both workshops are **one Next app** serving four routes, deployed as **one Cloud Run service
pinned to one instance**. That is not a simplification — it is the only shape that works. Read
"Why one instance" before changing anything.

| | Route |
|---|---|
| The Decision Room — projector | `/biz` |
| The Decision Room — phones | `/play` |
| AI Detective — projector | `/tv` |
| AI Detective — phones | `/` |

## Deploy

```bash
export GCP_PROJECT=your-project-id
export FACILITATOR_TOKEN='pick-something-nobody-has-seen'
./deploy/deploy.sh
```

It prints the four URLs when it finishes. First deploy takes a few minutes (Cloud Build compiles
the image); later ones are faster.

Optional overrides: `GCP_REGION` (default `asia-southeast1`, Singapore — the closest region to
Bangkok, ~30ms) and `SERVICE_NAME` (default `madt-workshops`).

One-time project setup, if this is a fresh project:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Why one instance

Both apps keep the live room in a Node process-global (`globalThis.__roomStore`,
`globalThis.__decisionRoomStore`) backed by a JSON file in the container's own filesystem. There
is no database, no Redis, no shared cache.

Cloud Run load-balances every request independently. With two instances:

- half the phones join a room on instance A, half on instance B
- both rooms are real and both look completely normal on the phone
- the projector polls too, so it shows whichever room its own request happened to hit
- vote counts and the leaderboard are silently wrong, and **nothing errors**

There is no way to notice this on stage and no way to fix it mid-session. Hence
`--max-instances=1`. It is a correctness flag, not a cost control.

`--min-instances=1` and `--no-cpu-throttling` keep that instance warm with its clock running
between requests, so the round timer does not freeze while the host is talking and no group of
phones eats a cold start mid-vote.

### What this costs you

- **A restart loses the room.** A new deploy, a crash, or Cloud Run moving the instance wipes it
  back to the lobby. Do not deploy on expo day once people are in the room.
- **No horizontal scale.** One CPU serving ~200 phones polling once a second. That is well within
  one instance, but there is no headroom above it — `--concurrency 250` is the ceiling.

### If you ever need more than one instance

The room store has to move out of process first — Firestore or Memorystore behind
`lib/room-store.ts` and `lib/store.ts`. Both already funnel every mutation through a single store
object, so the seam exists. Until that is done, raising `--max-instances` breaks the workshop.

## Before the expo

- [ ] `FACILITATOR_TOKEN` is not `madt2026`. The dev token is in this repo, in screenshots, and in
      the README. `deploy.sh` refuses to deploy with it.
- [ ] Load the four routes on a phone over mobile data, not venue Wi-Fi, to confirm the public URL
      works independently of the LAN.
- [ ] Run `npm run check:projector` against the deployed URL:
      `BASE_URL=https://... FACILITATOR_TOKEN=... npm run check:projector`
- [ ] Reset the room right before the session: `POST /api/room/reset` with the token header.

## Local equivalent of the container

```bash
npm run build
cd .next/standalone && cp -r ../../public . && cp -r ../static .next/
PORT=8099 HOSTNAME=0.0.0.0 FACILITATOR_TOKEN=test node server.js
```

This is what the image runs. Verified: all four routes and every CSS chunk return 200.

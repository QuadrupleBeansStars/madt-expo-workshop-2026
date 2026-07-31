#!/usr/bin/env bash
#
# Deploy both workshops to Cloud Run as ONE single-instance service.
#
# ─────────────────────────────────────────────────────────────────────────────
# READ THIS BEFORE CHANGING ANY FLAG BELOW
#
# Both apps hold the live room in a Node process-global (`globalThis.__roomStore`,
# `globalThis.__decisionRoomStore`) backed by a JSON file in the container's own filesystem.
# There is no database and no shared cache. That means:
#
#   ONE INSTANCE, OR THE WORKSHOP BREAKS IN A WAY NOBODY WILL DIAGNOSE ON STAGE.
#
# With two instances, Cloud Run load-balances each request independently. Half the phones join a
# room on instance A and half on instance B. Both rooms are real, both look fine on the phone, and
# the projector — which is also just polling — shows whichever one its own request landed on. The
# vote counts are wrong, the leaderboard is wrong, and nothing errors.
#
# `--max-instances=1` is therefore load-bearing, not a cost control. `--min-instances=1` plus
# `--no-cpu-throttling` keeps that instance warm and its clock running between requests, so the
# round timer does not freeze while the host is talking.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT="${GCP_PROJECT:-}"
REGION="${GCP_REGION:-asia-southeast1}"   # Singapore — closest region to Bangkok
SERVICE="${SERVICE_NAME:-madt-workshops}"

if [[ -z "$PROJECT" ]]; then
  echo "GCP_PROJECT is not set." >&2
  echo "  export GCP_PROJECT=your-project-id" >&2
  exit 2
fi

if [[ -z "${FACILITATOR_TOKEN:-}" ]]; then
  echo "FACILITATOR_TOKEN is not set. Without it the host controls are disabled and the deck" >&2
  echo "cannot be advanced past the lobby." >&2
  echo "  export FACILITATOR_TOKEN='something-not-madt2026'" >&2
  exit 2
fi

if [[ "$FACILITATOR_TOKEN" == "madt2026" ]]; then
  echo "Refusing to deploy with the development token. Anyone who has seen a screenshot of the" >&2
  echo "host bar knows it, and this service is about to be public." >&2
  exit 2
fi

echo "project : $PROJECT"
echo "region  : $REGION"
echo "service : $SERVICE"
echo

gcloud run deploy "$SERVICE" \
  --project "$PROJECT" \
  --region "$REGION" \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --max-instances 1 \
  --min-instances 1 \
  --no-cpu-throttling \
  --cpu 1 \
  --memory 1Gi \
  --concurrency 250 \
  --timeout 60 \
  --set-env-vars "FACILITATOR_TOKEN=${FACILITATOR_TOKEN},NODE_ENV=production"

echo
echo "Deployed. Routes:"
URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')
echo "  Decision Room  projector : ${URL}/biz"
echo "  Decision Room  phones    : ${URL}/play"
echo "  AI Detective   projector : ${URL}/tv"
echo "  AI Detective   phones    : ${URL}/"

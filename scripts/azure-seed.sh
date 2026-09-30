#!/usr/bin/env bash
# Seed the staging database with prisma/seed.ts, from a one-shot Container Apps
# Job — the database has no public endpoint. Same shape as the migration job in
# scripts/deploy.sh: built with `az acr build`, connects as pb_app, deleted
# afterwards because it holds the password as a secret.
#
#   scripts/azure-seed.sh scripts/deploy.stg.env
#
# Staging only: the seed writes synthetic buddies and tours, and turns every
# real user into an active buddy with bookings. It is all upserts, so a re-run
# is safe. Staging's server must be running (08:45–20:45 JST), and migrations
# must be current — run scripts/deploy.sh first if in doubt.
set -euo pipefail

CONFIG="${1:?usage: scripts/azure-seed.sh scripts/deploy.stg.env}"
MODE="$(stat -f '%OLp' "$CONFIG" 2>/dev/null || stat -c '%a' "$CONFIG")"
if [ "${MODE: -2}" != "00" ]; then
  echo "error: $CONFIG is mode $MODE — it holds database passwords." >&2
  echo "       run: chmod 600 $CONFIG" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$CONFIG"
set +a

: "${ENVIRONMENT:?}" "${RESOURCE_GROUP:?}" "${ACR_NAME:?}" "${ACA_ENV:?}"
: "${ACR_PULL_IDENTITY:?}" "${DATABASE_URL:?}"

if [ "$ENVIRONMENT" != "staging" ]; then
  echo "error: ENVIRONMENT is '$ENVIRONMENT'. The seed runs against staging only." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

ACR_IDENTITY_ID="$(az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" --query id -o tsv)"
ACR_LOGIN="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)"
TAG="$(git rev-parse --short HEAD)"
SEED_IMAGE="${ACR_LOGIN}/seed:${TAG}"

step "Build seed:${TAG}"
az acr build --registry "$ACR_NAME" --image "seed:${TAG}" \
  --file apps/api/Dockerfile --target seed .

JOB="caj-seed"
JOB_CREATED=""
EXEC_NAME=""

cleanup_job() {
  if [ -n "$EXEC_NAME" ]; then
    step "Seed log"
    tries=0
    until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
            --container seed --execution "$EXEC_NAME" --tail 100 \
            --format text 2>/dev/null; do
      tries=$((tries + 1))
      [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal)"; break; }
      sleep 10
    done
  fi
  if [ -n "$JOB_CREATED" ]; then
    step "Delete job $JOB"
    if ! az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null; then
      echo "  WARNING: could not delete $JOB. It holds pb_app's password" >&2
      echo "  as a secret. Delete it by hand:" >&2
      echo "    az containerapp job delete -n $JOB -g $RESOURCE_GROUP --yes" >&2
    fi
  fi
}
trap cleanup_job EXIT

step "Seed — job $JOB"
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true

az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" \
  --environment "$ACA_ENV" \
  --trigger-type Manual \
  --replica-timeout 900 --replica-retry-limit 0 \
  --replica-completion-count 1 --parallelism 1 \
  --image "$SEED_IMAGE" --container-name seed \
  --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
  --mi-user-assigned "$ACR_IDENTITY_ID" \
  --cpu 0.5 --memory 1.0Gi \
  --secrets "database-url=${DATABASE_URL}" \
  --env-vars "DATABASE_URL=secretref:database-url" \
  --output none
JOB_CREATED=1

EXEC_NAME="$(az containerapp job start -n "$JOB" -g "$RESOURCE_GROUP" --query name -o tsv)"
echo "  execution $EXEC_NAME"
STATUS="Running"
TRIES=0
while [ "$STATUS" = "Running" ] || [ "$STATUS" = "Unknown" ] || [ -z "$STATUS" ]; do
  sleep 10
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -gt 90 ]; then
    echo "error: seed still running after 15 minutes. Check the portal." >&2
    exit 1
  fi
  STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
    --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || echo Unknown)"
  echo "  $STATUS"
done

if [ "$STATUS" != "Succeeded" ]; then
  echo "error: seed execution $STATUS. The log below says why; the seed is" >&2
  echo "       all upserts, so a re-run is safe." >&2
  exit 1
fi

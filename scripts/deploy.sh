#!/usr/bin/env bash
# Deploy api + web to Cloud Run.
#
#   scripts/deploy.sh path/to/deploy.env
#
# The config file holds secrets — keep it outside the repo.
# See scripts/deploy.env.example for the required keys.
#
# Order is forced: NEXT_PUBLIC_* is inlined into the web bundle at build time,
# so the api must be deployed and its URL known before web is built. The api's
# CORS_ORIGIN then needs web's URL, so the api is patched at the end.
#
# Images are built on Cloud Build, not locally: Cloud Run needs linux/amd64 and
# the dev machines are arm64.
set -euo pipefail

CONFIG="${1:-}"
[ -n "$CONFIG" ] && [ -f "$CONFIG" ] || { echo "usage: $0 <config-file>" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; . "$CONFIG"; set +a

: "${PROJECT:?}" "${REGION:?}" "${REPO:?}"
: "${DATABASE_URL:?}" "${SCHEDULER_SECRET:?}"
: "${FIREBASE_PROJECT_ID:?}" "${FIREBASE_CLIENT_EMAIL:?}" "${FIREBASE_PRIVATE_KEY:?}"
: "${NEXT_PUBLIC_FIREBASE_API_KEY:?}" "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?}"

cd "$(dirname "$0")/.."
TAG="$(git rev-parse --short HEAD)"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}"

url_of() { gcloud run services describe "$1" --region "$REGION" --format='value(status.url)'; }

# --- api ---------------------------------------------------------------------
echo "==> building api:${TAG}"
gcloud builds submit --config apps/api/cloudbuild.yaml \
  --substitutions "_IMAGE=${REGISTRY}/api,_TAG=${TAG}"

# YAML is a superset of JSON, so emitting JSON sidesteps quoting the PEM.
ENV_FILE="$(mktemp -t api-env-XXXXXX).yaml"
trap 'rm -f "$ENV_FILE"' EXIT
python3 - "$ENV_FILE" <<'PY'
import json, os, sys
keys = ["DATABASE_URL", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL",
        "FIREBASE_PRIVATE_KEY", "SCHEDULER_SECRET", "EMAIL_DISABLED",
        "GMAIL_SENDER", "GMAIL_IMPERSONATE",
        "SLACK_WEBHOOK_URL", "SLACK_ENABLED", "SLACK_DISABLED",
        "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME", "R2_PUBLIC_URL"]
open(sys.argv[1], "w").write(
    json.dumps({k: os.environ[k] for k in keys if os.environ.get(k)}, indent=2))
PY

echo "==> deploying api"
gcloud run deploy api \
  --image "${REGISTRY}/api:${TAG}" \
  --region "$REGION" \
  --min-instances=0 \
  --allow-unauthenticated \
  --env-vars-file "$ENV_FILE"

API_URL="$(url_of api)"
echo "    api: $API_URL"

# --- web ---------------------------------------------------------------------
echo "==> building web:${TAG}"
gcloud builds submit --config apps/web/cloudbuild.yaml --substitutions \
  "_IMAGE=${REGISTRY}/web,_TAG=${TAG},_API_URL=${API_URL},_FB_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},_FB_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},_FB_PROJECT_ID=${FIREBASE_PROJECT_ID}"

echo "==> deploying web"
gcloud run deploy web \
  --image "${REGISTRY}/web:${TAG}" \
  --region "$REGION" \
  --min-instances=0 \
  --allow-unauthenticated

WEB_URL="$(url_of web)"
echo "    web: $WEB_URL"

# --- close the loop ----------------------------------------------------------
echo "==> pointing api at web"
gcloud run services update api --region "$REGION" \
  --update-env-vars "CORS_ORIGIN=${WEB_URL},WEB_BASE_URL=${WEB_URL}"

cat <<EOF

done.
  api  $API_URL
  web  $WEB_URL

Manual step, once per new web URL: add ${WEB_URL#https://} to
Firebase console -> Authentication -> Settings -> Authorized domains.
EOF

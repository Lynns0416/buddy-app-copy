#!/usr/bin/env bash
# Build and deploy api + web to Azure Container Apps, one environment per run.
#
#   scripts/deploy.sh scripts/deploy.env       # prod
#   scripts/deploy.sh scripts/deploy.stg.env   # staging
#
# The config file holds the two database passwords, the Firebase private key
# and every other application secret. It is gitignored (`deploy*.env`) and the
# script refuses to read it unless it is owner-only, the same check as
# scripts/azure-provision.sh. See scripts/deploy.env.example for the keys.
#
# Infrastructure — resource group, registry, VNet, Container Apps environment,
# Postgres — is scripts/azure-provision.sh, and the two database roles are
# scripts/azure-db-roles.sh. Both run once per environment. This one runs
# constantly and creates nothing but the two apps.
#
# ORDER IS FORCED. NEXT_PUBLIC_* is inlined into the web bundle at build time,
# so the api must be deployed and its FQDN known before web is built; the api's
# CORS_ORIGIN is then only known once web exists, so the api is patched last.
#
# Images are built with `az acr build`, server-side, so nothing is pushed from
# a laptop — which also sidesteps building linux/amd64 on an arm64 machine.
#
# `prisma migrate deploy` runs here, as a one-shot Container Apps Job, between
# the builds and the api deploy. See docs/decisions.md, "migrate deploy runs as
# a one-shot Container Apps Job".
set -euo pipefail

CONFIG="${1:-}"
[ -n "$CONFIG" ] && [ -f "$CONFIG" ] || { echo "usage: $0 <config-file>" >&2; exit 1; }

# The config holds pb_app's and pb_migrate's passwords in cleartext.
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
: "${ACA_API:?}" "${ACA_WEB:?}" "${ACR_PULL_IDENTITY:?}"
# pb_app for the api, pb_migrate for the migration job. Never the same role,
# and never the server admin — see docs/deploy-plan.md §4.1.
: "${DATABASE_URL:?}" "${MIGRATE_DATABASE_URL:?}"
: "${SCHEDULER_SECRET:?}"
: "${FIREBASE_PROJECT_ID:?}" "${FIREBASE_CLIENT_EMAIL:?}" "${FIREBASE_PRIVATE_KEY:?}"
: "${NEXT_PUBLIC_FIREBASE_API_KEY:?}" "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:?}"
# Photo upload is a shipped feature, not an opt-in. These name what
# scripts/azure-provision.sh step 7 created for this environment; there is no
# key, because the api reaches the account as STORAGE_IDENTITY.
: "${STORAGE_ACCOUNT:?}" "${STORAGE_PHOTOS_CONTAINER:?}" "${STORAGE_IDENTITY:?}"

if [ "$DATABASE_URL" = "$MIGRATE_DATABASE_URL" ]; then
  echo "error: DATABASE_URL and MIGRATE_DATABASE_URL are the same string." >&2
  echo "       The api connects as pb_app, which cannot run DDL; migrations" >&2
  echo "       connect as pb_migrate. See docs/deploy-plan.md §4.1." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

# Images are pulled with a user-assigned identity that outlives every resource
# here, not with a system-assigned one. A system-assigned identity is created
# with the resource that holds it, so its AcrPull assignment is seconds old
# when the platform first validates the pull — and the migration job is
# deleted and recreated on every deploy, which made that race permanent
# rather than a first-run cost. See docs/decisions.md 2026-09-13.
ACR_IDENTITY_ID="$(az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" \
  --query id -o tsv 2>/dev/null || true)"
if [ -z "$ACR_IDENTITY_ID" ]; then
  echo "error: no user-assigned identity '$ACR_PULL_IDENTITY' in $RESOURCE_GROUP." >&2
  echo "       scripts/azure-provision.sh creates it and grants it AcrPull." >&2
  exit 1
fi

# The api reaches Blob as this environment's storage identity, which holds
# Storage Blob Data Contributor on $STORAGE_ACCOUNT alone. The app carries the
# pull identity too, so the api is handed this one's client id to say which to
# use. See docs/decisions.md 2026-09-13, "Blob is reached by one identity per
# environment".
STORAGE_IDENTITY_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
  --query id -o tsv 2>/dev/null || true)"
STORAGE_IDENTITY_CLIENT_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
  --query clientId -o tsv 2>/dev/null || true)"
STORAGE_ACCOUNT_URL="$(az storage account show -n "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" \
  --query primaryEndpoints.blob -o tsv 2>/dev/null || true)"
STORAGE_ACCOUNT_URL="${STORAGE_ACCOUNT_URL%/}"
if [ -z "$STORAGE_IDENTITY_ID" ] || [ -z "$STORAGE_IDENTITY_CLIENT_ID" ] || [ -z "$STORAGE_ACCOUNT_URL" ]; then
  echo "error: no storage account '$STORAGE_ACCOUNT' or identity '$STORAGE_IDENTITY' in $RESOURCE_GROUP." >&2
  echo "       scripts/azure-provision.sh step 7 creates both." >&2
  exit 1
fi

# A dirty tree deploys code that is in no commit, so the commit tag would name
# an image that does not match it. Say so in the tag rather than in a warning
# nobody reads.
TAG="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain)" ] || TAG="${TAG}-dirty"

# The web image is built per environment — NEXT_PUBLIC_API_URL is baked into
# it — and both environments push to the same repository. Tagged by commit
# alone, the second environment to deploy a commit takes over the first one's
# tag, and the first environment's next cold start pulls a bundle that calls
# the other api. api and migrate carry nothing per environment and keep the
# plain commit tag.
case "$ENVIRONMENT" in
  *[!A-Za-z0-9_.-]*)
    echo "error: ENVIRONMENT '$ENVIRONMENT' cannot be part of an image tag." >&2
    exit 1 ;;
esac
WEB_TAG="${TAG}-${ENVIRONMENT}"

# --- Confirm the target ------------------------------------------------
# Red for production, blue for anything else, matching the other two scripts.
if [ -t 1 ]; then
  case "$ENVIRONMENT" in
    prod | production) BANNER=$'\033[1;97;41m' ;;
    *) BANNER=$'\033[1;97;44m' ;;
  esac
  BOLD=$'\033[1m'; RESET=$'\033[0m'
else
  BANNER=""; BOLD=""; RESET=""
fi
ENV_UPPER="$(printf '%s' "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')"

printf '\n%s                                                  %s\n' "$BANNER" "$RESET"
printf '%s   DEPLOY  ->  %-36s%s\n' "$BANNER" "$ENV_UPPER" "$RESET"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET"
cat <<CONFIRM
  Config file      $CONFIG
  Subscription     $(az account show --query name -o tsv)
  Resource group   $RESOURCE_GROUP
  Apps environment $ACA_ENV
  Apps             $ACA_API, $ACA_WEB
  Image tag        $TAG (web: $WEB_TAG)
  Web URL          ${WEB_HOSTNAME:-<generated>}
  Api URL          ${API_HOSTNAME:-<generated>}
  Photos           $STORAGE_ACCOUNT/$STORAGE_PHOTOS_CONTAINER, as $STORAGE_IDENTITY

  Pending migrations are applied to this environment's database before the
  api is updated.

CONFIRM
printf '%sDeploy %s to %s?%s [y/N] ' "$BOLD" "$TAG" "$ENV_UPPER" "$RESET"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing deployed." >&2; exit 1 ;;
esac

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
exists() { [ -n "$("$@" 2>/dev/null)" ]; }

app_exists() { exists az containerapp show -n "$1" -g "$RESOURCE_GROUP" --query name -o tsv; }
fqdn_of() {
  az containerapp show -n "$1" -g "$RESOURCE_GROUP" \
    --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null
}
# A custom domain is bound to an app but is not what the ingress reports, so it
# cannot be discovered — every deploy would otherwise overwrite the real URL
# with the generated one. Config wins when set; the generated name is the
# fallback, so leaving both keys blank keeps the previous behaviour exactly.
host_of() {
  local configured="$2"
  if [ -n "$configured" ]; then printf '%s' "$configured"; else fqdn_of "$1"; fi
}

ACR_LOGIN="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)"
API_IMAGE="${ACR_LOGIN}/api:${TAG}"
WEB_IMAGE="${ACR_LOGIN}/web:${WEB_TAG}"
MIGRATE_IMAGE="${ACR_LOGIN}/migrate:${TAG}"

# --- 1. Build the api and migration images -----------------------------
# Both before anything is applied or deployed: a build that fails must not
# leave a migrated database behind.
step "Build api:${TAG}"
az acr build --registry "$ACR_NAME" --image "api:${TAG}" --image "api:latest" \
  --file apps/api/Dockerfile --target runner .

step "Build migrate:${TAG}"
az acr build --registry "$ACR_NAME" --image "migrate:${TAG}" \
  --file apps/api/Dockerfile --target migrate .

# --- 2. Apply migrations -----------------------------------------------
# A one-shot Manual job, because the database has no public endpoint and its
# hostname resolves only inside the VNet. The job is deleted afterwards: it
# holds pb_migrate's password as a secret for as long as it exists. Same shape
# as scripts/azure-db-roles.sh, for the same reasons.
#
# `migrate deploy` is a no-op when nothing is pending, so this runs on every
# deploy and is safe to re-run after any failure.
JOB="caj-migrate"
JOB_CREATED=""
EXEC_NAME=""

cleanup_job() {
  if [ -n "$EXEC_NAME" ]; then
    step "Migration log"
    # The logs command lives in the containerapp extension, which is in
    # preview, and Log Analytics ingests with a delay. Not load-bearing:
    # the execution status already decided the outcome.
    tries=0
    until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
            --container migrate --execution "$EXEC_NAME" --tail 100 \
            --format text 2>/dev/null; do
      tries=$((tries + 1))
      [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal)"; break; }
      sleep 10
    done
  fi
  if [ -n "$JOB_CREATED" ]; then
    step "Delete job $JOB"
    if ! az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null; then
      echo "  WARNING: could not delete $JOB. It holds pb_migrate's password" >&2
      echo "  as a secret. Delete it by hand:" >&2
      echo "    az containerapp job delete -n $JOB -g $RESOURCE_GROUP --yes" >&2
    fi
  fi
}
trap cleanup_job EXIT

step "Migrate — job $JOB"
# Left over from an interrupted run, secret and all.
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true

# The job pulls with $ACR_PULL_IDENTITY, which already holds AcrPull, so no
# registry password is stored anywhere and nothing waits on a role assignment
# to propagate.
az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" \
  --environment "$ACA_ENV" \
  --trigger-type Manual \
  --replica-timeout 900 --replica-retry-limit 0 \
  --replica-completion-count 1 --parallelism 1 \
  --image "$MIGRATE_IMAGE" --container-name migrate \
  --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
  --mi-user-assigned "$ACR_IDENTITY_ID" \
  --cpu 0.5 --memory 1.0Gi \
  --secrets "database-url=${MIGRATE_DATABASE_URL}" \
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
    echo "error: migration still running after 15 minutes. Check the portal." >&2
    exit 1
  fi
  STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
    --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || echo Unknown)"
  echo "  $STATUS"
done

if [ "$STATUS" != "Succeeded" ]; then
  echo "error: migration execution $STATUS — nothing was deployed." >&2
  echo "       The log below says why. Prisma applies each migration in a" >&2
  echo "       transaction, so a failed run is safe to retry." >&2
  exit 1
fi

# Print the log and delete the job now, rather than leaving it to the trap at
# the end of the deploy: everything after this is minutes of image building,
# and the job holds pb_migrate's password the whole time.
cleanup_job
JOB_CREATED=""
EXEC_NAME=""

# --- 3. Deploy the api -------------------------------------------------
# Secrets are Container Apps secrets, referenced by name; only the non-secret
# values are plain environment variables. Empty values are dropped rather than
# set to "", because the api reads several of them as "set at all".
SECRETS=()
ENVS=()
secret_var() {
  local var="$1" val="${!1-}"
  [ -n "$val" ] || return 0
  local name
  name="$(printf '%s' "$var" | tr 'A-Z_' 'a-z-')"
  SECRETS+=("${name}=${val}")
  ENVS+=("${var}=secretref:${name}")
}
plain_var() {
  local var="$1" val="${!1-}"
  [ -n "$val" ] || return 0
  ENVS+=("${var}=${val}")
}

secret_var DATABASE_URL
secret_var FIREBASE_PRIVATE_KEY
secret_var SCHEDULER_SECRET
secret_var SLACK_WEBHOOK_URL
plain_var FIREBASE_PROJECT_ID
plain_var FIREBASE_CLIENT_EMAIL
plain_var EMAIL_DISABLED
plain_var GMAIL_SENDER
plain_var GMAIL_IMPERSONATE
plain_var SLACK_ENABLED
plain_var SLACK_DISABLED
plain_var STORAGE_ACCOUNT_URL
plain_var STORAGE_PHOTOS_CONTAINER
plain_var STORAGE_IDENTITY_CLIENT_ID

# An app's FQDN is fixed once it exists, so on every deploy after the first the
# web URL is already known. Carrying it into the api's environment here means
# the api never runs a revision without a CORS origin, and step 6 becomes a
# no-op instead of a second revision.
WEB_FQDN="$(host_of "$ACA_WEB" "${WEB_HOSTNAME:-}" || true)"
if [ -n "$WEB_FQDN" ]; then
  ENVS+=("CORS_ORIGIN=https://${WEB_FQDN}" "WEB_BASE_URL=https://${WEB_FQDN}")
fi

step "Deploy api"
if app_exists "$ACA_API"; then
  az containerapp secret set -n "$ACA_API" -g "$RESOURCE_GROUP" \
    --secrets "${SECRETS[@]}" --output none
  # An api created before photos moved to Blob holds only the pull identity.
  # Assigning an identity the app already holds changes nothing.
  az containerapp identity assign -n "$ACA_API" -g "$RESOURCE_GROUP" \
    --user-assigned "$STORAGE_IDENTITY_ID" --output none
  az containerapp update -n "$ACA_API" -g "$RESOURCE_GROUP" \
    --image "$API_IMAGE" --replace-env-vars "${ENVS[@]}" --output none
else
  # --min-replicas 0 is the difference between $0 and burning credit.
  az containerapp create -n "$ACA_API" -g "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$API_IMAGE" \
    --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
    --user-assigned "$ACR_IDENTITY_ID" "$STORAGE_IDENTITY_ID" \
    --ingress external --target-port 8080 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.5 --memory 1.0Gi \
    --secrets "${SECRETS[@]}" \
    --env-vars "${ENVS[@]}" \
    --output none
fi

API_FQDN="$(host_of "$ACA_API" "${API_HOSTNAME:-}" || true)"
[ -n "$API_FQDN" ] || { echo "error: $ACA_API reports no ingress FQDN." >&2; exit 1; }
API_URL="https://${API_FQDN}"
echo "  api: $API_URL"

# --- 4. Build web ------------------------------------------------------
# Ingress on the api stays external because the browser calls it directly:
# NEXT_PUBLIC_API_URL is inlined into the client bundle, and CORS_ORIGIN below
# exists for exactly that cross-origin call.
step "Build web:${WEB_TAG}"
az acr build --registry "$ACR_NAME" --image "web:${WEB_TAG}" \
  --file apps/web/Dockerfile --target runner \
  --build-arg "NEXT_PUBLIC_API_URL=${API_URL}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}" \
  --build-arg "NEXT_PUBLIC_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}" \
  --build-arg "NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED=${NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED:-false}" \
  .

# --- 5. Deploy web -----------------------------------------------------
# Nothing at runtime: everything web needs is in the bundle, and the Dockerfile
# sets PORT and HOSTNAME.
step "Deploy web"
if app_exists "$ACA_WEB"; then
  az containerapp update -n "$ACA_WEB" -g "$RESOURCE_GROUP" \
    --image "$WEB_IMAGE" --output none
else
  az containerapp create -n "$ACA_WEB" -g "$RESOURCE_GROUP" \
    --environment "$ACA_ENV" \
    --image "$WEB_IMAGE" \
    --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
    --user-assigned "$ACR_IDENTITY_ID" \
    --ingress external --target-port 3000 \
    --min-replicas 0 --max-replicas 2 \
    --cpu 0.5 --memory 1.0Gi \
    --output none
fi

NEW_WEB_FQDN="$(host_of "$ACA_WEB" "${WEB_HOSTNAME:-}" || true)"
[ -n "$NEW_WEB_FQDN" ] || { echo "error: $ACA_WEB reports no ingress FQDN." >&2; exit 1; }
WEB_URL="https://${NEW_WEB_FQDN}"
echo "  web: $WEB_URL"

# --- 6. Close the loop -------------------------------------------------
# Only on the first deploy, or if web's FQDN changed. Otherwise step 3 already
# carried it in.
if [ "$NEW_WEB_FQDN" != "${WEB_FQDN:-}" ]; then
  step "Point api at web"
  az containerapp update -n "$ACA_API" -g "$RESOURCE_GROUP" \
    --set-env-vars "CORS_ORIGIN=${WEB_URL}" "WEB_BASE_URL=${WEB_URL}" --output none
fi

# --- 7. Prune the registry ---------------------------------------------
# Every deploy adds an api, a migrate and a web image, and Basic includes 10GB.
# Azure's retention policy is no help: it deletes untagged manifests only, and
# only on Premium. A deploy is the only thing that adds images, so it is also
# what removes them.
#
# Prod and staging push to the same repositories and every app scales to zero,
# so a cold replica pulls its image again: deleting an image an app still
# references breaks that app at its next cold start, not now. Kept: every image
# a container app or job in the resource group references, from either
# environment, and the newest $KEEP_IMAGES tagged images in each repository.
# Everything else is deleted, including the untagged manifests a rebuilt tag
# leaves behind. See docs/decisions.md 2026-09-13.
#
# A failure here leaves extra images behind, never a broken deploy, so it warns
# rather than exits.
KEEP_IMAGES=5
IN_USE=""

referenced() { case $'\n'"$IN_USE"$'\n' in *$'\n'"$1"$'\n'*) return 0 ;; esac; return 1; }

prune_registry() {
  local repo digest tags tag rank keep apps app manifests
  apps="$(az containerapp list -g "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null)" || return 1
  # Every active revision's image as well as each app's template. In single
  # revision mode the previous revision keeps serving until the new one is
  # ready, and for good if it never is, and a cold start pulls its image again.
  # `revision list` without --all returns active revisions only.
  IN_USE="$(
    az containerapp list -g "$RESOURCE_GROUP" \
      --query "[].properties.template.containers[].image | []" -o tsv 2>/dev/null &&
    az containerapp job list -g "$RESOURCE_GROUP" \
      --query "[].properties.template.containers[].image | []" -o tsv 2>/dev/null &&
    while read -r app; do
      [ -n "$app" ] || continue
      az containerapp revision list -n "$app" -g "$RESOURCE_GROUP" \
        --query "[].properties.template.containers[].image | []" -o tsv 2>/dev/null || exit 1
    done <<<"$apps"
  )" || return 1
  # An empty or partial answer would read as "nothing is running". This
  # deploy's own two images must be in it, or nothing is deleted.
  if ! referenced "$API_IMAGE" || ! referenced "$WEB_IMAGE"; then
    echo "  could not confirm which images are in use." >&2
    return 1
  fi

  # backup is built by scripts/azure-backup.sh rather than here, but the
  # scheduled job that references it is in this resource group, so it is
  # covered by IN_USE and prunes like the rest.
  for repo in api migrate web backup; do
    # A repository that does not exist yet is not an error: backup only
    # appears once scripts/azure-backup.sh has run, and until then every
    # deploy would otherwise warn that the registry was not pruned.
    az acr repository show -n "$ACR_NAME" --repository "$repo" -o none 2>/dev/null || continue
    # Into a variable first: a failed listing read straight from a process
    # substitution is indistinguishable from an empty repository, and the prune
    # would report success having checked nothing.
    manifests="$(az acr manifest list-metadata -r "$ACR_NAME" -n "$repo" \
      --orderby time_desc --only-show-errors -o tsv \
      --query "[].[digest, join(' ', tags || \`[]\`)]")" || return 1
    rank=0
    while IFS=$'\t' read -r digest tags; do
      [ -n "$digest" ] || continue
      keep=""
      if [ -n "$tags" ]; then
        rank=$((rank + 1))
        [ "$rank" -gt "$KEEP_IMAGES" ] || keep=1
      fi
      if referenced "${ACR_LOGIN}/${repo}@${digest}"; then keep=1; fi
      while read -r tag; do
        if [ -n "$tag" ] && referenced "${ACR_LOGIN}/${repo}:${tag}"; then keep=1; fi
      done <<<"${tags// /$'\n'}"
      [ -z "$keep" ] || continue
      echo "  delete ${repo}@${digest:0:19} ${tags:-(untagged)}"
      az acr repository delete -n "$ACR_NAME" --image "${repo}@${digest}" \
        --yes --output none || return 1
    done <<<"$manifests"
  done
}

step "Prune registry"
if ! prune_registry; then
  echo "  WARNING: registry not pruned. The deploy itself is complete." >&2
fi

step "Done"
cat <<EOF

  ${ENV_UPPER}, tag ${TAG}
  api  $API_URL
  web  $WEB_URL

  Manual step, once per new web URL: add ${NEW_WEB_FQDN} to
  Firebase console -> Authentication -> Settings -> Authorized domains.

EOF

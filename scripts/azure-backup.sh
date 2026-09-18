#!/usr/bin/env bash
# Install the nightly database backup: a Blob container with a 30-day
# lifecycle rule, and a scheduled Container Apps Job that dumps into it.
#
#   scripts/azure-backup.sh scripts/azure.stg.env            # staging
#   scripts/azure-backup.sh scripts/azure.env                # prod
#   scripts/azure-backup.sh scripts/azure.env --run-now      # and run it once
#
# Safe to re-run: the container and the rule are created only if missing, and
# the job is deleted and recreated, which is also how pb_app's password is
# rotated into it after scripts/azure-db-roles.sh resets it.
#
# WHY A SECOND JOB, NOT THE API IMAGE OR THE HOURLY CRON
# The database has no public endpoint and its hostname resolves only inside
# the VNet, so the dump has to run in snet-apps; and pg_dump has to come from
# the image, which rules out the api image. See docs/deploy-plan.md §9 and
# docs/decisions.md 2026-09-12.
#
# WHERE THE PARTS LIVE
#   scripts/backup/Dockerfile   postgres:16 plus curl and jq
#   scripts/backup/backup.sh    what the job runs, baked into that image
#   this script                 the container, the rule, the schedule
#
# Retention is the storage account's lifecycle rule, not code in the job:
# BACKUP_RETENTION_DAYS days after creation, the blob is deleted by Azure.
# Under $0.50/yr at 30 snapshots; see docs/azure-costs.md.
#
# Proving one of these dumps still loads is scripts/azure-backup-verify.sh.
# That script is a test and writes only a scratch database; recovering the
# live database is a psql by hand, see docs/architecture.md "Backups".
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-backup.sh <env-file> [--run-now]}"
RUN_NOW=""
case "${2:-}" in
  "") ;;
  --run-now) RUN_NOW=1 ;;
  *) echo "error: unknown argument '$2' — expected --run-now." >&2; exit 1 ;;
esac

# The env file holds cleartext passwords. Refuse to read it if anyone but the
# owner can. Same check as scripts/azure-provision.sh.
MODE="$(stat -f '%OLp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
if [ "${MODE: -2}" != "00" ]; then
  echo "error: $ENV_FILE is mode $MODE — it holds database passwords." >&2
  echo "       run: chmod 600 $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${ENVIRONMENT:?}" "${RESOURCE_GROUP:?}" "${ACR_NAME:?}" "${ACA_ENV:?}"
: "${ACR_PULL_IDENTITY:?}" "${STORAGE_ACCOUNT:?}" "${STORAGE_IDENTITY:?}"
: "${STORAGE_BACKUPS_CONTAINER:?}" "${STORAGE_PHOTOS_CONTAINER:?}"
: "${BACKUP_RETENTION_DAYS:?}" "${BACKUP_CRON:?}" "${BACKUP_JOB:?}"
: "${PG_SERVER:?}" "${PG_DB_NAME:?}" "${PG_APP_USER:?}" "${PG_APP_PASSWORD:?}"

case "$BACKUP_RETENTION_DAYS" in
  '' | *[!0-9]*) echo "error: BACKUP_RETENTION_DAYS must be a whole number." >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
exists() { [ -n "$("$@" 2>/dev/null)" ]; }

JOB="$BACKUP_JOB"
# The one rule this account's lifecycle policy is allowed to contain. Named so
# a policy written by something else is recognisable rather than overwritten.
RULE="expire-${STORAGE_BACKUPS_CONTAINER}"

# --- What this needs to already exist ----------------------------------
ACR_IDENTITY_ID="$(az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" \
  --query id -o tsv 2>/dev/null || true)"
STORAGE_IDENTITY_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
  --query id -o tsv 2>/dev/null || true)"
# The job carries both identities — one to pull the image, one to write the
# blob — so the client id says which of them backup.sh asks for a token with.
STORAGE_IDENTITY_CLIENT_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" \
  --query clientId -o tsv 2>/dev/null || true)"
if [ -z "$ACR_IDENTITY_ID" ] || [ -z "$STORAGE_IDENTITY_ID" ] || [ -z "$STORAGE_IDENTITY_CLIENT_ID" ]; then
  echo "error: '$ACR_PULL_IDENTITY' or '$STORAGE_IDENTITY' is missing from $RESOURCE_GROUP." >&2
  echo "       scripts/azure-provision.sh creates both." >&2
  exit 1
fi
PG_FQDN="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query fullyQualifiedDomainName -o tsv 2>/dev/null || true)"
if [ -z "$PG_FQDN" ]; then
  echo "error: no server '$PG_SERVER' in $RESOURCE_GROUP." >&2
  echo "       scripts/azure-provision.sh creates it." >&2
  exit 1
fi
ACR_LOGIN="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)"

# --- Confirm the target ------------------------------------------------
# Red for production, blue for anything else, matching the other scripts.
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
printf '%s   NIGHTLY BACKUP  ->  %-28s%s\n' "$BANNER" "$ENV_UPPER" "$RESET"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET"
cat <<CONFIRM
  Config file      $ENV_FILE
  Subscription     $(az account show --query name -o tsv)
  Resource group   $RESOURCE_GROUP
  Server           $PG_SERVER, database $PG_DB_NAME, as $PG_APP_USER
  Destination      $STORAGE_ACCOUNT / $STORAGE_BACKUPS_CONTAINER
  Retention        $BACKUP_RETENTION_DAYS days, by lifecycle rule $RULE
  Schedule         $BACKUP_CRON  (UTC — Container Apps cron has no timezone)
  Job              $JOB in $ACA_ENV

CONFIRM
printf '%sInstall the nightly backup on %s?%s [y/N] ' "$BOLD" "$ENV_UPPER" "$RESET"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing changed." >&2; exit 1 ;;
esac

# --- 1. The container --------------------------------------------------
# container-rm goes through the management API, so it needs no data role and
# works with shared-key auth off — the same reason step 7 of the provisioning
# script creates the photos container that way.
step "Container $STORAGE_BACKUPS_CONTAINER in $STORAGE_ACCOUNT"
if exists az storage container-rm show --storage-account "$STORAGE_ACCOUNT" \
     -g "$RESOURCE_GROUP" -n "$STORAGE_BACKUPS_CONTAINER" --query name -o tsv; then
  echo "  exists"
else
  az storage container-rm create --storage-account "$STORAGE_ACCOUNT" \
    --resource-group "$RESOURCE_GROUP" --name "$STORAGE_BACKUPS_CONTAINER" \
    --public-access off --output none
  echo "  created"
fi

# No role assignment here: $STORAGE_IDENTITY already holds Storage Blob Data
# Contributor on the whole account, granted once by the provisioning script,
# so it can write this container as it writes photos. A second identity would
# add a name to remember and no isolation — the grant it would need is at
# account scope either way, because that is where a user delegation key is
# issued. See docs/decisions.md 2026-09-18.

# --- 2. The lifecycle rule ---------------------------------------------
# Retention is Azure's job, not the backup script's: an account has exactly
# one lifecycle policy, evaluated once a day, and a delete costs nothing.
#
# `management-policy create` replaces the whole policy, so a policy holding
# anything other than this rule is left alone and reported instead.
step "Lifecycle rule $RULE — delete after $BACKUP_RETENTION_DAYS days"
EXISTING_RULES="$(az storage account management-policy show \
  --account-name "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" \
  --query "policy.rules[].name" -o tsv 2>/dev/null || true)"
UNKNOWN=""
while read -r NAME; do
  [ -n "$NAME" ] || continue
  [ "$NAME" = "$RULE" ] || UNKNOWN="${UNKNOWN}${NAME} "
done <<<"$EXISTING_RULES"
if [ -n "$UNKNOWN" ]; then
  echo "error: $STORAGE_ACCOUNT already has lifecycle rule(s): ${UNKNOWN%% }" >&2
  echo "       Writing this one would delete them. Merge them by hand:" >&2
  echo "       az storage account management-policy show --account-name $STORAGE_ACCOUNT -g $RESOURCE_GROUP" >&2
  exit 1
fi
POLICY_JSON="$(mktemp -t pb-backup-policy)"
trap 'rm -f "$POLICY_JSON"' EXIT
cat > "$POLICY_JSON" <<POLICYEOF
{
  "rules": [
    {
      "name": "${RULE}",
      "type": "Lifecycle",
      "enabled": true,
      "definition": {
        "filters": {
          "blobTypes": ["blockBlob"],
          "prefixMatch": ["${STORAGE_BACKUPS_CONTAINER}/"]
        },
        "actions": {
          "baseBlob": {
            "delete": { "daysAfterCreationGreaterThan": ${BACKUP_RETENTION_DAYS} }
          }
        }
      }
    }
  ]
}
POLICYEOF
# Creation, not modification: a dump is written once and never touched again,
# so the two are the same date here — but only the first is true by
# definition, and a rewritten blob should still expire on its own schedule.
az storage account management-policy create \
  --account-name "$STORAGE_ACCOUNT" -g "$RESOURCE_GROUP" \
  --policy "@${POLICY_JSON}" --output none
rm -f "$POLICY_JSON"; trap - EXIT
echo "  ${STORAGE_BACKUPS_CONTAINER}/* deleted $BACKUP_RETENTION_DAYS days after creation"
# Photos live in the same account and must not be caught by the prefix.
echo "  photos in $STORAGE_PHOTOS_CONTAINER are outside the prefix and unaffected"

# --- 3. The image ------------------------------------------------------
# Context is scripts/backup, not the repo root: the root context would upload
# scripts/azure.env — this file's own passwords — to the registry.
step "Build backup image"
TAG="$(git rev-parse --short HEAD)"
[ -z "$(git status --porcelain)" ] || TAG="${TAG}-dirty"
az acr build --registry "$ACR_NAME" \
  --image "backup:${TAG}" --image "backup:latest" \
  --file scripts/backup/Dockerfile scripts/backup
BACKUP_IMAGE="${ACR_LOGIN}/backup:${TAG}"

# --- 4. The scheduled job ----------------------------------------------
# Deleted and recreated rather than updated: `containerapp job update` cannot
# change every field here, and unlike the migration job this one is meant to
# outlive the script, so there is no secret left behind to worry about beyond
# pb_app's password — which the job needs in order to run at 03:00 unattended.
step "Job $JOB"
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true
az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" \
  --environment "$ACA_ENV" \
  --trigger-type Schedule --cron-expression "$BACKUP_CRON" \
  --replica-timeout 1800 --replica-retry-limit 1 \
  --replica-completion-count 1 --parallelism 1 \
  --image "$BACKUP_IMAGE" --container-name backup \
  --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
  --mi-user-assigned "$ACR_IDENTITY_ID" "$STORAGE_IDENTITY_ID" \
  --cpu 1.0 --memory 2.0Gi \
  --secrets "pgpassword=${PG_APP_PASSWORD}" \
  --env-vars \
    "PGHOST=${PG_FQDN}" \
    "PGUSER=${PG_APP_USER}" \
    "PGDATABASE=${PG_DB_NAME}" \
    "PGSSLMODE=require" \
    "PGPASSWORD=secretref:pgpassword" \
    "STORAGE_ACCOUNT=${STORAGE_ACCOUNT}" \
    "BACKUPS_CONTAINER=${STORAGE_BACKUPS_CONTAINER}" \
    "IDENTITY_CLIENT_ID=${STORAGE_IDENTITY_CLIENT_ID}" \
  --output none
echo "  $JOB on $BACKUP_CRON, image backup:${TAG}"

# --- 5. Run it once, if asked ------------------------------------------
if [ -n "$RUN_NOW" ]; then
  step "Run now"
  EXEC_NAME="$(az containerapp job start -n "$JOB" -g "$RESOURCE_GROUP" --query name -o tsv)"
  echo "  execution $EXEC_NAME"
  STATUS="Running"
  TRIES=0
  while [ "$STATUS" = "Running" ] || [ "$STATUS" = "Unknown" ] || [ -z "$STATUS" ]; do
    sleep 10
    TRIES=$((TRIES + 1))
    STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
      --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || true)"
    [ "$TRIES" -ge 90 ] && break
  done
  echo "  status: ${STATUS:-unknown}"

  step "Log"
  # Log Analytics ingests with a delay, and the logs command is in the preview
  # containerapp extension. Not load-bearing: the status above decided it.
  tries=0
  until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
          --container backup --execution "$EXEC_NAME" --tail 100 \
          --format text 2>/dev/null; do
    tries=$((tries + 1))
    [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal)"; break; }
    sleep 10
  done

  if [ "$STATUS" != "Succeeded" ]; then
    echo "error: the backup run did not succeed." >&2
    exit 1
  fi
fi

# Staging is stopped most of the year, so a schedule left behind there fails
# every night at 03:00 and teaches everyone to ignore the job's failures.
REHEARSAL_NOTE=""
case "$ENVIRONMENT" in
  prod | production) ;;
  *) REHEARSAL_NOTE="
  ${ENV_UPPER} is a rehearsal. Delete the job when done — the server is stopped
  most of the year and the schedule would fail every night:

    az containerapp job delete -n ${JOB} -g ${RESOURCE_GROUP} --yes
" ;;
esac

step "Done"
cat <<EOF

  ${ENV_UPPER} backs up nightly at ${BACKUP_CRON} UTC to
  ${STORAGE_ACCOUNT}/${STORAGE_BACKUPS_CONTAINER}, kept ${BACKUP_RETENTION_DAYS} days.

  Check a dump loads:  scripts/azure-backup-verify.sh ${ENV_FILE}   (test only)
  Run the backup now:  az containerapp job start -n ${JOB} -g ${RESOURCE_GROUP}

  Re-run this script after scripts/azure-db-roles.sh: that resets ${PG_APP_USER}'s
  password, and this job holds the old one as a secret until it is recreated.
${REHEARSAL_NOTE}
EOF

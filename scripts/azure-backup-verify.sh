#!/usr/bin/env bash
# Check that a nightly dump still loads: restore one into a scratch database
# and assert it is usable. This is the part of #159 that proves anything —
# scripting a dump proves only that a file was written.
#
# NOT A RECOVERY TOOL. It writes a scratch database and nothing else; the job
# refuses any target whose name does not end in _restore_test. Recovering the
# live database is a psql by hand from the jump VM, see docs/architecture.md
# "Backups".
#
#   scripts/azure-backup-verify.sh scripts/azure.stg.env
#   scripts/azure-backup-verify.sh scripts/azure.env peacebuddy-2026-09-18.sql.gz
#   scripts/azure-backup-verify.sh scripts/azure.env --keep
#
# With no blob name it takes the newest dump in the container. The scratch
# database is created on the same server, loaded, checked, and dropped —
# --keep leaves it for poking at, and it then costs storage until dropped by
# hand. The live database is never written to; the only thing this script
# creates on the server is $PG_DB_NAME-restore-test.
#
# WHY IT RUNS AS THE SERVER ADMIN
# pb_migrate can only create objects in $PG_DB_NAME, and pb_app can create
# nothing at all. A scratch database is a new database, so the role that fills
# it has to be one with rights there. The job is Manual, holds the admin
# password as a secret, and is deleted when the script exits — the same shape
# and the same reasoning as scripts/azure-db-roles.sh.
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-backup-verify.sh <env-file> [blob-name] [--keep]}"
BLOB=""
KEEP=""
shift
for ARG in "$@"; do
  case "$ARG" in
    --keep) KEEP=1 ;;
    -*) echo "error: unknown flag '$ARG'." >&2; exit 1 ;;
    *) BLOB="$ARG" ;;
  esac
done

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
: "${STORAGE_BACKUPS_CONTAINER:?}" "${BACKUP_JOB:?}"
: "${PG_SERVER:?}" "${PG_DB_NAME:?}" "${PG_ADMIN_USER:?}" "${PG_ADMIN_PASSWORD:?}"

# Interpolated into YAML and into psql environment variables. Rather than
# escape for two grammars, reject the characters that matter — the same check
# scripts/azure-db-roles.sh makes.
for VAR in PG_ADMIN_USER PG_ADMIN_PASSWORD PG_DB_NAME; do
  case "${!VAR}" in
    *\'* | *\"* | *\\* | *'`'* | *'$'*)
      echo "error: $VAR contains a quote, backslash, backtick or dollar sign." >&2
      exit 1 ;;
  esac
done
case "$BLOB" in
  '' | peacebuddy-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].sql.gz) ;;
  *) echo "error: '$BLOB' is not a dump name — peacebuddy-YYYY-MM-DD.sql.gz." >&2; exit 1 ;;
esac

cd "$(dirname "$0")/.."

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# Named after the nightly job, so prod's and staging's cannot collide in the
# shared Container Apps environment. Deleted when this script exits either way.
JOB="${BACKUP_JOB}-verify"
RESTORE_DB="${PG_DB_NAME}_restore_test"

# The list prisma/migrations holds right now, which is what `prisma migrate
# status` compares _prisma_migrations against.
MIGRATIONS_DIR="prisma/migrations"
MIGRATIONS=()
while IFS= read -r D; do MIGRATIONS+=("$(basename "$D")"); done \
  < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
[ "${#MIGRATIONS[@]}" -gt 0 ] || { echo "error: no migration directories in $MIGRATIONS_DIR." >&2; exit 1; }
EXPECTED_MIGRATIONS="$(printf '%s,' "${MIGRATIONS[@]}")"
EXPECTED_MIGRATIONS="${EXPECTED_MIGRATIONS%,}"

ACR_IDENTITY_ID="$(az identity show -n "$ACR_PULL_IDENTITY" -g "$RESOURCE_GROUP" --query id -o tsv)"
STORAGE_IDENTITY_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" --query id -o tsv)"
STORAGE_IDENTITY_CLIENT_ID="$(az identity show -n "$STORAGE_IDENTITY" -g "$RESOURCE_GROUP" --query clientId -o tsv)"
ACR_LOGIN="$(az acr show -n "$ACR_NAME" -g "$RESOURCE_GROUP" --query loginServer -o tsv)"
VERIFY_IMAGE="${ACR_LOGIN}/backup:latest"
PG_FQDN="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query fullyQualifiedDomainName -o tsv 2>/dev/null || true)"
[ -n "$PG_FQDN" ] || { echo "error: no server '$PG_SERVER' in $RESOURCE_GROUP." >&2; exit 1; }

# --- Confirm the target ------------------------------------------------
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
printf '%s   BACKUP VERIFY  ->  %-29s%s\n' "$BANNER" "$ENV_UPPER" "$RESET"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET"
cat <<CONFIRM
  Config file      $ENV_FILE
  Subscription     $(az account show --query name -o tsv)
  Server           $PG_SERVER
  Dump             ${BLOB:-the newest in $STORAGE_ACCOUNT/$STORAGE_BACKUPS_CONTAINER}
  Restored into    $RESTORE_DB   (created now, dropped at the end${KEEP:+ — but --keep was passed})
  Live database    $PG_DB_NAME   read only, for the table list

CONFIRM
printf '%sVerify a dump against %s?%s [y/N] ' "$BOLD" "$ENV_UPPER" "$RESET"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing changed." >&2; exit 1 ;;
esac

JOB_CREATED=""
DB_CREATED=""
EXEC_NAME=""
STARTED_SERVER=""

cleanup() {
  code=$?
  if [ -n "$EXEC_NAME" ]; then
    step "Log"
    tries=0
    until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
            --container verify --execution "$EXEC_NAME" --tail 200 \
            --format text 2>/dev/null; do
      tries=$((tries + 1))
      [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal)"; break; }
      sleep 10
    done
  fi
  if [ -n "$JOB_CREATED" ]; then
    step "Delete job $JOB"
    if ! az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null; then
      echo "  WARNING: could not delete $JOB. It holds the server admin password" >&2
      echo "  as a secret. Delete it by hand:" >&2
      echo "    az containerapp job delete -n $JOB -g $RESOURCE_GROUP --yes" >&2
    fi
  fi
  if [ -n "$DB_CREATED" ] && [ -z "$KEEP" ]; then
    step "Drop $RESTORE_DB"
    if ! az postgres flexible-server db delete -g "$RESOURCE_GROUP" -s "$PG_SERVER" \
         -n "$RESTORE_DB" --yes --output none 2>/dev/null; then
      echo "  WARNING: $RESTORE_DB is still on $PG_SERVER. Drop it by hand:" >&2
      echo "    az postgres flexible-server db delete -g $RESOURCE_GROUP -s $PG_SERVER -n $RESTORE_DB --yes" >&2
    fi
  elif [ -n "$DB_CREATED" ]; then
    printf '\n  %s is left on %s. Drop it when done:\n\n' "$RESTORE_DB" "$PG_SERVER"
    printf '    az postgres flexible-server db delete -g %s -s %s -n %s --yes\n\n' \
      "$RESOURCE_GROUP" "$PG_SERVER" "$RESTORE_DB"
  fi
  if [ -n "$STARTED_SERVER" ]; then
    printf '\n  This run started %s, which was stopped. Stop it again:\n\n' "$PG_SERVER"
    printf '    az postgres flexible-server stop -g %s -n %s\n\n' "$RESOURCE_GROUP" "$PG_SERVER"
  fi
  exit "$code"
}
trap cleanup EXIT

# --- 1. The server has to be running -----------------------------------
step "Server $PG_SERVER"
STATE="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query state -o tsv)"
echo "  state: $STATE"
if [ "$STATE" != "Ready" ]; then
  echo "  starting it — this takes a couple of minutes"
  az postgres flexible-server start -n "$PG_SERVER" -g "$RESOURCE_GROUP" --output none
  STARTED_SERVER=1
fi

# --- 2. The scratch database -------------------------------------------
# Through the management plane, so this needs no psql and no CREATEDB grant.
step "Database $RESTORE_DB"
if [ -n "$(az postgres flexible-server db show -g "$RESOURCE_GROUP" -s "$PG_SERVER" \
           -n "$RESTORE_DB" --query name -o tsv 2>/dev/null || true)" ]; then
  echo "error: $RESTORE_DB already exists on $PG_SERVER." >&2
  echo "       A previous run left it behind. Drop it, then re-run:" >&2
  echo "       az postgres flexible-server db delete -g $RESOURCE_GROUP -s $PG_SERVER -n $RESTORE_DB --yes" >&2
  exit 1
fi
az postgres flexible-server db create -g "$RESOURCE_GROUP" -s "$PG_SERVER" \
  -n "$RESTORE_DB" --output none
DB_CREATED=1
echo "  created"

# --- 3. The one-shot job -----------------------------------------------
step "Job $JOB in $ACA_ENV"
# Left over from an interrupted run, secret and all.
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true

# Two identities: one pulls the image, one reads the blob — so verify.sh is
# told which client id to ask for a token with. The image is the one the
# nightly job runs, tag latest, because a restore has to be proved against the
# code that wrote the dump rather than against a second implementation.
ENV_ARGS=(
  "PGHOST=${PG_FQDN}"
  "PGUSER=${PG_ADMIN_USER}"
  "PGDATABASE=${PG_DB_NAME}"
  "PGSSLMODE=require"
  "PGPASSWORD=secretref:pgpassword"
  "RESTORE_DB=${RESTORE_DB}"
  "STORAGE_ACCOUNT=${STORAGE_ACCOUNT}"
  "BACKUPS_CONTAINER=${STORAGE_BACKUPS_CONTAINER}"
  "IDENTITY_CLIENT_ID=${STORAGE_IDENTITY_CLIENT_ID}"
  "EXPECTED_MIGRATIONS=${EXPECTED_MIGRATIONS}"
)
# Only when named. An empty BLOB is not "no blob" to the CLI, and verify.sh
# treats unset as "take the newest".
[ -n "$BLOB" ] && ENV_ARGS+=("BLOB=${BLOB}")

az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" \
  --environment "$ACA_ENV" \
  --trigger-type Manual \
  --replica-timeout 1800 --replica-retry-limit 0 \
  --replica-completion-count 1 --parallelism 1 \
  --image "$VERIFY_IMAGE" --container-name verify \
  --command "/usr/local/bin/verify.sh" \
  --registry-server "$ACR_LOGIN" --registry-identity "$ACR_IDENTITY_ID" \
  --mi-user-assigned "$ACR_IDENTITY_ID" "$STORAGE_IDENTITY_ID" \
  --cpu 1.0 --memory 2.0Gi \
  --secrets "pgpassword=${PG_ADMIN_PASSWORD}" \
  --env-vars "${ENV_ARGS[@]}" \
  --output none
JOB_CREATED=1

# --- 4. Run it and wait ------------------------------------------------
step "Run"
EXEC_NAME="$(az containerapp job start -n "$JOB" -g "$RESOURCE_GROUP" --query name -o tsv)"
echo "  execution $EXEC_NAME"
STATUS="Running"
TRIES=0
while [ "$STATUS" = "Running" ] || [ "$STATUS" = "Unknown" ] || [ -z "$STATUS" ]; do
  sleep 10
  TRIES=$((TRIES + 1))
  STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
    --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || true)"
  [ "$TRIES" -ge 180 ] && break
done
echo "  status: ${STATUS:-unknown}"
if [ "$STATUS" != "Succeeded" ]; then
  echo "error: the restore did not succeed. The log follows." >&2
  exit 1
fi

step "Restored"
echo "  the dump loaded into $RESTORE_DB, holds the same tables as $PG_DB_NAME,"
echo "  and its migration history matches prisma/migrations."

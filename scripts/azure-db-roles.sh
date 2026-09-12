#!/usr/bin/env bash
# Create the restricted application roles on a provisioned Postgres server.
#
#   scripts/azure-db-roles.sh scripts/azure.env       # prod
#   scripts/azure-db-roles.sh scripts/azure.stg.env   # staging
#
# Run this once per server, immediately after scripts/azure-provision.sh, and
# before anything is deployed against it. The provisioning script can only
# print a DATABASE_URL built from the server admin account; this replaces it
# with two roles that cannot administer anything. See docs/decisions.md,
# "Two database roles per server".
#
# The SQL is scripts/azure-db-roles.sql and it is idempotent, so re-running is
# how a password is rotated. Re-run it after restoring a dump as well: a table
# restored under another owner is not covered by the default privileges, and
# section 4 of the SQL grants on whatever already exists.
#
# WHY A CONTAINER APPS JOB
# The server has no public endpoint and its hostname resolves only inside the
# VNet, so psql has to run in there. Nothing is deployed yet, so there is no
# app to exec into, and psql is not installed on the dev machine. A one-shot
# Manual job in the Container Apps environment is the only thing already
# sitting in the right subnet. The job is created, run, and deleted, because
# it holds all three passwords as secrets for as long as it exists.
#
# Costs nothing meaningful: a Consumption job for under a minute is inside the
# free monthly grant, and starting a stopped staging server is $0.026/hr.
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-db-roles.sh <env-file>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/azure-db-roles.sql"
[ -f "$SQL_FILE" ] || { echo "error: $SQL_FILE is missing." >&2; exit 1; }

# The env file holds three cleartext passwords. Refuse to read it if anyone
# but the owner can. Same check as scripts/azure-provision.sh.
MODE="$(stat -f '%OLp' "$ENV_FILE" 2>/dev/null || stat -c '%a' "$ENV_FILE")"
if [ "${MODE: -2}" != "00" ]; then
  echo "error: $ENV_FILE is mode $MODE — it holds database passwords." >&2
  echo "       run: chmod 600 $ENV_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

: "${RESOURCE_GROUP:?}" "${ACA_ENV:?}" "${ENVIRONMENT:?}"
: "${PG_SERVER:?}" "${PG_DB_NAME:?}" "${PG_ADMIN_USER:?}" "${PG_ADMIN_PASSWORD:?}"
: "${PG_MIGRATE_USER:?}" "${PG_MIGRATE_PASSWORD:?}"
: "${PG_APP_USER:?}" "${PG_APP_PASSWORD:?}"

# Every value below is interpolated into a psql \set line and into a YAML
# double-quoted scalar. Rather than escape for two grammars, reject the
# characters that matter. `openssl rand -base64 24` never emits any of them.
for VAR in PG_ADMIN_USER PG_ADMIN_PASSWORD PG_MIGRATE_USER PG_MIGRATE_PASSWORD \
           PG_APP_USER PG_APP_PASSWORD PG_DB_NAME; do
  case "${!VAR}" in
    *\'* | *\"* | *\\* | *'`'* | *'$'*)
      echo "error: $VAR contains a quote, backslash, backtick or dollar sign." >&2
      echo "       Regenerate it: openssl rand -base64 24" >&2
      exit 1 ;;
  esac
done
if [ "$PG_MIGRATE_USER" = "$PG_APP_USER" ]; then
  echo "error: PG_MIGRATE_USER and PG_APP_USER are the same role." >&2
  echo "       The whole point is that the api cannot run DDL." >&2
  exit 1
fi
for VAR in PG_MIGRATE_USER PG_APP_USER; do
  if [ "${!VAR}" = "$PG_ADMIN_USER" ]; then
    echo "error: $VAR is the server admin account." >&2
    exit 1
  fi
done

# --- Confirm the target ------------------------------------------------
# Red for production, blue for anything else, matching azure-provision.sh.
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
printf '%s   DATABASE ROLES  ->  %-28s%s\n' "$BANNER" "$ENV_UPPER" "$RESET"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET"
cat <<CONFIRM
  Config file      $ENV_FILE
  Subscription     $(az account show --query name -o tsv)
  Resource group   $RESOURCE_GROUP
  Server           $PG_SERVER
  Database         $PG_DB_NAME
  Migration role   $PG_MIGRATE_USER   owns the tables, runs migrate deploy
  Application role $PG_APP_USER   reads and writes rows, no DDL

  Existing roles of these names have their passwords reset to this file.

CONFIRM
printf '%sCreate roles on %s?%s [y/N] ' "$BOLD" "$ENV_UPPER" "$RESET"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing changed." >&2; exit 1 ;;
esac

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

JOB="caj-db-roles"
JOB_YAML=""
JOB_CREATED=""
EXEC_NAME=""
STARTED_SERVER=""

cleanup() {
  local code=$?
  [ -n "$JOB_YAML" ] && rm -f "$JOB_YAML"
  if [ -n "$EXEC_NAME" ]; then
    step "Job log"
    # The logs command lives in the containerapp extension, which is in
    # preview and may not be installed. Log Analytics also ingests with a
    # delay, so retry a few times. Neither is load-bearing: psql's exit code
    # already decided the execution status, which is what the script trusts.
    local tries=0
    until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
            --container psql --execution "$EXEC_NAME" --tail 100 \
            --format text 2>/dev/null; do
      tries=$((tries + 1))
      [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal, or the Log Analytics workspace)"; break; }
      sleep 10
    done
  fi
  if [ -n "$JOB_CREATED" ]; then
    step "Delete job $JOB"
    if ! az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null; then
      echo "  WARNING: could not delete $JOB. It stores all three passwords as" >&2
      echo "  secrets. Delete it by hand:" >&2
      echo "    az containerapp job delete -n $JOB -g $RESOURCE_GROUP --yes" >&2
    fi
  fi
  # Printed here rather than only in the success summary. A failed run is
  # exactly when the reminder is easiest to lose, and a staging server left
  # running is the one mistake this environment actually bills for.
  if [ -n "$STARTED_SERVER" ]; then
    printf '\n  This run started %s, which was stopped. Stop it again:\n\n' "$PG_SERVER"
    printf '    az postgres flexible-server stop -g %s -n %s\n\n' "$RESOURCE_GROUP" "$PG_SERVER"
  fi
  exit "$code"
}
trap cleanup EXIT

# --- 1. The server has to exist and be running -------------------------
step "Server $PG_SERVER"
STATE="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query state -o tsv 2>/dev/null || true)"
if [ -z "$STATE" ]; then
  echo "error: $PG_SERVER does not exist in $RESOURCE_GROUP." >&2
  echo "       Provision it first: scripts/azure-provision.sh $ENV_FILE" >&2
  exit 1
fi
echo "  state: $STATE"
if [ "$STATE" != "Ready" ]; then
  echo "  starting it — this takes a couple of minutes"
  az postgres flexible-server start -n "$PG_SERVER" -g "$RESOURCE_GROUP" --output none
  STARTED_SERVER=1
fi

# Ask the server for its hostname rather than building one from PG_SERVER and
# DNS_ZONE. Those two do not compose into anything that resolves: Azure names
# the A record in the private zone with a generated token, not the server
# name, and publishes <server>.postgres.database.azure.com as a public CNAME
# onto it. That CNAME is what fullyQualifiedDomainName returns, and it answers
# only inside the linked VNet. Constructing the name instead of reading it is
# what made the first run fail with "Name or service not known".
PG_FQDN="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query fullyQualifiedDomainName -o tsv)"
[ -n "$PG_FQDN" ] || { echo "error: $PG_SERVER reports no FQDN." >&2; exit 1; }
echo "  host:  $PG_FQDN"

# --- 2. Build the payload ----------------------------------------------
# The \set lines are generated here rather than kept in the .sql file, so the
# file holds no credentials and reviews cleanly. Base64 so that a multi-line
# value never has to survive az's key=value argument parsing, and so the YAML
# scalar below stays a single safe token.
step "Build SQL payload"
SET_LINES=$(cat <<SETEOF
\set db_name '${PG_DB_NAME}'
\set admin_user '${PG_ADMIN_USER}'
\set migrate_user '${PG_MIGRATE_USER}'
\set migrate_password '${PG_MIGRATE_PASSWORD}'
\set app_user '${PG_APP_USER}'
\set app_password '${PG_APP_PASSWORD}'
SETEOF
)
SQL_B64="$(printf '%s\n%s' "$SET_LINES" "$(cat "$SQL_FILE")" | base64 | tr -d '\n')"
echo "  $(printf '%s' "$SQL_B64" | wc -c | tr -d ' ') bytes, base64"

# --- 3. Create the one-shot job ----------------------------------------
# Written as YAML rather than flags: the container argv contains spaces and
# quotes, and --args is documented as space-separated, which leaves how it
# splits ambiguous. YAML has one reading.
step "Job $JOB in $ACA_ENV"
ENV_ID="$(az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" --query id -o tsv)"
LOCATION_ACTUAL="$(az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" --query location -o tsv)"

# Left over from an interrupted run, secrets and all.
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true

JOB_YAML="$(mktemp -t pb-db-roles)"
chmod 600 "$JOB_YAML"
cat > "$JOB_YAML" <<YAMLEOF
location: "${LOCATION_ACTUAL}"
properties:
  environmentId: "${ENV_ID}"
  configuration:
    triggerType: Manual
    replicaTimeout: 600
    replicaRetryLimit: 0
    manualTriggerConfig:
      parallelism: 1
      replicaCompletionCount: 1
    secrets:
      - name: pgpassword
        value: "${PG_ADMIN_PASSWORD}"
      - name: setup-sql
        value: "${SQL_B64}"
  template:
    containers:
      - name: psql
        image: docker.io/library/postgres:16
        command:
          - /bin/sh
        args:
          - -c
          - printf %s "\$SETUP_SQL" | base64 -d | psql -v ON_ERROR_STOP=1 -f -
        env:
          - name: PGHOST
            value: "${PG_FQDN}"
          - name: PGUSER
            value: "${PG_ADMIN_USER}"
          - name: PGDATABASE
            value: "${PG_DB_NAME}"
          - name: PGSSLMODE
            value: "require"
          - name: PGPASSWORD
            secretRef: pgpassword
          - name: SETUP_SQL
            secretRef: setup-sql
        resources:
          cpu: 0.5
          memory: 1.0Gi
YAMLEOF

az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" --yaml "$JOB_YAML" --output none
JOB_CREATED=1
rm -f "$JOB_YAML"; JOB_YAML=""

# --- 4. Run it and wait ------------------------------------------------
# psql runs with ON_ERROR_STOP, and the SQL's own assertions raise rather than
# report, so a non-zero exit is the whole verdict. Nothing else is inspected.
step "Run"
EXEC_NAME="$(az containerapp job start -n "$JOB" -g "$RESOURCE_GROUP" --query name -o tsv)"
echo "  execution $EXEC_NAME"
STATUS="Running"
TRIES=0
while [ "$STATUS" = "Running" ] || [ "$STATUS" = "Unknown" ] || [ -z "$STATUS" ]; do
  sleep 10
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -gt 60 ]; then
    echo "error: still running after 10 minutes. Check the portal." >&2
    exit 1
  fi
  STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
    --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || echo Unknown)"
  echo "  $STATUS"
done

if [ "$STATUS" != "Succeeded" ]; then
  echo "error: execution $STATUS. The log below says why; nothing was left half-applied," >&2
  echo "       because the SQL runs with ON_ERROR_STOP and re-running is safe." >&2
  exit 1
fi

# --- 5. Done -----------------------------------------------------------
step "Done"
cat <<SUMMARY

  Roles created on $PG_SERVER / $PG_DB_NAME.

  DATABASE_URL for the api. This is the one that goes in the deploy config.
  It cannot create, alter or drop anything:

    postgresql://$PG_APP_USER:<PG_APP_PASSWORD>@$PG_FQDN:5432/$PG_DB_NAME?sslmode=require

  Connection string for \`prisma migrate deploy\` only. It owns the tables, and
  every migration must run as this role, or the api loses access to the tables
  the migration creates:

    postgresql://$PG_MIGRATE_USER:<PG_MIGRATE_PASSWORD>@$PG_FQDN:5432/$PG_DB_NAME?sslmode=require

  Both passwords are in $ENV_FILE. Neither hostname resolves outside the VNet.
  The admin account is now needed only to rotate these two roles.

SUMMARY

# The stop reminder is printed by cleanup(), on success and on failure alike.

#!/usr/bin/env bash
# Copy a database into a provisioned Azure Postgres server from another server.
#
#   scripts/azure-db-restore.sh scripts/azure.stg.env deploy.env
#
# Written for one job: moving staging's data off Neon into Azure (#153). The
# source is any reachable Postgres — the second file is read only for its
# DATABASE_URL. See docs/deploy-plan.md §6.
#
# WHAT IT DOES
# One `pg_dump | psql` through a pipe, inside a one-shot Container Apps job.
# Nothing lands on disk, here or there. The job then compares per-table row
# counts on both ends, asserts the restored `_prisma_migrations` matches
# `prisma/migrations/`, and asserts the application role can read and write
# every restored table. Any of those failing fails the job.
#
# WHY A CONTAINER APPS JOB
# Same reason as scripts/azure-db-roles.sh: the target server has no public
# endpoint and its hostname resolves only inside the VNet, psql is not
# installed on the dev machine, and nothing is deployed yet to exec into. The
# job is created, run, and deleted, because it holds both connection strings
# as secrets for as long as it exists.
#
# WHY IT CONNECTS AS THE MIGRATION ROLE
# Tables arrive owned by whoever loads them. Loading as PG_MIGRATE_USER is the
# ownership `prisma migrate deploy` needs anyway, and it puts the restored
# tables under the default privileges azure-db-roles.sh granted for that role,
# so PG_APP_USER needs no catch-up grant. The job proves that rather than
# trusting it. Load as anyone else and azure-db-roles.sh has to be re-run.
#
# WHY postgres:18 AND NOT postgres:16
# Neon runs Postgres 18 and the Azure server is 16. pg_dump refuses to read a
# server newer than itself, so the client has to be the newer one. Dumping 18
# for a 16 target is not a supported direction, and two lines of the output
# are the whole of what 16 rejects — both are filtered in the pipe, and both
# are named at the filter.
set -euo pipefail

ENV_FILE="${1:?usage: scripts/azure-db-restore.sh <azure-env-file> <source-env-file> [--reset]}"
SRC_FILE="${2:?usage: scripts/azure-db-restore.sh <azure-env-file> <source-env-file> [--reset]}"
RESET=""
[ "${3:-}" = "--reset" ] && RESET=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/prisma/migrations"
[ -d "$MIGRATIONS_DIR" ] || { echo "error: $MIGRATIONS_DIR is missing." >&2; exit 1; }

# Both files hold cleartext credentials. Refuse to read either if anyone but
# the owner can. Same check as scripts/azure-provision.sh.
for F in "$ENV_FILE" "$SRC_FILE"; do
  MODE="$(stat -f '%OLp' "$F" 2>/dev/null || stat -c '%a' "$F")"
  if [ "${MODE: -2}" != "00" ]; then
    echo "error: $F is mode $MODE — it holds database credentials." >&2
    echo "       run: chmod 600 $F" >&2
    exit 1
  fi
done

# shellcheck disable=SC1090
source "$ENV_FILE"
: "${RESOURCE_GROUP:?}" "${ACA_ENV:?}" "${ENVIRONMENT:?}"
: "${PG_SERVER:?}" "${PG_DB_NAME:?}"
: "${PG_MIGRATE_USER:?}" "${PG_MIGRATE_PASSWORD:?}" "${PG_APP_USER:?}"

# shellcheck disable=SC1090
# The source file is a deploy config, not an Azure one — read it in a subshell
# so its DATABASE_URL is the only thing that crosses over and nothing else in
# it can shadow a variable above.
SRC_URL="$(set -a; . "$SRC_FILE"; set +a; printf '%s' "${DATABASE_URL:-}")"
[ -n "$SRC_URL" ] || { echo "error: $SRC_FILE defines no DATABASE_URL." >&2; exit 1; }
# Prisma accepts connection_limit, schema and pgbouncer in the query string.
# libpq rejects every one of them: "invalid URI query parameter". Drop the
# query string and ask for TLS explicitly, which is what all three of Neon,
# Azure and a local server want anyway.
SRC_URL="${SRC_URL%%\?*}?sslmode=require"
case "$SRC_URL" in
  postgres://* | postgresql://*) ;;
  *) echo "error: DATABASE_URL in $SRC_FILE is not a postgres:// URL." >&2; exit 1 ;;
esac
SRC_HOST="${SRC_URL#*@}"; SRC_HOST="${SRC_HOST%%[:/]*}"

# Interpolated into a psql \set line and into a YAML double-quoted scalar, so
# the same character class azure-db-roles.sh rejects is rejected here.
for VAR in PG_MIGRATE_USER PG_MIGRATE_PASSWORD PG_APP_USER PG_DB_NAME; do
  case "${!VAR}" in
    *\'* | *\"* | *\\* | *'`'* | *'$'*)
      echo "error: $VAR contains a quote, backslash, backtick or dollar sign." >&2
      echo "       Regenerate it: openssl rand -base64 24" >&2
      exit 1 ;;
  esac
done

# --reset drops what is already there. Staging data still exists in the source
# at this point, which is what makes that proportionate; production data does
# not have a second copy standing by.
if [ -n "$RESET" ]; then
  case "$ENVIRONMENT" in
    prod | production)
      echo "error: --reset is refused against $ENVIRONMENT." >&2
      exit 1 ;;
  esac
fi

# The expected migration list is the directory listing, which is the same
# thing `prisma migrate status` compares the table against.
MIGRATIONS=()
while IFS= read -r D; do MIGRATIONS+=("$(basename "$D")"); done < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
[ "${#MIGRATIONS[@]}" -gt 0 ] || { echo "error: no migration directories in $MIGRATIONS_DIR." >&2; exit 1; }
MIGRATIONS_SQL_ARRAY="$(printf "'%s'," "${MIGRATIONS[@]}")"; MIGRATIONS_SQL_ARRAY="${MIGRATIONS_SQL_ARRAY%,}"

# --- Confirm the target ------------------------------------------------
# Red for production, blue for anything else, matching azure-provision.sh.
if [ -t 1 ]; then
  case "$ENVIRONMENT" in
    prod | production) BANNER=$'\033[1;97;41m' ;;
    *) BANNER=$'\033[1;97;44m' ;;
  esac
  BOLD=$'\033[1m'; RESET_C=$'\033[0m'
else
  BANNER=""; BOLD=""; RESET_C=""
fi
ENV_UPPER="$(printf '%s' "$ENVIRONMENT" | tr '[:lower:]' '[:upper:]')"

printf '\n%s                                                  %s\n' "$BANNER" "$RESET_C"
printf '%s   DATABASE RESTORE  ->  %-26s%s\n' "$BANNER" "$ENV_UPPER" "$RESET_C"
printf '%s                                                  %s\n\n' "$BANNER" "$RESET_C"
cat <<CONFIRM
  Azure config     $ENV_FILE
  Source config    $SRC_FILE
  Subscription     $(az account show --query name -o tsv)
  Resource group   $RESOURCE_GROUP

  FROM             $SRC_HOST
  TO               $PG_SERVER / $PG_DB_NAME
  Loaded as        $PG_MIGRATE_USER   owns the restored tables
  Checked for      $PG_APP_USER   must be able to read and write them
  Expecting        ${#MIGRATIONS[@]} migrations: ${MIGRATIONS[*]}

CONFIRM
if [ -n "$RESET" ]; then
  cat <<'RESETWARN'
  --reset: every table, sequence and enum in schema public on the TARGET is
  dropped before the load. The source is not touched.

RESETWARN
else
  echo "  The target must have no tables in schema public. --reset drops them."
  echo
fi
printf '%sRestore into %s?%s [y/N] ' "$BOLD" "$ENV_UPPER" "$RESET_C"
read -r REPLY
case "$REPLY" in
  y | Y | yes | YES) ;;
  *) echo "aborted, nothing changed." >&2; exit 1 ;;
esac

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

JOB="caj-db-restore"
JOB_YAML=""
JOB_CREATED=""
EXEC_NAME=""
STARTED_SERVER=""

cleanup() {
  local code=$?
  [ -n "$JOB_YAML" ] && rm -f "$JOB_YAML"
  if [ -n "$EXEC_NAME" ]; then
    step "Job log"
    # Same caveat as azure-db-roles.sh: the logs command is a preview
    # extension and Log Analytics ingests with a delay. The exit code already
    # decided the verdict; this is only how you read what happened.
    local tries=0
    until az containerapp job logs show -n "$JOB" -g "$RESOURCE_GROUP" \
            --container pg --execution "$EXEC_NAME" --tail 200 \
            --format text 2>/dev/null; do
      tries=$((tries + 1))
      [ "$tries" -ge 3 ] && { echo "  (no log yet; see the portal, or the Log Analytics workspace)"; break; }
      sleep 10
    done
  fi
  if [ -n "$JOB_CREATED" ]; then
    step "Delete job $JOB"
    if ! az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null; then
      echo "  WARNING: could not delete $JOB. It stores both connection strings" >&2
      echo "  as secrets. Delete it by hand:" >&2
      echo "    az containerapp job delete -n $JOB -g $RESOURCE_GROUP --yes" >&2
    fi
  fi
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

# Read the hostname rather than composing one from PG_SERVER and DNS_ZONE —
# see the comment in azure-db-roles.sh for why those two do not compose.
PG_FQDN="$(az postgres flexible-server show -n "$PG_SERVER" -g "$RESOURCE_GROUP" \
  --query fullyQualifiedDomainName -o tsv)"
[ -n "$PG_FQDN" ] || { echo "error: $PG_SERVER reports no FQDN." >&2; exit 1; }
echo "  host:  $PG_FQDN"

# --- 2. Build the payload ----------------------------------------------
# The whole job is one bash script, base64'd into a secret. Base64 so that
# neither the quoting nor the newlines have to survive a YAML scalar, same as
# azure-db-roles.sh does with its SQL.
step "Build job payload"
JOB_SH="$(cat <<JOBEOF
set -euo pipefail
set -o pipefail

# PG* in the environment addresses the TARGET. The source is a URL, and the
# PG* variables would otherwise supply its password and sslmode, so every
# source command drops them.
src() { env -u PGHOST -u PGUSER -u PGPASSWORD -u PGDATABASE -u PGSSLMODE "\$@"; }

# Exact per-table counts on both ends, not n_live_tup, which is an estimate
# and is zero on a freshly loaded table until autovacuum has been round.
COUNT_SQL="
SELECT table_name || ' ' || (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', table_name),
                      false, true, '')))[1]::text::bigint
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
 ORDER BY table_name;"

echo "== source \$SRC_HOST"
src psql "\$SRC_URL" -Atc "select 'server ' || current_setting('server_version')"

echo
echo "== target \$PGHOST"
psql -Atc "select 'server ' || current_setting('server_version') || ', as ' || current_user"
EXISTING="\$(psql -Atc "select count(*) from pg_tables where schemaname = 'public'")"
echo "tables in public: \$EXISTING"

if [ "\$EXISTING" != "0" ]; then
  if [ "\${DO_RESET:-}" != "1" ]; then
    echo "error: target is not empty. Re-run with --reset to drop what is there." >&2
    exit 1
  fi
  echo
  echo "== reset"
  # Enums as well as tables: Prisma's schema is half enum types, and a
  # leftover type fails the load just as a leftover table does. Owned by this
  # role, which is the only thing it is allowed to drop.
  psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
  END LOOP;
  FOR r IN SELECT t.typname FROM pg_type t
             JOIN pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public' AND t.typtype = 'e' LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
  END LOOP;
END \$\$;
SQL
  echo "dropped, \$(psql -Atc "select count(*) from pg_tables where schemaname = 'public'") tables left"
fi

echo
echo "== dump | load"
# The two filtered lines are the whole of what a Postgres 18 dump emits that
# a 16 server rejects:
#   SET transaction_timeout   a GUC that does not exist before 17
#   CREATE SCHEMA public      already there, and owned by the server admin
# --no-owner and --no-acl drop the source's roles, which do not exist here;
# the objects land owned by whoever is connected, which is the point.
src pg_dump "\$SRC_URL" --no-owner --no-acl --schema=public \\
  | grep -vE '^SET transaction_timeout|^CREATE SCHEMA public;|^COMMENT ON SCHEMA public' \\
  | psql -v ON_ERROR_STOP=1 -q -o /dev/null -f -
echo "loaded"

echo
echo "== row counts"
src psql "\$SRC_URL" -At -c "\$COUNT_SQL" > /tmp/src.txt
psql -At -c "\$COUNT_SQL" > /tmp/tgt.txt
if ! diff -u --label source /tmp/src.txt --label target /tmp/tgt.txt; then
  echo "error: the two ends do not agree. Nothing was removed from the source." >&2
  exit 1
fi
cat /tmp/tgt.txt
echo "\$(wc -l < /tmp/tgt.txt) tables agree"

echo
echo "== migration history"
# What \`prisma migrate deploy\` would refuse to run against, asserted here
# instead: a directory with no row is pending, a row with no directory is
# drift, and an unfinished or rolled back row is a failed migration.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO \$\$
DECLARE
  expected text[] := ARRAY[${MIGRATIONS_SQL_ARRAY}];
  bad text;
BEGIN
  SELECT string_agg(e, ', ') INTO bad FROM unnest(expected) e
   WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations m WHERE m.migration_name = e);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'pending — in prisma/migrations but not applied here: %', bad;
  END IF;

  SELECT string_agg(m.migration_name, ', ') INTO bad FROM _prisma_migrations m
   WHERE NOT (m.migration_name = ANY (expected));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'drift — applied here but not in prisma/migrations: %', bad;
  END IF;

  SELECT string_agg(m.migration_name, ', ') INTO bad FROM _prisma_migrations m
   WHERE m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'not cleanly applied: %', bad;
  END IF;
END \$\$;
SQL
psql -At -c "select migration_name || '  applied ' || to_char(finished_at, 'YYYY-MM-DD') from _prisma_migrations order by started_at"
echo "history matches prisma/migrations, nothing pending"

echo
echo "== ${PG_APP_USER} privileges"
# The restored tables were created by this role, so the default privileges
# azure-db-roles.sh set for it should already cover them and azure-db-roles.sh
# should not need re-running. Asserted, not assumed — load as any other role
# and this is what fails.
psql -v ON_ERROR_STOP=1 -q <<'SQL'
DO \$\$
DECLARE bad text;
BEGIN
  -- MATERIALIZED is load-bearing: without the fence the planner is free to
  -- evaluate has_table_privilege() before the schema filter, and it then
  -- errors on a catalog table that has no public.* counterpart.
  WITH t AS MATERIALIZED (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  SELECT string_agg(tablename, ', ') INTO bad FROM t
   WHERE NOT (has_table_privilege('${PG_APP_USER}', format('public.%I', tablename), 'SELECT')
          AND has_table_privilege('${PG_APP_USER}', format('public.%I', tablename), 'INSERT')
          AND has_table_privilege('${PG_APP_USER}', format('public.%I', tablename), 'UPDATE')
          AND has_table_privilege('${PG_APP_USER}', format('public.%I', tablename), 'DELETE'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '${PG_APP_USER} cannot read or write: % — re-run scripts/azure-db-roles.sh', bad;
  END IF;

  WITH s AS MATERIALIZED (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public')
  SELECT string_agg(sequencename, ', ') INTO bad FROM s
   WHERE NOT has_sequence_privilege('${PG_APP_USER}', format('public.%I', sequencename), 'SELECT,USAGE');
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION '${PG_APP_USER} cannot use sequences: % — re-run scripts/azure-db-roles.sh', bad;
  END IF;
END \$\$;
SQL
echo "${PG_APP_USER} can read and write every restored table"

echo
echo "== done"
JOBEOF
)"
JOB_SH_B64="$(printf '%s' "$JOB_SH" | base64 | tr -d '\n')"
echo "  $(printf '%s' "$JOB_SH_B64" | wc -c | tr -d ' ') bytes, base64"

# --- 3. Create the one-shot job ----------------------------------------
step "Job $JOB in $ACA_ENV"
ENV_ID="$(az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" --query id -o tsv)"
LOCATION_ACTUAL="$(az containerapp env show -n "$ACA_ENV" -g "$RESOURCE_GROUP" --query location -o tsv)"

# Left over from an interrupted run, secrets and all.
az containerapp job delete -n "$JOB" -g "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true

JOB_YAML="$(mktemp -t pb-db-restore)"
chmod 600 "$JOB_YAML"
cat > "$JOB_YAML" <<YAMLEOF
location: "${LOCATION_ACTUAL}"
properties:
  environmentId: "${ENV_ID}"
  configuration:
    triggerType: Manual
    replicaTimeout: 1800
    replicaRetryLimit: 0
    manualTriggerConfig:
      parallelism: 1
      replicaCompletionCount: 1
    secrets:
      - name: pgpassword
        value: "${PG_MIGRATE_PASSWORD}"
      - name: src-url
        value: "${SRC_URL}"
      - name: job-sh
        value: "${JOB_SH_B64}"
  template:
    containers:
      - name: pg
        image: docker.io/library/postgres:18
        command:
          - /bin/bash
        args:
          - -c
          - printf %s "\$JOB_SH" | base64 -d | bash
        env:
          - name: PGHOST
            value: "${PG_FQDN}"
          - name: PGUSER
            value: "${PG_MIGRATE_USER}"
          - name: PGDATABASE
            value: "${PG_DB_NAME}"
          - name: PGSSLMODE
            value: "require"
          - name: PGPASSWORD
            secretRef: pgpassword
          - name: SRC_URL
            secretRef: src-url
          - name: SRC_HOST
            value: "${SRC_HOST}"
          - name: DO_RESET
            value: "${RESET:-0}"
          - name: JOB_SH
            secretRef: job-sh
        resources:
          cpu: 1.0
          memory: 2.0Gi
YAMLEOF

az containerapp job create -n "$JOB" -g "$RESOURCE_GROUP" --yaml "$JOB_YAML" --output none
JOB_CREATED=1
rm -f "$JOB_YAML"; JOB_YAML=""

# --- 4. Run it and wait ------------------------------------------------
step "Run"
EXEC_NAME="$(az containerapp job start -n "$JOB" -g "$RESOURCE_GROUP" --query name -o tsv)"
echo "  execution $EXEC_NAME"
STATUS="Running"
TRIES=0
while [ "$STATUS" = "Running" ] || [ "$STATUS" = "Unknown" ] || [ -z "$STATUS" ]; do
  sleep 10
  TRIES=$((TRIES + 1))
  if [ "$TRIES" -gt 180 ]; then
    echo "error: still running after 30 minutes. Check the portal." >&2
    exit 1
  fi
  STATUS="$(az containerapp job execution show -n "$JOB" -g "$RESOURCE_GROUP" \
    --job-execution-name "$EXEC_NAME" --query properties.status -o tsv 2>/dev/null || echo Unknown)"
  echo "  $STATUS"
done

if [ "$STATUS" != "Succeeded" ]; then
  echo "error: execution $STATUS. The log below says why. The source database was" >&2
  echo "       only read from, so it is untouched either way; re-run with --reset" >&2
  echo "       once the cause is fixed." >&2
  exit 1
fi

# --- 5. Done -----------------------------------------------------------
step "Done"
cat <<SUMMARY

  $PG_DB_NAME on $PG_SERVER now holds $SRC_HOST's data.

  Row counts matched on every table, the migration history matches
  prisma/migrations with nothing pending, and $PG_APP_USER can read and write
  every restored table. There is nothing left to run against the database.

  The source was only read. Keep it until the new server is trusted.

SUMMARY

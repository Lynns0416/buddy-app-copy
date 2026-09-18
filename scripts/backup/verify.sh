#!/usr/bin/env bash
# Proves a stored dump still loads. This is a test, not a recovery tool: it
# only ever writes a scratch database, and it refuses any target whose name
# does not end in _restore_test. Recovering the live database is a psql by
# hand from the jump VM — see docs/architecture.md "Backups".
#
# Baked into the same image as backup.sh and run by
# scripts/azure-backup-verify.sh as a one-shot job, against a scratch database
# that script creates and drops.
#
# It downloads a dump blob with the same managed identity that wrote it, loads
# it, and then asserts the three things that decide whether the backup is
# worth anything:
#   - the load itself raised no error          (ON_ERROR_STOP)
#   - the restored schema holds the same tables as the live database
#   - _prisma_migrations matches prisma/migrations, so `migrate deploy` would
#     run against the restored database rather than refuse
# Row counts are printed against the live database but not asserted: the live
# one has moved on since the dump was taken, and a difference there is the
# backup being a day old, not the backup being broken.
set -euo pipefail

: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}" "${RESTORE_DB:?}"
: "${STORAGE_ACCOUNT:?}" "${BACKUPS_CONTAINER:?}" "${IDENTITY_CLIENT_ID:?}"
: "${EXPECTED_MIGRATIONS:?}"
: "${IDENTITY_ENDPOINT:?identity endpoint missing — is a user-assigned identity attached?}"
: "${IDENTITY_HEADER:?identity header missing — is a user-assigned identity attached?}"

BLOB_API_VERSION=2021-12-02

# The account's blob endpoint. Overridable only so that this script and
# verify.sh can be exercised end to end against a local stub before they are
# pointed at Azure — the api has the same seam for Azurite (docker-compose.yml,
# STORAGE_CONNECTION_STRING). Nothing sets it in the job.
BLOB_ENDPOINT="${BLOB_ENDPOINT:-https://${STORAGE_ACCOUNT}.blob.core.windows.net}"
BASE="${BLOB_ENDPOINT}/${BACKUPS_CONTAINER}"

echo "== token"
TOKEN="$(curl -sS --fail-with-body --retry 3 --retry-delay 5 \
  -H "X-IDENTITY-HEADER: ${IDENTITY_HEADER}" \
  "${IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=https%3A%2F%2Fstorage.azure.com%2F&client_id=${IDENTITY_CLIENT_ID}" \
  | jq -re '.access_token')"

auth=(-H "Authorization: Bearer ${TOKEN}" -H "x-ms-version: ${BLOB_API_VERSION}")

echo
echo "== choose a dump"
if [ -n "${BLOB:-}" ]; then
  echo "  named: ${BLOB}"
else
  # List Blobs returns XML, and the image has no XML parser. The names are
  # peacebuddy-YYYY-MM-DD.sql.gz, so lexical order is date order and the last
  # one is the newest — which is the dump anyone restoring in anger wants.
  BLOB="$(curl -sS --fail-with-body "${BASE}?restype=container&comp=list&prefix=peacebuddy-" "${auth[@]}" \
    | tr '<' '\n' | sed -n 's|^Name>||p' | sort | tail -n 1)"
  [ -n "$BLOB" ] || { echo "error: no peacebuddy-*.sql.gz in ${BACKUPS_CONTAINER}." >&2; exit 1; }
  echo "  newest: ${BLOB}"
fi

echo
echo "== download"
curl -sS --fail-with-body "${BASE}/${BLOB}" "${auth[@]}" -o /tmp/dump.sql.gz
gzip -t /tmp/dump.sql.gz
gzip -dc /tmp/dump.sql.gz > /tmp/dump.sql
echo "  $(wc -c < /tmp/dump.sql.gz) bytes gzipped, $(wc -c < /tmp/dump.sql) raw"
if ! tail -n 5 /tmp/dump.sql | grep -q 'PostgreSQL database dump complete'; then
  echo "error: the stored dump is truncated — it has no completion marker." >&2
  exit 1
fi

echo
echo "== load into ${RESTORE_DB}"
# A dump taken with --schema=public carries CREATE SCHEMA public, and a new
# database already has one — so the load stops on "schema public already
# exists" unless something gives. azure-db-restore.sh solved the same problem
# by filtering those lines out of the stream; here the schema is dropped
# instead, because the dump then loads exactly as stored. A backup you have to
# edit before it will load is a backup with a step nobody remembers at 3am.
#
# Guarded twice over: this must be a scratch database, never the live one.
if [ "$RESTORE_DB" = "$PGDATABASE" ]; then
  echo "error: RESTORE_DB is the live database ${PGDATABASE}." >&2
  exit 1
fi
case "$RESTORE_DB" in
  *_restore_test) ;;
  *) echo "error: RESTORE_DB '${RESTORE_DB}' is not a *_restore_test database." >&2; exit 1 ;;
esac
PGDATABASE="$RESTORE_DB" psql -v ON_ERROR_STOP=1 -q -c 'DROP SCHEMA IF EXISTS public CASCADE'
# --no-owner was passed at dump time, so everything lands owned by this role.
PGDATABASE="$RESTORE_DB" psql -v ON_ERROR_STOP=1 -q -o /dev/null -f /tmp/dump.sql
echo "  loaded"

# Exact counts, not n_live_tup, which is an estimate and reads zero on a
# freshly loaded table until autovacuum has been round.
COUNT_SQL="
SELECT table_name || ' ' || (xpath('/row/c/text()',
         query_to_xml(format('select count(*) as c from public.%I', table_name),
                      false, true, '')))[1]::text::bigint
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
 ORDER BY table_name;"

echo
echo "== tables"
PGDATABASE="$RESTORE_DB" psql -At -c "$COUNT_SQL" > /tmp/restored.txt
psql -At -c "$COUNT_SQL" > /tmp/live.txt
cut -d' ' -f1 /tmp/restored.txt > /tmp/restored.names
cut -d' ' -f1 /tmp/live.txt > /tmp/live.names
if ! diff -u --label live /tmp/live.names --label restored /tmp/restored.names; then
  echo "error: the restored database does not hold the same tables as ${PGDATABASE}." >&2
  exit 1
fi
echo "  $(wc -l < /tmp/restored.names | tr -d ' ') tables, the same set as ${PGDATABASE}"

echo
echo "== row counts, restored against live"
# Informational. A difference is the age of the dump.
diff --label live /tmp/live.txt --label restored /tmp/restored.txt || true
cat /tmp/restored.txt

echo
echo "== migration history"
# What `prisma migrate deploy` would refuse to run against, asserted here
# instead: a directory with no row is pending, a row with no directory is
# drift, and an unfinished or rolled back row is a failed migration.
# The list is built from prisma/migrations by the calling script. Rejected
# rather than escaped: a name carrying a quote would end the SQL literal, and
# Prisma's own names never contain one.
IFS=',' read -r -a MIGRATION_NAMES <<<"$EXPECTED_MIGRATIONS"
for NAME in "${MIGRATION_NAMES[@]}"; do
  case "$NAME" in
    '' | *[!A-Za-z0-9_-]*)
      echo "error: migration name '${NAME}' is empty or has an unexpected character." >&2
      exit 1 ;;
  esac
done
EXPECTED_SQL="$(printf "'%s'," "${MIGRATION_NAMES[@]}")"
PGDATABASE="$RESTORE_DB" psql -v ON_ERROR_STOP=1 -q <<SQL
DO \$\$
DECLARE
  expected text[] := ARRAY[${EXPECTED_SQL%,}];
  bad text;
BEGIN
  SELECT string_agg(e, ', ') INTO bad FROM unnest(expected) e
   WHERE NOT EXISTS (SELECT 1 FROM _prisma_migrations m WHERE m.migration_name = e);
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'pending — in prisma/migrations but not in the dump: %', bad;
  END IF;

  SELECT string_agg(m.migration_name, ', ') INTO bad FROM _prisma_migrations m
   WHERE NOT (m.migration_name = ANY (expected));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'drift — in the dump but not in prisma/migrations: %', bad;
  END IF;

  SELECT string_agg(m.migration_name, ', ') INTO bad FROM _prisma_migrations m
   WHERE m.finished_at IS NULL OR m.rolled_back_at IS NOT NULL;
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'not cleanly applied: %', bad;
  END IF;
END \$\$;
SQL
echo "  matches prisma/migrations, nothing pending"

echo
echo "== done"
echo "  ${BLOB} loads into an empty database and comes out usable"

#!/usr/bin/env bash
# What the nightly backup job runs. Baked into the image next to it; not a
# heredoc payload, so CI's shellcheck job actually analyses it — unlike the
# bash that azure-db-restore.sh assembles into a job secret, which nothing
# lints. A line here must not begin with the word shellcheck: that reads as a
# directive and fails the parse.
#
# One pg_dump of the whole public schema, gzipped, PUT into Blob as one block
# blob named for the JST day. Retention is not this script's business: the
# storage account's lifecycle rule deletes blobs older than 30 days, which is
# why it is a rule and not code here. See docs/decisions.md 2026-09-12.
#
# Authentication is a user-assigned managed identity, the same one the api
# uses for photos. Container Apps injects IDENTITY_ENDPOINT and
# IDENTITY_HEADER; the identity holds Storage Blob Data Contributor on the
# account, so no key and no SAS exists anywhere in this job.
#
# The database password is the only secret, and it is pb_app's — the role that
# cannot run DDL. pg_dump needs SELECT on every table and sequence, which is
# exactly what azure-db-roles.sql grants it, so a permanently-scheduled
# container never holds pb_migrate's password.
set -euo pipefail

: "${PGHOST:?}" "${PGUSER:?}" "${PGDATABASE:?}"
: "${STORAGE_ACCOUNT:?}" "${BACKUPS_CONTAINER:?}" "${IDENTITY_CLIENT_ID:?}"
# Injected by the Container Apps runtime, not by the job definition. Their
# absence means the job has no managed identity attached.
: "${IDENTITY_ENDPOINT:?identity endpoint missing — is a user-assigned identity attached?}"
: "${IDENTITY_HEADER:?identity header missing — is a user-assigned identity attached?}"

# Pinned rather than "latest": a blob written against an API version the
# account does not know fails at upload, which is the right time to find out.
BLOB_API_VERSION=2021-12-02

# The account's blob endpoint. Overridable only so that this script and
# verify.sh can be exercised end to end against a local stub before they are
# pointed at Azure — the api has the same seam for Azurite (docker-compose.yml,
# STORAGE_CONNECTION_STRING). Nothing sets it in the job.
BLOB_ENDPOINT="${BLOB_ENDPOINT:-https://${STORAGE_ACCOUNT}.blob.core.windows.net}"

# JST, like every other date this app reasons about (CLAUDE.md, getTodayJst).
# The job fires at 03:00 JST, so a UTC day would name it the previous day.
DAY="$(TZ=Asia/Tokyo date +%Y-%m-%d)"
BLOB="peacebuddy-${DAY}.sql.gz"
DUMP=/tmp/peacebuddy.sql
GZIP="${DUMP}.gz"

echo "== dump ${PGDATABASE} on ${PGHOST} as ${PGUSER}"
# --no-owner and --no-acl: the roles on the restore target are not necessarily
# these ones, and whoever loads the dump should end up owning what it creates.
# --schema=public matches what azure-db-restore.sh dumps and loads.
pg_dump --no-owner --no-acl --schema=public --file="$DUMP"

# pg_dump exits non-zero on failure, which set -e already catches. This catches
# the other one: a dump truncated by a disk or a connection that went away
# mid-write, which exits 0 and produces a file that restores silently short.
# pg_dump writes this marker only after the last object.
if ! tail -n 5 "$DUMP" | grep -q 'PostgreSQL database dump complete'; then
  echo "error: dump has no completion marker — it is truncated. Nothing uploaded." >&2
  exit 1
fi
TABLES="$(grep -c '^CREATE TABLE ' "$DUMP" || true)"
echo "  $(wc -c < "$DUMP") bytes, ${TABLES} tables"
if [ "${TABLES:-0}" -lt 1 ]; then
  echo "error: dump contains no tables. Nothing uploaded." >&2
  exit 1
fi

echo
echo "== compress"
gzip -9 -f "$DUMP"
# Catches a gzip that produced a corrupt member, before it is the only copy.
gzip -t "$GZIP"
SIZE="$(wc -c < "$GZIP" | tr -d ' ')"
echo "  ${SIZE} bytes gzipped"

echo
echo "== token"
# Container Apps' identity endpoint, not IMDS: IMDS is not reachable from a
# Container Apps replica. client_id names which attached identity to use —
# the job also carries the ACR pull identity, so it cannot be left implicit.
TOKEN="$(curl -sS --fail-with-body --retry 3 --retry-delay 5 \
  -H "X-IDENTITY-HEADER: ${IDENTITY_HEADER}" \
  "${IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=https%3A%2F%2Fstorage.azure.com%2F&client_id=${IDENTITY_CLIENT_ID}" \
  | jq -re '.access_token')"
echo "  got a token for storage.azure.com"

URL="${BLOB_ENDPOINT}/${BACKUPS_CONTAINER}/${BLOB}"

echo
echo "== upload ${BLOB}"
# One PUT Blob. A block blob has a 5000 MiB single-request limit and these
# dumps are megabytes, so nothing here needs the block-list dance. A re-run on
# the same day overwrites, which is what a retried job should do.
CODE="$(curl -sS -X PUT "$URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-ms-version: ${BLOB_API_VERSION}" \
  -H "x-ms-blob-type: BlockBlob" \
  -H "Content-Type: application/gzip" \
  --data-binary "@${GZIP}" \
  -o /tmp/upload.err -w '%{http_code}')"
if [ "$CODE" != "201" ]; then
  echo "error: upload returned HTTP ${CODE}" >&2
  cat /tmp/upload.err >&2
  exit 1
fi

echo
echo "== verify"
# Read it back rather than trusting the 201. A backup nobody has ever read is
# the failure mode this whole issue exists to avoid.
REMOTE="$(curl -sS --fail-with-body -I "$URL" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "x-ms-version: ${BLOB_API_VERSION}" \
  | tr -d '\r' | awk 'tolower($1) == "content-length:" { print $2 }')"
if [ "$REMOTE" != "$SIZE" ]; then
  echo "error: uploaded ${SIZE} bytes, the account reports '${REMOTE}'." >&2
  exit 1
fi

echo
echo "== done"
echo "  ${URL}"
# No retention figure here: the job does not know it. The lifecycle rule on
# the account does, and BACKUP_RETENTION_DAYS is what sets it.
echo "  ${SIZE} bytes, ${TABLES} tables; expiry is the account's lifecycle rule"

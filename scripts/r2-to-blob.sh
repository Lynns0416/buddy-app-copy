#!/usr/bin/env bash
# Copy buddy photos off Cloudflare R2 into an environment's Azure Blob container.
#
#   scripts/r2-to-blob.sh scripts/azure.stg.env scripts/r2.stg.env
#
# Written for one job, #155. Only staging has photos on R2, in
# `peace-buddy-photos-staging`; prod never had a working bucket, so its storage
# account starts empty. The second file is read only for R2_ACCOUNT_ID,
# R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME — the values the GCP
# staging api still carries.
#
# WHAT IT DOES
# Downloads every object under buddy-photos/ into a temporary directory and
# checks the download against R2, then uploads each file under the same name.
# The photo_key migration already turned every stored R2 URL into that name,
# so nothing in the database changes. Last, every downloaded file is checked
# against the container: present, same MD5, content type matching its
# extension. Any mismatch fails the run. The directory is removed on exit.
#
# Safe to re-run, and meant to be: GCP staging keeps taking uploads until it
# stops serving, so run it again just before that. Names end in a UUID, so an
# overwrite rewrites the same bytes.
#
# WHY THROUGH THIS MACHINE
# The Blob account has a public endpoint, so unlike azure-db-restore.sh nothing
# here needs the VNet. azcopy's S3 source takes Amazon S3 URLs, not R2's, and
# `az` has no S3 source at all, so the bytes pass through a local directory —
# ~70 files of at most 2 MB. rclone runs in a container because it is not
# installed here. The upload is the host `az` with your Entra login, because
# shared-key auth is off on the account.
#
# BEFORE RUNNING
# Owner on the account manages it but cannot read or write blobs. The first
# step checks for a data role and prints the grant if it is missing. See
# docs/decisions.md 2026-09-13, "Blob is reached by one identity per
# environment".
#
# No confirmation prompt, unlike azure-provision.sh: it only adds blobs under
# names the api already expects, and costs nothing measurable.
set -euo pipefail

ENV_FILE="${1:?usage: scripts/r2-to-blob.sh <azure-env-file> <r2-env-file>}"
R2_FILE="${2:?usage: scripts/r2-to-blob.sh <azure-env-file> <r2-env-file>}"

PREFIX='buddy-photos'
RCLONE_IMAGE='docker.io/rclone/rclone:1.75.1'

# The Azure file holds database passwords and the R2 file a secret key.
for FILE in "$ENV_FILE" "$R2_FILE"; do
  MODE="$(stat -f '%OLp' "$FILE" 2>/dev/null || stat -c '%a' "$FILE")"
  if [ "${MODE: -2}" != "00" ]; then
    echo "error: $FILE is mode $MODE — it holds secrets." >&2
    echo "       run: chmod 600 $FILE" >&2
    exit 1
  fi
done

# shellcheck disable=SC1090
source "$ENV_FILE"
# shellcheck disable=SC1090
source "$R2_FILE"

: "${RESOURCE_GROUP:?}" "${STORAGE_ACCOUNT:?}" "${STORAGE_PHOTOS_CONTAINER:?}"
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET_NAME:?}"

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# Named by `-e NAME` with no value below, so docker reads them from this
# environment and the secret never appears in a process listing.
export RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"

# Under $HOME, not mktemp's default: Docker Desktop shares /Users with its VM,
# but a container writing into the macOS temp folder left nothing on the host.
WORK="$(mktemp -d "$HOME/.r2-to-blob.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
# Photos only, so a listing written beside them is never counted as one.
DATA="$WORK/data"
mkdir "$DATA"

rclone() {
  docker run --rm -v "$DATA:/data" \
    -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ENDPOINT -e RCLONE_CONFIG_R2_ACCESS_KEY_ID \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY \
    "$RCLONE_IMAGE" "$@"
}

blob() { # az storage blob <subcommand> against this environment's photos container
  local sub="$1"
  shift
  az storage blob "$sub" --auth-mode login --account-name "$STORAGE_ACCOUNT" "$@"
}

cat <<PLAN
  Subscription     $(az account show --query name -o tsv)
  From             r2:$R2_BUCKET_NAME/$PREFIX/
  To               $STORAGE_ACCOUNT/$STORAGE_PHOTOS_CONTAINER/$PREFIX/
PLAN

step "Check Blob data access"
if ! blob list -c "$STORAGE_PHOTOS_CONTAINER" --num-results 1 --output none 2>/dev/null; then
  echo "error: cannot list $STORAGE_ACCOUNT/$STORAGE_PHOTOS_CONTAINER as $(az account show --query user.name -o tsv)." >&2
  echo "       Owner is not a data role. Grant one, wait a few minutes for it to apply, and re-run:" >&2
  echo "       az role assignment create --role 'Storage Blob Data Contributor' \\" >&2
  echo "         --assignee \"\$(az ad signed-in-user show --query id -o tsv)\" \\" >&2
  echo "         --scope \"\$(az storage account show -n $STORAGE_ACCOUNT -g $RESOURCE_GROUP --query id -o tsv)\"" >&2
  exit 1
fi

step "Download from R2"
rclone copy "r2:$R2_BUCKET_NAME/$PREFIX" "/data/$PREFIX"
# Sizes and MD5 both ways: R2 holds nothing the directory lacks, and the
# reverse.
rclone check "r2:$R2_BUCKET_NAME/$PREFIX" "/data/$PREFIX"

COUNT="$(find "$DATA" -type f | wc -l | tr -d ' ')"
if [ "$COUNT" = 0 ]; then
  echo "error: nothing under $PREFIX/ in $R2_BUCKET_NAME — wrong bucket?" >&2
  exit 1
fi
# The service only ever wrote these three, so anything else is not a photo
# the api would link to.
OTHER="$(find "$DATA" -type f ! -name '*.jpg' ! -name '*.png' ! -name '*.webp')"
if [ -n "$OTHER" ]; then
  echo "error: unexpected files under $PREFIX/:" >&2
  echo "${OTHER//$DATA\//  }" >&2
  exit 1
fi
rclone lsf -R --files-only "r2:$R2_BUCKET_NAME" > "$WORK/bucket.txt"
OUTSIDE="$(grep -vc "^$PREFIX/" "$WORK/bucket.txt" || true)"
echo "$COUNT photos downloaded; $OUTSIDE other objects in the bucket, not copied."

# A profile holds one photo: the api deletes the old blob after each upload,
# but swallows a failed delete. More than one under a profile is a photo a
# member replaced or removed, and it is copied too. Named here, not skipped,
# because which one a row points at is in the database, inside the VNet.
ORPHANED="$(find "$DATA/$PREFIX" -mindepth 2 -type f | awk -F/ '{print $(NF-1)}' | sort | uniq -d)"
if [ -n "$ORPHANED" ]; then
  echo "warning: these profiles have more than one photo on R2; all are copied:"
  while read -r PROFILE; do echo "  $PROFILE"; done <<< "$ORPHANED"
fi

step "Upload to Blob"
# One batch per extension, so the content type is set rather than guessed.
for PAIR in jpg:image/jpeg png:image/png webp:image/webp; do
  EXT="${PAIR%%:*}"
  if [ -n "$(find "$DATA" -type f -name "*.$EXT" -print -quit)" ]; then
    blob upload-batch -d "$STORAGE_PHOTOS_CONTAINER" -s "$DATA" \
      --pattern "$PREFIX/*.$EXT" --content-type "${PAIR#*:}" \
      --overwrite true --output none
  fi
done

step "Verify"
# One line per photo — name, base64 MD5, content type — built from the files and
# from the container, then compared. The service computes a blob's MD5 when it
# arrives in one request, which a file this size always does.
(
  cd "$DATA"
  find "$PREFIX" -type f | while read -r NAME; do
    case "$NAME" in
      *.jpg) TYPE=image/jpeg ;;
      *.png) TYPE=image/png ;;
      *.webp) TYPE=image/webp ;;
    esac
    printf '%s\t%s\t%s\n' "$NAME" "$(openssl dgst -md5 -binary "$NAME" | base64)" "$TYPE"
  done
) | sort > "$WORK/expected.tsv"
blob list -c "$STORAGE_PHOTOS_CONTAINER" --prefix "$PREFIX/" --num-results '*' \
  --query '[].[name, properties.contentSettings.contentMd5, properties.contentSettings.contentType]' \
  -o tsv | sort > "$WORK/actual.tsv"

MISSING="$(comm -23 "$WORK/expected.tsv" "$WORK/actual.tsv")"
if [ -n "$MISSING" ]; then
  echo "error: these photos are missing from the container or differ (name, MD5, type):" >&2
  echo "$MISSING" >&2
  exit 1
fi
echo "All $COUNT photos are in $STORAGE_ACCOUNT/$STORAGE_PHOTOS_CONTAINER with matching MD5 and content type."

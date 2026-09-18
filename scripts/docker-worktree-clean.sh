#!/usr/bin/env bash
#
# Reap the Docker resources a removed git worktree left behind.
#
# Every worktree runs its own Compose project, named after the worktree
# directory, so each one holds ~3GB of built images plus node_modules and
# Postgres volumes. `wtp remove` deletes the directory and nothing else, and
# wtp 2.5.1 has no pre/post-remove hook to attach a teardown to — so this
# script reconciles instead: a Compose project whose worktree is gone is an
# orphan, and orphans are removed.
#
# Two rules keep the blast radius to this repo:
#   - a project is only ever removed after its worktree is, and the live set
#     comes from `git worktree list`;
#   - a project must own this repo's volumes (SIGNATURE_VOLUMES below) to be
#     considered at all, so a Compose project from another repo that happens
#     to sit on this daemon is never touched.
#
#   scripts/docker-worktree-clean.sh                   # remove orphans
#   scripts/docker-worktree-clean.sh --dry-run         # list them only
#   scripts/docker-worktree-clean.sh --prune-dangling  # also drop untagged
#                                                      # layers — daemon-wide,
#                                                      # not just this repo
#
# macOS ships bash 3.2, so arrays are filled line by line — no mapfile.
set -euo pipefail

# Volume suffixes from docker-compose.yml, distinctive enough to identify a
# project as this repo's. Keep in sync when the compose volumes change.
SIGNATURE_VOLUMES="_api_nm_types _db_data"

dry_run=false
prune_dangling=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --prune-dangling) prune_dangling=true ;;
    *) echo "usage: $0 [--dry-run] [--prune-dangling]" >&2; exit 2 ;;
  esac
done

run() {
  if [ "$dry_run" = true ]; then
    printf '  would run: %s\n' "$*"
  else
    "$@" >/dev/null
  fi
}

# Compose derives the project name from the directory name, so the basename of
# each worktree path is the project that belongs to it.
live=$(git worktree list --porcelain \
  | sed -n 's|^worktree ||p' \
  | while IFS= read -r path; do basename "$path"; done \
  | sort -u)

# Volumes carry the project label, and only volumes identify a project as this
# repo's — hence no candidates from container labels or image names, which
# cannot be attributed to this compose file.
all_volumes=$(docker volume ls -q)
candidates=$(docker volume ls --filter label=com.docker.compose.project \
  --format '{{.Label "com.docker.compose.project"}}' | grep -v '^$' | sort -u)

orphans=""
while IFS= read -r project; do
  [ -n "$project" ] || continue
  case "$live" in
    "$project"|"$project"$'\n'*|*$'\n'"$project"|*$'\n'"$project"$'\n'*) continue ;;
  esac

  mine=true
  for suffix in $SIGNATURE_VOLUMES; do
    printf '%s\n' "$all_volumes" | grep -qx "${project}${suffix}" || mine=false
  done
  [ "$mine" = true ] || continue

  orphans="${orphans}${project}"$'\n'
done <<< "$candidates"

if [ -z "$orphans" ]; then
  echo "No orphaned Compose projects."
fi

while IFS= read -r project; do
  [ -n "$project" ] || continue
  echo "Removing Compose project: $project"

  containers=()
  while IFS= read -r name; do
    containers+=("$name")
  done < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
  if [ ${#containers[@]} -gt 0 ]; then
    run docker rm -f "${containers[@]}"
  fi

  volumes=()
  while IFS= read -r name; do
    volumes+=("$name")
  done < <(docker volume ls -q \
    --filter "label=com.docker.compose.project=$project")
  if [ ${#volumes[@]} -gt 0 ]; then
    run docker volume rm "${volumes[@]}"
  fi

  # Built images carry no project label, only the `<project>-<service>` name.
  images=()
  while IFS= read -r name; do
    case "$name" in
      "$project"-api:*|"$project"-web:*|"$project"-ci:*) images+=("$name") ;;
    esac
  done < <(docker images --format '{{.Repository}}:{{.Tag}}')
  if [ ${#images[@]} -gt 0 ]; then
    run docker rmi "${images[@]}"
  fi
done <<< "$orphans"

# Untagged layers a rebuild leaves behind cannot be traced to a project, so
# this is daemon-wide and stays opt-in.
if [ "$prune_dangling" = true ]; then
  echo "Pruning dangling images (daemon-wide)."
  run docker image prune -f
fi

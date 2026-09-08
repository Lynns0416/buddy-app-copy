#!/usr/bin/env bash
# Copy the untracked env files from the main checkout into this worktree.
#
# docker-compose.yml reads `apps/api/.env` and `apps/web/.env.local` via
# `env_file`, and a fresh `git worktree add` has neither — compose then refuses
# to start with "env file ... not found". Run this once per new worktree.
set -euo pipefail

ENV_FILES=(apps/api/.env apps/web/.env.local)

repo_root=$(git rev-parse --show-toplevel)
# First entry of `git worktree list` is always the main checkout.
main_root=$(git worktree list --porcelain | head -1 | cut -d' ' -f2-)

if [ "$repo_root" = "$main_root" ]; then
  echo "Already in the main checkout ($main_root) — nothing to copy." >&2
  exit 1
fi

force=false
[ "${1:-}" = "--force" ] && force=true

for f in "${ENV_FILES[@]}"; do
  src="$main_root/$f"
  dest="$repo_root/$f"
  if [ ! -f "$src" ]; then
    echo "missing in main checkout: $src — copy its .example and fill it in" >&2
    exit 1
  fi
  if [ -f "$dest" ] && [ "$force" = false ]; then
    echo "kept   $f (already present; --force to overwrite)"
    continue
  fi
  cp "$src" "$dest"
  echo "copied $f"
done

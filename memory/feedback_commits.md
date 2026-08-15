---
name: Commit rules
description: No co-author, one concern per commit, feature branches, typecheck before committing
type: feedback
originSessionId: de270ad7-d72b-4c7a-b428-bb0d05102f55
---
Never add `Co-Authored-By: Claude ...` to commit messages.

Commit in one-concern units. Do not bundle unrelated changes (page + i18n together is fine; feature + memory update + bug fix is not). Never squash multiple concerns into one large commit even when cleaning up history — tooling/config, lib extraction, tests, and page changes each get their own commit.

Never commit directly to `main`. Always create a feature branch first (e.g. `feat/booking-system`), then commit there.

Before every commit, run tsc --noEmit via Docker in both apps:
```
docker-compose run --rm -w /app/apps/api api npx tsc --noEmit
docker-compose run --rm -w /app/apps/web web npx tsc --noEmit
```

**NEVER commit autonomously.** Only commit when the user explicitly runs `/commit`.
"Do it", "go ahead", or approval of a plan means *make the changes* — it does NOT
mean commit. Make the edits and stop. Violated 2026-08-15 despite this rule
already being written here.

**NEVER create a branch autonomously.** Run `git rev-parse --abbrev-ref HEAD`
before touching anything and work on whatever branch the user is already on. The
user creates the branch for the work they asked for; inventing a second one
strands their branch and splits the change. The session-start git status snapshot
goes stale — do not trust it to know the current branch. Violated 2026-08-15:
user was on `docs/install-mermaid`, I branched off it to
`docs/architecture-mermaid` and committed there.

**NEVER open a PR autonomously.** Only create a PR when the user explicitly asks for it. Pushing a branch is fine after `/commit`, but `gh pr create` requires explicit instruction.

**Why:** Direct main commits, large squashes, missing typechecks, and co-author tags have all caused problems. Autonomous commits and self-created branches put the
user's work somewhere they didn't choose and have to undo.

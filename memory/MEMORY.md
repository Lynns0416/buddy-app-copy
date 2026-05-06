# Memory Index

## Project
- [project_state.md](project_state.md) — Build status, blockers, next steps
- [project_prerelease.md](project_prerelease.md) — Pre-release: no migration needed. **DELETE on first prod deploy.**
- [project_followup_trainee_capacity.md](project_followup_trainee_capacity.md) — Follow-up: trainees must not see tours (API-level, listTours+getTour return empty/null)

## User
- [user_profile.md](user_profile.md) — Org context (Google Workspace for Nonprofits, Apple sign-in deferred)

## Feedback
- [feedback_memory.md](feedback_memory.md) — Save memories to project memory/ only, never ~/.claude/projects/
- [feedback_docker.md](feedback_docker.md) — Always run commands via docker exec/compose, never directly
- [feedback_commits.md](feedback_commits.md) — No co-author, one concern per commit, feature branches, typecheck first
- [feedback_token_efficiency.md](feedback_token_efficiency.md) — grep first, targeted reads only, skip typecheck for mechanical changes, user handles tasks manually
- **Never eslint-disable** — Fix code pattern instead. Suppressing rules masks real bugs and creates tech debt.

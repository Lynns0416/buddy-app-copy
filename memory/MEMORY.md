# Memory Index

## Project
- [project_prerelease.md](project_prerelease.md) — Pre-release: schema changes = `prisma db push`, never raise migration concerns. DELETE on first prod deploy.

## User
- [user_profile.md](user_profile.md) — Org context (Google Workspace for Nonprofits, Apple sign-in deferred)

## Feedback
- [feedback_memory.md](feedback_memory.md) — Save memories to project memory/ only, never ~/.claude/projects/
- [feedback_docker.md](feedback_docker.md) — Always run commands via docker exec/compose, never directly
- [feedback_commits.md](feedback_commits.md) — No co-author, one concern per commit, feature branches, typecheck first
- [feedback_token_efficiency.md](feedback_token_efficiency.md) — grep first, targeted reads only, skip typecheck for mechanical changes, user handles tasks manually
- **Never eslint-disable** — Fix code pattern instead. Suppressing rules masks real bugs and creates tech debt.
- [feedback_mock_pattern.md](feedback_mock_pattern.md) — Prisma mock pattern: use `as unknown as MockDb` cast, never `vi.mocked(db.model.method)` standalone
- [feedback_project_state.md](feedback_project_state.md) — Do not maintain project_state.md; git log is source of truth for completed work
- [feedback_ask_before_concluding.md](feedback_ask_before_concluding.md) — Ask questions until confident; never state recommendations with false confidence
- [feedback_review_discipline.md](feedback_review_discipline.md) — One review = one list. Cap ~5 items. Severity honest. Own regressions. Don't drip-feed findings across rounds.

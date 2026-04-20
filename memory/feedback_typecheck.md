---
name: Run typecheck before committing
description: Must run tsc --noEmit in both apps before every commit — CI has caught type errors multiple times
type: feedback
---

Always run `tsc --noEmit` (via Docker) in `apps/api` and `apps/web` before committing.

**Why:** CI has caught TypeScript errors post-commit more than once, requiring fix-up commits.

**How to apply:** Before `git commit`, run:
```
docker-compose run --rm -w /app/apps/api api npx tsc --noEmit
docker-compose run --rm -w /app/apps/web web npx tsc --noEmit
```
Do not skip this step even for test-only changes — test files are type-checked too.

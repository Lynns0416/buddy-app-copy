---
name: Project state
description: Current build status, blockers, and next steps
type: project
---

## Built (merged to main, as of 2026-04-19)

- Monorepo, Prisma schema, Docker, next-intl i18n (ja/en)
- Firebase Auth (Google; Apple deferred), session cookie
- `POST /auth/register`, `GET /auth/me`
- `GET /me/profile`, `PUT /me/profile`, `GET /tours` — buddy profile + Firebase emulator config, Vitest tests
- `adminAuthMiddleware` (role check, 403), empty admin router at `/admin`, `/[locale]/admin/page.tsx`, i18n keys

## Blocker

Buddy stuck on `/pending` after login — `/dashboard` doesn't exist yet, no admin approval flow.

## Next (priority order)

1. **Buddy approval** — `GET /admin/buddies?status=`, `PUT /admin/buddies/:id/status`, `/[locale]/admin/buddies/page.tsx`
2. **Buddy dashboard** — `/[locale]/dashboard/page.tsx` with real data from `GET /tours`
3. **Auth test fixes** (low priority) — `routes/auth.test.ts` 2 broken tests, refactor to `buildApp()` pattern

## Decisions

- Non-admin hitting `/admin`: redirect to `/` (top page)
- `/admin` path is fine — role check is server-side, obscurity not needed
- Buddy dashboard (`/dashboard`): real data only, no placeholders
- `status` = lifecycle only: `pending | active | rejected | suspended` — `trainee` removed
- `tier` = expertise level: `trainee | junior | mid | senior | expert | instructor | organizer` — `trainee` added here
- Approval from pending → `status: active, tier: trainee` (default)

## Notes

- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)
- `api-test` Docker service missing `depends_on: db` — minor, not blocking

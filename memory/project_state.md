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
- `adminAuthMiddleware` (role check, 403), `/admin` router, `/[locale]/admin/page.tsx`
- `GET /admin/buddies?status=`, `PUT /admin/buddies/:id/status`, `/[locale]/admin/buddies/page.tsx` — buddy approval flow with pending/approve/reject (#11)
- Route name refactor (#10), admin dashboard setup (#9)
- ESLint fully configured (flat config, strict TS rules) on both API and web (#12)
- `/[locale]/dashboard/page.tsx` — buddy dashboard with tour list, auth guard, not-registered soft message
- Response types moved to `packages/types`; local type dupes removed from web; magic strings replaced with enum values across API and web

## Blocker

None known.

## Next (priority order)

1. TBD

## Decisions

- Non-admin hitting `/admin`: redirect to `/` (top page)
- `/admin` path is fine — role check is server-side, obscurity not needed
- Buddy dashboard (`/dashboard`): real data only, no placeholders
- `status` = lifecycle only: `pending | active | rejected | suspended` — `trainee` removed
- `tier` = expertise level: `trainee | junior | mid | senior | expert | instructor | organizer` — `trainee` added here
- Approval from pending → `status: active, tier: trainee` (default)

## Notes

- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)

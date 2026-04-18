---
name: Project state
description: Current build status, blockers, and next steps
type: project
---

## Built (as of 2026-04-19)

### main
- Monorepo, Prisma schema, Docker, next-intl i18n (ja/en)
- Firebase Auth (Google; Apple deferred), session cookie, login/pending pages
- `POST /auth/register`, `GET /auth/me`

### feat/buddy-profile (ready to PR)
- `GET /me/profile`, `PUT /me/profile`, `GET /tours`
- Firebase Auth emulator config (`firebase.json`, `.firebaserc`)
- Service + route tests (Vitest)

## Blocker
Buddy stuck on `/pending` after login — `/dashboard` doesn't exist, no admin approval flow.

## Next (priority order)
1. **Admin: buddy approval** — `GET /admin/buddies?status=pending`, `PUT /admin/buddies/:id/status`, `/[locale]/admin/buddies/page.tsx`
2. **Buddy dashboard stub** — `/[locale]/dashboard/page.tsx` (upcoming tours, profile link)
3. **Auth test fixes** (low priority) — `routes/auth.test.ts` 2 broken tests, refactor to `buildApp()` pattern

## Notes
- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)

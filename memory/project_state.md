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
1. **Admin scaffold** — `adminAuth` middleware (role check, 403), empty admin router, mount at `/admin`, `/[locale]/admin/page.tsx` landing page, i18n keys
2. **Buddy approval** — `GET /admin/buddies?status=`, `PUT /admin/buddies/:id/status`, `/[locale]/admin/buddies/page.tsx`
3. **Buddy dashboard stub** — `/[locale]/dashboard/page.tsx` (placeholder or tours from `GET /tours`)
4. **Auth test fixes** (low priority) — `routes/auth.test.ts` 2 broken tests, refactor to `buildApp()` pattern

## Decisions
- Non-admin hitting `/admin`: redirect to `/` (top page)
- `/admin` path is fine — role check is server-side, obscurity not needed
- Buddy dashboard (`/dashboard`): real data only, no placeholders

## Notes
- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)

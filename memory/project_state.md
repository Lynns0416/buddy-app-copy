---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Built (merged to main, as of 2026-04-20)

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
- Group management CRUD (#18): `GET/POST /admin/groups`, `GET/PUT /admin/groups/:id` + web pages (list, create, detail, edit)
- Seed data added (#16); PRD todos added (#17)
- Refactoring/frontend magic strings and test (#23)
- `GET /admin/tours` + admin tour list page (#24)
- Zod validation error details returned from API; `TourForm` component extracted (#25)
- React Hook Form integration (#26); frontend tests added (#27)
- Tour detail — buddy-facing: `GET /tours/:id` with seat counts + `myBookingStatus`; `/[locale]/dashboard/tours/[id]/page.tsx`; dashboard cards linked (#28)

## Blocker

None known.

## Next (priority order)

1. **Booking system** (§8): `POST /tours/:id/bookings` (create), `PUT /tours/:id/bookings/:bookingId` (update status), cancellation flow, waitlist auto-promotion
2. *Data model questions already resolved:* `bookingOpen Boolean @default(false)` manual gate; `startTime`/`endTime Time?` nullable on Tour

## Decisions

- Non-admin hitting `/admin`: redirect to `/` (top page)
- `/admin` path is fine — role check is server-side, obscurity not needed
- Buddy dashboard (`/dashboard`): real data only, no placeholders
- `status` = lifecycle only: `pending | active | rejected | suspended` — `trainee` removed
- `tier` = expertise level: `trainee | junior | mid | senior | expert | instructor | organizer` — `trainee` added here
- Approval from pending → `status: active, tier: trainee` (default)
- Tour time fields: `startTime Time?` + `endTime Time?` on Tour (nullable). Duration is derived in UI. TourTimeline/itinerary deferred.
- `bookingOpen Boolean @default(false)`: purely manual admin gate. Auto-close is API logic: reject new bookings when `tourDate <= today`. UI: tour list must handle multiple tours per day sorted by startTime, visually flag back-to-back tours.
- Booking allowed when: `status=published AND bookingOpen=true AND tourDate > today`

## Notes

- Two Firebase projects: staging (under Workspace org) + prod (after nonprofit approval)

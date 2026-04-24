---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Built (through PR #28, merged to main by 2026-04-20)
Foundation: monorepo, Prisma, Docker, Firebase Auth (Google), next-intl i18n (ja/en), ESLint, seed data.
API: auth, buddy profile, tours (list+detail with seat counts), admin CRUD (buddies, groups, tours), booking (atomic seat claim, waitlist, cancellation).
Web: buddy dashboard, admin (buddies, groups, tours), tour detail, React Hook Form; all types in `packages/types`.

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

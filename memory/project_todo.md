---
name: Project TODOs
description: Deferred requirements and schema changes to implement later
type: project
---

## Tour timeline / duration (deferred)

- Tour model needs start time and end time fields (or duration)
- `meetingTime` on Tour is assembly time, ~30–40 min before tour start — it is NOT the start time
- Tour timeline will have a relation with the Tour model (exact shape TBD by user)
- Impacts: tour display on dashboard, buddy scheduling, notifications

## Shared response types — move to packages/types (next PR after dashboard)

- All HTTP response types (`TourResponse`, `AdminBuddyResponse`, `BuddyProfileResponse`, `UserResponse`) belong in `packages/types`, not `apps/api/src/types.ts`
- Web pages currently duplicate these as local types (`AdminBuddy` in adminBuddies/page.tsx, `Tour` in dashboard/page.tsx, `DbUser` in auth.tsx)
- `apps/api/src/types.ts` should only contain Hono env types (`AuthEnv`, `FirebaseEnv`, etc.)
- Date fields in wire types should be `string` (ISO 8601) — no Hono/TS native equivalent to kotlinx Instant; validate with `z.string().datetime()` in Zod
- Also update `CLAUDE.md` to correct the wrong rule ("API response types → apps/api/src/types.ts")
- Once response types are in `packages/types`, replace all magic string status checks in web pages (e.g. `=== 'active'`, `=== 'pending'`, `=== 'admin'`) with enum values from `@peace-buddy/types` (`BuddyStatus`, `UserRole`, `TourStatus`, etc.)
- Touches: `packages/types/src/index.ts`, `apps/api/src/types.ts`, `apps/api/src/**/*.ts` imports, all web pages with local type dupes, `auth.tsx`

## Tour booking open/closed status (deferred)

- Need to distinguish `published + open` (buddies can book) vs `published + closed` (visible, cannot book)
- Currently `TourStatus` = `draft | published | cancelled | completed` — no open/closed distinction
- Options: add new status values, or add a separate `bookingOpen: Boolean` field on Tour
- Must decide data model before implementing booking flow

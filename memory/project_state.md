---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Next (priority order)

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `AdminBuddyBookingEntry`, `AdminBuddyDetailResponse = AdminBuddyResponse & { bookings: AdminBuddyBookingEntry[] }` |
| `apps/api/src/services/admin.service.ts` | Extend `getBuddyDetail()` select to include bookings (ordered by tour date desc) |
| `apps/api/src/services/admin.service.test.ts` | Update mock stub + add booking history test coverage |
| `apps/web/src/lib/api-client.ts` | `getBuddy` return type → `AdminBuddyDetailResponse` |
| `apps/web/src/app/[locale]/admin/buddies/admin.buddy.ts` | `fetchBuddy` return type |
| `apps/web/src/app/[locale]/admin/buddies/[id]/page.tsx` | Render sortable booking history table below edit form |
| `apps/web/messages/en.json` + `ja.json` | Add `adminBuddies.bookingHistory`, column headers, empty state |

**`AdminBuddyBookingEntry`:** `id`, `tourId`, `status` (BookingStatus), `bookedAt`, `tour: { tourDate, location, group: { name }, status }`

## Decisions

### Admin buddy pages
- Flat navigation: pending + buddies as separate top-level menu items
- API uses query params (`?status=pending`, `?status=active`); `/admin/buddies/pending` is a Next.js page URL only
- Admin buddy pages use flat navigation (pending + buddies as separate menu items, not nested)

### Admin buddy detail — booking history
- `GET /admin/buddies/:id` returns `AdminBuddyDetailResponse` (additive — list endpoints keep returning `AdminBuddyResponse`)
- Show all bookings, no status filter (filter is a future option)
- Group name cell links to `/admin/tours/:id` — whole row is not clickable (edit form is the primary action)
- Default sort: tour date descending

### Buddy profile settings (§11.6)
- Language enum (`LanguageSchema`) ordered for UI — priority tier first: `english, korean, chinese_simplified, chinese_traditional`, then alphabetical: `arabic, french, german, italian, japanese, portuguese, russian, spanish, thai, vietnamese`
- Skills: free text textarea (one per line, split on `\n` before submit) — structured multi-select deferred
- Photo (`photoUrl`): disabled field with "coming soon" text; not sent in PUT body — existing value preserved
- Both `displayName` and `realName` editable by buddy
- `languages.*` i18n namespace kept separate from `profile.*` for reuse in admin views

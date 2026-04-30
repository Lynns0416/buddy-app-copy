---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Next (priority order)

Phase 2 — `trainee` BuddyStatus alignment (§5.1):

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `'trainee'` to `BuddyStatusSchema`; add `trainee` variant to `UpdateBuddyStatusSchema` |
| `apps/api/src/services/admin.service.ts` | Handle `trainee` in status transitions |
| `apps/web/src/lib/status-display.ts` | Add `trainee` entry to `buddyStatusBadgeVariant` |
| `apps/web/messages/{en,ja}.json` | Add `buddyStatus.trainee` key |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | Revisit auth-gate: `trainee` buddies can view but not book |
| Prisma migration | `ALTER TYPE BuddyStatus ADD VALUE 'trainee'` |

## Decisions

### Admin buddy pages
- Flat navigation: pending + buddies as separate top-level menu items
- API uses query params (`?status=pending`, `?status=active`); `/admin/buddies/pending` is a Next.js page URL only

### Admin buddy detail — booking history
- `GET /admin/buddies/:id` returns `AdminBuddyDetailResponse` (additive — list endpoints keep returning `AdminBuddyResponse`)
- Show all bookings, no status filter
- Group name cell links to `/admin/tours/:id`
- Default sort: tour date descending

### Buddy profile settings (§11.6)
- Language enum (`LanguageSchema`) ordered for UI — priority tier first
- Skills: free text textarea (one per line, split on `\n` before submit)
- Photo (`photoUrl`): disabled field with "coming soon" text; not sent in PUT body
- Both `displayName` and `realName` editable by buddy
- After save: stay on page, refetch profile, show inline success message
- Cancel: navigate to `/dashboard`

### Status display (shared, all pages)
- `apps/web/src/lib/status-display.ts` — pure functions `getBuddyStatusLabel(t, s)`, `getTourStatusLabel(t, s)`, `getBookingStatusLabel(t, s)` and badge variant maps
- Caller adds `const tXxxStatus = useTranslations('xxxStatus')` and passes it to the helper
- Shared i18n namespaces: `buddyStatus.*`, `tourStatus.*`, `bookingStatus.*` (top-level in en.json/ja.json)
- Old inline `Record<TourStatus, string>` maps removed from all page files
- `trainee` BuddyStatus deferred to phase 2 — see Next table above

### Buddy profile header (read-only display)
- Shows account status badge + "Member since" date
- `Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' })`
- Tier hidden from buddy per §5.2

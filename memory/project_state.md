---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Current branch — feat/admin/evaluation-ui

Admin-side evaluation UI only. No buddy-side UI in this branch.

### Decisions

- **Per-tour eval entry points**: both buddy detail page and tour detail page (inline forms, no modal, no separate eval page)
- **Score field UX**: radio buttons (1–5) + optional note textarea per field
- **Profile eval form**: always rendered directly — empty if no data, pre-filled if data exists. No CTA or modal.
- **Tour detail page**: must be built in this branch (new — `/admin/tours/[id]` page does not yet exist)

---

### Plan

#### Step 1 — API client wiring

`apps/web/src/lib/api-client.ts` — add functions:
- `listAdminEvaluations({ buddyId?, tourId? })` → `AdminEvaluationResponse[]`
- `createAdminEvaluation(data: CreateAdminEvaluation)` → `AdminEvaluationResponse`
- `updateAdminEvaluation(id, data: UpdateAdminEvaluation)` → `AdminEvaluationResponse`
- `deleteAdminEvaluation(id)` → `void`
- `upsertAdminProfileEvaluation(buddyId, data: UpsertAdminProfileEvaluation)` → `AdminProfileEvaluationResponse`
- `getAdminProfileEvaluation(buddyId)` → `AdminProfileEvaluationResponse | null`
- `listAdminSelfEvaluations({ buddyId? })` → `AdminSelfEvaluationResponse[]`
- `getAdminSelfEvaluation(id)` → `AdminSelfEvaluationResponse`

`apps/web/src/lib/api-paths.ts` — add constants:
- `adminEvaluations`, `adminEvaluation(id)`
- `adminProfileEvaluation(buddyId)`
- `adminSelfEvaluations`, `adminSelfEvaluation(id)`

#### Step 2 — Shared primitive

`apps/web/src/app/[locale]/admin/_components/evaluation-score-field.tsx`
- Props: `name`, `label`, `value: number | null`, `noteValue: string | null`, `onChange`, `noteOnChange`, `disabled?`
- Renders: radio group (1–5, labelled) + optional note textarea below
- Reused by all evaluation forms
- i18n: score labels in `adminEvaluations.scores.*`

#### Step 3 — Buddy detail page additions

Entry: `apps/web/src/app/[locale]/admin/buddies/[id]/page.tsx`

Three new sections, rendered below existing BuddyBookingHistory:

**3a. Profile Evaluation** — `admin-profile-evaluation-form.tsx`
- On mount: fetch `getAdminProfileEvaluation(buddyId)` — pre-fills or shows empty form
- All 11 score fields (including reliability) via `evaluation-score-field.tsx`
- Single "Save" button → `upsertAdminProfileEvaluation`
- No delete action (upsert only)

**3b. Per-Tour Evaluations** — `buddy-per-tour-evaluations.tsx` (container) + `buddy-per-tour-evaluation-form.tsx` (form)
- On mount: fetch `listAdminEvaluations({ buddyId })`
- Table: tour date, overall rating, last updated, "Edit" / "Delete"
- "Add Evaluation" button → inline form (tourId required; shows tour picker from buddy's confirmed bookings)
- Edit: inline form pre-filled with existing data
- Delete: confirm + `deleteAdminEvaluation`
- Tour picker source: `AdminBuddyDetailResponse.bookings` (already fetched) — filter to confirmed only

**3c. Self-Evaluations (read-only)** — `admin-self-evaluations.tsx`
- On mount: fetch `listAdminSelfEvaluations({ buddyId })`
- Read-only table: tour date, overall rating, locked status, submitted at
- Row expand: shows all field values read-only (or inline detail)

#### Step 4 — Tour detail page (new)

`apps/web/src/app/[locale]/admin/tours/[id]/page.tsx`

- Fetches `getAdminTour(id)` (already in api-client) → `AdminTourDetailResponse`
- Shows tour header: date, location, status, capacity, group name
- Shows buddy list from `bookings` (`AdminTourBookingEntry[]`): displayName, bookingStatus
- For each confirmed-booking buddy: "Evaluate" → inline `tour-per-buddy-evaluation-form.tsx`
  - Pre-checks if eval exists via `listAdminEvaluations({ tourId })` fetched on mount
  - "Edit" if eval exists, "Add" if not

No tour editing in this branch (that's `adminTourEdit`).

#### Step 5 — i18n

New namespace `adminEvaluations` in both `en.json` and `ja.json`:
- `adminEvaluations.sections.profileEvaluation`
- `adminEvaluations.sections.perTourEvaluations`
- `adminEvaluations.sections.selfEvaluations`
- `adminEvaluations.fields.*` — one key per field (overallRating, reliability, communication, …)
- `adminEvaluations.fields.*.note` — note field label per dimension
- `adminEvaluations.scores.1` through `adminEvaluations.scores.5` — radio labels
- `adminEvaluations.actions.*` — save, edit, delete, addEvaluation
- `adminEvaluations.empty.*` — empty state strings

---

### Component file map

| File | Location |
|---|---|
| `evaluation-score-field.tsx` | `admin/_components/` — atomic UI primitive only |
| `admin-profile-evaluation-form.tsx` | `admin/buddies/[id]/_components/` |
| `buddy-per-tour-evaluations.tsx` | `admin/buddies/[id]/_components/` |
| `buddy-per-tour-evaluation-form.tsx` | `admin/buddies/[id]/_components/` |
| `admin-self-evaluations.tsx` | `admin/buddies/[id]/_components/` |
| `tour-buddy-list.tsx` | `admin/tours/[id]/_components/` |
| `tour-per-buddy-evaluation-form.tsx` | `admin/tours/[id]/_components/` |

---

## Built — feat/evaluation-base (merged)

| What | Files |
|---|---|
| Prisma models | `AdminEvaluation`, `SelfEvaluation`, `AdminProfileEvaluation` |
| Zod schemas + response types | `packages/types/src/index.ts` |
| Admin per-tour eval CRUD | `services/adminEvaluation.service.ts`, `routes/adminEvaluations.ts` |
| Admin profile eval upsert/get | `services/adminProfileEvaluation.service.ts`, `routes/adminProfileEvaluations.ts` |
| Buddy self-eval create/list/update | `services/selfEvaluation.service.ts`, `routes/selfEvaluations.ts` |
| Admin read of self-evals | `routes/adminSelfEvaluations.ts` |

## Decisions (stable)

### Evaluation system
- Admin per-tour eval: one per buddy per tour, `@@unique([buddyId, tourId])`; any admin can edit; no deadline
- Self-eval: editable until `createdAt + 7 days` (`SELF_EVAL_EDIT_WINDOW_DAYS = 7`), computed at service layer
- Profile eval: one per buddy (upsert); no tour link; no deadline; `createdBy` = original creator only
- `overallRating`: stored, manually set — not computed from dimension scores
- Future: Slack notification, quarterly term evaluations — deferred

### Admin buddy pages
- Flat navigation: pending + buddies as separate top-level menu items
- API uses query params (`?status=pending`, `?status=active`)

### Admin buddy detail — booking history
- `GET /admin/buddies/:id` returns `AdminBuddyDetailResponse`
- Show all bookings, no status filter; group name links to tour detail; default sort: tour date desc

### Buddy profile settings (§11.6)
- Language enum ordered for UI — priority tier first
- Skills: free text textarea (one per line)
- Photo: disabled, "coming soon"
- Both `displayName` and `realName` editable
- After save: stay on page, refetch, inline success message
- Cancel: navigate to `/dashboard`
- `languages.*` i18n namespace separate from `profile.*`

### Status display (shared)
- `apps/web/src/lib/status-display.ts` — `getBuddyStatusLabel`, `getTourStatusLabel`, `getBookingStatusLabel`
- Shared i18n namespaces: `buddyStatus.*`, `tourStatus.*`, `bookingStatus.*`

### Buddy profile header
- Status badge + "Member since" date
- `Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' })`
- Tier hidden from buddy (§5.2)

## Deferred — Phase 2

`trainee` BuddyStatus alignment (§5.1):

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `'trainee'` to `BuddyStatusSchema` |
| `apps/api/src/services/admin.service.ts` | Handle `trainee` in status transitions |
| `apps/web/src/lib/status-display.ts` | Add `trainee` to `buddyStatusBadgeVariant` |
| `apps/web/messages/{en,ja}.json` | Add `buddyStatus.trainee` key |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | `trainee` buddies can view but not book |
| Prisma migration | `ALTER TYPE BuddyStatus ADD VALUE 'trainee'` |

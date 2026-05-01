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
- `languages.*` i18n namespace kept separate from `profile.*` for reuse in admin views

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

## 9. Evaluation System

### 9.1 Overview

Two evaluation types: **admin evaluations** (internal, hidden from buddies) and **buddy self-evaluations** (visible to admins and the buddy themselves).

Both types are **per-tour** and **editable until a deadline** (after which they become read-only).

Future scope (not in base): Slack notification on tour completion, quarterly term evaluations.

### 9.2 Admin Evaluations

#### Design decisions
- Always linked to a specific tour (`tourId` required, not nullable)
- **One record per buddy per tour** — unique constraint `[buddyId, tourId]`; any admin can create or update
- No modal prompt after tour completion — admins evaluate async, when they have time
- `createdBy` tracks who created the record (audit); any admin can subsequently edit
- Editable until an edit deadline (mechanism TBD — see open questions)
- Buddies have no visibility

#### Fields

All score fields: **1 = Needs Improvement / 2 = Developing / 3 = Proficient / 4 = Advanced / 5 = Exceptional**. All text fields optional.

| Field | Score | Text | Notes |
|---|---|---|---|
| Overall rating | 1–5 | ✅ | |
| Reliability | 1–5 | ✅ | Admin eval only |
| Communication | 1–5 | ✅ | |
| Group engagement | 1–5 | ✅ | |
| Memory | 1–5 | ✅ | Remembering names, details, preferences |
| Knowledge | 1–5 | ✅ | Content accuracy and depth |
| Dedication | 1–5 | ✅ | Effort and commitment |
| Dialogue | 1–5 | ✅ | Core differentiating skill |
| Adaptability | 1–5 | ✅ | Handling unexpected situations |
| Emotion | — | ✅ | Cannot be meaningfully scored |
| Confidence | 1–5 | ✅ | |

### 9.3 Buddy Self-Evaluations

#### Design decisions
- Always linked to a tour (`tourId` required)
- One per buddy per tour — unique constraint `[buddyId, tourId]`
- Buddy can only submit if they had a `confirmed` booking on the tour
- Editable until an edit deadline (same mechanism as admin eval)
- Admins can read all; buddies can only read their own

#### Fields

| Field | Score | Text |
|---|---|---|
| Overall rating | 1–5 | ✅ |
| Communication | 1–5 | ✅ |
| Group engagement | 1–5 | ✅ |
| Memory | 1–5 | ✅ |
| Knowledge | 1–5 | ✅ |
| Dedication | 1–5 | ✅ |
| Dialogue | 1–5 | ✅ |
| Adaptability | 1–5 | ✅ |
| Emotion | — | ✅ |
| Confidence | 1–5 | ✅ |

### 9.4 Admin Profile Evaluation (Overall)

A separate model from per-tour evaluations. One record per buddy (upsert semantics). Not tour-linked. Same fields as admin per-tour eval (including reliability). Any admin can create or update. No edit deadline.

This is the buddy's "standing overall profile" as maintained by admins. UI may show a calculated average from per-tour history alongside this manually-set overall.

### 9.5 Self-Eval Edit Lock

- Before submission: always open
- After submission: editable until `createdAt + N_DAYS` (constant, TBD)
- No DB field — service computes lock state from `createdAt`
- Admin evals: no deadline, always editable

### 9.6 `overallRating` field

Stored, human-set. Not computed from other fields. UI will separately calculate and display an average from individual dimension scores. No DB aggregate needed.

### 9.7 Open Questions (must resolve before implementation)
1. **N_DAYS for self-eval lock**: how many days after submission should the edit window close? (e.g., 7, 14, 30?)
2. **Quarterly / term evaluation**: deferred — design TBD. Not in base scope.
3. **`PUT /admin/profile-evaluations/:buddyId` tracking**: should `createdBy` be updated to `lastEditedBy` on each update, or kept as original creator? (Currently planned as original creator only.)

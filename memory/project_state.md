---
name: Project state
description: Current build status, blockers, and next steps
type: project
---

## Current branch — feat/admin/evaluation-ui (cleanup PR pending)

3 commits ahead of origin/main, not yet PR'd:
- `feat: extend AdminEvaluationResponse with tourDate and tourGroupName`
- `refactor: extract shared evaluation form helpers to evaluation-form.ts`
- `fix: surface load errors and fix add/edit link label in evaluation components`

**Action**: push and open a follow-up PR against main, then start `feat/buddy/self-evaluation-ui`.

---

## Next branch — feat/buddy/self-evaluation-ui

### Scope

Self-evaluation UI for buddies. API fully built; only web wiring + one small API filter change needed.

Entry point: **tour detail page only** (`/dashboard/tours/[id]`), shown when `tour.status === completed && myBookingStatus === confirmed`. No dedicated self-eval history page — buddy reaches past evals via booking history → tour detail.

### Plan

#### Step 1 — API: add tourId filter

`apps/api/src/services/selfEvaluation.service.ts` — add optional `tourId?: string` param to `listMySelfEvaluations`.
`apps/api/src/routes/selfEvaluations.ts` — read `c.req.query('tourId')` and pass through.
Update `selfEvaluations.test.ts`.

#### Step 2 — API client wiring

`apps/web/src/lib/api-paths.ts`:
- `selfEvaluations: '/me/self-evaluations'`
- `selfEvaluation: (id: string) => \`/me/self-evaluations/${id}\``

`apps/web/src/lib/api-client.ts`:
- `listMySelfEvaluations(params: { tourId?: string })` → `SelfEvaluationResponse[]`
- `createSelfEvaluation(data: CreateSelfEvaluation)` → `SelfEvaluationResponse`
- `updateSelfEvaluation(id, data: UpdateSelfEvaluation)` → `SelfEvaluationResponse`

#### Step 3 — Action module

`apps/web/src/app/[locale]/dashboard/self-evaluations/self-evaluation.ts`:
- `listMySelfEvaluations(params)` → `ActionResult<SelfEvaluationResponse[]>`
- `createSelfEvaluation(data)` → `ActionResult<SelfEvaluationResponse>`
- `updateSelfEvaluation(id, data)` → `ActionResult<SelfEvaluationResponse>`

#### Step 4 — Form state module

`apps/web/src/app/[locale]/dashboard/self-evaluations/self-evaluation-form-state.ts`:
- `SelfScoreState`, `SelfNoteState` — 10 score fields (no `reliability`), 10 note fields + `emotionNote`
- `emptySelfScores()`, `emptySelfNotes()`, `fromSelfResponse()`, `buildSelfPayload()`, `mapSelfEvalError()`
- Reuse `EvaluationScoreField` from `../../admin/_components/evaluation-score-field` directly (pure UI, no admin logic)

#### Step 5 — Self-eval form component

`apps/web/src/app/[locale]/dashboard/self-evaluations/_components/self-evaluation-form.tsx`:
- Props: `tourId: string`, `existing: SelfEvaluationResponse | null`, `onSaved: (e: SelfEvaluationResponse) => void`, `onCancel: () => void`
- `existing === null` → create
- `existing && !existing.locked` → update (pre-fills)
- `existing?.locked` → read-only score summary (no form, no inputs)

#### Step 6 — Tour self-eval section component (separate from page)

`apps/web/src/app/[locale]/dashboard/self-evaluations/_components/tour-self-eval-section.tsx`:
- Props: `tourId: string`
- Fetches `listMySelfEvaluations({ tourId })` on mount, handles its own loading/error state
- Renders `SelfEvaluationForm` inline

Tour detail page (`/dashboard/tours/[id]/page.tsx`) conditionally renders:
```
{tour.status === 'completed' && tour.myBookingStatus === 'confirmed' && (
  <TourSelfEvalSection tourId={id} />
)}
```
No other changes to the tour detail page.

#### Step 7 — i18n

New namespace `selfEvaluations` in `en.json` + `ja.json`:
- `selfEvaluations.sectionTitle`
- `selfEvaluations.fields.*` — 10 fields (no `reliability`)
- `selfEvaluations.scoreLegend`, `scoreMin`, `scoreMax`, `notePlaceholder`
- `selfEvaluations.actions.save`, `actions.cancel`
- `selfEvaluations.locked` (message shown when locked)
- `selfEvaluations.error.*`
- `selfEvaluations.messages.saved`

### Deferred

- Self-eval history page (not needed; bookmark via booking history → tour detail)
- `SelfEvaluationResponse` enrichment with `tourDate`/group name (only needed if history page is built)

---

## Built

### feat/admin/evaluation-ui (PR #61 merged + 3 cleanup commits, PR pending)

| What | Files |
|---|---|
| Admin eval API client methods | `apps/web/src/lib/api-client.ts` |
| Admin eval action module | `admin/evaluations/admin.evaluation.ts` |
| Shared eval form helpers | `admin/evaluations/evaluation-form.ts` |
| `EvaluationScoreField` primitive | `admin/_components/evaluation-score-field.tsx` |
| Admin profile eval form | `admin/buddies/_components/admin-profile-evaluation-form.tsx` |
| Admin profile eval summary | `admin/buddies/_components/admin-profile-evaluation-summary.tsx` |
| Per-tour eval list + form (buddy view) | `admin/buddies/_components/buddy-per-tour-evaluations.tsx`, `buddy-per-tour-evaluation-form.tsx` |
| Self-eval read-only view (admin) | `admin/buddies/_components/buddy-self-evaluations.tsx` |
| Tour eval section + form (tour view) | `admin/tours/_components/tour-buddy-eval-section.tsx`, `tour-per-buddy-evaluation-form.tsx` |
| Eval detail page | `admin/evaluations/[id]/page.tsx` |
| `AdminEvaluationResponse` extended | `tourDate`, `tourGroupName` fields; all score/note fields `.nullish()` |

### feat/evaluation-base (merged, PR #59)

| What | Files |
|---|---|
| Prisma models | `AdminEvaluation`, `SelfEvaluation`, `AdminProfileEvaluation` |
| Zod schemas + response types | `packages/types/src/index.ts` |
| Admin per-tour eval CRUD | `services/adminEvaluation.service.ts`, `routes/adminEvaluations.ts` |
| Admin profile eval upsert/get | `services/adminProfileEvaluation.service.ts`, `routes/adminProfileEvaluations.ts` |
| Buddy self-eval create/list/update | `services/selfEvaluation.service.ts`, `routes/selfEvaluations.ts` |
| Admin read of self-evals | `routes/adminSelfEvaluations.ts` |

### Buddy dashboard (merged, various PRs)

| What | Files |
|---|---|
| Booking history page | `dashboard/bookings/page.tsx` + `use-my-bookings` hook |
| Tour detail page with full booking/cancel flow | `dashboard/tours/[id]/page.tsx` |
| Profile settings | `dashboard/profile/` |
| Dashboard tour list | `dashboard/page.tsx` |

---

## Decisions (stable)

### Evaluation system
- Admin per-tour eval: one per buddy per tour, `@@unique([buddyId, tourId])`; any admin can edit; no deadline
- Self-eval: editable until `createdAt + 7 days` (`SELF_EVAL_EDIT_WINDOW_DAYS = 7`), computed at service layer
- Profile eval: one per buddy (upsert); no tour link; no deadline; `createdBy` = original creator only
- `overallRating`: stored, manually set — not computed from dimension scores

### Admin buddy pages
- Flat navigation: pending + buddies as separate top-level menu items
- API uses query params (`?status=pending`, `?status=active`)

### Buddy profile settings (§11.6)
- Language enum ordered for UI; Skills: free text textarea
- Photo: disabled, "coming soon"
- After save: stay on page, refetch, inline success message

### Status display (shared)
- `apps/web/src/lib/status-display.ts` — `getBuddyStatusLabel`, `getTourStatusLabel`, `getBookingStatusLabel`

---

## Deferred — Phase 2

`trainee` BuddyStatus alignment (§5.1):

| File | Change |
|---|---|
| `packages/types/src/index.ts` | Add `'trainee'` to `BuddyStatusSchema` |
| `apps/api/src/services/admin.service.ts` | Handle `trainee` in status transitions |
| `apps/web/src/lib/status-display.ts` | Add `trainee` label/badge |
| `apps/web/messages/{en,ja}.json` | Add `buddyStatus.trainee` |
| `apps/web/src/app/[locale]/dashboard/page.tsx` | `trainee` buddies can view but not book |
| Prisma migration | `ALTER TYPE BuddyStatus ADD VALUE 'trainee'` |

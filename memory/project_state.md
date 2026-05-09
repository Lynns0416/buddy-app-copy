---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
## Built & Merged to main
- Admin profile system (#63): ensureAdminProfile middleware, createdByName in evaluations
- Admin profile & roster pages (#63): view/edit own name, super_admin soft-delete
- Evaluation fixes (#64): i18n fixes, self-eval card with pips, multi-admin eval support
- Tour booking consolidation: removed applications UI, consolidated into tours booking flow, removed applications endpoints
- Tier-based capacity model (#68): 3-pool capacity (junior/non_junior/anyone), TierCapacity table, pool-scoped myCapacity/myRemaining, TierCapacityForm admin UI, anyoneConfirmed formula fix, promoteWaitlist serializable tx, notEligible i18n error
- Fix/tour api for trainee (#69): listTours/getTour block trainee buddies at service level

## Current Work — feat/admin/add-trainee-menu-item
Refactoring `trainee` from `BuddyTier` to `BuddyStatus`.

### Complete (not yet PR'd)
- **Schema**: `BuddyStatus` gains `trainee`; `BuddyTier` loses `trainee`
- **Types package**: `BuddyStatusSchema`, `BuddyTierSchema`, `UpdateBuddyStatusSchema` updated; rebuilt
- **`admin.service.ts`**: `updateBuddyStatus` always sets `tier=junior` on `active`, no tier on `trainee`
- **`tour.service.ts`**: trainee gate uses `status === trainee` (not tier)
- **`booking.service.ts`**: removed redundant `tier === trainee` check
- **`admin.ts` route**: removed tier extraction from status update body
- **`admin.service.test.ts`**: full rewrite — fixed eslint-disables, vi.mocked pattern, new status tests
- **`admin.test.ts`**: updated tier/status tests, trainee tier now 400
- **`tour.service.test.ts`**: trainee gate tests use `status: 'trainee'`
- **`booking.service.test.ts`**: trainee NOT_ELIGIBLE test uses `status: 'trainee'`
- **`status-display.ts`**: added `trainee` badge variant
- **i18n en/ja**: `buddyStatus.trainee`, `promoteButton`, updated `promoteTierModal.message` (name only), `adminTrainees.error.unknown`, removed `tierTrainee`, replaced `traineesNote` with `viewTrainees`
- **`admin.buddy.ts`**: `fetchTrainees()` calls `fetchBuddies(status=trainee)`; removed BuddyTierSchema import
- **`admin.buddy.test.ts`**: fixture tier null, fetchTrainees expects trainee status
- **`use-buddies.ts`**: new hook (fetch+error, pages own sort state)
- **`use-trainees.ts`**: new hook
- **`buddies/page.tsx`**: uses `useBuddies()`, static "View trainees →" link
- **`trainees/page.tsx`**: uses `useTrainees()`, clean namespace
- **`buddy-form.tsx`**: status-aware — trainee shows promote button, hides tier dropdown; non-trainee shows tier dropdown; `doPromote()` calls `updateBuddyStatus('active')` → redirects to adminTrainees
- **`promote-tier-modal.tsx`**: removed `tierLabel` prop, message uses `{name}` only
- **`pending/page.tsx`**: approve sets status=trainee (not active); eslint-disable removed
- **`[id]/page.tsx`**: back link status-aware (trainee→adminTrainees, else adminBuddies); eslint-disable removed
- **`seed.ts`**: trainees use `status: BuddyStatus.trainee`, `tier: null`
- **`prisma db push`**: applied (removed trainee from BuddyTier enum)
- **Tests**: 442/442 pass

### Open
- PR not yet created

## Next Phase

### Deferred
- Training schedules section for trainee buddies (separate section, not tours)
- Self-evaluation UI (spec in PRD §8.8): fetch tourId filter, form component, tour section integration

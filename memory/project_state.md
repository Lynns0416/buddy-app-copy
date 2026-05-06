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

## Current Work — feat/tour-capacity-by-tier-ui (PR pending)

### Complete
- Schema: 3-pool capacity model (`BookingPool` enum: junior/non_junior/anyone), `TierCapacity` table
- `lib/pool.ts`: shared `getPoolCapacities`, `NON_JUNIOR_TIERS` between booking and tour services
- `tour.service.ts`: `getTour` computes `myRemaining` (buddy's pool remaining + anyone overflow)
- `booking.service.ts`: imports pool logic from shared `lib/pool.ts`
- Admin API: GET/PATCH `/:id/tier-capacities` endpoints in `adminTours.ts`
- `adminTour.service.ts`: `getTierCapacities`, `upsertTierCapacities` (atomic $transaction)
- Types: `TierCapacityEntry`, `UpsertTierCapacitiesSchema`, updated `TourDetailResponse` with `remaining` + `myRemaining`
- Web: `TierCapacityForm` component (live seat count, sum validation, ActionResult pattern)
- Web: Admin tour detail page renders `TierCapacityForm`
- Web: Buddy tour detail page shows `myRemaining` (pool-specific) or falls back to `remaining`
- i18n: `tierCapacity` namespace in en.json + ja.json; renamed fields throughout
- Seed: fixed `buddyTier` on all booking creates, removed ApplicationPool references
- Tests: full coverage — tour.service, adminTours routes, admin.tour.ts action module, page tests

## Next Phase

### Immediate
- Open PR for feat/tour-capacity-by-tier-ui and merge

### Phase 2 — Deferred
- `trainee` BuddyStatus alignment (§5.1): add status value, handle in transitions, add label/badge, update login flow
- Self-evaluation UI (spec in PRD §8.8): fetch tourId filter, form component, tour section integration
</content>
</invoke>
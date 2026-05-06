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

## Current Work — fix/tour-api-for-trainee

### Complete
- `listTours` blocks trainee buddies at service level (returns `[]`)
- `getTour` blocks trainee buddies at service level (returns `null` → 404)
- Route passes `userId` to `listTours`
- Tests updated: new trainee cases, existing `listTours` calls updated to pass userId

### Open
- PR not yet created

## Next Phase

### Deferred
- Training schedules section for trainee buddies (separate section, not tours)
- `trainee` BuddyStatus alignment (§5.1): add status value, handle in transitions, add label/badge, update login flow
- Self-evaluation UI (spec in PRD §8.8): fetch tourId filter, form component, tour section integration

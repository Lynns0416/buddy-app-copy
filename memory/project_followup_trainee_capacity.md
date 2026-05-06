---
name: Trainee myCapacity/myRemaining follow-up
description: getTour returns pool-scoped capacity for trainee buddies — should return null since trainee can't book
type: project
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
`getTour` in `apps/api/src/services/tour.service.ts` computes `myCapacity` and `myRemaining` for any buddy who has a tier set, including trainee. Trainee is treated as non-junior, so they see the non-junior pool capacity — which is misleading since trainee can't book (`createBooking` already blocks them with `NOT_ELIGIBLE`).

**Why:** Trainee sees capacity numbers that imply they could book, but they can't. The `null` fallback in `TourDetailResponse` is the correct signal for "you have no pool-scoped view."

**How to apply:** In the next PR that touches `tour.service.ts` or buddy eligibility, add a guard: if `buddyProfile.tier === PrismaBuddyTier.trainee`, skip the pool capacity computation and leave `myCapacity`/`myRemaining` as `null`. This matches the `getTour` behavior for buddies with no tier set.

(code owner added the following description.)

Description looks confusing. Trainee shouldn't see `tour` itself. they can't join yet. they see only training schedules which will be added later.
---
name: Trainee tour access follow-up
description: Trainees must not see tours at all — enforced at API level in tour.service.ts
type: project
originSessionId: b4422d44-5a3d-4967-9db8-c9ddd4f1ed06
---
Trainees cannot book tours and should not see tour data. This is a business rule, not a UI concern.

**Why:** Trainees are on a different track (training schedules, not tours). Showing them tours is misleading and incorrect. Training schedules will be a separate section built later.

**How to apply:**
- `listTours` in `tour.service.ts` must accept `userId`, look up the buddy's tier, and return `[]` if trainee.
- `getTour` in `tour.service.ts` already fetches `buddyProfile`. Add a guard: if `tier === trainee`, return `null` (route responds 404).
- Route handler `tourRoutes.get('/')` must pass `c.get('user').id` to `listTours`.
- For now, trainee dashboard shows empty state — acceptable until training schedules are built.
- No Prisma schema changes needed.

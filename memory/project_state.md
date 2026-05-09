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
- Trainee refactor (#70): `trainee` moved from `BuddyTier` to `BuddyStatus`; tier=null for trainees; booking/tour eligibility gates updated; seed, UI, i18n, tests all updated

## Current Work — feat/multiple-tours

### Complete (API layer — previous sessions)
- `TourSession` model: id, tourId, order, label, meetingTime, capacity, participantCount
- `Booking.sessionId` + `@@unique([buddyId, sessionId])`, `TierCapacity` moved to session-scoped
- Types: `TourSessionResponse`, `TourSessionDetailResponse`, `MyTourBookingEntry`, `MySessionBookingEntry`, `AdminTourBookingEntry` updated with session fields
- API routes: `POST/PUT/DELETE /admin/tours/:id/sessions/:sessionId`, tier-capacity session-scoped
- `PUT /tours/:tourId/sessions/:sessionId/bookings/me` replaces old `PUT /tours/:id/bookings/me`
- Services fully updated (booking, tour, adminTour, admin buddy)
- `api-paths.ts`, `api-client.ts`, `admin.tour.ts` updated

### Complete (Web layer — this session)
- `tour-form.tsx`: sessions via `useFieldArray`, `hideSessionManagement` prop for edit mode
- `add-session-form.tsx`: new component for admin to add 2nd session
- `session-booking-card.tsx`: new component for per-session booking actions on buddy tour detail
- `admin/tours/[id]/page.tsx`: sessions display, per-session TierCapacityForm, session management, session column in bookings table
- `admin/tours/[id]/edit/page.tsx`: strips sessions from updateTour payload, hideSessionManagement
- `dashboard/page.tsx`: shows sessions meetingTime
- `dashboard/tours/[id]/page.tsx`: completely rewritten for per-session booking
- `dashboard/tours/[id]/dashboard.booking.ts`: sessionId param added
- `dashboard/bookings/page.tsx`: uses `MyTourBookingEntry`
- `hooks/use-my-bookings.ts`: updated to `MyTourBookingEntry`
- `messages/en.json` + `ja.json`: session strings added
- All affected tests updated

### Open
- `prisma db push` not yet run (needs Docker)
- PR not yet created

## Next Phase

### Deferred
- Training schedules section for trainee buddies (separate section, not tours)
- Self-evaluation UI (spec in PRD §8.8): fetch tourId filter, form component, tour section integration

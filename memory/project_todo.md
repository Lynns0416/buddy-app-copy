---
name: Project TODOs
description: Deferred requirements and all unbuilt features from the PRD
type: project
---

## Deferred schema / data model changes

### Tour timeline / duration
- Tour model needs start time and end time fields (or duration)
- `meetingTime` on Tour is assembly time, ~30–40 min before tour start — it is NOT the start time
- Tour timeline will have a relation with the Tour model (exact shape TBD)
- Impacts: tour display on dashboard, buddy scheduling, notifications

### Tour booking open/closed status
- Need to distinguish `published + open` (buddies can book) vs `published + closed` (visible, cannot book)
- Currently `TourStatus` = `draft | published | cancelled | completed` — no open/closed distinction
- Options: add new status values, or add a separate `bookingOpen: Boolean` field on Tour
- Must decide data model before implementing booking flow

---

## Unbuilt features (from PRD v0.3)

### Group management (§6)
**API:**
- `GET /admin/groups` — list all groups
- `POST /admin/groups` — create group
- `PUT /admin/groups/:id` — edit group
- `GET /admin/groups/:id` — group detail + tour history

**Web:**
- Admin group list page
- Admin group create/edit form
- Admin group detail page (tour history)

---

### Tour management — admin (§7)
**API:**
- `POST /admin/tours` — create tour (draft)
- `PUT /admin/tours/:id` — edit tour fields
- `PUT /admin/tours/:id/status` — publish / cancel / complete
- `DELETE /admin/tours/:id` — hard delete (draft only; PRD §data-model soft delete policy)
- `GET /admin/tours` — list all tours (all statuses, admin view with adminMemo)
- `GET /admin/tours/:id` — tour detail for admin (includes booking list, adminMemo)

**Web:**
- Admin tour list page
- Admin tour create/edit form (all fields including adminMemo, deadlines, notification offsets)
- Admin tour detail page (booking list: buddy name, status, booked time)

---

### Tour detail — buddy-facing (§7, §8.2)
**API:**
- `GET /tours/:id` — tour detail with seat counts (confirmed / maybe / waitlist / declined) and remaining seats; buddy's own booking status if any

**Web:**
- Tour detail page for buddies (seat counts, remaining seats, description, location, group name — but NOT who else booked)

---

### Booking system (§8)
**API:**
- `POST /tours/:id/bookings` — create booking (confirmed / maybe / waitlist)
- `PUT /tours/:id/bookings` — update booking status (all transitions per §8.4 matrix)
  - When Confirmed → Declined: must record cancellation reason (category + optional free text)
  - Enforce cancellation deadline; after deadline, only admin can change
- Waitlist: notify all waitlisted buddies when a Confirmed → Declined opens a seat (§8.6)
- Maybe: deadline enforcement and notification (§8.5)
- `GET /me/bookings` — buddy's own booking history (all past + current)
- `GET /admin/tours/:id/bookings` — all bookings for a tour (admin only; includes buddy names)
- `GET /admin/buddies/:id/bookings` — all bookings for a buddy (admin only)

**Web:**
- Booking action buttons on tour detail/dashboard (confirm / maybe / waitlist / decline)
- Cancellation reason modal (category select + optional free text) — triggered on Confirmed → Declined
- Buddy booking history page

**Edge cases to handle:**
- Atomic seat claim for waitlist (DB transaction + row lock; second claim fails gracefully)
- `BuddyCancellationDeadlineOverride`: admin can set per-buddy deadline on a tour
  - API: `PUT /admin/tours/:id/bookings/:buddyId/deadline`
  - Web: shown in admin tour detail page

---

### Admin buddy management — full (§11.4)
Currently only approval (status change) is built. Missing:

**API:**
- `GET /admin/buddies/:id` — full buddy detail (status, tier, internalNotes, admin evaluations, self-evaluations, booking history)
- `PUT /admin/buddies/:id` — update tier, internalNotes (status update already exists at `/:id/status`)

**Web:**
- Admin buddy detail page (full profile, evaluations summary, booking history)
- Tier + notes edit form on buddy detail

---

### Evaluation system (§9)
**API — admin evaluations:**
- `POST /admin/buddies/:id/evaluations` — create evaluation (per-tour or general)
- `GET /admin/buddies/:id/evaluations` — list all evaluations for a buddy
- `PUT /admin/evaluations/:id` — edit existing evaluation
- Prompt flow: when tour marked Completed → return list of Confirmed buddies for admin to evaluate

**API — self-evaluations:**
- `POST /me/self-evaluations` — submit self-eval for a completed tour
- `GET /me/self-evaluations` — list own self-evals
- `GET /admin/buddies/:id/self-evaluations` — admin view of a buddy's self-evals

**Web:**
- Admin evaluation form (all score + text fields per §9.2)
- Admin tour completion flow: prompt with list of Confirmed buddies → select → evaluate
- Buddy self-evaluation form (no reliability field)
- Buddy self-eval history page

---

### Notifications (§10)
**API:**
- `GET /me/notifications` — in-app notification list (unread first)
- `PUT /me/notifications/:id/read` — mark read
- `POST /internal/notifications/flush-digest` — Cloud Scheduler endpoint for daily digest
- Notification sends on:
  - New tour published → all active buddies (in-app + email)
  - Tour details changed → all Confirmed/Maybe/Waitlist buddies (in-app + email)
  - Tour reminder → N days before tour (in-app + email; configurable offsets)
  - Maybe deadline reminder → N days before deadline
  - Waitlist seat opened → all waitlisted buddies (in-app + email)
  - Account approved/rejected → buddy (email)
  - New signup → admins (email or Slack)
  - Cancellation → admins (email or Slack)
  - Maybe resolved → admins
  - Maybe deadline missed → admins

**Web:**
- Notification bell / indicator (unread count)
- Notification list / drawer

---

### Admin notification preferences (§10.2)
**API:**
- `GET /admin/me/notification-prefs` — current prefs
- `PUT /admin/me/notification-prefs` — update per-event channel + delivery mode

**Web:**
- Admin notification preferences settings page

---

### Profile photo upload (§5.3)
- GCP Cloud Storage integration
- `POST /me/profile/photo` — upload signed URL or direct upload
- `DELETE /me/profile/photo`
- Web: photo upload on buddy profile edit page

---

### System configuration — Super Admin only (§11.5)
**API:**
- Admin account management: `POST /super-admin/users` (create admin), `PUT /super-admin/users/:id/role`
- Global defaults: cancellation deadline offset, maybe deadline offset, notification schedule offsets
- `GET /super-admin/config`, `PUT /super-admin/config`

**Web:**
- Super admin config page

---

### Apple sign-in (§4)
- Deferred: waiting for Apple Developer account
- Firebase already configured with `OAuthProvider('apple.com')` in `auth.tsx` — just needs enabling

---

### Data migration (§14)
- One-time import script: Google Sheets CSV → Prisma (buddy profiles)
- Run after launch setup; admin fills missing fields via dashboard


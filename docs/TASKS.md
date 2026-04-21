# Task Tracker

Checkboxes reflect build status. Update when a PR merges.
Linked to PRD sections — refer to `docs/PRD.md` for full spec.

---

## M1 — Foundation ✅
- [x] Monorepo, Docker, Prisma schema
- [x] Firebase Auth (Google), session cookie
- [x] `POST /auth/register`, `GET /auth/me`
- [x] `GET /me/profile`, `PUT /me/profile`
- [x] Admin middleware + `/admin` router
- [x] ESLint (flat config, strict TS)
- [x] next-intl i18n (ja/en)
- [x] Seed data

---

## M2 — Buddy & Group core ✅
- [x] `GET /tours` — buddy tour list
- [x] `/[locale]/dashboard/page.tsx` — buddy dashboard with tour list
- [x] `GET /admin/buddies?status=` — buddy list with filter
- [x] `PUT /admin/buddies/:id/status` — approve / reject
- [x] `/[locale]/admin/buddies/page.tsx` — admin buddy list + approval flow
- [x] Group CRUD: `GET/POST /admin/groups`, `GET/PUT /admin/groups/:id`
- [x] Admin group web pages (list, create, detail, edit)

---

## M3 — Tour management (admin) 🔄 partially done
- [x] `GET /admin/tours` — tour list (all statuses)
- [x] Admin tour list page
- [x] `TourForm` component (React Hook Form)
- [ ] `POST /admin/tours` — create tour (draft) · PRD §7
- [ ] `PUT /admin/tours/:id` — edit tour fields
- [ ] `PUT /admin/tours/:id/status` — publish / cancel / complete
- [ ] `DELETE /admin/tours/:id` — hard delete (draft only)
- [ ] `GET /admin/tours/:id` — tour detail (booking list, adminMemo)
- [ ] Admin tour create/edit form (all fields incl. deadlines, notification offsets)
- [ ] Admin tour detail page (booking list: buddy name, status, booked time)

---

## M4 — Tour detail (buddy-facing) ✅
- [x] `GET /tours/:id` — detail with seat counts + `myBookingStatus`
- [x] `/[locale]/dashboard/tours/[id]/page.tsx`
- [x] Dashboard tour cards linked to detail page

---

## M5 — Booking system · PRD §8 ⬜ next up
- [ ] `POST /tours/:id/bookings` — create (Confirmed / Maybe / Waitlist)
- [ ] `PUT /tours/:id/bookings/:bookingId` — update status (full transition matrix)
  - [ ] Cancellation reason modal (category + optional free text) on Confirmed → Declined
  - [ ] Cancellation deadline enforcement (buddy blocked after deadline)
  - [ ] Admin override: `PUT /admin/tours/:id/bookings/:buddyId/deadline`
- [ ] Waitlist auto-notify on seat open (all waitlisted buddies)
- [ ] Maybe deadline enforcement + reminder hooks
- [ ] Atomic seat claim (DB transaction, second claim fails gracefully)
- [ ] `GET /me/bookings` — buddy's own booking history
- [ ] `GET /admin/tours/:id/bookings` — all bookings for a tour (admin)
- [ ] `GET /admin/buddies/:id/bookings` — all bookings for a buddy (admin)
- [ ] Web: booking action buttons on tour detail (Confirm / Maybe / Waitlist / Decline)
- [ ] Web: cancellation reason modal
- [ ] Web: buddy booking history page

---

## M6 — Admin buddy management (full) · PRD §11.4
- [ ] `GET /admin/buddies/:id` — full detail (status, tier, notes, eval summary, booking history)
- [ ] `PUT /admin/buddies/:id` — update tier, internalNotes
- [ ] Admin buddy detail page
- [ ] Tier + notes edit form on buddy detail

---

## M7 — Evaluation system · PRD §9
- [ ] `POST /admin/buddies/:id/evaluations` — create per-tour or general eval
- [ ] `GET /admin/buddies/:id/evaluations` — list evaluations
- [ ] `PUT /admin/evaluations/:id` — edit evaluation
- [ ] Admin eval prompt on tour Completed (list of Confirmed buddies)
- [ ] `POST /me/self-evaluations` — buddy submits self-eval for completed tour
- [ ] `GET /me/self-evaluations` — buddy's own self-evals
- [ ] `GET /admin/buddies/:id/self-evaluations` — admin view
- [ ] Admin evaluation form (all score + text fields)
- [ ] Admin tour completion flow (prompt → select buddy → evaluate)
- [ ] Buddy self-evaluation form
- [ ] Buddy self-eval history page

---

## M8 — Notifications · PRD §10
- [ ] `GET /me/notifications`, `PUT /me/notifications/:id/read` — in-app
- [ ] `POST /internal/notifications/flush-digest` — Cloud Scheduler digest
- [ ] `sendEmail()` utility (abstract provider; Resend or Gmail API)
- [ ] Email sends: new tour, tour changed, tour reminder, maybe deadline, waitlist open, approval/rejection
- [ ] Slack webhook: new signup, booking cancelled, maybe resolved/missed, new booking digest
- [ ] Web: notification bell + unread count
- [ ] Web: notification list / drawer

---

## M9 — Admin notification preferences · PRD §10.2
- [ ] `GET /admin/me/notification-prefs`, `PUT /admin/me/notification-prefs`
- [ ] Web: admin notification preferences settings page

---

## M10 — Super admin + system config · PRD §11.5
- [ ] `POST /super-admin/users` — create admin account
- [ ] `PUT /super-admin/users/:id/role`
- [ ] `GET /super-admin/config`, `PUT /super-admin/config` — global defaults
- [ ] Super admin config web page

---

## Infra / ops
- [ ] Profile photo upload: GCP Cloud Storage · PRD §5.3
  - [ ] `POST /me/profile/photo` (signed URL / direct upload)
  - [ ] `DELETE /me/profile/photo`
  - [ ] Web: photo upload on buddy profile edit
- [ ] Data migration script: Google Sheets CSV → Prisma · PRD §14
- [ ] Apple sign-in (waiting on Apple Developer account) · PRD §4
- [ ] GCP Cloud Run + Cloud SQL deployment
- [ ] GitHub Actions CI/CD

---

## Bug fixes / quality
- [x] Routing fix: logout redirect, login redirect, `/` blank page · #31
- [x] Frontend magic strings replaced with enum values · #23
- [x] Zod validation error details in API responses · #25
- [x] React Hook Form integration · #26
- [x] Frontend test suite · #27

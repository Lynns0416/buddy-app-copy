# Roadmap

Living list of remaining v1 scope. Each item links back to the PRD section that defines the behaviour. Update this file as items ship (remove or move to a "Recently shipped" section) and as new scope is agreed.

Source of truth for completed work is `git log` — do not duplicate ship dates here.

---

## Before launch

Target: release in 1–2 weeks from 2026-08-15. Only the Slack webhook blocks it — Apple sign-in is held behind a flag rather than shipped broken.

- [x] **Admin notifications via Slack** — replaced the broken admin email path rather than building it. `new_signup` and `new_booking` had no email template and no email enqueue site at all, so the originally-planned "flip the defaults to immediate" would have changed nothing. See `docs/decisions.md` 2026-08-15.
- [ ] **Create the Slack app and set `SLACK_WEBHOOK_URL`** — the code ships inert without it. Sending is gated on `SLACK_ENABLED=true` or `NODE_ENV=production`; until the webhook exists, admins get in-app only. **This is now the launch dependency.**
- [ ] **Apple sign-in: Firebase console config** (Service ID + key) — no longer launch-blocking. The button is disabled behind `NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED` and shows "coming soon" until the provider exists; re-enable by rebuilding web with the flag set to `true`. See `docs/decisions.md` 2026-08-15 and 2026-09-13.

Deliberately **not** blocking launch — all are missing nudges rather than broken flows, and at ~50 buddies / 5–6 admins they surface within a day:

- `self_eval_prompt` and `waitlist_opened` never enqueued (see below)
- `upsertUser` duplicate-account risk from Apple Hide My Email (see `docs/decisions.md`)
- Digest mode stays selectable in the admin UI with no flush job behind it. Admin email is off by default so nobody hits it by accident, but an admin who enables email *and* picks digest gets silence. Either build the job or remove the option.

---

## Notifications

In-app delivery (#100) and email delivery (#101) shipped the queue, dispatcher, per-admin preferences, email-mode handling (immediate today), and the event triggers listed as "Shipped" in PRD §10. What remains:

### Time-based cron jobs (PRD §10.5)

All four jobs share the same `X-Scheduler-Secret` middleware as the existing `/jobs/notifications/dispatch` endpoint.

- [x] `POST /jobs/notifications/reminders` — hourly. Match `Tour.notificationOffsets` (default `[3, 1]`) against now and enqueue `tour_reminder` to confirmed / maybe / waitlist buddies. Shipped #103.
- [x] `POST /jobs/notifications/maybe-reminders` — hourly. Enqueue `maybe_reminder` to buddies still in Maybe at offsets `[3, 1]` days before the tour's `maybeDeadline`. Shipped #104.
- [x] `POST /jobs/notifications/maybe-deadlines` — hourly. Enqueue `maybe_deadline_missed` to assigned admins for any unresolved Maybe past deadline. Fires on the JST day after `maybeDeadline` only; idempotent per tour via `NotificationDispatchLog`.
- [ ] `POST /jobs/notifications/digest` — 09:00 JST. Flush `DigestQueue` per admin; one email per admin per day; skip if no activity. Admins who choose `emailMode = 'digest'` for any event currently get nothing — `DigestQueue` has no writer, so even building the flush job would find an empty table. **Not launch-blocking** now that admin notifications go to Slack and admin email is off by default — build it only if someone actually asks for digest email.

### Schema prerequisite

- [x] `NotificationDispatchLog(eventKey UNIQUE)` table — idempotency for the cron jobs above. Shipped #103.

### Missing enqueue sites (events declared in `NotifEventKindSchema` but never enqueued)

- [ ] `waitlist_opened` — PRD §10.1 says immediate to all buddies on the waitlist for the freed pool. Today only `waitlist_promoted` fires.
- [ ] `self_eval_prompt` — PRD §10.1 says in-app on tour Completed to Confirmed buddies. No call site. The filter it needs is specified: send to a Confirmed buddy with no `TourReflection` on **any** session of that tour (PRD §9.3, `docs/decisions.md` 2026-09-23).
- [x] `tour_details_changed` on session `meetingTime` change — wired in `updateSession` alongside the place change. Shipped #247.

### Slack channel (PRD §10.3)

- [x] Slack delivery shipped for all six admin events — `lib/slack.ts` sender, `services/slackTemplates/`, `enqueueSlackForAdmins`, and the dispatcher case. One shared channel via `SLACK_WEBHOOK_URL`; still needs the webhook created (see "Before launch").
- [x] Slack and email messages name the acting buddy and the tour, not just the event — shared interpolation in `lib/templateRender.ts`, payloads widened at every enqueue site, typed per event in `packages/types`. `docs/decisions.md` 2026-09-13.
- [ ] Per-admin Slack targeting / `@mentions` — deferred. Requires per-user Slack IDs and a bot token instead of an incoming webhook. `slackEnabled` is informational only until then.

---

## Admin

- [x] **Admin home worklist** — `/admin` lists pending applications, unresolved Maybes past deadline, tours short of buddies in the next 14 days, completed tours missing evaluations, and unread notifications. No metrics. PRD §11.7, #198.
- [x] **Buddy stats** — `/admin/buddies/stats`: one row per buddy, ~40 numbers (attendance, cancellations, reflections, evaluation averages, places and group types), scoped by period / group type / place, columns chosen per admin, with an overview of figures and charts above the table that narrows it on click. Same numbers on the buddy detail page. PRD §11.4, #253.
- [ ] **Booking history for stats** — Maybe→Confirmed conversion, waitlist promotions, tier promotion dates and booking lead time need an event or history table; a `Booking` keeps only its current status. Out of #253.
- [ ] **Organisation-wide numbers over time** — sessions, tours and active buddies per month, session fill rates, share of tours below minimum. Needs a per-month query. Out of #253; tracked in #250.

---

## Bookings / Tours

- [ ] **Buddy suspend / un-suspend** — PRD §11.4 #788. `BuddyStatus.suspended` enum exists; the status endpoint does not accept it. Need API path + admin UI affordance.
- [ ] **Per-buddy cancellation deadline override** — PRD §7.1 / §11.2. `BuddyCancellationDeadlineOverride` model exists in schema; no admin API or UI to manage it.

---

## System configuration

- [ ] **`/admin/config` global defaults** — PRD §11.5. Cancellation deadline offset, Maybe deadline offset, Maybe reminder offsets, tour-reminder default offsets. No route, service, or DB model yet. Per-tour `notificationOffsets` stays the per-tour override.
- [ ] **Org-wide notification defaults** — PRD §11.5. Defaults applied when a new admin is created (today every admin starts from hard-coded defaults in `notificationPreference.service.ts`).

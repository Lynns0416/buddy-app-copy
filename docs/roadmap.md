# Roadmap

Living list of remaining v1 scope. Each item links back to the PRD section that defines the behaviour. Update this file as items ship (remove or move to a "Recently shipped" section) and as new scope is agreed.

Source of truth for completed work is `git log` — do not duplicate ship dates here.

---

## Notifications

In-app delivery (#100) and email delivery (#101) shipped the queue, dispatcher, per-admin preferences, email-mode handling (immediate today), and the event triggers listed as "Shipped" in PRD §10. What remains:

### Time-based cron jobs (PRD §10.5)

All four jobs share the same `X-Scheduler-Secret` middleware as the existing `/jobs/notifications/dispatch` endpoint.

- [x] `POST /jobs/notifications/reminders` — hourly. Match `Tour.notificationOffsets` (default `[3, 1]`) against now and enqueue `tour_reminder` to confirmed / maybe / waitlist buddies. Shipped #103.
- [x] `POST /jobs/notifications/maybe-reminders` — hourly. Enqueue `maybe_reminder` to buddies still in Maybe at offsets `[3, 1]` days before the tour's `maybeDeadline`. Shipped #104.
- [ ] `POST /jobs/notifications/maybe-deadlines` — hourly. Enqueue `maybe_deadline_missed` to assigned admins for any unresolved Maybe past deadline.
- [ ] `POST /jobs/notifications/digest` — 09:00 JST. Flush `DigestQueue` per admin; one email per admin per day; skip if no activity. Admins who chose `emailMode = 'digest'` for any event currently get nothing — this is the gap that unblocks the digest preference.

### Schema prerequisite

- [x] `NotificationDispatchLog(eventKey UNIQUE)` table — idempotency for the cron jobs above. Shipped #103.

### Missing enqueue sites (events declared in `NotifEventKindSchema` but never enqueued)

- [ ] `waitlist_opened` — PRD §10.1 says immediate to all buddies on the waitlist for the freed pool. Today only `waitlist_promoted` fires.
- [ ] `self_eval_prompt` — PRD §10.1 says in-app on tour Completed to Confirmed buddies. No call site.
- [ ] `tour_details_changed` on session `meetingTime` change — PRD §10.1 lists meeting time as a trigger but `adminSession.service.ts:updateSession` does not enqueue today. Decide: wire it, or drop `meetingTime` from PRD §10.1.

### Slack channel (PRD §10.3)

- [ ] Wire Slack delivery. The dispatcher currently fails `channel: 'slack'` jobs with `"slack channel not yet implemented"`. Needs `SLACK_WEBHOOK_URL` env var, a sender, and enqueue sites that emit `channel: 'slack'` rows when an admin has `slackEnabled = true` for the event. Confirm whether Slack is still in v1 scope before building.

---

## Bookings / Tours

- [ ] **Buddy suspend / un-suspend** — PRD §11.4 #788. `BuddyStatus.suspended` enum exists; the status endpoint does not accept it. Need API path + admin UI affordance.
- [ ] **Per-buddy cancellation deadline override** — PRD §7.1 / §11.2. `BuddyCancellationDeadlineOverride` model exists in schema; no admin API or UI to manage it.

---

## System configuration

- [ ] **`/admin/config` global defaults** — PRD §11.5. Cancellation deadline offset, Maybe deadline offset, Maybe reminder offsets, tour-reminder default offsets. No route, service, or DB model yet. Per-tour `notificationOffsets` stays the per-tour override.
- [ ] **Org-wide notification defaults** — PRD §11.5. Defaults applied when a new admin is created (today every admin starts from hard-coded defaults in `notificationPreference.service.ts`).

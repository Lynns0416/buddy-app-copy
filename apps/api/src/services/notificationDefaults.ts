import {
  EmailModeSchema,
  type BuddyNotifEventType,
  type EmailMode,
  type NotifEventType,
} from '@peace-buddy/types'

// Single source of truth for notification defaults, used when no
// NotificationPreference row exists for a person.
//
// Two consumers, deliberately one table:
// - notification.service.ts decides what actually sends
// - notificationPreference.service.ts decides what the admin settings screen shows
// Splitting these apart once let the screen and delivery drift; keep them here.
//
// Email is off by default for every admin event — Slack is the admin channel
// (docs/decisions.md 2026-08-15). An admin can still opt back in per event.
// `mode` is retained because the field is still user-settable, but it only
// takes effect once `enabled` is turned on.
//
// Lives outside both services so that a test mocking either one cannot make the
// other's defaults undefined.
export const DEFAULT_ADMIN_EMAIL_PREFS: Record<
  NotifEventType,
  { enabled: boolean; mode: EmailMode }
> = {
  new_signup: { enabled: false, mode: EmailModeSchema.enum.immediate },
  new_booking: { enabled: false, mode: EmailModeSchema.enum.immediate },
  cancellation: { enabled: false, mode: EmailModeSchema.enum.immediate },
  maybe_resolved: { enabled: false, mode: EmailModeSchema.enum.immediate },
  maybe_deadline_missed: { enabled: false, mode: EmailModeSchema.enum.immediate },
}

// Buddy defaults, same two consumers as above. Everything is on: a buddy who has
// never opened the settings must receive exactly what they received before
// preferences existed (#213).
//
// There is no mode and no Slack flag here — buddies get email on/off only
// (PRD §10.1). Buddy rows written to NotificationPreference carry
// `emailMode: 'immediate'` and `slackEnabled: false` to satisfy the shared
// columns; nothing reads either for a buddy.
export const DEFAULT_BUDDY_EMAIL_PREFS: Record<BuddyNotifEventType, { enabled: boolean }> = {
  tour_published: { enabled: true },
  tour_details_changed: { enabled: true },
  tour_reminder: { enabled: true },
  maybe_reminder: { enabled: true },
}

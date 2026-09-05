import { EmailModeSchema, type EmailMode, type NotifEventType } from '@peace-buddy/types'

// Single source of truth for admin notification defaults, used when no
// NotificationPreference row exists for an admin.
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

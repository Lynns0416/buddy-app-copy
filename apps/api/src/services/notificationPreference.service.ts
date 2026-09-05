import { db } from '../lib/db'
import {
  NotifEventTypeSchema,
  type NotifEventType,
  type NotificationPreferenceItem,
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferences,
} from '@peace-buddy/types'
import { DEFAULT_ADMIN_EMAIL_PREFS } from './adminNotificationDefaults'

// What the admin settings screen shows for event types the admin has not
// explicitly configured. Email values are *derived* from
// DEFAULT_ADMIN_EMAIL_PREFS in adminNotificationDefaults.ts — the table that decides
// what actually sends — so the screen cannot drift from delivery behaviour.
//
// Slack is the admin channel (docs/decisions.md 2026-08-15), so email is off by
// default. `slackEnabled` is always true and informational only: Slack posts to
// one shared channel with no per-admin targeting, so nothing reads this flag at
// enqueue time and the UI renders it as a disabled control.
const DEFAULTS: Record<NotifEventType, Omit<NotificationPreferenceItem, 'eventType'>> =
  Object.fromEntries(
    NotifEventTypeSchema.options.map((eventType) => [
      eventType,
      {
        emailEnabled: DEFAULT_ADMIN_EMAIL_PREFS[eventType].enabled,
        emailMode: DEFAULT_ADMIN_EMAIL_PREFS[eventType].mode,
        slackEnabled: true,
      },
    ]),
  ) as Record<NotifEventType, Omit<NotificationPreferenceItem, 'eventType'>>

export async function getAdminNotificationPreferences(
  adminId: string,
): Promise<NotificationPreferencesResponse> {
  const rows = await db.notificationPreference.findMany({
    where: { adminId },
    select: { eventType: true, emailEnabled: true, emailMode: true, slackEnabled: true },
  })
  const byType = new Map(rows.map((r) => [r.eventType, r]))

  const preferences: NotificationPreferenceItem[] = NotifEventTypeSchema.options.map((eventType) => {
    const stored = byType.get(eventType)
    if (stored) {
      return {
        eventType,
        emailEnabled: stored.emailEnabled,
        emailMode: stored.emailMode,
        slackEnabled: stored.slackEnabled,
      }
    }
    return { eventType, ...DEFAULTS[eventType] }
  })

  return { preferences }
}

export async function updateAdminNotificationPreferences(
  adminId: string,
  data: UpdateNotificationPreferences,
): Promise<NotificationPreferencesResponse> {
  // Upsert every supplied row atomically. Reject duplicates to keep callers honest.
  const seen = new Set<string>()
  for (const p of data.preferences) {
    if (seen.has(p.eventType)) {
      throw new Error(`duplicate eventType in preferences: ${p.eventType}`)
    }
    seen.add(p.eventType)
  }

  await db.$transaction(
    data.preferences.map((p) =>
      db.notificationPreference.upsert({
        where: { adminId_eventType: { adminId, eventType: p.eventType } },
        create: { adminId, ...p },
        update: {
          emailEnabled: p.emailEnabled,
          emailMode: p.emailMode,
          slackEnabled: p.slackEnabled,
        },
      }),
    ),
  )

  return getAdminNotificationPreferences(adminId)
}

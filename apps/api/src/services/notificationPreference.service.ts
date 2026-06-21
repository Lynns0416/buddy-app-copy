import { db } from '../lib/db'
import {
  EmailModeSchema,
  NotifEventTypeSchema,
  type NotifEventType,
  type NotificationPreferenceItem,
  type NotificationPreferencesResponse,
  type UpdateNotificationPreferences,
} from '@peace-buddy/types'

// Defaults match the PRD §10.2 table. Used to backfill any event types the
// admin hasn't explicitly configured yet.
const DEFAULTS: Record<NotifEventType, Omit<NotificationPreferenceItem, 'eventType'>> = {
  new_signup: { emailEnabled: true, emailMode: EmailModeSchema.enum.digest, slackEnabled: false },
  new_booking: { emailEnabled: true, emailMode: EmailModeSchema.enum.digest, slackEnabled: false },
  cancellation: { emailEnabled: true, emailMode: EmailModeSchema.enum.immediate, slackEnabled: false },
  maybe_resolved: { emailEnabled: true, emailMode: EmailModeSchema.enum.immediate, slackEnabled: false },
  maybe_deadline_missed: { emailEnabled: true, emailMode: EmailModeSchema.enum.immediate, slackEnabled: false },
}

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

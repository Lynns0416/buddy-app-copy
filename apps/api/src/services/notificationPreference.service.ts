import { db } from '../lib/db'
import {
  BuddyNotifEventTypeSchema,
  EmailModeSchema,
  NotifEventTypeSchema,
  type BuddyNotificationPreferenceItem,
  type BuddyNotificationPreferencesResponse,
  type NotifEventType,
  type NotificationPreferenceItem,
  type NotificationPreferencesResponse,
  type UpdateBuddyNotificationPreferences,
  type UpdateNotificationPreferences,
} from '@peace-buddy/types'
import { DEFAULT_ADMIN_EMAIL_PREFS, DEFAULT_BUDDY_EMAIL_PREFS } from './notificationDefaults'

// What the admin settings screen shows for event types the admin has not
// explicitly configured. Email values are *derived* from
// DEFAULT_ADMIN_EMAIL_PREFS in notificationDefaults.ts — the table that decides
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
    where: { userId: adminId },
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
        where: { userId_eventType: { userId: adminId, eventType: p.eventType } },
        create: { userId: adminId, ...p },
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

// ---- Buddy preferences ----
//
// Same table, same defaults-derived-from-delivery discipline as above. Only
// `emailEnabled` is buddy-settable; the shared `emailMode` / `slackEnabled`
// columns are written with fixed values and never read for a buddy.
//
// The unmutable events are not in BuddyNotifEventTypeSchema and not in the
// Prisma enum, so they never appear here and a PUT naming one fails Zod at the
// route.

export async function getBuddyNotificationPreferences(
  userId: string,
): Promise<BuddyNotificationPreferencesResponse> {
  const rows = await db.notificationPreference.findMany({
    where: { userId },
    select: { eventType: true, emailEnabled: true },
  })
  const byType = new Map(rows.map((r) => [r.eventType, r]))

  const preferences: BuddyNotificationPreferenceItem[] = BuddyNotifEventTypeSchema.options.map(
    (eventType) => {
      const stored = byType.get(eventType)
      return {
        eventType,
        emailEnabled: stored ? stored.emailEnabled : DEFAULT_BUDDY_EMAIL_PREFS[eventType].enabled,
      }
    },
  )

  return { preferences }
}

export async function updateBuddyNotificationPreferences(
  userId: string,
  data: UpdateBuddyNotificationPreferences,
): Promise<BuddyNotificationPreferencesResponse> {
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
        where: { userId_eventType: { userId, eventType: p.eventType } },
        create: {
          userId,
          eventType: p.eventType,
          emailEnabled: p.emailEnabled,
          emailMode: EmailModeSchema.enum.immediate,
          slackEnabled: false,
        },
        update: { emailEnabled: p.emailEnabled },
      }),
    ),
  )

  return getBuddyNotificationPreferences(userId)
}

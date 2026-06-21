import { db } from '../lib/db'
import {
  BuddyStatusSchema,
  BookingStatusSchema,
  EmailModeSchema,
  NotificationChannelSchema,
  UserRoleSchema,
  type EmailMode,
  type MarkNotificationsRead,
  type NotifEventKind,
  type NotifEventType,
  type NotificationResponse,
} from '@peace-buddy/types'
import type { Prisma, PrismaClient } from '@prisma/client'
import { hasEmailTemplate } from './notificationTemplates'

type Tx = PrismaClient | Prisma.TransactionClient

type EnqueueArgs = {
  eventType: NotifEventKind
  recipientUserId: string
  payload: Record<string, unknown>
  scheduledFor?: Date
}

// Maps a dispatchable kind to its admin-preference enum value, when the event
// is configurable per-admin. Returns null for events that aren't admin-preference
// gated (either buddy-targeted or always-immediate per PRD §10.2).
function adminPrefEnumFor(kind: NotifEventKind): NotifEventType | null {
  switch (kind) {
    case 'new_signup': return 'new_signup'
    case 'new_booking': return 'new_booking'
    case 'booking_cancelled': return 'cancellation'
    case 'maybe_resolved': return 'maybe_resolved'
    case 'maybe_deadline_missed': return 'maybe_deadline_missed'
    default: return null
  }
}

// Defaults per PRD §10.2 when no NotificationPreference row exists for an admin.
const DEFAULT_ADMIN_EMAIL_PREFS: Record<NotifEventType, { enabled: boolean; mode: EmailMode }> = {
  new_signup: { enabled: true, mode: EmailModeSchema.enum.digest },
  new_booking: { enabled: true, mode: EmailModeSchema.enum.digest },
  cancellation: { enabled: true, mode: EmailModeSchema.enum.immediate },
  maybe_resolved: { enabled: true, mode: EmailModeSchema.enum.immediate },
  maybe_deadline_missed: { enabled: true, mode: EmailModeSchema.enum.immediate },
}

type AdminPrefRow = { eventType: NotifEventType; emailEnabled: boolean; emailMode: EmailMode }

// Returns 'immediate' (send now), 'digest' (buffer for daily flush — slice 5),
// or 'off' (don't email). `cant_go_post_deadline` is always immediate per PRD.
type AdminEmailDecision = 'immediate' | 'digest' | 'off'

function decideAdminEmail(kind: NotifEventKind, prefs: AdminPrefRow[]): AdminEmailDecision {
  if (adminPrefEnumFor(kind) === null) {
    // cant_go_post_deadline and any future always-immediate admin events
    return hasEmailTemplate(kind) ? 'immediate' : 'off'
  }
  const prefEnum = adminPrefEnumFor(kind)!
  const row = prefs.find((p) => p.eventType === prefEnum)
  const pref = row
    ? { enabled: row.emailEnabled, mode: row.emailMode }
    : DEFAULT_ADMIN_EMAIL_PREFS[prefEnum]
  if (!pref.enabled) return 'off'
  return pref.mode === EmailModeSchema.enum.immediate ? 'immediate' : 'digest'
}

// Writes one in-app job per recipient. Caller MUST pass a txn client (`tx`)
// so the job row is committed atomically with the triggering state change.
export async function enqueueInApp(args: EnqueueArgs, tx: Tx) {
  const recipient = await tx.user.findUnique({
    where: { id: args.recipientUserId },
    select: { locale: true },
  })
  if (!recipient) return // recipient deleted — silently drop

  await tx.notificationJob.create({
    data: {
      channel: NotificationChannelSchema.enum.in_app,
      eventType: args.eventType,
      recipientUserId: args.recipientUserId,
      payload: args.payload as Prisma.InputJsonValue,
      locale: recipient.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    },
  })
}

// Enqueue an in-app job for every active+trainee admin. Used for global admin
// events (e.g. new_signup) that aren't tour-scoped.
export async function enqueueInAppForAllAdmins(
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  const admins = await tx.user.findMany({
    where: {
      role: { in: [UserRoleSchema.enum.admin, UserRoleSchema.enum.super_admin] },
      adminProfile: { deletedAt: null },
    },
    select: { id: true, locale: true },
  })
  if (admins.length === 0) return

  await tx.notificationJob.createMany({
    data: admins.map((a) => ({
      channel: NotificationChannelSchema.enum.in_app,
      eventType: args.eventType,
      recipientUserId: a.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: a.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

// Enqueue an in-app job for admins assigned to a tour. Used for tour-scoped
// events (new_booking, booking_cancelled, etc.). Soft-deleted admins are
// excluded. If no admins are assigned, no notifications are sent — matches PRD §10.2.
export async function enqueueInAppForTourAdmins(
  tourId: string,
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  const assignments = await tx.tourAdminAssignment.findMany({
    where: { tourId, admin: { deletedAt: null } },
    select: { admin: { select: { user: { select: { id: true, locale: true } } } } },
  })
  if (assignments.length === 0) return

  await tx.notificationJob.createMany({
    data: assignments.map((a) => ({
      channel: NotificationChannelSchema.enum.in_app,
      eventType: args.eventType,
      recipientUserId: a.admin.user.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: a.admin.user.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

// Enqueue an in-app job for every active buddy. Used for tour_published.
export async function enqueueInAppForActiveBuddies(
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  const buddies = await tx.buddyProfile.findMany({
    where: { status: BuddyStatusSchema.enum.active },
    select: { user: { select: { id: true, locale: true } } },
  })
  if (buddies.length === 0) return

  await tx.notificationJob.createMany({
    data: buddies.map((b) => ({
      channel: NotificationChannelSchema.enum.in_app,
      eventType: args.eventType,
      recipientUserId: b.user.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: b.user.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

// Enqueue an in-app job for every buddy with a confirmed/maybe/waitlist booking
// on the tour. Deduped by user (a buddy holding bookings across both sessions
// receives one notification). Used for tour_cancelled and tour_details_changed.
export async function enqueueInAppForBookedBuddies(
  tourId: string,
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  const bookings = await tx.booking.findMany({
    where: {
      tourId,
      status: {
        in: [
          BookingStatusSchema.enum.confirmed,
          BookingStatusSchema.enum.maybe,
          BookingStatusSchema.enum.waitlist,
        ],
      },
    },
    select: { buddy: { select: { user: { select: { id: true, locale: true } } } } },
  })
  if (bookings.length === 0) return

  const seen = new Map<string, { id: string; locale: (typeof bookings)[number]['buddy']['user']['locale'] }>()
  for (const b of bookings) {
    seen.set(b.buddy.user.id, { id: b.buddy.user.id, locale: b.buddy.user.locale })
  }

  await tx.notificationJob.createMany({
    data: Array.from(seen.values()).map((u) => ({
      channel: NotificationChannelSchema.enum.in_app,
      eventType: args.eventType,
      recipientUserId: u.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: u.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

// ---- Email enqueue helpers ----
//
// Each mirrors its in-app counterpart and skips silently when no template is
// registered for the event (slice-3 surface; later slices add more templates).
// Admin-targeted helpers consult NotificationPreference; digest-mode admins
// are skipped here and will be picked up by the slice-5 DigestQueue writer.

export async function enqueueEmail(args: EnqueueArgs, tx: Tx) {
  if (!hasEmailTemplate(args.eventType)) return

  const recipient = await tx.user.findUnique({
    where: { id: args.recipientUserId },
    select: { locale: true },
  })
  if (!recipient) return

  await tx.notificationJob.create({
    data: {
      channel: NotificationChannelSchema.enum.email,
      eventType: args.eventType,
      recipientUserId: args.recipientUserId,
      payload: args.payload as Prisma.InputJsonValue,
      locale: recipient.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    },
  })
}

export async function enqueueEmailForActiveBuddies(
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  if (!hasEmailTemplate(args.eventType)) return

  const buddies = await tx.buddyProfile.findMany({
    where: { status: BuddyStatusSchema.enum.active },
    select: { user: { select: { id: true, locale: true } } },
  })
  if (buddies.length === 0) return

  await tx.notificationJob.createMany({
    data: buddies.map((b) => ({
      channel: NotificationChannelSchema.enum.email,
      eventType: args.eventType,
      recipientUserId: b.user.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: b.user.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

export async function enqueueEmailForBookedBuddies(
  tourId: string,
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  if (!hasEmailTemplate(args.eventType)) return

  const bookings = await tx.booking.findMany({
    where: {
      tourId,
      status: {
        in: [
          BookingStatusSchema.enum.confirmed,
          BookingStatusSchema.enum.maybe,
          BookingStatusSchema.enum.waitlist,
        ],
      },
    },
    select: { buddy: { select: { user: { select: { id: true, locale: true } } } } },
  })
  if (bookings.length === 0) return

  const seen = new Map<string, { id: string; locale: (typeof bookings)[number]['buddy']['user']['locale'] }>()
  for (const b of bookings) {
    seen.set(b.buddy.user.id, { id: b.buddy.user.id, locale: b.buddy.user.locale })
  }

  await tx.notificationJob.createMany({
    data: Array.from(seen.values()).map((u) => ({
      channel: NotificationChannelSchema.enum.email,
      eventType: args.eventType,
      recipientUserId: u.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: u.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })),
  })
}

export async function enqueueEmailForTourAdmins(
  tourId: string,
  args: Omit<EnqueueArgs, 'recipientUserId'>,
  tx: Tx,
) {
  if (!hasEmailTemplate(args.eventType)) return

  const assignments = await tx.tourAdminAssignment.findMany({
    where: { tourId, admin: { deletedAt: null } },
    select: {
      admin: {
        select: {
          user: {
            select: {
              id: true,
              locale: true,
              notificationPrefs: {
                select: { eventType: true, emailEnabled: true, emailMode: true },
              },
            },
          },
        },
      },
    },
  })
  if (assignments.length === 0) return

  const rows: Array<{
    channel: 'email'
    eventType: NotifEventKind
    recipientUserId: string
    payload: Prisma.InputJsonValue
    locale: (typeof assignments)[number]['admin']['user']['locale']
    scheduledFor: Date
  }> = []

  for (const a of assignments) {
    const decision = decideAdminEmail(args.eventType, a.admin.user.notificationPrefs)
    if (decision !== 'immediate') continue
    rows.push({
      channel: NotificationChannelSchema.enum.email,
      eventType: args.eventType,
      recipientUserId: a.admin.user.id,
      payload: args.payload as Prisma.InputJsonValue,
      locale: a.admin.user.locale,
      scheduledFor: args.scheduledFor ?? new Date(),
    })
  }

  if (rows.length === 0) return
  await tx.notificationJob.createMany({ data: rows })
}

// Read-side: fetch the authenticated user's in-app notifications.
export async function listNotifications(userId: string, limit = 50): Promise<NotificationResponse[]> {
  const rows = await db.notification.findMany({
    where: { userId },
    select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotifEventKind,
    payload: r.payload as Record<string, unknown>,
    readAt: r.readAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } })
}

export async function markRead(userId: string, body: MarkNotificationsRead) {
  const now = new Date()
  if ('all' in body && body.all === true) {
    await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: now },
    })
  } else if ('ids' in body) {
    await db.notification.updateMany({
      where: { userId, id: { in: body.ids }, readAt: null },
      data: { readAt: now },
    })
  }
}

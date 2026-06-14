import { db } from '../lib/db'
import {
  BuddyStatusSchema,
  BookingStatusSchema,
  NotificationChannelSchema,
  UserRoleSchema,
  type MarkNotificationsRead,
  type NotifEventKind,
  type NotificationResponse,
} from '@peace-buddy/types'
import type { Prisma, PrismaClient } from '@prisma/client'

type Tx = PrismaClient | Prisma.TransactionClient

type EnqueueArgs = {
  eventType: NotifEventKind
  recipientUserId: string
  payload: Record<string, unknown>
  scheduledFor?: Date
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

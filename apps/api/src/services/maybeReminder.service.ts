import { db } from '../lib/db'
import {
  BookingStatusSchema,
  BuddyStatusSchema,
  NotifEventKindSchema,
  TourStatusSchema,
  type MaybeReminderResult,
} from '@peace-buddy/types'
import { Prisma } from '@prisma/client'
import { enqueueEmail, enqueueInApp } from './notification.service'
import { payloadTourDate, type TourNameRef } from '../lib/notificationPayload'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

// Global offsets per PRD §10.5 — "Global offsets (default: 3 days, 1 day before
// deadline)". PRD §11.5 calls `/admin/config.maybeReminderOffsets` aspirational,
// so the constant is the spec, not a placeholder for a missing config surface.
const MAYBE_REMINDER_OFFSETS = [3, 1]

function jstStartOfDayUtc(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function dispatchKey(tourId: string, offsetDays: number, recipientUserId: string): string {
  return `maybe_reminder:${tourId}:${offsetDays}:${recipientUserId}`
}

// Per PRD §10.5 — fires `maybe_reminder` to buddies still in Maybe when today
// (JST) equals `maybeDeadline - offset` for any offset in MAYBE_REMINDER_OFFSETS.
// Idempotent via NotificationDispatchLog so hourly cron runs only enqueue once
// per (tour, offset, buddy).
export async function enqueueMaybeReminders(now: Date = new Date()): Promise<MaybeReminderResult> {
  const today = jstStartOfDayUtc(now)
  const result: MaybeReminderResult = { tours: 0, considered: 0, enqueued: 0, alreadySent: 0 }

  const tours = await db.tour.findMany({
    where: {
      status: TourStatusSchema.enum.published,
      maybeDeadline: { gte: today },
    },
    select: {
      id: true,
      maybeDeadline: true,
      tourDate: true,
      group: { select: { name: true } },
    },
  })

  for (const tour of tours) {
    if (!tour.maybeDeadline) continue
    const deadline = tour.maybeDeadline
    const offsetsDueToday = MAYBE_REMINDER_OFFSETS.filter((offset) => {
      const trigger = addDays(deadline, -offset)
      return trigger.getTime() === today.getTime()
    })
    if (offsetsDueToday.length === 0) continue
    result.tours += 1

    const recipients = await findReminderRecipients(tour.id)
    if (recipients.length === 0) continue
    result.considered += recipients.length * offsetsDueToday.length

    for (const offset of offsetsDueToday) {
      for (const recipient of recipients) {
        const outcome = await tryEnqueueForRecipient(tour, offset, recipient.userId)
        if (outcome === 'enqueued') result.enqueued += 1
        else result.alreadySent += 1
      }
    }
  }

  return result
}

type Recipient = { userId: string }

async function findReminderRecipients(tourId: string): Promise<Recipient[]> {
  const bookings = await db.booking.findMany({
    where: {
      tourId,
      status: BookingStatusSchema.enum.maybe,
      buddy: {
        status: { notIn: [BuddyStatusSchema.enum.suspended, BuddyStatusSchema.enum.rejected] },
      },
    },
    select: { buddy: { select: { userId: true } } },
  })
  const seen = new Set<string>()
  const recipients: Recipient[] = []
  for (const b of bookings) {
    if (seen.has(b.buddy.userId)) continue
    seen.add(b.buddy.userId)
    recipients.push({ userId: b.buddy.userId })
  }
  return recipients
}

async function tryEnqueueForRecipient(
  tour: TourNameRef,
  offsetDays: number,
  recipientUserId: string,
): Promise<'enqueued' | 'already_sent'> {
  const eventKey = dispatchKey(tour.id, offsetDays, recipientUserId)
  try {
    await db.$transaction(async (tx) => {
      await tx.notificationDispatchLog.create({ data: { eventKey } })
      const args = {
        eventType: NotifEventKindSchema.enum.maybe_reminder,
        recipientUserId,
        payload: {
          tourId: tour.id,
          groupName: tour.group.name,
          tourDate: payloadTourDate(tour.tourDate),
          offsetDays,
        },
      }
      await enqueueInApp(args, tx)
      await enqueueEmail(args, tx)
    })
    return 'enqueued'
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return 'already_sent'
    }
    throw e
  }
}

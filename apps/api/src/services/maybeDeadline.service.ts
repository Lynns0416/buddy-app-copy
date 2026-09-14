import { db } from '../lib/db'
import {
  BookingStatusSchema,
  NotifEventKindSchema,
  TourStatusSchema,
  type MaybeDeadlineResult,
} from '@peace-buddy/types'
import { Prisma } from '@prisma/client'
import { payloadTourDate, type TourNameRef } from '../lib/notificationPayload'
import {
  enqueueEmailForTourAdmins,
  enqueueInAppForTourAdmins,
  enqueueSlackForAdmins,
} from './notification.service'

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

function jstStartOfDayUtc(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()))
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

// Per PRD §10.5 — fires `maybe_deadline_missed` to assigned admins on the JST
// day immediately after a tour's `maybeDeadline`, when at least one booking is
// still in Maybe. The day-after window keeps the query set bounded; if the
// hourly cron is down for >24h the event is permanently missed for that day's
// tours — that is an acceptable tradeoff documented alongside the cadence.
// Idempotent via NotificationDispatchLog so multiple hourly runs in the
// window enqueue only once per tour.
export async function enqueueMaybeDeadlineMissed(
  now: Date = new Date(),
): Promise<MaybeDeadlineResult> {
  const today = jstStartOfDayUtc(now)
  const yesterday = addDays(today, -1)
  const result: MaybeDeadlineResult = { tours: 0, enqueuedTours: 0, alreadySent: 0 }

  const tours = await db.tour.findMany({
    where: {
      status: TourStatusSchema.enum.published,
      maybeDeadline: { gte: yesterday, lt: today },
      bookings: { some: { status: BookingStatusSchema.enum.maybe } },
      // Per PRD §10.2 — no assigned admins means no tour-scoped notification.
      // Filtering here keeps the dispatch log honest: we never write a log row
      // for a tour that would produce zero notification jobs.
      adminAssignments: { some: { admin: { deletedAt: null } } },
    },
    select: { id: true, tourDate: true, group: { select: { name: true } } },
  })

  for (const tour of tours) {
    result.tours += 1
    const outcome = await tryEnqueueForTour(tour)
    if (outcome === 'enqueued') result.enqueuedTours += 1
    else result.alreadySent += 1
  }

  return result
}

async function tryEnqueueForTour(tour: TourNameRef): Promise<'enqueued' | 'already_sent'> {
  const eventKey = `maybe_deadline_missed:${tour.id}`
  try {
    await db.$transaction(async (tx) => {
      await tx.notificationDispatchLog.create({ data: { eventKey } })
      const args = {
        eventType: NotifEventKindSchema.enum.maybe_deadline_missed,
        payload: {
          tourId: tour.id,
          groupName: tour.group.name,
          tourDate: payloadTourDate(tour.tourDate),
        },
      }
      await enqueueInAppForTourAdmins(tour.id, args, tx)
      await enqueueEmailForTourAdmins(tour.id, args, tx)
      await enqueueSlackForAdmins(args, tx)
    })
    return 'enqueued'
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return 'already_sent'
    }
    throw e
  }
}

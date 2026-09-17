import { db } from '../lib/db'
import {
  BookingStatusSchema,
  NotifEventKindSchema,
  TourStatusSchema,
  jstStartOfDayUtc,
  type AdminDashboardOverdueMaybeTour,
  type MaybeDeadlineResult,
} from '@peace-buddy/types'
import { Prisma } from '@prisma/client'
import { addDays } from '../lib/jstDay'
import { payloadTourDate, type TourNameRef } from '../lib/notificationPayload'
import {
  enqueueEmailForTourAdmins,
  enqueueInAppForTourAdmins,
  enqueueSlackForAdmins,
} from './notification.service'

// A published tour still holding at least one Maybe booking. The cron narrows
// this to deadlines that fell yesterday; the admin worklist to every passed
// deadline whose tour has not happened yet.
const unresolvedMaybeWhere = {
  status: TourStatusSchema.enum.published,
  bookings: { some: { status: BookingStatusSchema.enum.maybe } },
} satisfies Prisma.TourWhereInput

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
      ...unresolvedMaybeWhere,
      maybeDeadline: { gte: yesterday, lt: today },
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

// Every tour the admin worklist lists as an unresolved Maybe past its deadline
// (PRD §11.7): the deadline's JST day has ended and the tour's has not. Unlike
// the cron, a tour with no assigned admin is included — every admin reads the
// worklist, so nobody being assigned is a reason to show the tour, not hide it.
export async function listOverdueMaybeTours(
  now: Date = new Date(),
): Promise<AdminDashboardOverdueMaybeTour[]> {
  const today = jstStartOfDayUtc(now)
  const tours = await db.tour.findMany({
    where: {
      ...unresolvedMaybeWhere,
      maybeDeadline: { lt: today },
      tourDate: { gte: today },
    },
    select: {
      id: true,
      tourDate: true,
      maybeDeadline: true,
      group: { select: { name: true } },
      _count: { select: { bookings: { where: { status: BookingStatusSchema.enum.maybe } } } },
    },
    orderBy: { tourDate: 'asc' },
  })

  // `lt` never matches NULL, so every row has a deadline; the guard narrows the type.
  return tours.flatMap((tour) =>
    tour.maybeDeadline
      ? [
          {
            id: tour.id,
            tourDate: tour.tourDate.toISOString(),
            group: { name: tour.group.name },
            maybeDeadline: tour.maybeDeadline.toISOString(),
            maybeCount: tour._count.bookings,
          },
        ]
      : [],
  )
}

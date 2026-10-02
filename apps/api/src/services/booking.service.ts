import { TourStatus, BookingStatus as PrismaBookingStatus, BuddyTier as PrismaBuddyTier, CancellationCategory as PrismaCancellationCategory, Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { placeSummarySelect, sessionPlaces } from '../lib/sessionPlaces'
import { BookingStatusSchema, NotifEventKindSchema, getTodayJst } from '@peace-buddy/types'
import type { BookingResponse, BookingStatus, BuddyTier, CancellationReasonBody, MyTourBookingEntry } from '@peace-buddy/types'
import { getPoolCapacities, poolForTier, NON_JUNIOR_TIERS } from '../lib/pool'
import { payloadTourDate } from '../lib/notificationPayload'
import type { Pool } from '../lib/pool'
import {
  enqueueEmail,
  enqueueEmailForTourAdmins,
  enqueueInApp,
  enqueueInAppForTourAdmins,
  enqueueSlackForAdmins,
} from './notification.service'

type CreateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'TOUR_NOT_FOUND' | 'SESSION_NOT_FOUND' | 'NOT_BOOKABLE' | 'ALREADY_BOOKED' | 'BUDDY_NOT_FOUND' | 'NOT_ELIGIBLE' | 'DEADLINE_PASSED' | 'MAYBE_DEADLINE_PASSED' }

type UpdateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'TOUR_FULL' | 'BUDDY_NOT_FOUND' | 'DEADLINE_PASSED' | 'MAYBE_DEADLINE_PASSED' | 'REASON_REQUIRED' }

type ReportCantGoResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'BUDDY_NOT_FOUND' | 'DEADLINE_NOT_PASSED' | 'INVALID_STATUS' }

const bookingSelect = {
  id: true,
  tourId: true,
  sessionId: true,
  buddyTier: true,
  status: true,
  bookedAt: true,
  updatedAt: true,
} as const

// A `@db.Date` column comes back as UTC midnight, so its UTC date is the stored
// calendar date. Compare it with getTodayJst(), never with the server's clock.
function dateOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function mapBooking(row: {
  id: string
  tourId: string
  sessionId: string
  buddyTier: string
  status: string
  bookedAt: Date
  updatedAt: Date
}): BookingResponse {
  return {
    id: row.id,
    tourId: row.tourId,
    sessionId: row.sessionId,
    buddyTier: row.buddyTier as BuddyTier,
    status: row.status as BookingStatus,
    bookedAt: row.bookedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function getConfirmedCountByPool(sessionId: string, pool: Pool): Promise<number> {
  if (pool === 'junior') {
    return db.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed, buddyTier: PrismaBuddyTier.junior } })
  }
  if (pool === 'non_junior') {
    return db.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed, buddyTier: { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] } } })
  }
  return db.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed } })
}

export async function createBooking(
  tourId: string,
  sessionId: string,
  userId: string,
  status?: typeof BookingStatusSchema.enum.maybe,
): Promise<CreateBookingResult> {
  const [session, buddy] = await Promise.all([
    db.tourSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        tourId: true,
        capacity: true,
        tour: {
          select: {
            status: true,
            tourDate: true,
            bookingOpen: true,
            cancellationDeadline: true,
            maybeDeadline: true,
            group: { select: { name: true } },
          },
        },
      },
    }),
    db.buddyProfile.findUnique({
      where: { userId },
      select: { id: true, tier: true, status: true, displayName: true },
    }),
  ])

  if (!session) return { ok: false, code: 'SESSION_NOT_FOUND' }
  if (session.tourId !== tourId) return { ok: false, code: 'TOUR_NOT_FOUND' }
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }

  const tour = session.tour
  if (tour.status !== TourStatus.published || !tour.bookingOpen || dateOf(tour.tourDate) <= getTodayJst()) {
    return { ok: false, code: 'NOT_BOOKABLE' }
  }

  if (buddy.status !== 'active' || !buddy.tier) {
    return { ok: false, code: 'NOT_ELIGIBLE' }
  }

  const buddyTier = buddy.tier as BuddyTier
  let finalStatus: PrismaBookingStatus
  if (status === BookingStatusSchema.enum.maybe) {
    const deadlineOverride = await db.buddyCancellationDeadlineOverride.findUnique({
      where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
      select: { deadline: true },
    })
    const today = getTodayJst()
    if (today >= dateOf(deadlineOverride?.deadline ?? tour.cancellationDeadline)) {
      return { ok: false, code: 'DEADLINE_PASSED' }
    }
    if (tour.maybeDeadline && today >= dateOf(tour.maybeDeadline)) {
      return { ok: false, code: 'MAYBE_DEADLINE_PASSED' }
    }
    // A Maybe holds no seat, so the tier pools do not decide it.
    finalStatus = PrismaBookingStatus.maybe
  } else {
    const capacities = await getPoolCapacities(sessionId, session.capacity)
    const primaryPool = poolForTier(buddyTier)
    const otherPool: 'junior' | 'non_junior' = primaryPool === 'junior' ? 'non_junior' : 'junior'
    const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
      getConfirmedCountByPool(sessionId, primaryPool),
      getConfirmedCountByPool(sessionId, otherPool),
      getConfirmedCountByPool(sessionId, 'anyone'),
    ])
    const anyoneConfirmed = Math.max(
      0,
      totalConfirmed - Math.min(primaryCount, capacities[primaryPool]) - Math.min(otherCount, capacities[otherPool]),
    )

    finalStatus =
      primaryCount < capacities[primaryPool] || anyoneConfirmed < capacities.anyone
        ? PrismaBookingStatus.confirmed
        : PrismaBookingStatus.waitlist
  }

  try {
    const booking = await db.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { buddyId_sessionId: { buddyId: buddy.id, sessionId } },
        select: { id: true, status: true },
      })
      let row
      if (existing) {
        if (existing.status !== PrismaBookingStatus.declined) throw new Error('ALREADY_BOOKED')
        row = await tx.booking.update({
          where: { id: existing.id },
          data: { status: finalStatus, buddyTier: buddyTier as PrismaBuddyTier },
          select: bookingSelect,
        })
      } else {
        row = await tx.booking.create({
          data: { buddyId: buddy.id, tourId, sessionId, buddyTier: buddyTier as PrismaBuddyTier, status: finalStatus },
          select: bookingSelect,
        })
      }
      const bookingArgs = {
        eventType: NotifEventKindSchema.enum.new_booking,
        payload: {
          bookingId: row.id,
          tourId,
          sessionId,
          buddyId: buddy.id,
          buddyName: buddy.displayName,
          groupName: tour.group.name,
          tourDate: payloadTourDate(tour.tourDate),
          status: row.status as BookingStatus,
        },
      }
      await enqueueInAppForTourAdmins(tourId, bookingArgs, tx)
      await enqueueSlackForAdmins(bookingArgs, tx)
      return row
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

    return { ok: true, booking: mapBooking(booking) }
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_BOOKED') {
      return { ok: false, code: 'ALREADY_BOOKED' }
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return { ok: false, code: 'ALREADY_BOOKED' }
    }
    throw err
  }
}

export async function updateBooking(
  sessionId: string,
  userId: string,
  newStatus: 'confirmed' | 'maybe' | 'waitlist' | 'declined',
  reason?: CancellationReasonBody,
): Promise<UpdateBookingResult> {
  const [buddy, session] = await Promise.all([
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true, displayName: true } }),
    db.tourSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        capacity: true,
        tourId: true,
        tour: {
          select: {
            cancellationDeadline: true,
            maybeDeadline: true,
            tourDate: true,
            group: { select: { name: true } },
          },
        },
      },
    }),
  ])
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }
  if (!session) return { ok: false, code: 'NOT_FOUND' }

  const [booking, deadlineOverride] = await Promise.all([
    db.booking.findUnique({
      where: { buddyId_sessionId: { buddyId: buddy.id, sessionId } },
      select: { id: true, status: true, buddyTier: true },
    }),
    db.buddyCancellationDeadlineOverride.findUnique({
      where: { buddyId_tourId: { buddyId: buddy.id, tourId: session.tourId } },
      select: { deadline: true },
    }),
  ])
  if (!booking) return { ok: false, code: 'NOT_FOUND' }

  const effectiveDeadline = deadlineOverride?.deadline ?? session.tour.cancellationDeadline
  if (getTodayJst() >= dateOf(effectiveDeadline)) {
    return { ok: false, code: 'DEADLINE_PASSED' }
  }

  if (newStatus === BookingStatusSchema.enum.maybe && session.tour.maybeDeadline && getTodayJst() >= dateOf(session.tour.maybeDeadline)) {
    return { ok: false, code: 'MAYBE_DEADLINE_PASSED' }
  }

  const wasConfirmed = booking.status === PrismaBookingStatus.confirmed
  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined && !reason) {
    return { ok: false, code: 'REASON_REQUIRED' }
  }

  if (newStatus === BookingStatusSchema.enum.confirmed && !wasConfirmed) {
    try {
      const updated = await db.$transaction(async (tx) => {
        const capacities = await getPoolCapacities(sessionId, session.capacity)
        const buddyTier = booking.buddyTier as BuddyTier
        const primaryPool = poolForTier(buddyTier)
        const otherPool: 'junior' | 'non_junior' = primaryPool === 'junior' ? 'non_junior' : 'junior'
        const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
          tx.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed, buddyTier: booking.buddyTier } }),
          tx.booking.count({
            where: {
              sessionId,
              status: PrismaBookingStatus.confirmed,
              buddyTier: otherPool === 'junior'
                ? PrismaBuddyTier.junior
                : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
            },
          }),
          tx.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed } }),
        ])
        const anyoneConfirmed = Math.max(
          0,
          totalConfirmed - Math.min(primaryCount, capacities[primaryPool]) - Math.min(otherCount, capacities[otherPool]),
        )
        if (primaryCount >= capacities[primaryPool] && anyoneConfirmed >= capacities.anyone) {
          throw new Error('TOUR_FULL')
        }
        return tx.booking.update({
          where: { id: booking.id },
          data: { status: PrismaBookingStatus.confirmed },
          select: bookingSelect,
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      return { ok: true, booking: mapBooking(updated) }
    } catch (err) {
      if (err instanceof Error && err.message === 'TOUR_FULL') return { ok: false, code: 'TOUR_FULL' }
      throw err
    }
  }

  const wasMaybe = booking.status === PrismaBookingStatus.maybe
  const willDecline = wasConfirmed && newStatus === BookingStatusSchema.enum.declined

  // Snapshotted into every payload below so the message can name the buddy and
  // the tour without a second lookup at render time. See docs/decisions.md
  // 2026-09-13 for why these are frozen at enqueue rather than looked up live.
  const tourRef = {
    tourId: session.tourId,
    buddyName: buddy.displayName,
    groupName: session.tour.group.name,
    tourDate: payloadTourDate(session.tour.tourDate),
  }

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.booking.update({
      where: { id: booking.id },
      data: { status: newStatus as PrismaBookingStatus },
      select: bookingSelect,
    })

    if (willDecline) {
      if (reason) {
        await tx.cancellationReason.create({
          data: {
            bookingId: booking.id,
            category: reason.category as PrismaCancellationCategory,
            freeText: reason.freeText,
            unavoidable: false,
            recordedBy: userId,
          },
        })
      }
      const cancelArgs = {
        eventType: NotifEventKindSchema.enum.booking_cancelled,
        payload: { ...tourRef, bookingId: booking.id, sessionId, buddyId: buddy.id },
      }
      await enqueueInAppForTourAdmins(session.tourId, cancelArgs, tx)
      await enqueueEmailForTourAdmins(session.tourId, cancelArgs, tx)
      await enqueueSlackForAdmins(cancelArgs, tx)
    }

    if (wasMaybe && newStatus !== BookingStatusSchema.enum.maybe) {
      const resolvedArgs = {
        eventType: NotifEventKindSchema.enum.maybe_resolved,
        payload: {
          ...tourRef,
          bookingId: booking.id,
          sessionId,
          buddyId: buddy.id,
          resolution: newStatus,
        },
      }
      await enqueueInAppForTourAdmins(session.tourId, resolvedArgs, tx)
      await enqueueEmailForTourAdmins(session.tourId, resolvedArgs, tx)
      await enqueueSlackForAdmins(resolvedArgs, tx)
    }

    return u
  })

  if (willDecline) {
    await promoteWaitlist(sessionId, session.capacity, booking.buddyTier as BuddyTier, session.tourId)
  }

  return { ok: true, booking: mapBooking(updated) }
}

export async function reportCantGo(
  tourId: string,
  sessionId: string,
  userId: string,
  body: CancellationReasonBody,
): Promise<ReportCantGoResult> {
  const [buddy, session] = await Promise.all([
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true, displayName: true } }),
    db.tourSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        tourId: true,
        capacity: true,
        tour: {
          select: {
            cancellationDeadline: true,
            tourDate: true,
            group: { select: { name: true } },
          },
        },
      },
    }),
  ])
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }
  if (!session || session.tourId !== tourId) return { ok: false, code: 'NOT_FOUND' }

  if (getTodayJst() < dateOf(session.tour.cancellationDeadline)) {
    return { ok: false, code: 'DEADLINE_NOT_PASSED' }
  }

  const booking = await db.booking.findUnique({
    where: { buddyId_sessionId: { buddyId: buddy.id, sessionId } },
    select: { id: true, status: true, buddyTier: true },
  })
  if (!booking) return { ok: false, code: 'NOT_FOUND' }

  const validStatuses: PrismaBookingStatus[] = [
    PrismaBookingStatus.confirmed,
    PrismaBookingStatus.maybe,
    PrismaBookingStatus.waitlist,
  ]
  if (!validStatuses.includes(booking.status)) {
    return { ok: false, code: 'INVALID_STATUS' }
  }

  const wasConfirmed = booking.status === PrismaBookingStatus.confirmed

  const updated = await db.$transaction(async (tx) => {
    const u = await tx.booking.update({
      where: { id: booking.id },
      data: { status: PrismaBookingStatus.declined },
      select: bookingSelect,
    })
    await tx.cancellationReason.create({
      data: {
        bookingId: booking.id,
        category: body.category as PrismaCancellationCategory,
        freeText: body.freeText,
        unavoidable: false,
        recordedBy: userId,
      },
    })
    const cantGoArgs = {
      eventType: NotifEventKindSchema.enum.cant_go_post_deadline,
      payload: {
        bookingId: booking.id,
        tourId: session.tourId,
        sessionId,
        buddyId: buddy.id,
        buddyName: buddy.displayName,
        groupName: session.tour.group.name,
        tourDate: payloadTourDate(session.tour.tourDate),
        category: body.category,
      },
    }
    await enqueueInAppForTourAdmins(session.tourId, cantGoArgs, tx)
    await enqueueEmailForTourAdmins(session.tourId, cantGoArgs, tx)
    await enqueueSlackForAdmins(cantGoArgs, tx)
    return u
  })

  if (wasConfirmed) {
    await promoteWaitlist(sessionId, session.capacity, booking.buddyTier as BuddyTier, session.tourId)
  }

  return { ok: true, booking: mapBooking(updated) }
}

async function promoteWaitlist(sessionId: string, capacity: number, cancelledTier: BuddyTier, tourId: string): Promise<void> {
  const capacities = await getPoolCapacities(sessionId, capacity)
  const primaryPool = poolForTier(cancelledTier)

  const candidate =
    await findWaitlistCandidate(sessionId, primaryPool) ??
    await findAnyWaitlistCandidate(sessionId)

  if (!candidate) return

  await db.$transaction(async (tx) => {
    const cPool = poolForTier(candidate.buddyTier as BuddyTier)
    const cOtherPool: 'junior' | 'non_junior' = cPool === 'junior' ? 'non_junior' : 'junior'
    const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
      tx.booking.count({
        where: {
          sessionId,
          status: PrismaBookingStatus.confirmed,
          buddyTier: cPool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
        },
      }),
      tx.booking.count({
        where: {
          sessionId,
          status: PrismaBookingStatus.confirmed,
          buddyTier: cOtherPool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
        },
      }),
      tx.booking.count({ where: { sessionId, status: PrismaBookingStatus.confirmed } }),
    ])
    const anyoneConfirmed = Math.max(
      0,
      totalConfirmed - Math.min(primaryCount, capacities[cPool]) - Math.min(otherCount, capacities[cOtherPool]),
    )
    if (primaryCount < capacities[cPool] || anyoneConfirmed < capacities.anyone) {
      await tx.booking.update({
        where: { id: candidate.id },
        data: { status: PrismaBookingStatus.confirmed },
      })
      // The tour is read through the booking rather than separately: it costs
      // nothing extra, runs only when someone is actually promoted, and is
      // non-null by construction so the payload can never carry a blank name.
      const promoted = await tx.booking.findUnique({
        where: { id: candidate.id },
        select: {
          buddy: { select: { userId: true } },
          tour: { select: { tourDate: true, group: { select: { name: true } } } },
        },
      })
      if (promoted) {
        const promoArgs = {
          eventType: NotifEventKindSchema.enum.waitlist_promoted,
          recipientUserId: promoted.buddy.userId,
          payload: {
            bookingId: candidate.id,
            tourId,
            sessionId,
            groupName: promoted.tour.group.name,
            tourDate: payloadTourDate(promoted.tour.tourDate),
          },
        }
        await enqueueInApp(promoArgs, tx)
        await enqueueEmail(promoArgs, tx)
      }
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

async function findWaitlistCandidate(sessionId: string, pool: 'junior' | 'non_junior') {
  return db.booking.findFirst({
    where: {
      sessionId,
      status: PrismaBookingStatus.waitlist,
      buddyTier: pool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
    },
    orderBy: { bookedAt: 'asc' },
    select: { id: true, buddyTier: true },
  })
}

async function findAnyWaitlistCandidate(sessionId: string) {
  return db.booking.findFirst({
    where: { sessionId, status: PrismaBookingStatus.waitlist },
    orderBy: { bookedAt: 'asc' },
    select: { id: true, buddyTier: true },
  })
}

export async function listMyBookings(userId: string): Promise<MyTourBookingEntry[]> {
  const rows = await db.booking.findMany({
    where: {
      buddy: { userId },
      status: { not: PrismaBookingStatus.declined },
    },
    orderBy: { session: { tour: { tourDate: 'desc' } } },
    select: {
      id: true,
      tourId: true,
      sessionId: true,
      status: true,
      bookedAt: true,
      session: {
        select: {
          order: true,
          label: true,
          meetingTime: true,
          startTime: true,
          endTime: true,
          place: { select: placeSummarySelect },
          tour: {
            select: {
              tourDate: true,
              sessions: { select: { place: { select: placeSummarySelect } }, orderBy: { order: 'asc' as const } },
              status: true,
              maybeDeadline: true,
              group: { select: { name: true, type: true } },
            },
          },
        },
      },
    },
  })

  // A reflection is written per session, but the obligation is per tour — one
  // anywhere in the tour marks it done (docs/decisions.md 2026-09-23). The
  // reflection has no tourId column, so this reads the tour through the session.
  const reflectedTourIds = new Set(
    (
      await db.tourReflection.findMany({
        where: {
          buddy: { userId },
          session: { tourId: { in: rows.map((r) => r.tourId) } },
        },
        select: { session: { select: { tourId: true } } },
      })
    ).map((r) => r.session.tourId),
  )

  // The history page leaves out a tour the attendance record marks the buddy
  // absent from (PRD §8.8).
  const absentTourIds = new Set(
    (
      await db.attendance.findMany({
        where: { buddy: { userId }, absent: true, tourId: { in: rows.map((r) => r.tourId) } },
        select: { tourId: true },
      })
    ).map((a) => a.tourId),
  )

  // Group by tourId, preserving order from first booking of each tour
  const tourMap = new Map<string, MyTourBookingEntry>()
  for (const r of rows) {
    const existing = tourMap.get(r.tourId)
    const sessionEntry = {
      bookingId: r.id,
      sessionId: r.sessionId,
      sessionOrder: r.session.order,
      sessionLabel: r.session.label,
      meetingTime: r.session.meetingTime.toISOString(),
      startTime: r.session.startTime ? r.session.startTime.toISOString() : null,
      endTime: r.session.endTime ? r.session.endTime.toISOString() : null,
      place: r.session.place,
      bookingStatus: r.status as BookingStatus,
      bookedAt: r.bookedAt.toISOString(),
    }
    if (existing) {
      existing.bookings.push(sessionEntry)
      existing.bookings.sort((a, b) => a.sessionOrder - b.sessionOrder)
    } else {
      tourMap.set(r.tourId, {
        tourId: r.tourId,
        tourDate: r.session.tour.tourDate.toISOString(),
        places: sessionPlaces(r.session.tour.sessions),
        status: r.session.tour.status,
        maybeDeadline: r.session.tour.maybeDeadline ? r.session.tour.maybeDeadline.toISOString() : null,
        reflectionSubmitted: reflectedTourIds.has(r.tourId),
        absent: absentTourIds.has(r.tourId),
        group: { name: r.session.tour.group.name, type: r.session.tour.group.type },
        bookings: [sessionEntry],
      })
    }
  }

  return Array.from(tourMap.values())
}

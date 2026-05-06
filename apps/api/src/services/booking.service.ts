import { TourStatus, BookingStatus as PrismaBookingStatus, BuddyTier as PrismaBuddyTier, CancellationCategory as PrismaCancellationCategory, Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { BookingStatusSchema, BuddyTierSchema } from '@peace-buddy/types'
import type { BookingResponse, BookingStatus, BuddyTier, CancellationReasonBody, MyBookingEntry } from '@peace-buddy/types'
import { getPoolCapacities, NON_JUNIOR_TIERS } from '../lib/pool'
import type { Pool } from '../lib/pool'

type CreateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'TOUR_NOT_FOUND' | 'NOT_BOOKABLE' | 'ALREADY_BOOKED' | 'BUDDY_NOT_FOUND' | 'NOT_ELIGIBLE' }

type UpdateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'TOUR_FULL' | 'BUDDY_NOT_FOUND' | 'DEADLINE_PASSED' | 'MAYBE_DEADLINE_PASSED' | 'REASON_REQUIRED' }

const bookingSelect = {
  id: true,
  tourId: true,
  buddyTier: true,
  status: true,
  bookedAt: true,
  updatedAt: true,
} as const

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mapBooking(row: {
  id: string
  tourId: string
  buddyTier: string
  status: string
  bookedAt: Date
  updatedAt: Date
}): BookingResponse {
  return {
    id: row.id,
    tourId: row.tourId,
    buddyTier: row.buddyTier as BuddyTier,
    status: row.status as BookingStatus,
    bookedAt: row.bookedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function poolForTier(tier: BuddyTier): 'junior' | 'non_junior' {
  return tier === BuddyTierSchema.enum.junior ? 'junior' : 'non_junior'
}


async function getConfirmedCountByPool(tourId: string, pool: Pool): Promise<number> {
  if (pool === 'junior') {
    return db.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed, buddyTier: PrismaBuddyTier.junior } })
  }
  if (pool === 'non_junior') {
    return db.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed, buddyTier: { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] } } })
  }
  return db.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed } })
}

export async function createBooking(
  tourId: string,
  userId: string,
): Promise<CreateBookingResult> {
  const [tour, buddy] = await Promise.all([
    db.tour.findUnique({
      where: { id: tourId },
      select: { status: true, tourDate: true, bookingOpen: true, capacity: true },
    }),
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true, tier: true, status: true } }),
  ])

  if (!tour) return { ok: false, code: 'TOUR_NOT_FOUND' }
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }

  if (tour.status !== TourStatus.published || !tour.bookingOpen || localDateStr(tour.tourDate) < localDateStr(new Date())) {
    return { ok: false, code: 'NOT_BOOKABLE' }
  }

  // Only active buddies with a non-trainee tier can book
  if (buddy.status !== 'active' || !buddy.tier || buddy.tier === BuddyTierSchema.enum.trainee) {
    return { ok: false, code: 'NOT_ELIGIBLE' }
  }

  const buddyTier = buddy.tier as BuddyTier
  const capacities = await getPoolCapacities(tourId, tour.capacity)
  const primaryPool = poolForTier(buddyTier)

  const otherPool: 'junior' | 'non_junior' = primaryPool === 'junior' ? 'non_junior' : 'junior'
  const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
    getConfirmedCountByPool(tourId, primaryPool),
    getConfirmedCountByPool(tourId, otherPool),
    getConfirmedCountByPool(tourId, 'anyone'),
  ])
  const anyoneConfirmed = Math.max(
    0,
    totalConfirmed - Math.min(primaryCount, capacities[primaryPool]) - Math.min(otherCount, capacities[otherPool]),
  )

  const finalStatus: PrismaBookingStatus =
    primaryCount < capacities[primaryPool] || anyoneConfirmed < capacities.anyone
      ? PrismaBookingStatus.confirmed
      : PrismaBookingStatus.waitlist

  try {
    const booking = await db.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
        select: { id: true, status: true },
      })
      if (existing) {
        if (existing.status !== PrismaBookingStatus.declined) throw new Error('ALREADY_BOOKED')
        // Re-book: reuse existing row
        return tx.booking.update({
          where: { id: existing.id },
          data: { status: finalStatus, buddyTier: buddyTier as PrismaBuddyTier },
          select: bookingSelect,
        })
      }
      return tx.booking.create({
        data: { buddyId: buddy.id, tourId, buddyTier: buddyTier as PrismaBuddyTier, status: finalStatus },
        select: bookingSelect,
      })
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
  tourId: string,
  userId: string,
  newStatus: 'confirmed' | 'maybe' | 'waitlist' | 'declined',
  reason?: CancellationReasonBody,
): Promise<UpdateBookingResult> {
  const [buddy, tour] = await Promise.all([
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true } }),
    db.tour.findUnique({ where: { id: tourId }, select: { cancellationDeadline: true, maybeDeadline: true, capacity: true } }),
  ])
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }
  if (!tour) return { ok: false, code: 'NOT_FOUND' }

  const [booking, deadlineOverride] = await Promise.all([
    db.booking.findUnique({
      where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
      select: { id: true, status: true, buddyTier: true },
    }),
    db.buddyCancellationDeadlineOverride.findUnique({
      where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
      select: { deadline: true },
    }),
  ])
  if (!booking) return { ok: false, code: 'NOT_FOUND' }

  const effectiveDeadline = deadlineOverride?.deadline ?? tour.cancellationDeadline
  if (localDateStr(new Date()) >= localDateStr(effectiveDeadline)) {
    return { ok: false, code: 'DEADLINE_PASSED' }
  }

  if (newStatus === BookingStatusSchema.enum.maybe && tour.maybeDeadline && localDateStr(new Date()) >= localDateStr(tour.maybeDeadline)) {
    return { ok: false, code: 'MAYBE_DEADLINE_PASSED' }
  }

  const wasConfirmed = booking.status === PrismaBookingStatus.confirmed
  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined && !reason) {
    return { ok: false, code: 'REASON_REQUIRED' }
  }

  if (newStatus === BookingStatusSchema.enum.confirmed && !wasConfirmed) {
    try {
      const updated = await db.$transaction(async (tx) => {
        const capacities = await getPoolCapacities(tourId, tour.capacity)
        const buddyTier = booking.buddyTier as BuddyTier
        const primaryPool = poolForTier(buddyTier)
        const otherPool: 'junior' | 'non_junior' = primaryPool === 'junior' ? 'non_junior' : 'junior'
        const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
          tx.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed, buddyTier: booking.buddyTier } }),
          tx.booking.count({
            where: {
              tourId,
              status: PrismaBookingStatus.confirmed,
              buddyTier: otherPool === 'junior'
                ? PrismaBuddyTier.junior
                : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
            },
          }),
          tx.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed } }),
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

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { status: newStatus as PrismaBookingStatus },
    select: bookingSelect,
  })

  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined) {
    if (reason) {
      await db.cancellationReason.create({
        data: {
          bookingId: booking.id,
          category: reason.category as PrismaCancellationCategory,
          freeText: reason.freeText,
          unavoidable: reason.unavoidable,
          recordedBy: userId,
        },
      })
    }
    await promoteWaitlist(tourId, tour.capacity, booking.buddyTier as BuddyTier)
  }

  return { ok: true, booking: mapBooking(updated) }
}

async function promoteWaitlist(tourId: string, capacity: number, cancelledTier: BuddyTier): Promise<void> {
  const capacities = await getPoolCapacities(tourId, capacity)
  const primaryPool = poolForTier(cancelledTier)

  // Try same-pool candidate first, then any waitlisted buddy for the anyone-pool overflow slot
  const candidate =
    await findWaitlistCandidate(tourId, primaryPool) ??
    await findAnyWaitlistCandidate(tourId)

  if (!candidate) return

  await db.$transaction(async (tx) => {
    const cPool = poolForTier(candidate.buddyTier as BuddyTier)
    const cOtherPool: 'junior' | 'non_junior' = cPool === 'junior' ? 'non_junior' : 'junior'
    const [primaryCount, otherCount, totalConfirmed] = await Promise.all([
      tx.booking.count({
        where: {
          tourId,
          status: PrismaBookingStatus.confirmed,
          buddyTier: cPool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
        },
      }),
      tx.booking.count({
        where: {
          tourId,
          status: PrismaBookingStatus.confirmed,
          buddyTier: cOtherPool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
        },
      }),
      tx.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed } }),
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
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}

async function findWaitlistCandidate(tourId: string, pool: 'junior' | 'non_junior') {
  return db.booking.findFirst({
    where: {
      tourId,
      status: PrismaBookingStatus.waitlist,
      buddyTier: pool === 'junior' ? PrismaBuddyTier.junior : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
    },
    orderBy: { bookedAt: 'asc' },
    select: { id: true, buddyTier: true },
  })
}

async function findAnyWaitlistCandidate(tourId: string) {
  return db.booking.findFirst({
    where: { tourId, status: PrismaBookingStatus.waitlist },
    orderBy: { bookedAt: 'asc' },
    select: { id: true, buddyTier: true },
  })
}

export async function listMyBookings(userId: string): Promise<MyBookingEntry[]> {
  const rows = await db.booking.findMany({
    where: { buddy: { userId }, status: PrismaBookingStatus.confirmed },
    orderBy: { tour: { tourDate: 'desc' } },
    select: {
      id: true,
      tourId: true,
      status: true,
      bookedAt: true,
      updatedAt: true,
      tour: {
        select: {
          tourDate: true,
          meetingTime: true,
          location: true,
          status: true,
          group: { select: { name: true } },
        },
      },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    tourId: r.tourId,
    status: r.status as BookingStatus,
    bookedAt: r.bookedAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    tour: {
      tourDate: r.tour.tourDate.toISOString(),
      meetingTime: r.tour.meetingTime.toISOString(),
      location: r.tour.location,
      status: r.tour.status as import('@peace-buddy/types').TourStatus,
      group: { name: r.tour.group.name },
    },
  }))
}

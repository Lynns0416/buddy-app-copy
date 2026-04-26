import { TourStatus, BookingStatus as PrismaBookingStatus, CancellationCategory as PrismaCancellationCategory, Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { BookingStatusSchema } from '@peace-buddy/types'
import type { BookingResponse, BookingStatus, CancellationReasonBody, MyBookingEntry } from '@peace-buddy/types'

type CreateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'TOUR_NOT_FOUND' | 'NOT_BOOKABLE' | 'ALREADY_BOOKED' | 'BUDDY_NOT_FOUND' }

type UpdateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'TOUR_FULL' | 'BUDDY_NOT_FOUND' | 'DEADLINE_PASSED' | 'MAYBE_DEADLINE_PASSED' | 'REASON_REQUIRED' }

const bookingSelect = {
  id: true,
  tourId: true,
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
  status: string
  bookedAt: Date
  updatedAt: Date
}): BookingResponse {
  return {
    id: row.id,
    tourId: row.tourId,
    status: row.status as BookingStatus,
    bookedAt: row.bookedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function createBooking(
  tourId: string,
  userId: string,
  initialStatus?: 'confirmed' | 'maybe' | 'declined',
): Promise<CreateBookingResult> {
  const [tour, buddy] = await Promise.all([
    db.tour.findUnique({
      where: { id: tourId },
      select: { status: true, tourDate: true, bookingOpen: true, capacity: true },
    }),
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true } }),
  ])

  if (!tour) return { ok: false, code: 'TOUR_NOT_FOUND' }
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }

  if (tour.status !== TourStatus.published || !tour.bookingOpen || localDateStr(tour.tourDate) < localDateStr(new Date())) {
    return { ok: false, code: 'NOT_BOOKABLE' }
  }

  try {
    const booking = await db.$transaction(async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
        select: { id: true },
      })
      if (existing) throw new Error('ALREADY_BOOKED')

      let status: PrismaBookingStatus
      if (initialStatus === 'maybe') {
        status = PrismaBookingStatus.maybe
      } else if (initialStatus === 'declined') {
        status = PrismaBookingStatus.declined
      } else {
        const confirmedCount = await tx.booking.count({
          where: { tourId, status: PrismaBookingStatus.confirmed },
        })
        status = confirmedCount < tour.capacity ? PrismaBookingStatus.confirmed : PrismaBookingStatus.waitlist
      }

      return tx.booking.create({
        data: { buddyId: buddy.id, tourId, status },
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
      select: { id: true, status: true },
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

  // Atomic seat claim: wrap count + update in a serializable transaction to prevent double-booking
  if (newStatus === BookingStatusSchema.enum.confirmed && !wasConfirmed) {
    try {
      const updated = await db.$transaction(async (tx) => {
        const confirmedCount = await tx.booking.count({
          where: { tourId, status: PrismaBookingStatus.confirmed },
        })
        if (confirmedCount >= tour.capacity) throw new Error('TOUR_FULL')
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
    // M8: notify all waitlisted buddies that a seat has opened; for now auto-promote oldest
    await promoteWaitlist(tourId, tour.capacity)
  }

  return { ok: true, booking: mapBooking(updated) }
}

async function promoteWaitlist(tourId: string, capacity: number): Promise<void> {
  const confirmedCount = await db.booking.count({
    where: { tourId, status: PrismaBookingStatus.confirmed },
  })
  if (confirmedCount >= capacity) return

  const oldest = await db.booking.findFirst({
    where: { tourId, status: PrismaBookingStatus.waitlist },
    orderBy: { bookedAt: 'asc' },
    select: { id: true },
  })
  if (!oldest) return

  await db.booking.update({
    where: { id: oldest.id },
    data: { status: PrismaBookingStatus.confirmed },
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

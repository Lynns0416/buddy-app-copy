import { TourStatus, BookingStatus as PrismaBookingStatus, CancellationCategory as PrismaCancellationCategory } from '@prisma/client'
import { db } from '../lib/db'
import { BookingStatusSchema } from '@peace-buddy/types'
import type { BookingResponse, BookingStatus, CancellationReasonBody } from '@peace-buddy/types'

type CreateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'TOUR_NOT_FOUND' | 'NOT_BOOKABLE' | 'ALREADY_BOOKED' | 'BUDDY_NOT_FOUND' }

type UpdateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'TOUR_FULL' | 'BUDDY_NOT_FOUND' | 'DEADLINE_PASSED' | 'REASON_REQUIRED' }

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

export async function createBooking(tourId: string, userId: string): Promise<CreateBookingResult> {
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

  const existing = await db.booking.findUnique({
    where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
    select: { id: true },
  })
  if (existing) return { ok: false, code: 'ALREADY_BOOKED' }

  const confirmedCount = await db.booking.count({
    where: { tourId, status: PrismaBookingStatus.confirmed },
  })
  const newStatus =
    confirmedCount < tour.capacity ? PrismaBookingStatus.confirmed : PrismaBookingStatus.waitlist

  const booking = await db.booking.create({
    data: { buddyId: buddy.id, tourId, status: newStatus },
    select: bookingSelect,
  })

  return { ok: true, booking: mapBooking(booking) }
}

export async function updateBooking(
  tourId: string,
  userId: string,
  newStatus: 'confirmed' | 'maybe' | 'declined',
  reason?: CancellationReasonBody,
): Promise<UpdateBookingResult> {
  const [buddy, tour] = await Promise.all([
    db.buddyProfile.findUnique({ where: { userId }, select: { id: true } }),
    db.tour.findUnique({ where: { id: tourId }, select: { cancellationDeadline: true, capacity: true } }),
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

  if (newStatus === BookingStatusSchema.enum.confirmed && booking.status !== PrismaBookingStatus.confirmed) {
    const confirmedCount = await db.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed } })
    if (confirmedCount >= tour.capacity) return { ok: false, code: 'TOUR_FULL' }
  }

  const wasConfirmed = booking.status === PrismaBookingStatus.confirmed
  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined && !reason) {
    return { ok: false, code: 'REASON_REQUIRED' }
  }

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { status: newStatus },
    select: bookingSelect,
  })

  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined && reason) {
    await db.cancellationReason.create({
      data: {
        bookingId: booking.id,
        category: reason.category as PrismaCancellationCategory,
        freeText: reason.freeText,
        unavoidable: reason.unavoidable,
        recordedBy: userId,
      },
    })
    await promoteWaitlist(tourId, tour.capacity)
  } else if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined) {
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

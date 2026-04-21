import { TourStatus, BookingStatus as PrismaBookingStatus } from '@prisma/client'
import { db } from '../lib/db'
import { BookingStatusSchema } from '@peace-buddy/types'
import type { BookingResponse, UpdateBookingBody } from '@peace-buddy/types'

type CreateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'TOUR_NOT_FOUND' | 'NOT_BOOKABLE' | 'ALREADY_BOOKED' | 'BUDDY_NOT_FOUND' }

type UpdateBookingResult =
  | { ok: true; booking: BookingResponse }
  | { ok: false; code: 'NOT_FOUND' | 'TOUR_FULL' | 'BUDDY_NOT_FOUND' }

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
    status: row.status as UpdateBookingBody['status'],
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
  newStatus: UpdateBookingBody['status'],
): Promise<UpdateBookingResult> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) return { ok: false, code: 'BUDDY_NOT_FOUND' }

  const booking = await db.booking.findUnique({
    where: { buddyId_tourId: { buddyId: buddy.id, tourId } },
    select: { id: true, status: true },
  })
  if (!booking) return { ok: false, code: 'NOT_FOUND' }

  if (newStatus === BookingStatusSchema.enum.confirmed && booking.status !== PrismaBookingStatus.confirmed) {
    const [tour, confirmedCount] = await Promise.all([
      db.tour.findUnique({ where: { id: tourId }, select: { capacity: true } }),
      db.booking.count({ where: { tourId, status: PrismaBookingStatus.confirmed } }),
    ])
    if (!tour) return { ok: false, code: 'NOT_FOUND' }
    if (confirmedCount >= tour.capacity) return { ok: false, code: 'TOUR_FULL' }
  }

  const wasConfirmed = booking.status === PrismaBookingStatus.confirmed

  const updated = await db.booking.update({
    where: { id: booking.id },
    data: { status: newStatus },
    select: bookingSelect,
  })

  if (wasConfirmed && newStatus === BookingStatusSchema.enum.declined) {
    const tour = await db.tour.findUnique({ where: { id: tourId }, select: { capacity: true } })
    if (tour) await promoteWaitlist(tourId, tour.capacity)
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

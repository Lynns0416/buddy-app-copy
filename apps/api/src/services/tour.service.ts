import { TourStatus } from '@prisma/client'
import { db } from '../lib/db'
import type { TourResponse, TourDetailResponse, TourSeatCounts, GroupType, BookingStatus } from '@peace-buddy/types'
import type { ToursQuery } from '../types'

const tourSelect = {
  id: true,
  groupId: true,
  group: { select: { id: true, name: true, type: true } },
  status: true,
  tourDate: true,
  meetingTime: true,
  startTime: true,
  endTime: true,
  bookingOpen: true,
  location: true,
  capacity: true,
  participantCount: true,
  description: true,
  cancellationDeadline: true,
  maybeDeadline: true,
  notificationOffsets: true,
  createdAt: true,
  updatedAt: true,
} as const

function mapTour(row: {
  id: string
  groupId: string
  group: { id: string; name: string; type: string }
  status: string
  tourDate: Date
  meetingTime: Date
  startTime: Date | null
  endTime: Date | null
  bookingOpen: boolean
  location: string
  capacity: number
  participantCount: number
  description: string | null
  cancellationDeadline: Date
  maybeDeadline: Date | null
  notificationOffsets: number[]
  createdAt: Date
  updatedAt: Date
}): TourResponse {
  return {
    id: row.id,
    groupId: row.groupId,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourResponse['status'],
    tourDate: row.tourDate.toISOString(),
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.capacity,
    participantCount: row.participantCount,
    description: row.description,
    cancellationDeadline: row.cancellationDeadline.toISOString(),
    maybeDeadline: row.maybeDeadline ? row.maybeDeadline.toISOString() : null,
    notificationOffsets: row.notificationOffsets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTours(filters?: ToursQuery): Promise<TourResponse[]> {
  const rows = await db.tour.findMany({
    where: {
      status: (filters?.status as TourStatus | undefined) ?? TourStatus.published,
      ...(filters?.from || filters?.to
        ? {
            tourDate: {
              ...(filters?.from ? { gte: filters.from } : {}),
              ...(filters?.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    select: tourSelect,
    orderBy: { tourDate: 'asc' },
  })
  return rows.map(mapTour)
}

export async function getTour(id: string, userId: string): Promise<TourDetailResponse | null> {
  const [row, countRows, myBooking] = await Promise.all([
    db.tour.findUnique({ where: { id }, select: tourSelect }),
    db.booking.groupBy({
      by: ['status'],
      where: { tourId: id },
      _count: { status: true },
    }),
    db.booking.findFirst({
      where: { tourId: id, buddy: { userId } },
      select: { status: true },
    }),
  ])

  if (!row) return null

  const seatCounts: TourSeatCounts = { confirmed: 0, maybe: 0, waitlist: 0, declined: 0 }
  for (const r of countRows) {
    seatCounts[r.status as BookingStatus] = r._count.status
  }

  return {
    ...mapTour(row),
    seatCounts,
    remainingSeats: row.capacity - seatCounts.confirmed,
    myBookingStatus: (myBooking?.status ?? null) as BookingStatus | null,
  }
}

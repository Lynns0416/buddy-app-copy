import { TourStatus, BuddyTier as PrismaBuddyTier } from '@prisma/client'
import { db } from '../lib/db'
import { getPoolCapacities, NON_JUNIOR_TIERS } from '../lib/pool'
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

export async function listTours(userId: string, filters?: ToursQuery): Promise<TourResponse[]> {
  const buddyProfile = await db.buddyProfile.findFirst({
    where: { userId },
    select: { tier: true },
  })
  if (buddyProfile?.tier === PrismaBuddyTier.trainee) return []

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
  const [row, countRows, myBooking, buddyProfile] = await Promise.all([
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
    db.buddyProfile.findFirst({
      where: { userId },
      select: { tier: true },
    }),
  ])

  if (!row) return null
  if (buddyProfile?.tier === PrismaBuddyTier.trainee) return null

  const seatCounts: TourSeatCounts = { confirmed: 0, maybe: 0, waitlist: 0, declined: 0 }
  for (const r of countRows) {
    seatCounts[r.status as BookingStatus] = r._count.status
  }

  let myCapacity: number | null = null
  let myRemaining: number | null = null
  if (buddyProfile?.tier) {
    const capacities = await getPoolCapacities(id, row.capacity)
    const isJunior = buddyProfile.tier === PrismaBuddyTier.junior
    const primaryPool = isJunior ? 'junior' : 'non_junior'
    myCapacity = capacities[primaryPool] + capacities.anyone
    const otherPool = isJunior ? 'non_junior' : 'junior'
    const [primaryConfirmed, otherConfirmed, totalConfirmed] = await Promise.all([
      db.booking.count({
        where: {
          tourId: id,
          status: 'confirmed',
          buddyTier: isJunior
            ? PrismaBuddyTier.junior
            : { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] },
        },
      }),
      db.booking.count({
        where: {
          tourId: id,
          status: 'confirmed',
          buddyTier: isJunior
            ? { in: NON_JUNIOR_TIERS as unknown as PrismaBuddyTier[] }
            : PrismaBuddyTier.junior,
        },
      }),
      db.booking.count({ where: { tourId: id, status: 'confirmed' } }),
    ])
    const anyoneConfirmed = Math.max(
      0,
      totalConfirmed - Math.min(primaryConfirmed, capacities[primaryPool]) - Math.min(otherConfirmed, capacities[otherPool]),
    )
    myRemaining = Math.max(0, capacities[primaryPool] - primaryConfirmed)
      + Math.max(0, capacities.anyone - anyoneConfirmed)
  }

  return {
    ...mapTour(row),
    seatCounts,
    remaining: row.capacity - seatCounts.confirmed,
    myCapacity,
    myRemaining,
    myBookingStatus: (myBooking?.status ?? null) as BookingStatus | null,
  }
}

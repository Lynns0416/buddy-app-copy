import { TourStatus, BuddyStatus as PrismaBuddyStatus } from '@prisma/client'
import { db } from '../lib/db'
import { getPoolCapacities, poolForTier, tiersInPool } from '../lib/pool'
import type { TierPool } from '../lib/pool'
import { buildTourIcs, icsTourSelect } from '../lib/tourIcs'
import { placeSummarySelect, sessionPlaces } from '../lib/sessionPlaces'
import { BookingStatusSchema, LocaleSchema } from '@peace-buddy/types'
import type { TourResponse, TourDetailResponse, TourSessionDetailResponse, TourSeatCounts, GroupType, BookingStatus, TourSessionResponse, PlaceSummary } from '@peace-buddy/types'
import type { ToursQuery } from '../types'

const sessionSelect = {
  id: true,
  order: true,
  label: true,
  meetingTime: true,
  startTime: true,
  endTime: true,
  capacity: true,
  minBuddies: true,
  participantCount: true,
  place: { select: placeSummarySelect },
  // Confirmed buddies, counted as the admin "short of buddies" list counts them (PRD §11.7).
  _count: { select: { bookings: { where: { status: BookingStatusSchema.enum.confirmed } } } },
} as const

const tourSelect = {
  id: true,
  groupId: true,
  group: { select: { id: true, name: true, type: true } },
  status: true,
  tourDate: true,
  bookingOpen: true,
  description: true,
  cancellationDeadline: true,
  maybeDeadline: true,
  notificationOffsets: true,
  createdAt: true,
  updatedAt: true,
  sessions: { select: sessionSelect, orderBy: { order: 'asc' as const } },
} as const

function mapSession(row: {
  id: string
  order: number
  label: string | null
  meetingTime: Date
  startTime: Date | null
  endTime: Date | null
  capacity: number
  minBuddies: number | null
  participantCount: number
  place: PlaceSummary
}): TourSessionResponse {
  return {
    id: row.id,
    order: row.order,
    label: row.label,
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    capacity: row.capacity,
    minBuddies: row.minBuddies,
    participantCount: row.participantCount,
    belowMinimum: row.minBuddies != null && row.participantCount < row.minBuddies,
    place: row.place,
  }
}

function mapTour(row: {
  id: string
  groupId: string
  group: { id: string; name: string; type: string }
  status: string
  tourDate: Date
  bookingOpen: boolean
  description: string | null
  cancellationDeadline: Date
  maybeDeadline: Date | null
  notificationOffsets: number[]
  createdAt: Date
  updatedAt: Date
  sessions: Array<{
    id: string
    order: number
    label: string | null
    meetingTime: Date
    startTime: Date | null
    endTime: Date | null
    capacity: number
    minBuddies: number | null
    participantCount: number
    place: PlaceSummary
    _count: { bookings: number }
  }>
}, myBookingBySession: Map<string, BookingStatus>): TourResponse {
  const totalParticipants = row.sessions.reduce((s, sess) => s + sess.participantCount, 0)
  return {
    id: row.id,
    groupId: row.groupId,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourResponse['status'],
    tourDate: row.tourDate.toISOString(),
    bookingOpen: row.bookingOpen,
    places: sessionPlaces(row.sessions),
    participantCount: totalParticipants,
    description: row.description,
    cancellationDeadline: row.cancellationDeadline.toISOString(),
    maybeDeadline: row.maybeDeadline ? row.maybeDeadline.toISOString() : null,
    notificationOffsets: row.notificationOffsets,
    sessions: row.sessions.map((sess) => ({
      ...mapSession(sess),
      confirmedCount: sess._count.bookings,
      myBookingStatus: myBookingBySession.get(sess.id) ?? null,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listTours(userId: string, filters?: ToursQuery): Promise<TourResponse[]> {
  const buddyProfile = await db.buddyProfile.findFirst({
    where: { userId },
    select: { status: true },
  })
  if (buddyProfile?.status === PrismaBuddyStatus.trainee) return []

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

  // One lookup for the caller's bookings across every listed session, not one per tour.
  const sessionIds = rows.flatMap((row) => row.sessions.map((sess) => sess.id))
  const myBookings = buddyProfile && sessionIds.length > 0
    ? await db.booking.findMany({
        where: { sessionId: { in: sessionIds }, buddy: { userId } },
        select: { sessionId: true, status: true },
      })
    : []
  const myBookingBySession = new Map<string, BookingStatus>()
  for (const b of myBookings) {
    myBookingBySession.set(b.sessionId, b.status)
  }

  return rows.map((row) => mapTour(row, myBookingBySession))
}

export async function getTour(id: string, userId: string): Promise<TourDetailResponse | null> {
  const [row, buddyProfile] = await Promise.all([
    db.tour.findUnique({
      where: { id },
      select: {
        ...tourSelect,
        staffInCharge: { select: { name: true, deletedAt: true } },
        // Richer than tourSelect's session place: a buddy picking a spot for
        // a reflection moment needs the session's place's active spots too.
        sessions: {
          select: {
            ...sessionSelect,
            place: {
              select: {
                ...placeSummarySelect,
                spots: {
                  where: { active: true },
                  select: placeSummarySelect,
                  orderBy: { sortOrder: 'asc' as const },
                },
              },
            },
          },
          orderBy: { order: 'asc' as const },
        },
      },
    }),
    db.buddyProfile.findFirst({
      where: { userId },
      select: { status: true, tier: true },
    }),
  ])

  if (!row) return null
  if (buddyProfile?.status === PrismaBuddyStatus.trainee) return null

  const sessionIds = row.sessions.map((s) => s.id)

  // Batch all DB queries across sessions
  const [seatCountRows, myBookings, confirmedByTierRows] = await Promise.all([
    db.booking.groupBy({
      by: ['sessionId', 'status'],
      where: { sessionId: { in: sessionIds } },
      _count: { status: true },
    }),
    buddyProfile
      ? db.booking.findMany({
          where: { sessionId: { in: sessionIds }, buddy: { userId } },
          select: { sessionId: true, status: true },
        })
      : Promise.resolve([]),
    buddyProfile?.tier
      ? db.booking.groupBy({
          by: ['sessionId', 'buddyTier'],
          where: { sessionId: { in: sessionIds }, status: 'confirmed' },
          _count: { buddyTier: true },
        })
      : Promise.resolve([]),
  ])

  // Pre-fetch tier capacities per session (needed for myCapacity/myRemaining)
  const capacitiesMap = new Map<string, Awaited<ReturnType<typeof getPoolCapacities>>>()
  if (buddyProfile?.tier) {
    await Promise.all(
      row.sessions.map(async (sess) => {
        capacitiesMap.set(sess.id, await getPoolCapacities(sess.id, sess.capacity))
      })
    )
  }

  // Index results by sessionId
  const seatCountsBySession = new Map<string, TourSeatCounts>()
  for (const r of seatCountRows) {
    const counts = seatCountsBySession.get(r.sessionId) ?? { confirmed: 0, maybe: 0, waitlist: 0, declined: 0 }
    counts[r.status as BookingStatus] = r._count.status
    seatCountsBySession.set(r.sessionId, counts)
  }

  const myBookingBySession = new Map<string, BookingStatus>()
  for (const b of myBookings) {
    myBookingBySession.set(b.sessionId, b.status)
  }

  // confirmedByTier[sessionId][buddyTier] = count
  const confirmedByTier = new Map<string, Map<string, number>>()
  for (const r of confirmedByTierRows) {
    const byTier = confirmedByTier.get(r.sessionId) ?? new Map<string, number>()
    byTier.set(r.buddyTier, r._count.buddyTier)
    confirmedByTier.set(r.sessionId, byTier)
  }

  const sessionDetails: TourSessionDetailResponse[] = row.sessions.map((sess) => {
    const seatCounts = seatCountsBySession.get(sess.id) ?? { confirmed: 0, maybe: 0, waitlist: 0, declined: 0 }

    let myCapacity: number | null = null
    let myRemaining: number | null = null
    if (buddyProfile?.tier) {
      const capacities = capacitiesMap.get(sess.id)!
      const primaryPool = poolForTier(buddyProfile.tier)
      const otherPool: TierPool = primaryPool === 'junior' ? 'non_junior' : 'junior'
      myCapacity = capacities[primaryPool] + capacities.anyone

      const byTier = confirmedByTier.get(sess.id) ?? new Map<string, number>()
      const confirmedIn = (pool: TierPool) =>
        tiersInPool(pool).reduce((sum, t) => sum + (byTier.get(t) ?? 0), 0)
      const primaryConfirmed = confirmedIn(primaryPool)
      const otherConfirmed = confirmedIn(otherPool)
      const totalConfirmed = seatCounts.confirmed
      const anyoneConfirmed = Math.max(
        0,
        totalConfirmed - Math.min(primaryConfirmed, capacities[primaryPool]) - Math.min(otherConfirmed, capacities[otherPool]),
      )
      myRemaining = Math.max(0, capacities[primaryPool] - primaryConfirmed)
        + Math.max(0, capacities.anyone - anyoneConfirmed)
    }

    return {
      ...mapSession(sess),
      place: sess.place,
      seatCounts,
      remaining: sess.capacity - seatCounts.confirmed,
      myCapacity,
      myRemaining,
      myBookingStatus: myBookingBySession.get(sess.id) ?? null,
    }
  })

  // Name only: an admin's contact details are not shown to buddies.
  const staff = row.staffInCharge
  return {
    ...mapTour(row, myBookingBySession),
    sessions: sessionDetails,
    staffInCharge: staff && !staff.deletedAt ? { name: staff.name } : null,
  }
}

// One VEVENT per session the buddy is confirmed on — not every session in
// the tour, and not maybe/waitlist. Returns null (404) when the tour isn't
// visible to the caller, same as getTour, and also when the buddy holds no
// confirmed session — nothing to put on a personal calendar. See #199.
export async function getTourIcs(id: string, userId: string): Promise<string | null> {
  const [row, buddyProfile, user] = await Promise.all([
    db.tour.findUnique({
      where: { id },
      select: icsTourSelect,
    }),
    db.buddyProfile.findFirst({ where: { userId }, select: { status: true } }),
    db.user.findUnique({ where: { id: userId }, select: { locale: true } }),
  ])

  if (!row) return null
  if (buddyProfile?.status === PrismaBuddyStatus.trainee) return null

  const sessionIds = row.sessions.map((s) => s.id)
  const confirmedBookings = sessionIds.length > 0
    ? await db.booking.findMany({
        where: { sessionId: { in: sessionIds }, buddy: { userId }, status: BookingStatusSchema.enum.confirmed },
        select: { sessionId: true },
      })
    : []
  const confirmedSessionIds = new Set(confirmedBookings.map((b) => b.sessionId))
  const confirmedSessions = row.sessions.filter((s) => confirmedSessionIds.has(s.id))
  if (confirmedSessions.length === 0) return null

  return buildTourIcs(row, confirmedSessions, user?.locale ?? LocaleSchema.enum.ja)
}

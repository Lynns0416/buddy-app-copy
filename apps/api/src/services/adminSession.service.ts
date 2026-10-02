import { db } from '../lib/db'
import type {
  CreateTourSession,
  UpdateTourSession,
  AdminTourDetailResponse,
  TierCapacities,
} from '@peace-buddy/types'
import { TourStatusSchema, NotifEventKindSchema, BookingStatusSchema } from '@peace-buddy/types'
import { payloadTourDate } from '../lib/notificationPayload'
import { TourNotFoundError, TourImmutableError, getAdminTourDetail } from './adminTour.service'
import { enqueueEmailForBookedBuddies, enqueueInAppForBookedBuddies } from './notification.service'

export class SessionNotFoundError extends Error {
  constructor() {
    super('Session not found')
  }
}

export class SessionHasBookingsError extends Error {
  constructor() {
    super('Cannot delete session with bookings')
  }
}

export class LastSessionError extends Error {
  constructor() {
    super('Cannot delete the only session')
  }
}

export class TooManySessionsError extends Error {
  constructor() {
    super('Tour already has maximum number of sessions')
  }
}

export class PlaceInUseError extends Error {
  constructor() {
    super('A moment on this session uses a spot of its place, so the place cannot be changed')
  }
}

export class CapacityBelowConfirmedError extends Error {
  constructor() {
    super('Capacity cannot be lower than the number of confirmed bookings on this session')
  }
}

export class MinBuddiesExceedsCapacityError extends Error {
  constructor() {
    super('minBuddies must be ≤ capacity')
  }
}

function parseTime(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const d = new Date(0)
  d.setUTCHours(hours, minutes, 0, 0)
  return d
}

export async function addSession(tourId: string, data: CreateTourSession): Promise<AdminTourDetailResponse> {
  const existing = await db.tour.findUnique({
    where: { id: tourId },
    select: { status: true, sessions: { select: { order: true } } },
  })
  if (!existing) throw new TourNotFoundError()
  if (existing.status === TourStatusSchema.enum.cancelled || existing.status === TourStatusSchema.enum.completed) throw new TourImmutableError()
  if (existing.sessions.length >= 2) throw new TooManySessionsError()

  const nextOrder = existing.sessions.length + 1
  await db.tourSession.create({
    data: {
      tourId,
      order: nextOrder,
      label: data.label ?? null,
      meetingTime: parseTime(data.meetingTime),
      startTime: data.startTime ? parseTime(data.startTime) : null,
      endTime: data.endTime ? parseTime(data.endTime) : null,
      capacity: data.capacity,
      minBuddies: data.minBuddies,
      participantCount: data.participantCount ?? 0,
      placeId: data.placeId,
    },
  })

  const detail = await getAdminTourDetail(tourId)
  return detail!
}

export async function updateSession(tourId: string, sessionId: string, data: UpdateTourSession): Promise<AdminTourDetailResponse> {
  const session = await db.tourSession.findUnique({
    where: { id: sessionId },
    select: { tourId: true, placeId: true, meetingTime: true, capacity: true, minBuddies: true, tour: { select: { status: true } } },
  })
  if (!session || session.tourId !== tourId) throw new SessionNotFoundError()

  // The schema only compares the two when both are sent; a partial update is
  // checked against the stored value of the one left out.
  const capacity = data.capacity ?? session.capacity
  const minBuddies = data.minBuddies ?? session.minBuddies
  if (minBuddies > capacity) throw new MinBuddiesExceedsCapacityError()

  const placeChanged = data.placeId !== undefined && data.placeId !== session.placeId
  const meetingTimeChanged =
    data.meetingTime !== undefined && data.meetingTime !== session.meetingTime.toISOString().slice(11, 16)

  // Lowering capacity never un-confirms a booking — it is rejected instead.
  if (data.capacity !== undefined) {
    const confirmed = await db.booking.count({
      where: { sessionId, status: BookingStatusSchema.enum.confirmed },
    })
    if (data.capacity < confirmed) throw new CapacityBelowConfirmedError()
  }

  // A session's place cannot change while a moment on it uses one of the old
  // place's spots — the moment would name a spot the session no longer visits.
  if (placeChanged) {
    const inUse = await db.tourReflectionMoment.findFirst({
      where: { spot: { placeId: session.placeId }, reflection: { sessionId } },
      select: { id: true },
    })
    if (inUse) throw new PlaceInUseError()
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.tourSession.update({
      where: { id: sessionId },
      select: { tour: { select: { tourDate: true, group: { select: { name: true } } } } },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.meetingTime !== undefined ? { meetingTime: parseTime(data.meetingTime) } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime ? parseTime(data.startTime) : null } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime ? parseTime(data.endTime) : null } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.minBuddies !== undefined ? { minBuddies: data.minBuddies } : {}),
        ...(data.participantCount !== undefined ? { participantCount: data.participantCount } : {}),
        ...(data.placeId !== undefined ? { placeId: data.placeId } : {}),
      },
    })

    if ((placeChanged || meetingTimeChanged) && session.tour.status === TourStatusSchema.enum.published) {
      const args = {
        eventType: NotifEventKindSchema.enum.tour_details_changed,
        payload: { tourId, groupName: updated.tour.group.name, tourDate: payloadTourDate(updated.tour.tourDate) },
      }
      await enqueueInAppForBookedBuddies(tourId, args, tx)
      await enqueueEmailForBookedBuddies(tourId, args, tx)
    }
  })

  const detail = await getAdminTourDetail(tourId)
  return detail!
}

export async function deleteSession(tourId: string, sessionId: string): Promise<AdminTourDetailResponse> {
  const session = await db.tourSession.findUnique({
    where: { id: sessionId },
    select: { tourId: true, _count: { select: { bookings: true } } },
  })
  if (!session || session.tourId !== tourId) throw new SessionNotFoundError()
  if (session._count.bookings > 0) throw new SessionHasBookingsError()

  const tourSessions = await db.tourSession.count({ where: { tourId } })
  if (tourSessions <= 1) throw new LastSessionError()

  await db.$transaction(async (tx) => {
    await tx.tourSession.delete({ where: { id: sessionId } })
    const remaining = await tx.tourSession.findMany({
      where: { tourId },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    for (let i = 0; i < remaining.length; i++) {
      await tx.tourSession.update({ where: { id: remaining[i].id }, data: { order: i + 1 } })
    }
  })

  const detail = await getAdminTourDetail(tourId)
  return detail!
}

export async function getSessionTierCapacities(sessionId: string): Promise<TierCapacities> {
  const rows = await db.tierCapacity.findMany({
    where: { sessionId },
    select: { pool: true, percent: true },
  })
  const result: TierCapacities = { junior: 20, non_junior: 30, anyone: 50 }
  for (const row of rows) {
    result[row.pool as keyof TierCapacities] = row.percent
  }
  return result
}

export async function upsertSessionTierCapacities(tourId: string, sessionId: string, data: TierCapacities): Promise<TierCapacities> {
  const session = await db.tourSession.findUnique({ where: { id: sessionId }, select: { tourId: true } })
  if (!session || session.tourId !== tourId) throw new SessionNotFoundError()

  const pools: Array<keyof TierCapacities> = ['junior', 'non_junior', 'anyone']
  await db.$transaction(
    pools.map((pool) =>
      db.tierCapacity.upsert({
        where: { sessionId_pool: { sessionId, pool } },
        create: { sessionId, pool, percent: data[pool] },
        update: { percent: data[pool] },
      })
    )
  )

  return getSessionTierCapacities(sessionId)
}

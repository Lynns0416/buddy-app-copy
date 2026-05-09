import { db } from '../lib/db'
import type {
  CreateTourSession,
  UpdateTourSession,
  AdminTourDetailResponse,
  TierCapacities,
} from '@peace-buddy/types'
import { TourStatusSchema } from '@peace-buddy/types'
import { TourNotFoundError, TourImmutableError, getAdminTourDetail } from './adminTour.service'

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
      participantCount: data.participantCount ?? 0,
    },
  })

  const detail = await getAdminTourDetail(tourId)
  return detail!
}

export async function updateSession(tourId: string, sessionId: string, data: UpdateTourSession): Promise<AdminTourDetailResponse> {
  const session = await db.tourSession.findUnique({ where: { id: sessionId }, select: { tourId: true } })
  if (!session || session.tourId !== tourId) throw new SessionNotFoundError()

  await db.tourSession.update({
    where: { id: sessionId },
    data: {
      ...(data.label !== undefined ? { label: data.label } : {}),
      ...(data.meetingTime !== undefined ? { meetingTime: parseTime(data.meetingTime) } : {}),
      ...(data.startTime !== undefined ? { startTime: data.startTime ? parseTime(data.startTime) : null } : {}),
      ...(data.endTime !== undefined ? { endTime: data.endTime ? parseTime(data.endTime) : null } : {}),
      ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
      ...(data.participantCount !== undefined ? { participantCount: data.participantCount } : {}),
    },
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

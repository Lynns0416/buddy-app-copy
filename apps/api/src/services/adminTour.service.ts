import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import {
  TourStatusSchema,
  BookingStatusSchema,
} from '@peace-buddy/types'
import type {
  CreateTour,
  UpdateTour,
  CreateTourSession,
  UpdateTourSession,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
  TourSessionResponse,
  TourStatus,
  TourAction,
  GroupType,
  BookingStatus,
  TierCapacities,
} from '@peace-buddy/types'

export class TourNotFoundError extends Error {
  constructor() {
    super('Tour not found')
  }
}

export class TourTransitionError extends Error {}

export class TourImmutableError extends Error {
  constructor() {
    super('Cannot edit a cancelled or completed tour')
  }
}

export class TourNotDraftError extends Error {
  constructor() {
    super('Only draft tours can be deleted')
  }
}

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

const ACTION_TO_STATUS: Record<TourAction, TourStatus> = {
  publish: TourStatusSchema.enum.published,
  cancel: TourStatusSchema.enum.cancelled,
  complete: TourStatusSchema.enum.completed,
}

const ALLOWED_TRANSITIONS: Partial<Record<TourStatus, TourStatus[]>> = {
  draft: [TourStatusSchema.enum.published, TourStatusSchema.enum.cancelled],
  published: [TourStatusSchema.enum.cancelled, TourStatusSchema.enum.completed],
}

function parseTime(hhmm: string): Date {
  const [hours, minutes] = hhmm.split(':').map(Number)
  const d = new Date(0)
  d.setUTCHours(hours, minutes, 0, 0)
  return d
}

const sessionSelect = {
  id: true,
  order: true,
  label: true,
  meetingTime: true,
  startTime: true,
  endTime: true,
  capacity: true,
  participantCount: true,
} as const

function mapSession(row: {
  id: string
  order: number
  label: string | null
  meetingTime: Date
  startTime: Date | null
  endTime: Date | null
  capacity: number
  participantCount: number
}): TourSessionResponse {
  return {
    id: row.id,
    order: row.order,
    label: row.label,
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    capacity: row.capacity,
    participantCount: row.participantCount,
  }
}

function mapSummary(row: {
  id: string
  group: { id: string; name: string; type: string }
  status: string
  tourDate: Date
  bookingOpen: boolean
  location: string
  description: string | null
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
    participantCount: number
  }>
  _count: { bookings: number }
}): AdminTourSummaryResponse {
  const totalCapacity = row.sessions.reduce((s, sess) => s + sess.capacity, 0)
  const totalParticipants = row.sessions.reduce((s, sess) => s + sess.participantCount, 0)
  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: totalCapacity,
    description: row.description,
    confirmedCount: row._count.bookings,
    participantCount: totalParticipants,
    sessions: row.sessions.sort((a, b) => a.order - b.order).map(mapSession),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

const tourListSelect = {
  id: true,
  group: { select: { id: true, name: true, type: true } },
  status: true,
  tourDate: true,
  bookingOpen: true,
  location: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  sessions: { select: sessionSelect, orderBy: { order: 'asc' as const } },
  _count: {
    select: {
      bookings: { where: { status: BookingStatusSchema.enum.confirmed } },
    },
  },
} as const

export async function listAdminTours(params: { status?: TourStatus }): Promise<AdminTourSummaryResponse[]> {
  const rows = await db.tour.findMany({
    where: params.status ? { status: params.status } : undefined,
    select: tourListSelect,
    orderBy: { tourDate: 'asc' },
  })
  return rows.map(mapSummary)
}

export async function createTour(data: CreateTour): Promise<AdminTourDetailResponse> {
  const row = await db.tour.create({
    data: {
      groupId: data.groupId,
      status: TourStatusSchema.enum.draft,
      tourDate: data.tourDate,
      bookingOpen: data.bookingOpen,
      location: data.location,
      description: data.description ?? null,
      adminMemo: data.adminMemo ?? null,
      cancellationDeadline: data.cancellationDeadline,
      maybeDeadline: data.maybeDeadline ?? null,
      notificationOffsets: data.notificationOffsets,
      sessions: {
        create: data.sessions.map((s, idx) => ({
          order: idx + 1,
          label: s.label ?? null,
          meetingTime: parseTime(s.meetingTime),
          startTime: s.startTime ? parseTime(s.startTime) : null,
          endTime: s.endTime ? parseTime(s.endTime) : null,
          capacity: s.capacity,
          participantCount: s.participantCount ?? 0,
        })),
      },
    },
    select: {
      id: true,
      group: { select: { id: true, name: true, type: true } },
      status: true,
      tourDate: true,
      bookingOpen: true,
      location: true,
      description: true,
      adminMemo: true,
      cancellationDeadline: true,
      maybeDeadline: true,
      notificationOffsets: true,
      createdAt: true,
      updatedAt: true,
      sessions: { select: sessionSelect, orderBy: { order: 'asc' as const } },
    },
  })

  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.sessions.reduce((s, sess) => s + sess.capacity, 0),
    description: row.description,
    confirmedCount: 0,
    participantCount: row.sessions.reduce((s, sess) => s + sess.participantCount, 0),
    sessions: row.sessions.map(mapSession),
    adminMemo: row.adminMemo,
    cancellationDeadline: row.cancellationDeadline.toISOString(),
    maybeDeadline: row.maybeDeadline ? row.maybeDeadline.toISOString() : null,
    notificationOffsets: row.notificationOffsets,
    bookings: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function getAdminTourDetail(id: string): Promise<AdminTourDetailResponse | null> {
  const row = await db.tour.findUnique({
    where: { id },
    select: {
      id: true,
      group: { select: { id: true, name: true, type: true } },
      status: true,
      tourDate: true,
      bookingOpen: true,
      location: true,
      description: true,
      adminMemo: true,
      cancellationDeadline: true,
      maybeDeadline: true,
      notificationOffsets: true,
      createdAt: true,
      updatedAt: true,
      sessions: { select: sessionSelect, orderBy: { order: 'asc' as const } },
      bookings: {
        select: {
          id: true,
          buddyId: true,
          sessionId: true,
          buddy: { select: { displayName: true } },
          status: true,
          bookedAt: true,
          session: { select: { order: true, label: true } },
        },
        orderBy: [{ session: { order: 'asc' } }, { bookedAt: 'asc' }],
      },
      _count: {
        select: {
          bookings: { where: { status: BookingStatusSchema.enum.confirmed } },
        },
      },
    },
  })

  if (!row) return null
  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.sessions.reduce((s, sess) => s + sess.capacity, 0),
    description: row.description,
    confirmedCount: row._count.bookings,
    participantCount: row.sessions.reduce((s, sess) => s + sess.participantCount, 0),
    sessions: row.sessions.map(mapSession),
    adminMemo: row.adminMemo,
    cancellationDeadline: row.cancellationDeadline.toISOString(),
    maybeDeadline: row.maybeDeadline ? row.maybeDeadline.toISOString() : null,
    notificationOffsets: row.notificationOffsets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    bookings: row.bookings.map((b) => ({
      id: b.id,
      buddyId: b.buddyId,
      sessionId: b.sessionId,
      sessionOrder: b.session.order,
      sessionLabel: b.session.label,
      displayName: b.buddy.displayName,
      status: b.status as BookingStatus,
      bookedAt: b.bookedAt.toISOString(),
    })),
  }
}

export async function updateTour(id: string, data: UpdateTour): Promise<AdminTourDetailResponse> {
  const existing = await db.tour.findUnique({ where: { id }, select: { status: true } })
  if (!existing) throw new TourNotFoundError()
  if (existing.status === TourStatusSchema.enum.cancelled || existing.status === TourStatusSchema.enum.completed) throw new TourImmutableError()

  try {
    await db.tour.update({
      where: { id },
      data: {
        ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
        ...(data.tourDate !== undefined ? { tourDate: data.tourDate } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.adminMemo !== undefined ? { adminMemo: data.adminMemo } : {}),
        ...(data.cancellationDeadline !== undefined ? { cancellationDeadline: data.cancellationDeadline } : {}),
        ...(data.maybeDeadline !== undefined ? { maybeDeadline: data.maybeDeadline } : {}),
        ...(data.bookingOpen !== undefined ? { bookingOpen: data.bookingOpen } : {}),
        ...(data.notificationOffsets !== undefined ? { notificationOffsets: data.notificationOffsets } : {}),
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw new TourNotFoundError()
    throw e
  }

  const detail = await getAdminTourDetail(id)
  return detail!
}

export async function transitionTourStatus(
  id: string,
  action: TourAction,
): Promise<AdminTourDetailResponse> {
  const existing = await db.tour.findUnique({ where: { id }, select: { status: true } })
  if (!existing) throw new TourNotFoundError()

  const targetStatus = ACTION_TO_STATUS[action]
  const allowed = ALLOWED_TRANSITIONS[existing.status] ?? []
  if (!allowed.includes(targetStatus)) {
    throw new TourTransitionError(
      `Cannot transition from '${existing.status}' to '${targetStatus}'`,
    )
  }

  await db.tour.update({ where: { id }, data: { status: targetStatus } })

  const detail = await getAdminTourDetail(id)
  return detail!
}

export async function deleteTour(id: string): Promise<void> {
  const existing = await db.tour.findUnique({ where: { id }, select: { status: true } })
  if (!existing) throw new TourNotFoundError()
  if (existing.status !== TourStatusSchema.enum.draft) throw new TourNotDraftError()

  await db.tour.delete({ where: { id } })
}

// Session management

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

  // Ensure at least 1 session remains
  const tourSessions = await db.tourSession.count({ where: { tourId } })
  if (tourSessions <= 1) throw new LastSessionError()

  await db.tourSession.delete({ where: { id: sessionId } })

  // Re-order remaining sessions
  const remaining = await db.tourSession.findMany({
    where: { tourId },
    orderBy: { order: 'asc' },
    select: { id: true },
  })
  await db.$transaction(
    remaining.map((s, idx) =>
      db.tourSession.update({ where: { id: s.id }, data: { order: idx + 1 } })
    )
  )

  const detail = await getAdminTourDetail(tourId)
  return detail!
}

// Tier capacities (session-scoped)

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

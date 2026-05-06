import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import {
  TourStatusSchema,
  BookingStatusSchema,
} from '@peace-buddy/types'
import type {
  CreateTour,
  UpdateTour,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
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

function mapSummary(row: {
  id: string
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
  createdAt: Date
  updatedAt: Date
  _count: { bookings: number }
}): AdminTourSummaryResponse {
  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: row._count.bookings,
    participantCount: row.participantCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listAdminTours(params: { status?: TourStatus }): Promise<AdminTourSummaryResponse[]> {
  const rows = await db.tour.findMany({
    where: params.status ? { status: params.status } : undefined,
    select: {
      id: true,
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
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          bookings: { where: { status: BookingStatusSchema.enum.confirmed } },
        },
      },
    },
    orderBy: { tourDate: 'asc' },
  })
  return rows.map(mapSummary)
}

export async function createTour(data: CreateTour): Promise<AdminTourDetailResponse> {
  type CreateTourSelect = {
    id: string
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
    adminMemo: string | null
    cancellationDeadline: Date
    maybeDeadline: Date | null
    notificationOffsets: number[]
    createdAt: Date
    updatedAt: Date
  }

  const row = (await db.tour.create({
    data: {
      groupId: data.groupId,
      status: TourStatusSchema.enum.draft,
      tourDate: data.tourDate,
      meetingTime: parseTime(data.meetingTime),
      bookingOpen: data.bookingOpen,
      location: data.location,
      capacity: data.capacity,
      participantCount: data.participantCount ?? 0,
      description: data.description ?? null,
      adminMemo: data.adminMemo ?? null,
      cancellationDeadline: data.cancellationDeadline,
      maybeDeadline: data.maybeDeadline ?? null,
      notificationOffsets: data.notificationOffsets,
    },
    select: {
      id: true,
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
      adminMemo: true,
      cancellationDeadline: true,
      maybeDeadline: true,
      notificationOffsets: true,
      createdAt: true,
      updatedAt: true,
    },
  })) as CreateTourSelect

  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: 0,
    participantCount: row.participantCount,
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
  type DetailTourSelect = {
    id: string
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
    adminMemo: string | null
    cancellationDeadline: Date
    maybeDeadline: Date | null
    notificationOffsets: number[]
    createdAt: Date
    updatedAt: Date
    bookings: Array<{
      id: string
      buddyId: string
      buddy: { displayName: string }
      status: string
      bookedAt: Date
    }>
    _count: {
      bookings: number
    }
  }

  const row = (await db.tour.findUnique({
    where: { id },
    select: {
      id: true,
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
      adminMemo: true,
      cancellationDeadline: true,
      maybeDeadline: true,
      notificationOffsets: true,
      createdAt: true,
      updatedAt: true,
      bookings: {
        select: {
          id: true,
          buddyId: true,
          buddy: { select: { displayName: true } },
          status: true,
          bookedAt: true,
        },
        orderBy: { bookedAt: 'asc' },
      },
      _count: {
        select: {
          bookings: { where: { status: BookingStatusSchema.enum.confirmed } },
        },
      },
    },
  })) as DetailTourSelect | null

  if (!row) return null
  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    meetingTime: row.meetingTime.toISOString(),
    startTime: row.startTime ? row.startTime.toISOString() : null,
    endTime: row.endTime ? row.endTime.toISOString() : null,
    bookingOpen: row.bookingOpen,
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: row._count.bookings,
    participantCount: row.participantCount,
    adminMemo: row.adminMemo,
    cancellationDeadline: row.cancellationDeadline.toISOString(),
    maybeDeadline: row.maybeDeadline ? row.maybeDeadline.toISOString() : null,
    notificationOffsets: row.notificationOffsets,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    bookings: row.bookings.map((b) => ({
      id: b.id,
      buddyId: b.buddyId,
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
        ...(data.meetingTime !== undefined ? { meetingTime: parseTime(data.meetingTime) } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.participantCount !== undefined ? { participantCount: data.participantCount } : {}),
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

export async function getTierCapacities(tourId: string): Promise<TierCapacities> {
  const rows = await db.tierCapacity.findMany({
    where: { tourId },
    select: { pool: true, percent: true },
  })
  const result: TierCapacities = { junior: 20, non_junior: 30, anyone: 50 }
  for (const row of rows) {
    result[row.pool as keyof TierCapacities] = row.percent
  }
  return result
}

export async function upsertTierCapacities(tourId: string, data: TierCapacities): Promise<TierCapacities> {
  const existing = await db.tour.findUnique({ where: { id: tourId }, select: { id: true } })
  if (!existing) throw new TourNotFoundError()

  const pools: Array<keyof TierCapacities> = ['junior', 'non_junior', 'anyone']
  await db.$transaction(
    pools.map((pool) =>
      db.tierCapacity.upsert({
        where: { tourId_pool: { tourId, pool } },
        create: { tourId, pool, percent: data[pool] },
        update: { percent: data[pool] },
      })
    )
  )

  return getTierCapacities(tourId)
}

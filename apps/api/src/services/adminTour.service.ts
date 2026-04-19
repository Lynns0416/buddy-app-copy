import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import type {
  CreateTour,
  UpdateTour,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
  TourStatus,
  GroupType,
  BookingStatus,
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

const ACTION_TO_STATUS: Record<string, TourStatus> = {
  publish: 'published',
  cancel: 'cancelled',
  complete: 'completed',
}

const ALLOWED_TRANSITIONS: Record<string, TourStatus[]> = {
  draft: ['published', 'cancelled'],
  published: ['cancelled', 'completed'],
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
  location: string
  capacity: number
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
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: row._count.bookings,
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
      location: true,
      capacity: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          bookings: { where: { status: 'confirmed' } },
        },
      },
    },
    orderBy: { tourDate: 'asc' },
  })
  return rows.map(mapSummary)
}

export async function createTour(data: CreateTour): Promise<AdminTourDetailResponse> {
  const row = await db.tour.create({
    data: {
      groupId: data.groupId,
      status: 'draft',
      tourDate: data.tourDate,
      meetingTime: parseTime(data.meetingTime),
      location: data.location,
      capacity: data.capacity,
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
      location: true,
      capacity: true,
      description: true,
      adminMemo: true,
      cancellationDeadline: true,
      maybeDeadline: true,
      notificationOffsets: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return {
    id: row.id,
    group: { id: row.group.id, name: row.group.name, type: row.group.type as GroupType },
    status: row.status as TourStatus,
    tourDate: row.tourDate.toISOString(),
    meetingTime: row.meetingTime.toISOString(),
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: 0,
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
      meetingTime: true,
      location: true,
      capacity: true,
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
          bookings: { where: { status: 'confirmed' } },
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
    meetingTime: row.meetingTime.toISOString(),
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    confirmedCount: row._count.bookings,
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
  if (existing.status === 'cancelled' || existing.status === 'completed') throw new TourImmutableError()

  try {
    await db.tour.update({
      where: { id },
      data: {
        ...(data.groupId !== undefined ? { groupId: data.groupId } : {}),
        ...(data.tourDate !== undefined ? { tourDate: data.tourDate } : {}),
        ...(data.meetingTime !== undefined ? { meetingTime: parseTime(data.meetingTime) } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.adminMemo !== undefined ? { adminMemo: data.adminMemo } : {}),
        ...(data.cancellationDeadline !== undefined ? { cancellationDeadline: data.cancellationDeadline } : {}),
        ...(data.maybeDeadline !== undefined ? { maybeDeadline: data.maybeDeadline } : {}),
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
  action: 'publish' | 'cancel' | 'complete',
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
  if (existing.status !== 'draft') throw new TourNotDraftError()

  await db.tour.delete({ where: { id } })
}

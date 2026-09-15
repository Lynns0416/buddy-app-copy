import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { addDays, jstStartOfDayUtc } from '../lib/jstDay'
import { payloadTourDate } from '../lib/notificationPayload'
import {
  TourStatusSchema,
  BookingStatusSchema,
  NotifEventKindSchema,
} from '@peace-buddy/types'
import {
  enqueueEmailForActiveBuddies,
  enqueueEmailForBookedBuddies,
  enqueueInAppForActiveBuddies,
  enqueueInAppForBookedBuddies,
} from './notification.service'
import type {
  CreateTour,
  UpdateTour,
  AdminTourSummaryResponse,
  AdminTourDetailResponse,
  AdminDashboardUnderfilledTour,
  TourAdminAssignedAdmin,
  TourSessionResponse,
  TourStatus,
  TourAction,
  GroupType,
  BookingStatus,
  CancellationReasonResponse,
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
    minBuddies: number | null
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

// Published tours in the next `days` JST days with a session whose confirmed
// buddies are below its `minBuddies` (PRD §11.7). This is not `belowMinimum`:
// that flag compares the visitor count to the threshold; this counts buddies.
export async function listUnderfilledTours(
  now: Date,
  days: number,
): Promise<AdminDashboardUnderfilledTour[]> {
  const today = jstStartOfDayUtc(now)
  const rows = await db.tour.findMany({
    where: {
      status: TourStatusSchema.enum.published,
      tourDate: { gte: today, lt: addDays(today, days) },
      sessions: { some: { minBuddies: { not: null } } },
    },
    select: {
      id: true,
      tourDate: true,
      group: { select: { name: true } },
      sessions: {
        where: { minBuddies: { not: null } },
        select: {
          id: true,
          order: true,
          label: true,
          minBuddies: true,
          _count: { select: { bookings: { where: { status: BookingStatusSchema.enum.confirmed } } } },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { tourDate: 'asc' },
  })

  return rows.flatMap((row) => {
    const sessions = row.sessions.flatMap((s) =>
      s.minBuddies != null && s._count.bookings < s.minBuddies
        ? [{ id: s.id, order: s.order, label: s.label, minBuddies: s.minBuddies, confirmedCount: s._count.bookings }]
        : [],
    )
    if (sessions.length === 0) return []
    return [{ id: row.id, tourDate: row.tourDate.toISOString(), group: { name: row.group.name }, sessions }]
  })
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
          minBuddies: s.minBuddies ?? null,
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
    assignedAdmins: [],
    staffInChargeId: null,
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
          cancellationReason: {
            select: {
              id: true,
              category: true,
              freeText: true,
              unavoidable: true,
              createdAt: true,
              recorder: { select: { email: true } },
            },
          },
        },
        orderBy: [{ session: { order: 'asc' } }, { bookedAt: 'asc' }],
      },
      adminAssignments: {
        select: { adminId: true, admin: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      staffInChargeId: true,
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
    bookings: row.bookings.map((b) => {
      const cr = b.cancellationReason
      const cancellationReason: CancellationReasonResponse | null = cr
        ? {
            id: cr.id,
            category: cr.category as CancellationReasonResponse['category'],
            freeText: cr.freeText,
            unavoidable: cr.unavoidable,
            recordedBy: { email: cr.recorder.email },
            createdAt: cr.createdAt.toISOString(),
          }
        : null
      return {
        id: b.id,
        buddyId: b.buddyId,
        sessionId: b.sessionId,
        sessionOrder: b.session.order,
        sessionLabel: b.session.label,
        displayName: b.buddy.displayName,
        status: b.status as BookingStatus,
        bookedAt: b.bookedAt.toISOString(),
        cancellationReason,
      }
    }),
    assignedAdmins: row.adminAssignments.map((a): TourAdminAssignedAdmin => ({ adminId: a.adminId, name: a.admin.name })),
    staffInChargeId: row.staffInChargeId,
  }
}

// The group name and date a notification message shows. Selected from the same
// `update` that changed them, so an edit that moves the tour notifies with the
// new values rather than the ones read before the write.
const tourRefSelect = { tourDate: true, group: { select: { name: true } } } as const

function tourRef(tour: { tourDate: Date; group: { name: string } }) {
  return { groupName: tour.group.name, tourDate: payloadTourDate(tour.tourDate) }
}

export async function updateTour(id: string, data: UpdateTour): Promise<AdminTourDetailResponse> {
  const existing = await db.tour.findUnique({
    where: { id },
    select: { status: true, tourDate: true, location: true },
  })
  if (!existing) throw new TourNotFoundError()
  if (existing.status === TourStatusSchema.enum.cancelled || existing.status === TourStatusSchema.enum.completed) throw new TourImmutableError()

  const tourDateChanged = data.tourDate !== undefined && data.tourDate.getTime() !== existing.tourDate.getTime()
  const locationChanged = data.location !== undefined && data.location !== existing.location
  const notifyDetailsChanged =
    existing.status === TourStatusSchema.enum.published && (tourDateChanged || locationChanged)

  try {
    await db.$transaction(async (tx) => {
      const updated = await tx.tour.update({
        where: { id },
        select: tourRefSelect,
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

      if (notifyDetailsChanged) {
        const args = {
          eventType: NotifEventKindSchema.enum.tour_details_changed,
          payload: { tourId: id, ...tourRef(updated) },
        }
        await enqueueInAppForBookedBuddies(id, args, tx)
        await enqueueEmailForBookedBuddies(id, args, tx)
      }
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

  await db.$transaction(async (tx) => {
    const updated = await tx.tour.update({
      where: { id },
      select: tourRefSelect,
      data: { status: targetStatus },
    })

    if (targetStatus === TourStatusSchema.enum.published) {
      const args = {
        eventType: NotifEventKindSchema.enum.tour_published,
        payload: { tourId: id, ...tourRef(updated) },
      }
      await enqueueInAppForActiveBuddies(args, tx)
      await enqueueEmailForActiveBuddies(args, tx)
    } else if (targetStatus === TourStatusSchema.enum.cancelled) {
      const args = {
        eventType: NotifEventKindSchema.enum.tour_cancelled,
        payload: { tourId: id, ...tourRef(updated) },
      }
      await enqueueInAppForBookedBuddies(id, args, tx)
      await enqueueEmailForBookedBuddies(id, args, tx)
    }
  })

  const detail = await getAdminTourDetail(id)
  return detail!
}

export async function deleteTour(id: string): Promise<void> {
  const existing = await db.tour.findUnique({ where: { id }, select: { status: true } })
  if (!existing) throw new TourNotFoundError()
  if (existing.status !== TourStatusSchema.enum.draft) throw new TourNotDraftError()

  await db.tour.delete({ where: { id } })
}


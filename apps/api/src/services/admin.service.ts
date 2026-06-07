import { BookingStatus as PrismaBookingStatus } from '@prisma/client'
import { db } from '../lib/db'
import type { AdminBuddyResponse, AdminBuddyDetailResponse, BuddyStatus, BuddyTier, BookingStatus, TourStatus, CancellationReasonResponse, CancellationSummary, AdminBookingStatusResponse } from '@peace-buddy/types'
import { BuddyStatusSchema, BuddyTierSchema } from '@peace-buddy/types'

const adminBuddySelect = {
  id: true,
  userId: true,
  status: true,
  tier: true,
  displayName: true,
  realName: true,
  photoUrl: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: { email: true },
  },
} as const

function mapBuddy(raw: {
  user: { email: string }
  id: string
  userId: string
  status: string
  tier: string | null
  displayName: string
  realName: string
  photoUrl: string | null
  internalNotes: string | null
  createdAt: Date
  updatedAt: Date
}): AdminBuddyResponse {
  const { user, ...rest } = raw
  return { ...rest, email: user.email } as unknown as AdminBuddyResponse
}

export async function listBuddies(status?: BuddyStatus, tier?: BuddyTier): Promise<AdminBuddyResponse[]> {
  const rows = await db.buddyProfile.findMany({
    where: status || tier
      ? { ...(status ? { status } : {}), ...(tier ? { tier } : {}) }
      : undefined,
    select: adminBuddySelect,
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapBuddy)
}

const adminBuddyDetailSelect = {
  ...adminBuddySelect,
  bookings: {
    select: {
      id: true,
      tourId: true,
      sessionId: true,
      status: true,
      bookedAt: true,
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
      session: {
        select: {
          order: true,
          label: true,
        },
      },
      tour: {
        select: {
          tourDate: true,
          location: true,
          status: true,
          group: { select: { name: true } },
        },
      },
    },
    orderBy: { tour: { tourDate: 'desc' as const } },
  },
} as const

export async function getBuddyDetail(id: string): Promise<AdminBuddyDetailResponse | null> {
  const [raw, absentWithoutReportCount] = await Promise.all([
    db.buddyProfile.findUnique({ where: { id }, select: adminBuddyDetailSelect }),
    db.adminEvaluation.count({ where: { buddyId: id, absentWithoutReport: true } }),
  ])
  if (!raw) return null
  const { bookings, ...rest } = raw
  const mappedBookings = bookings.map((b) => {
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
      tourId: b.tourId,
      sessionId: b.sessionId,
      sessionOrder: b.session.order,
      sessionLabel: b.session.label,
      status: b.status as BookingStatus,
      bookedAt: b.bookedAt.toISOString(),
      cancellationReason,
      tour: {
        tourDate: b.tour.tourDate.toISOString(),
        location: b.tour.location,
        status: b.tour.status as TourStatus,
        group: { name: b.tour.group.name },
      },
    }
  })
  const reasons = mappedBookings
    .map((b) => b.cancellationReason)
    .filter((cr): cr is CancellationReasonResponse => cr !== null)
  const cancellationSummary: CancellationSummary = {
    total: reasons.length,
    unavoidable: reasons.filter((cr) => cr.unavoidable === true).length,
    avoidable: reasons.filter((cr) => cr.unavoidable === false).length,
    unreviewed: reasons.filter((cr) => cr.unavoidable === null).length,
  }
  return {
    ...mapBuddy(rest),
    bookings: mappedBookings,
    cancellationSummary,
    absenceSummary: { absentWithoutReport: absentWithoutReportCount },
  }
}

export async function updateCancellationReason(
  bookingId: string,
  unavoidable: boolean | null,
): Promise<CancellationReasonResponse | null> {
  try {
    const updated = await db.cancellationReason.update({
      where: { bookingId },
      data: { unavoidable },
      select: {
        id: true,
        category: true,
        freeText: true,
        unavoidable: true,
        createdAt: true,
        recorder: { select: { email: true } },
      },
    })
    return {
      id: updated.id,
      category: updated.category as CancellationReasonResponse['category'],
      freeText: updated.freeText,
      unavoidable: updated.unavoidable,
      recordedBy: { email: updated.recorder.email },
      createdAt: updated.createdAt.toISOString(),
    }
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

export async function updateBuddyStatus(
  id: string,
  status: BuddyStatus
): Promise<AdminBuddyResponse | null> {
  try {
    const data: { status: BuddyStatus; tier?: BuddyTier } = { status }
    if (status === BuddyStatusSchema.enum.active) {
      data.tier = BuddyTierSchema.enum.junior
    }
    const raw = await db.buddyProfile.update({
      where: { id },
      data,
      select: adminBuddySelect,
    })
    return mapBuddy(raw)
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

export async function updateAdminBookingStatus(
  bookingId: string,
  status: BookingStatus,
): Promise<AdminBookingStatusResponse | null> {
  try {
    const updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: status as PrismaBookingStatus },
      select: { id: true, status: true },
    })
    return { id: updated.id, status: updated.status as BookingStatus }
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

export async function updateBuddyProfile(
  id: string,
  tier?: BuddyTier | null,
  internalNotes?: string | null
): Promise<AdminBuddyResponse | null> {
  try {
    const data: { tier?: BuddyTier | null; internalNotes?: string | null } = {}
    if (tier !== undefined) data.tier = tier
    if (internalNotes !== undefined) data.internalNotes = internalNotes

    if (Object.keys(data).length === 0) {
      const raw = await db.buddyProfile.findUnique({
        where: { id },
        select: adminBuddySelect,
      })
      return raw ? mapBuddy(raw) : null
    }

    const raw = await db.buddyProfile.update({
      where: { id },
      data,
      select: adminBuddySelect,
    })
    return mapBuddy(raw)
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

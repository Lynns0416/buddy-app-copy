import { db } from '../lib/db'
import type { AdminBuddyResponse, AdminBuddyDetailResponse, BuddyStatus, BuddyTier, BookingStatus, TourStatus } from '@peace-buddy/types'
import { BuddyStatusSchema, BuddyTierSchema } from '@peace-buddy/types'

const adminBuddySelect = {
  id: true,
  userId: true,
  status: true,
  tier: true,
  displayName: true,
  realName: true,
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
  const raw = await db.buddyProfile.findUnique({
    where: { id },
    select: adminBuddyDetailSelect,
  })
  if (!raw) return null
  const { bookings, ...rest } = raw
  return {
    ...mapBuddy(rest),
    bookings: bookings.map((b) => ({
      id: b.id,
      tourId: b.tourId,
      sessionId: b.sessionId,
      sessionOrder: b.session.order,
      sessionLabel: b.session.label,
      status: b.status as BookingStatus,
      bookedAt: b.bookedAt.toISOString(),
      tour: {
        tourDate: b.tour.tourDate.toISOString(),
        location: b.tour.location,
        status: b.tour.status as TourStatus,
        group: { name: b.tour.group.name },
      },
    })),
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

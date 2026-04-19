import { db } from '../lib/db'
import type { AdminBuddyResponse } from '../types'
import type { BuddyStatus, BuddyTier } from '@peace-buddy/types'

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
  return { ...rest, email: user.email }
}

export async function listBuddies(status?: BuddyStatus): Promise<AdminBuddyResponse[]> {
  const rows = await db.buddyProfile.findMany({
    where: status ? { status } : undefined,
    select: adminBuddySelect,
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapBuddy)
}

export async function updateBuddyStatus(
  id: string,
  status: BuddyStatus,
  tier?: BuddyTier
): Promise<AdminBuddyResponse | null> {
  try {
    const data: { status: BuddyStatus; tier?: BuddyTier } = { status }
    if (status === 'active') {
      data.tier = tier ?? 'trainee'
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

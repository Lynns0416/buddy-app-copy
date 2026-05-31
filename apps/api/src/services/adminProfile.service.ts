import { Prisma } from '@prisma/client'
import { db } from '../lib/db'
import { TourStatusSchema } from '@peace-buddy/types'
import type { AdminProfileResponse } from '@peace-buddy/types'

export class HasActiveTourAssignmentsError extends Error {}

const adminProfileSelect = {
  id: true,
  userId: true,
  name: true,
  deletedAt: true,
  createdAt: true,
} as const

function mapAdminProfile(raw: {
  id: string
  userId: string
  name: string
  deletedAt: Date | null
  createdAt: Date
}): AdminProfileResponse {
  return {
    id: raw.id,
    userId: raw.userId,
    name: raw.name,
    createdAt: raw.createdAt.toISOString(),
  }
}

export async function getAdminProfile(userId: string): Promise<AdminProfileResponse | null> {
  const raw = await db.adminProfile.findUnique({
    where: { userId },
    select: adminProfileSelect,
  })
  // Soft-deleted profiles are invisible
  if (raw && raw.deletedAt !== null) return null
  return raw ? mapAdminProfile(raw) : null
}

export async function listAdminProfiles(): Promise<AdminProfileResponse[]> {
  const rows = await db.adminProfile.findMany({
    where: { deletedAt: null },
    select: adminProfileSelect,
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(mapAdminProfile)
}

export async function createAdminProfile(
  userId: string,
  name: string
): Promise<AdminProfileResponse | null> {
  try {
    const raw = await db.adminProfile.create({
      data: { userId, name },
      select: adminProfileSelect,
    })
    return mapAdminProfile(raw)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null
    throw e
  }
}

export async function updateAdminProfile(userId: string, name: string): Promise<AdminProfileResponse | null> {
  try {
    const raw = await db.adminProfile.update({
      where: { userId },
      data: { name },
      select: adminProfileSelect,
    })
    return mapAdminProfile(raw)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null
    throw e
  }
}

export async function softDeleteAdminProfile(userId: string): Promise<AdminProfileResponse | null> {
  const profile = await db.adminProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!profile) return null

  const activeAssignment = await db.tourAdminAssignment.findFirst({
    where: {
      adminId: profile.id,
      tour: { status: { in: [TourStatusSchema.enum.draft, TourStatusSchema.enum.published] } },
    },
    select: { id: true },
  })
  if (activeAssignment) throw new HasActiveTourAssignmentsError()

  try {
    const raw = await db.adminProfile.update({
      where: { userId },
      data: { deletedAt: new Date() },
      select: adminProfileSelect,
    })
    return mapAdminProfile(raw)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') return null
    throw e
  }
}

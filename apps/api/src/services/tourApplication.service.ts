import { db } from '../lib/db'
import type { BuddyTier, AppErrorCode } from '@peace-buddy/types'

// Default pool percentages (used when no TierCapacity rows exist for a tour)
const DEFAULT_JUNIOR_PCT = 20
const DEFAULT_NON_JUNIOR_PCT = 30
const DEFAULT_ANYONE_PCT = 50

const NON_JUNIOR_TIERS: BuddyTier[] = ['mid', 'senior', 'expert', 'instructor', 'organizer']

type Pool = 'junior' | 'non_junior' | 'anyone'

function poolForTier(tier: BuddyTier): 'junior' | 'non_junior' {
  return tier === 'junior' ? 'junior' : 'non_junior'
}

interface PoolCapacities {
  junior: number
  non_junior: number
  anyone: number
}

async function getPoolCapacities(tourId: string): Promise<PoolCapacities> {
  const tour = await db.tour.findUnique({
    where: { id: tourId },
    select: { capacity: true },
  })

  if (!tour) {
    throw new Error(`Tour ${tourId} not found`)
  }

  const rows = await db.tierCapacity.findMany({
    where: { tourId },
    select: { pool: true, percent: true },
  })

  if (rows.length === 0) {
    return {
      junior: Math.floor(tour.capacity * DEFAULT_JUNIOR_PCT / 100),
      non_junior: Math.floor(tour.capacity * DEFAULT_NON_JUNIOR_PCT / 100),
      anyone: Math.floor(tour.capacity * DEFAULT_ANYONE_PCT / 100),
    }
  }

  const pctMap: Record<Pool, number> = { junior: 0, non_junior: 0, anyone: 0 }
  for (const row of rows) {
    pctMap[row.pool as Pool] = row.percent
  }

  return {
    junior: Math.floor(tour.capacity * pctMap.junior / 100),
    non_junior: Math.floor(tour.capacity * pctMap.non_junior / 100),
    anyone: Math.floor(tour.capacity * pctMap.anyone / 100),
  }
}

async function getApprovedCountByPool(tourId: string, pool: Pool): Promise<number> {
  if (pool === 'junior') {
    return db.application.count({
      where: { tourId, status: 'approved', buddyTier: 'junior' },
    })
  }
  if (pool === 'non_junior') {
    return db.application.count({
      where: { tourId, status: 'approved', buddyTier: { in: NON_JUNIOR_TIERS } },
    })
  }
  // anyone pool: count all approved
  return db.application.count({
    where: { tourId, status: 'approved' },
  })
}

async function tryAssignToPool(
  applicationId: string,
  tourId: string,
  pool: Pool,
  capacities: PoolCapacities,
): Promise<boolean> {
  const approved = await getApprovedCountByPool(tourId, pool)
  if (approved >= capacities[pool]) return false

  await db.application.update({
    where: { id: applicationId },
    data: { status: 'approved', approvedAt: new Date() },
  })

  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { buddyId: true },
  })

  if (application) {
    await db.booking.create({
      data: {
        applicationId,
        buddyId: application.buddyId,
        tourId,
        status: 'confirmed',
      },
    })
  }

  return true
}

async function assignApplication(applicationId: string): Promise<void> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { id: true, tourId: true, buddyTier: true },
  })

  if (!application) {
    throw new Error(`Application ${applicationId} not found`)
  }

  const capacities = await getPoolCapacities(application.tourId)
  const primaryPool = poolForTier(application.buddyTier)

  // Try primary pool first, then anyone pool
  const assigned =
    await tryAssignToPool(applicationId, application.tourId, primaryPool, capacities) ||
    await tryAssignToPool(applicationId, application.tourId, 'anyone', capacities)

  if (!assigned) {
    await db.application.update({
      where: { id: applicationId },
      data: { status: 'waitlisted' },
    })
  }
}

export async function getApplicationStatus(tourId: string, buddyId: string) {
  return db.application.findUnique({
    where: { tourId_buddyId: { tourId, buddyId } },
    select: { id: true, status: true, createdAt: true, approvedAt: true },
  })
}

type ApplicationResult = { ok: true; data: string } | { ok: false; code: AppErrorCode }

export async function createApplication(
  tourId: string,
  buddyId: string,
  buddyTier: BuddyTier,
): Promise<ApplicationResult> {
  // Allow re-apply if existing application is rejected (cancelled)
  const existing = await db.application.findUnique({
    where: { tourId_buddyId: { tourId, buddyId } },
    select: { id: true, status: true },
  })

  let applicationId: string

  if (existing && existing.status !== 'rejected') {
    return { ok: false, code: 'conflict' }
  }

  if (existing && existing.status === 'rejected') {
    // Reuse the rejected row
    await db.application.update({
      where: { id: existing.id },
      data: { status: 'pending', approvedAt: null, buddyTier },
    })
    applicationId = existing.id
  } else {
    const created = await db.application.create({
      data: { tourId, buddyId, buddyTier, status: 'pending' },
      select: { id: true },
    })
    applicationId = created.id
  }

  await assignApplication(applicationId)
  return { ok: true, data: applicationId }
}

export async function cancelApplication(applicationId: string): Promise<void> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: { status: true, tourId: true, buddyTier: true },
  })

  if (!application) {
    throw new Error(`Application ${applicationId} not found`)
  }

  const wasApproved = application.status === 'approved'

  await db.application.update({
    where: { id: applicationId },
    data: { status: 'rejected' },
  })

  if (wasApproved) {
    await db.booking.deleteMany({ where: { applicationId } })
    await promoteFromWaitlist(application.tourId, application.buddyTier)
  }
}

async function promoteFromWaitlist(tourId: string, tier: BuddyTier): Promise<void> {
  const primaryPool = poolForTier(tier)

  // Find earliest waitlisted buddy that can fill primary pool or anyone pool
  const candidate = await db.application.findFirst({
    where: {
      tourId,
      status: 'waitlisted',
      buddyTier: primaryPool === 'junior' ? 'junior' : { in: NON_JUNIOR_TIERS },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (candidate) {
    await assignApplication(candidate.id)
    return
  }

  // Also check anyone pool — find any waitlisted buddy regardless of tier
  const anyCandidate = await db.application.findFirst({
    where: {
      tourId,
      status: 'waitlisted',
      buddyTier: { notIn: ['trainee'] },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (anyCandidate) {
    await assignApplication(anyCandidate.id)
  }
}

// Exported for testing
export { getPoolCapacities, assignApplication, promoteFromWaitlist }
export type { PoolCapacities }

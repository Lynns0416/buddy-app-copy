import { db } from '../lib/db'
import type { BuddyTier } from '@peace-buddy/types'

const ApplicationStatusValues = {
  pending: 'pending' as const,
  approved: 'approved' as const,
  rejected: 'rejected' as const,
  waitlisted: 'waitlisted' as const,
}

type ApplicationStatus = typeof ApplicationStatusValues[keyof typeof ApplicationStatusValues]

const BookingStatus = {
  confirmed: 'confirmed' as const,
}

export type TierCapacityMap = Record<BuddyTier, number>

export async function getTierCapacities(tourId: string): Promise<TierCapacityMap> {
  const tour = await db.tour.findUnique({
    where: { id: tourId },
    select: { capacity: true, mentorshipBalanced: true },
  })

  if (!tour) {
    throw new Error(`Tour ${tourId} not found`)
  }

  if (!tour.mentorshipBalanced) {
    return {
      trainee: 0,
      junior: 0,
      mid: 0,
      senior: 0,
      expert: 0,
      instructor: 0,
      organizer: 0,
    }
  }

  const tierCapacities = await db.tierCapacity.findMany({
    where: { tourId },
    select: { tier: true, percent: true },
  })

  const capacityMap: TierCapacityMap = {
    trainee: 0,
    junior: 0,
    mid: 0,
    senior: 0,
    expert: 0,
    instructor: 0,
    organizer: 0,
  }

  for (const tc of tierCapacities) {
    capacityMap[tc.tier] = Math.floor(tour.capacity * (tc.percent / 100))
  }

  return capacityMap
}

export async function getApprovedCount(
  tourId: string,
  tier?: BuddyTier,
): Promise<number> {
  const where: { tourId: string; status: ApplicationStatus; buddyTier?: BuddyTier } = {
    tourId,
    status: ApplicationStatusValues.approved,
  }

  if (tier) {
    where.buddyTier = tier
  }

  const count = await db.application.count({ where })
  return count
}

export async function assignApplication(applicationId: string): Promise<void> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      tourId: true,
      buddyId: true,
      buddyTier: true,
    },
  })

  if (!application) {
    throw new Error(`Application ${applicationId} not found`)
  }

  const capacities = await getTierCapacities(application.tourId)
  const tierCapacity = capacities[application.buddyTier]
  const tierApprovedCount = await getApprovedCount(application.tourId, application.buddyTier)

  const shouldApprove = tierApprovedCount < tierCapacity

  if (shouldApprove) {
    await db.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatusValues.approved,
        approvedAt: new Date(),
      },
    })

    await db.booking.create({
      data: {
        applicationId: application.id,
        buddyId: application.buddyId,
        tourId: application.tourId,
        status: BookingStatus.confirmed,
      },
    })
  } else {
    await db.application.update({
      where: { id: applicationId },
      data: {
        status: ApplicationStatusValues.waitlisted,
      },
    })
  }
}

export async function promoteFromWaitlist(tourId: string, tier: BuddyTier): Promise<boolean> {
  const capacities = await getTierCapacities(tourId)
  const tierCapacity = capacities[tier]
  const tierApprovedCount = await getApprovedCount(tourId, tier)

  if (tierApprovedCount >= tierCapacity) {
    return false
  }

  const nextWaitlisted = await db.application.findFirst({
    where: {
      tourId,
      status: ApplicationStatusValues.waitlisted,
      buddyTier: tier,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })

  if (!nextWaitlisted) {
    return false
  }

  await assignApplication(nextWaitlisted.id)
  return true
}

export async function getApplicationStatus(tourId: string, buddyId: string) {
  const application = await db.application.findUnique({
    where: {
      tourId_buddyId: { tourId, buddyId },
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      approvedAt: true,
    },
  })

  return application
}

export async function createApplication(
  tourId: string,
  buddyId: string,
  buddyTier: BuddyTier,
): Promise<string> {
  const application = await db.application.create({
    data: {
      tourId,
      buddyId,
      buddyTier,
      status: ApplicationStatusValues.pending,
    },
    select: { id: true },
  })

  await assignApplication(application.id)

  return application.id
}

export async function cancelApplication(applicationId: string): Promise<void> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      status: true,
      tourId: true,
      buddyId: true,
      buddyTier: true,
    },
  })

  if (!application) {
    throw new Error(`Application ${applicationId} not found`)
  }

  const wasApproved = application.status === ApplicationStatusValues.approved

  await db.application.update({
    where: { id: applicationId },
    data: {
      status: ApplicationStatusValues.rejected,
    },
  })

  if (wasApproved) {
    await db.booking.deleteMany({
      where: {
        applicationId,
      },
    })

    await promoteFromWaitlist(application.tourId, application.buddyTier)
  }
}

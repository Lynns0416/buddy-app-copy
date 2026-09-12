import { db } from '../lib/db'
import type { BuddyProfileResponse, UpdateBuddyProfile } from '@peace-buddy/types'

// Explicit select — tier is buddy-visible (#137); never fetches internalNotes,
// memberType, or other admin-only fields
export const buddyProfileSelect = {
  id: true,
  status: true,
  tier: true,
  displayName: true,
  realName: true,
  photoUrl: true,
  bio: true,
  contactInfo: true,
  languages: true,
  skills: true,
  onboardingSeenAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getBuddyProfile(userId: string): Promise<BuddyProfileResponse | null> {
  const profile = await db.buddyProfile.findUnique({
    where: { userId },
    select: buddyProfileSelect,
  })
  if (!profile) return null
  return profile as unknown as BuddyProfileResponse
}

export async function updateBuddyProfile(
  userId: string,
  data: UpdateBuddyProfile
): Promise<BuddyProfileResponse | null> {
  try {
    const updated = await db.buddyProfile.update({
      where: { userId },
      data,
      select: buddyProfileSelect,
    })
    return updated as unknown as BuddyProfileResponse
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

// Records that the buddy has been sent to their profile once after approval.
// Stamped on the redirect, not on save: reaching the page is the whole flow,
// and whether they change anything there is their decision.
export async function markOnboardingSeen(userId: string): Promise<BuddyProfileResponse | null> {
  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { onboardingSeenAt: true },
  })
  if (!existing) return null
  if (existing.onboardingSeenAt) return getBuddyProfile(userId)

  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { onboardingSeenAt: new Date() },
    select: buddyProfileSelect,
  })
  return updated as unknown as BuddyProfileResponse
}

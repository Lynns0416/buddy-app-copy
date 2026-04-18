import { db } from '../lib/db'
import type { BuddyProfileResponse } from '../types'
import type { UpdateBuddyProfile } from '@peace-buddy/types'

// Explicit select — never fetches internalNotes, tier, or other admin-only fields
const buddyProfileSelect = {
  id: true,
  status: true,
  displayName: true,
  realName: true,
  photoUrl: true,
  bio: true,
  contactInfo: true,
  languages: true,
  skills: true,
  availability: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getBuddyProfile(userId: string): Promise<BuddyProfileResponse | null> {
  const profile = await db.buddyProfile.findUnique({
    where: { userId },
    select: buddyProfileSelect,
  })
  if (!profile) return null
  return profile as BuddyProfileResponse
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
    return updated as BuddyProfileResponse
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as any).code === 'P2025') return null
    throw e
  }
}

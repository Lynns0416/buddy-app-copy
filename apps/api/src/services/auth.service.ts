import { db } from '../lib/db'
import type { UserResponse } from '../types'

// Explicit select — never fetches internalNotes, tier, adminEvaluations, or other admin-only fields
const userSelect = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  buddyProfile: {
    select: {
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
    },
  },
} as const

export async function upsertUser(
  uid: string,
  email: string,
  data: {
    displayName?: string
    realName?: string
    languages?: string[]
    photoUrl?: string | null
    bio?: string | null
  }
): Promise<UserResponse> {
  const user = await db.user.upsert({
    where: { firebaseUid: uid },
    create: {
      firebaseUid: uid,
      email,
      role: 'buddy',
      buddyProfile: {
        create: {
          status: 'pending',
          displayName: data.displayName ?? email.split('@')[0],
          realName: data.realName ?? '',
          languages: data.languages ?? [],
          photoUrl: data.photoUrl ?? null,
          bio: data.bio ?? null,
        },
      },
    },
    update: {},
    select: userSelect,
  })

  return user as UserResponse
}

export async function getUser(id: string): Promise<UserResponse | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: userSelect,
  })

  if (!user) return null
  return user as UserResponse
}

import { db } from '../lib/db'
import type { Locale, UserResponse } from '@peace-buddy/types'
import { UserRoleSchema, BuddyStatusSchema, NotifEventKindSchema } from '@peace-buddy/types'
import { enqueueInAppForAllAdmins, enqueueSlackForAdmins } from './notification.service'

// Explicit select — never fetches internalNotes, tier, adminEvaluations, or other admin-only fields
const userSelect = {
  id: true,
  email: true,
  role: true,
  locale: true,
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
      onboardingSeenAt: true,
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
  const user = await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { firebaseUid: uid }, select: { id: true } })

    const row = await tx.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        email,
        role: UserRoleSchema.enum.buddy,
        buddyProfile: {
          create: {
            status: BuddyStatusSchema.enum.pending,
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

    if (!existing) {
      const signupArgs = {
        eventType: NotifEventKindSchema.enum.new_signup,
        payload: { buddyUserId: row.id, email: row.email, displayName: row.buddyProfile?.displayName ?? null },
      }
      await enqueueInAppForAllAdmins(signupArgs, tx)
      await enqueueSlackForAdmins(signupArgs, tx)
    }

    return row
  })

  return user as unknown as UserResponse
}

export async function getUser(id: string): Promise<UserResponse | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: userSelect,
  })

  if (!user) return null
  return user as unknown as UserResponse
}

export async function updateLocale(userId: string, locale: Locale): Promise<UserResponse | null> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { locale },
      select: userSelect,
    })
    return user as unknown as UserResponse
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

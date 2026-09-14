import { db } from '../lib/db'
import { withPhotoLink } from '../lib/photoStorage'
import type { Locale, UserResponse } from '@peace-buddy/types'
import { UserRoleSchema, BuddyStatusSchema, NotifEventKindSchema } from '@peace-buddy/types'
import { enqueueInAppForAllAdmins, enqueueSlackForAdmins } from './notification.service'

// Explicit select — tier is buddy-visible on their own profile (#137); never
// fetches internalNotes, memberType, adminEvaluations, or other admin-only fields
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
      tier: true,
      displayName: true,
      realName: true,
      photoKey: true,
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

async function toUserResponse<T extends { buddyProfile: { photoKey: string | null } | null }>(
  row: T,
): Promise<UserResponse> {
  const { buddyProfile, ...rest } = row
  return {
    ...rest,
    buddyProfile: buddyProfile ? await withPhotoLink(buddyProfile) : null,
  } as unknown as UserResponse
}

export async function upsertUser(
  uid: string,
  email: string,
  data: {
    displayName?: string
    realName?: string
    languages?: string[]
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
            bio: data.bio ?? null,
          },
        },
      },
      // Refresh email on every sign-in: the provider address is the source of
      // truth, and it is what notification delivery and the admin UI resolve to.
      // Without this it keeps whatever it held at account creation (#194).
      // Guarded on a non-empty value — verifyFirebaseToken falls back to '' when
      // the ID token carries no email claim, and writing that would clobber a
      // good stored address with one nothing can deliver to.
      update: email ? { email } : {},
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

  return toUserResponse(user)
}

export async function getUser(id: string): Promise<UserResponse | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: userSelect,
  })

  if (!user) return null
  return toUserResponse(user)
}

export async function updateLocale(userId: string, locale: Locale): Promise<UserResponse | null> {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: { locale },
      select: userSelect,
    })
    return await toUserResponse(user)
  } catch (e) {
    if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2025') return null
    throw e
  }
}

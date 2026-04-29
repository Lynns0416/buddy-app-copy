'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import type { BuddyProfileResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { ProfileForm } from './_components/profile-form'
import { fetchMyProfile } from './dashboard.profile'

export default function ProfilePage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('profile')
  const [profile, setProfile] = useState<BuddyProfileResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.pending) {
        router.replace(routes.pending(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.active) {
      void fetchMyProfile().then((result) => {
        if (result.ok) setProfile(result.data)
        else setFetchError(t('error.unknown'))
      })
    }
  }, [loading, firebaseUser, dbUser]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !dbUser) return null

  return (
    <AppShell variant="buddy">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {profile && <ProfileForm profile={profile} />}
    </AppShell>
  )
}

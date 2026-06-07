'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { ProfileHeader } from './_components/profile-header'
import { ProfileForm } from './_components/profile-form'
import { useMyProfile } from './hooks/use-my-profile'

export default function ProfilePage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('profile')
  const { profile, error: fetchError, refetch, updateProfile } = useMyProfile(!loading && !!firebaseUser)

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.pending) {
        router.replace(routes.pending(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  if (loading || !dbUser) return null

  return (
    <AppShell variant="buddy">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('error.unknown')}
        </p>
      )}

      {profile && (
        <>
          <ProfileHeader profile={profile} onPhotoSaved={updateProfile} />
          <ProfileForm profile={profile} onSaved={refetch} />
        </>
      )}
    </AppShell>
  )
}

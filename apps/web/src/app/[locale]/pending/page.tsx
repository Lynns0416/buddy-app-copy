'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'

export default function PendingPage() {
  const { firebaseUser, dbUser, loading, signOut } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('pending')

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.buddyProfile?.status !== 'pending') {
        router.replace(routes.dashboard(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  if (loading) return null

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('message')}</p>
      <button onClick={signOut}>{t('signOut')}</button>
    </main>
  )
}

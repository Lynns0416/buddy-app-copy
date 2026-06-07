'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'

export default function PendingPage() {
  const { firebaseUser, dbUser, loading, signOut } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('pending')

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.buddyProfile?.status !== BuddyStatusSchema.enum.pending) {
        router.replace(routes.buddy(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  if (loading) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm text-center">
        <h1 className="mb-3 text-xl font-semibold">{t('title')}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{t('message')}</p>
        <Button variant="outline" onClick={async () => { await signOut(); router.push(routes.login(locale)) }}>{t('signOut')}</Button>
      </div>
    </div>
  )
}

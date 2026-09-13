'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { BuddyStatusSchema, UserRoleSchema } from '@peace-buddy/types'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { isAppleSignInEnabled } from '../../../lib/flags'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { AppleSignInButton } from '@/components/apple-sign-in-button'

function SessionExpiredBanner() {
  const t = useTranslations('login')
  const searchParams = useSearchParams()
  if (searchParams.get('reason') !== 'session_expired') return null
  return (
    <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
      {t('sessionExpired')}
    </p>
  )
}

export default function LoginPage() {
  const { firebaseUser, dbUser, loading, signInWithGoogle, signInWithApple } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('login')
  const appleEnabled = isAppleSignInEnabled()

  useEffect(() => {
    if (!loading && firebaseUser && dbUser) {
      if (dbUser.buddyProfile?.status === BuddyStatusSchema.enum.pending) {
        router.replace(routes.pending(locale))
      } else if (dbUser.role === UserRoleSchema.enum.admin || dbUser.role === UserRoleSchema.enum.super_admin) {
        router.replace(routes.admin(locale))
      } else {
        router.replace(routes.buddy(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  async function handleGoogle() {
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Google sign-in failed', err)
    }
  }

  async function handleApple() {
    try {
      await signInWithApple()
    } catch (err) {
      console.error('Apple sign-in failed', err)
    }
  }

  if (loading) return null

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">{t('appName')}</h1>
        <p className="mb-8 text-sm text-muted-foreground">{t('title')}</p>
        <Suspense>
          <SessionExpiredBanner />
        </Suspense>
        <div className="flex flex-col gap-3">
          <GoogleSignInButton label={t('google')} onClick={handleGoogle} />
          <div>
            <AppleSignInButton label={t('apple')} onClick={handleApple} disabled={!appleEnabled} />
            {!appleEnabled && (
              <p className="mt-2 text-center text-xs text-muted-foreground">{t('appleComingSoon')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

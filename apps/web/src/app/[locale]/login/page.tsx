'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { AppleSignInButton } from '@/components/apple-sign-in-button'

export default function LoginPage() {
  const { firebaseUser, dbUser, loading, signInWithGoogle, signInWithApple } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('login')

  useEffect(() => {
    if (!loading && firebaseUser && dbUser) {
      if (dbUser.buddyProfile?.status === 'pending') {
        router.replace(routes.pending(locale))
      } else {
        router.replace(routes.dashboard(locale))
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
        <div className="flex flex-col gap-3">
          <GoogleSignInButton label={t('google')} onClick={handleGoogle} />
          <AppleSignInButton label={t('apple')} onClick={handleApple} />
        </div>
      </div>
    </div>
  )
}

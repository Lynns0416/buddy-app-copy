'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'

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
    <main>
      <h1>{t('title')}</h1>
      <button onClick={handleGoogle}>{t('google')}</button>
      <button onClick={handleApple}>{t('apple')}</button>
    </main>
  )
}

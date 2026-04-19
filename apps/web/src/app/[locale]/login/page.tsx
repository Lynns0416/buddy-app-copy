'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'

function GoogleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-4 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-colors hover:bg-[#f8f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4285F4] focus-visible:ring-offset-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {label}
    </button>
  )
}

function AppleButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-3 rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#1a1a1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 814 1000" className="h-5 w-5 shrink-0 fill-white">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.8 8.7 308.5 8.7 214.5 8.7 63.2 97.9 0 185.6 0s130 43.2 176.3 43.2c44.8 0 121.1-47 176.3-47 18.7 0 133.3 1.9 213.4 101.9zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
      </svg>
      {label}
    </button>
  )
}

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
          <GoogleButton onClick={handleGoogle} label={t('google')} />
          <AppleButton onClick={handleApple} label={t('apple')} />
        </div>
      </div>
    </div>
  )
}

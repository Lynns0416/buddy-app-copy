'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '../../lib/auth'
import { routes } from '../../lib/routes'

export default function HomePage() {
  const { firebaseUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()

  useEffect(() => {
    if (!loading) {
      if (firebaseUser) {
        router.replace(routes.dashboard(locale))
      } else {
        router.replace(routes.login(locale))
      }
    }
  }, [loading, firebaseUser, locale, router])

  return null
}

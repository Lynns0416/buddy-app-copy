'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'

export default function AdminPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('admin')

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'super_admin') {
        router.replace(routes.home(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('title')}</h1>
      <nav>
        <Link href={routes.adminBuddies(locale)}>{t('buddies')}</Link>
      </nav>
    </main>
  )
}

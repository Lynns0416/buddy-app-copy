'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'

export default function AdminPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('admin')

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(`/${locale}/login`)
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'super_admin') {
        router.replace(`/${locale}`)
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('title')}</h1>
    </main>
  )
}

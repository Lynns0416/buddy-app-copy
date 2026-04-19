'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import { apiRequest } from '../../../../lib/api'

type AdminBuddy = {
  id: string
  userId: string
  status: string
  tier: string | null
  displayName: string
  realName: string
  email: string
  internalNotes: string | null
  createdAt: string
  updatedAt: string
}

export default function AdminBuddiesPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddy[]>([])

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.role !== 'admin' && dbUser.role !== 'super_admin') {
        router.replace(routes.home(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser && (dbUser.role === 'admin' || dbUser.role === 'super_admin')) {
      apiRequest<AdminBuddy[]>('/admin/buddies?status=pending')
        .then(setBuddies)
        .catch(() => {})
    }
  }, [loading, firebaseUser, dbUser])

  async function handleApprove(id: string) {
    await apiRequest(`/admin/buddies/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    })
    setBuddies((prev) => prev.filter((b) => b.id !== id))
  }

  async function handleReject(id: string) {
    await apiRequest(`/admin/buddies/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'rejected' }),
    })
    setBuddies((prev) => prev.filter((b) => b.id !== id))
  }

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('title')}</h1>
      {buddies.length === 0 ? (
        <p>{t('noResults')}</p>
      ) : (
        <ul>
          {buddies.map((buddy) => (
            <li key={buddy.id}>
              <span>{buddy.displayName}</span>
              <span>{buddy.email}</span>
              <button onClick={() => handleApprove(buddy.id)}>{t('approve')}</button>
              <button onClick={() => handleReject(buddy.id)}>{t('reject')}</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

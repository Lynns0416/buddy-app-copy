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
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    setPendingAction(id)
    setError(null)
    try {
      await apiRequest(`/admin/buddies/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active' }),
      })
      setBuddies((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleReject(id: string) {
    setPendingAction(id)
    setError(null)
    try {
      await apiRequest(`/admin/buddies/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'rejected' }),
      })
      setBuddies((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingAction(null)
    }
  }

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('title')}</h1>
      {error && <p>{error}</p>}
      {buddies.length === 0 ? (
        <p>{t('noResults')}</p>
      ) : (
        <ul>
          {buddies.map((buddy) => (
            <li key={buddy.id}>
              <span>{buddy.displayName}</span>
              <span>{buddy.email}</span>
              <button
                onClick={() => handleApprove(buddy.id)}
                disabled={pendingAction !== null}
              >
                {t('approve')}
              </button>
              <button
                onClick={() => handleReject(buddy.id)}
                disabled={pendingAction !== null}
              >
                {t('reject')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import { apiRequest } from '../../../../lib/api'
import type { AdminBuddyResponse } from '@peace-buddy/types'
import { UserRoleSchema, BuddyStatusSchema } from '@peace-buddy/types'

export default function AdminBuddiesPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.role !== UserRoleSchema.enum.admin && dbUser.role !== UserRoleSchema.enum.super_admin) {
        router.replace(routes.home(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser && (dbUser.role === UserRoleSchema.enum.admin || dbUser.role === UserRoleSchema.enum.super_admin)) {
      apiRequest<AdminBuddyResponse[]>(`/admin/buddies?status=${BuddyStatusSchema.enum.pending}`)
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
        body: JSON.stringify({ status: BuddyStatusSchema.enum.active }),
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
        body: JSON.stringify({ status: BuddyStatusSchema.enum.rejected }),
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../../lib/auth'
import { routes } from '../../../../../lib/routes'
import { apiRequest } from '../../../../../lib/api'
import type { GroupDetailResponse } from '@peace-buddy/types'
import { UserRoleSchema } from '@peace-buddy/types'

export default function AdminGroupDetailPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('adminGroups')
  const [group, setGroup] = useState<GroupDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

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
      apiRequest<GroupDetailResponse>(`/admin/groups/${id}`)
        .then(setGroup)
        .catch(() => setFetchError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser, id])

  if (loading || !dbUser) return null
  if (fetchError) return <main><p>{fetchError}</p></main>
  if (!group) return null

  return (
    <main>
      <Link href={routes.adminGroups(locale)}>{t('back')}</Link>
      <h1>{group.name}</h1>
      <dl>
        <dt>{t('type')}</dt>
        <dd>{group.type}</dd>
        {group.contactName && (
          <>
            <dt>{t('contactName')}</dt>
            <dd>{group.contactName}</dd>
          </>
        )}
        {group.contactEmail && (
          <>
            <dt>{t('contactEmail')}</dt>
            <dd>{group.contactEmail}</dd>
          </>
        )}
        {group.contactPhone && (
          <>
            <dt>{t('contactPhone')}</dt>
            <dd>{group.contactPhone}</dd>
          </>
        )}
        {group.notes && (
          <>
            <dt>{t('notes')}</dt>
            <dd>{group.notes}</dd>
          </>
        )}
      </dl>
      <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
      <h2>{t('tours')}</h2>
      {group.tours.length === 0 ? (
        <p>{t('noTours')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>{t('tourDate')}</th>
              <th>{t('status')}</th>
              <th>{t('location')}</th>
              <th>{t('capacity')}</th>
            </tr>
          </thead>
          <tbody>
            {group.tours.map((tour) => (
              <tr key={tour.id}>
                <td>{tour.tourDate}</td>
                <td>{tour.status}</td>
                <td>{tour.location}</td>
                <td>{tour.capacity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import { apiRequest } from '../../../../lib/api'
import type { GroupResponse } from '@peace-buddy/types'
import { UserRoleSchema } from '@peace-buddy/types'

type SortField = 'name' | 'type'
type SortDir = 'asc' | 'desc'

export default function AdminGroupsPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminGroups')
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

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
      apiRequest<GroupResponse[]>('/admin/groups')
        .then(setGroups)
        .catch(() => setFetchError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser])

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...groups].sort((a, b) => {
    const cmp = a[sortField].localeCompare(b[sortField], 'ja')
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('title')}</h1>
      {fetchError && <p>{fetchError}</p>}
      <Link href={routes.adminGroupNew(locale)}>{t('newGroup')}</Link>
      {sorted.length === 0 ? (
        <p>{t('noResults')}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => handleSort('name')}>{t('name')}</button>
              </th>
              <th>
                <button onClick={() => handleSort('type')}>{t('type')}</button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((group) => (
              <tr key={group.id}>
                <td>
                  <Link href={routes.adminGroupDetail(locale, group.id)}>{group.name}</Link>
                </td>
                <td>{group.type}</td>
                <td>
                  <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}

'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../../../lib/auth'
import { routes } from '../../../../../../lib/routes'
import { apiRequest } from '../../../../../../lib/api'
import type { GroupDetailResponse } from '@peace-buddy/types'
import { UserRoleSchema, GroupTypeSchema } from '@peace-buddy/types'

export default function AdminGroupEditPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('adminGroups')
  const [group, setGroup] = useState<GroupDetailResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
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
      apiRequest<GroupDetailResponse>(`/admin/groups/${id}`)
        .then(setGroup)
        .catch(() => setError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser, id])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name') as string,
      type: form.get('type') as string,
      contactName: (form.get('contactName') as string) || null,
      contactEmail: (form.get('contactEmail') as string) || null,
      contactPhone: (form.get('contactPhone') as string) || null,
      notes: (form.get('notes') as string) || null,
    }
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest(`/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) })
      router.push(routes.adminGroupDetail(locale, id))
    } catch {
      setError(t('actionError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !dbUser) return null
  if (error && !group) return <main><p>{error}</p></main>
  if (!group) return null

  return (
    <main>
      <Link href={routes.adminGroupDetail(locale, id)}>{t('backToDetail')}</Link>
      <h1>{t('editTitle')}</h1>
      {error && <p>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">{t('name')}</label>
          <input id="name" name="name" required defaultValue={group.name} />
        </div>
        <div>
          <label htmlFor="type">{t('type')}</label>
          <select id="type" name="type" required defaultValue={group.type}>
            {GroupTypeSchema.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contactName">{t('contactName')}</label>
          <input id="contactName" name="contactName" defaultValue={group.contactName ?? ''} />
        </div>
        <div>
          <label htmlFor="contactEmail">{t('contactEmail')}</label>
          <input id="contactEmail" name="contactEmail" type="email" defaultValue={group.contactEmail ?? ''} />
        </div>
        <div>
          <label htmlFor="contactPhone">{t('contactPhone')}</label>
          <input id="contactPhone" name="contactPhone" defaultValue={group.contactPhone ?? ''} />
        </div>
        <div>
          <label htmlFor="notes">{t('notes')}</label>
          <textarea id="notes" name="notes" defaultValue={group.notes ?? ''} />
        </div>
        <button type="submit" disabled={submitting}>{t('save')}</button>
        <Link href={routes.adminGroupDetail(locale, id)}>{t('cancel')}</Link>
      </form>
    </main>
  )
}

'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../../lib/auth'
import { routes } from '../../../../../lib/routes'
import { apiRequest } from '../../../../../lib/api'
import { UserRoleSchema, GroupTypeSchema } from '@peace-buddy/types'

export default function AdminGroupNewPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminGroups')
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body = {
      name: form.get('name') as string,
      type: form.get('type') as string,
      contactName: (form.get('contactName') as string) || undefined,
      contactEmail: (form.get('contactEmail') as string) || undefined,
      contactPhone: (form.get('contactPhone') as string) || undefined,
      notes: (form.get('notes') as string) || undefined,
    }
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/admin/groups', { method: 'POST', body: JSON.stringify(body) })
      router.push(routes.adminGroups(locale))
    } catch {
      setError(t('actionError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !dbUser) return null

  return (
    <main>
      <h1>{t('createTitle')}</h1>
      {error && <p>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="name">{t('name')}</label>
          <input id="name" name="name" required />
        </div>
        <div>
          <label htmlFor="type">{t('type')}</label>
          <select id="type" name="type" required>
            {GroupTypeSchema.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="contactName">{t('contactName')}</label>
          <input id="contactName" name="contactName" />
        </div>
        <div>
          <label htmlFor="contactEmail">{t('contactEmail')}</label>
          <input id="contactEmail" name="contactEmail" type="email" />
        </div>
        <div>
          <label htmlFor="contactPhone">{t('contactPhone')}</label>
          <input id="contactPhone" name="contactPhone" />
        </div>
        <div>
          <label htmlFor="notes">{t('notes')}</label>
          <textarea id="notes" name="notes" />
        </div>
        <button type="submit" disabled={submitting}>{t('save')}</button>
        <Link href={routes.adminGroups(locale)}>{t('cancel')}</Link>
      </form>
    </main>
  )
}

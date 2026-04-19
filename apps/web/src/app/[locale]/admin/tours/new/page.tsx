'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../../lib/auth'
import { routes } from '../../../../../lib/routes'
import { apiRequest } from '../../../../../lib/api'
import type { GroupResponse } from '@peace-buddy/types'
import { UserRoleSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function AdminTourNewPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminTours')
  const [groups, setGroups] = useState<GroupResponse[]>([])
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
      apiRequest<GroupResponse[]>('/admin/groups').then(setGroups).catch(() => {})
    }
  }, [loading, firebaseUser, dbUser])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const offsetsRaw = (form.get('notificationOffsets') as string).split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
    const body = {
      groupId: form.get('groupId') as string,
      tourDate: form.get('tourDate') as string,
      meetingTime: form.get('meetingTime') as string,
      location: form.get('location') as string,
      capacity: Number(form.get('capacity')),
      description: (form.get('description') as string) || undefined,
      adminMemo: (form.get('adminMemo') as string) || undefined,
      cancellationDeadline: form.get('cancellationDeadline') as string,
      maybeDeadline: (form.get('maybeDeadline') as string) || undefined,
      notificationOffsets: offsetsRaw,
    }
    setSubmitting(true)
    setError(null)
    try {
      await apiRequest('/admin/tours', { method: 'POST', body: JSON.stringify(body) })
      router.push(routes.adminTours(locale))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('actionError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !dbUser) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={routes.adminTours(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-semibold">{t('createTitle')}</h1>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="groupId">{t('group')}</Label>
              <select
                id="groupId"
                name="groupId"
                required
                className="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tourDate">{t('tourDate')}</Label>
              <Input id="tourDate" name="tourDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meetingTime">{t('meetingTime')}</Label>
              <Input id="meetingTime" name="meetingTime" type="time" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">{t('location')}</Label>
              <Input id="location" name="location" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacity">{t('capacity')}</Label>
              <Input id="capacity" name="capacity" type="number" min={1} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cancellationDeadline">{t('cancellationDeadline')}</Label>
              <Input id="cancellationDeadline" name="cancellationDeadline" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maybeDeadline">{t('maybeDeadline')}</Label>
              <Input id="maybeDeadline" name="maybeDeadline" type="date" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notificationOffsets">{t('notificationOffsets')}</Label>
              <Input id="notificationOffsets" name="notificationOffsets" defaultValue="3, 1" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="adminMemo">{t('adminMemo')}</Label>
              <Textarea id="adminMemo" name="adminMemo" rows={3} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>{t('save')}</Button>
            <Button asChild variant="ghost">
              <Link href={routes.adminTours(locale)}>{t('cancel')}</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

'use client'

import { type FormEvent, useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { GroupDetailResponse } from '@peace-buddy/types'
import { GroupTypeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export default function AdminGroupEditPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminGroups')
  const [group, setGroup] = useState<GroupDetailResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    apiClient.getGroup(id)
      .then(setGroup)
      .catch(() => setError(t('actionError')))
  }, [ready, id, t])

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
      await apiClient.updateGroup(id, body as Parameters<typeof apiClient.updateGroup>[1])
      router.push(routes.adminGroupDetail(locale, id))
    } catch {
      setError(t('actionError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!ready) return null

  if (error && !group) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
      </AppShell>
    )
  }

  if (!group) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={routes.adminGroupDetail(locale, id)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('backToDetail')}
        </Link>
      </div>

      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-semibold">{t('editTitle')}</h1>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" name="name" required defaultValue={group.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">{t('type')}</Label>
              <select
                id="type"
                name="type"
                required
                defaultValue={group.type}
                className="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {GroupTypeSchema.options.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">{t('contactName')}</Label>
              <Input id="contactName" name="contactName" defaultValue={group.contactName ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
              <Input id="contactEmail" name="contactEmail" type="email" defaultValue={group.contactEmail ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">{t('contactPhone')}</Label>
              <Input id="contactPhone" name="contactPhone" defaultValue={group.contactPhone ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={group.notes ?? ''} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>{t('save')}</Button>
            <Button asChild variant="ghost">
              <Link href={routes.adminGroupDetail(locale, id)}>{t('cancel')}</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

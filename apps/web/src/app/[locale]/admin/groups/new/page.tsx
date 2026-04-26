'use client'

import { type FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AppError } from '@peace-buddy/types'
import { GroupTypeSchema, AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createGroup } from '../admin.group'
import type { CreateGroup } from '@peace-buddy/types'

export default function AdminGroupNewPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminGroups')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function errorMessage(err: AppError): string {
    switch (err.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const body: CreateGroup = {
      name: form.get('name') as string,
      type: form.get('type') as CreateGroup['type'],
      contactName: (form.get('contactName') as string) || undefined,
      contactEmail: (form.get('contactEmail') as string) || undefined,
      contactPhone: (form.get('contactPhone') as string) || undefined,
      notes: (form.get('notes') as string) || undefined,
    }
    setSubmitting(true)
    setError(null)
    const result = await createGroup(body)
    if (result.ok) router.push(routes.adminGroups(locale))
    else setError(errorMessage(result.error))
    setSubmitting(false)
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={routes.adminGroups(locale)} className="text-sm text-muted-foreground hover:text-foreground">
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
              <Label htmlFor="name">{t('name')}</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">{t('type')}</Label>
              <select
                id="type"
                name="type"
                required
                className="border-input bg-background ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {GroupTypeSchema.options.map((opt: string) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactName">{t('contactName')}</Label>
              <Input id="contactName" name="contactName" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactEmail">{t('contactEmail')}</Label>
              <Input id="contactEmail" name="contactEmail" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contactPhone">{t('contactPhone')}</Label>
              <Input id="contactPhone" name="contactPhone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">{t('notes')}</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button type="submit" disabled={submitting}>{t('save')}</Button>
            <Button asChild variant="ghost">
              <Link href={routes.adminGroups(locale)}>{t('cancel')}</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  )
}

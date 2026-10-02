'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { getTodayJst } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { AnnouncementForm } from '../_components/announcement-form'
import { createAnnouncement, emptyAnnouncementForm, toUpsertAnnouncement, type AnnouncementFormValues } from '../admin.announcement'
import { useAnnouncementErrorMessage } from '../use-announcement-error'

export default function AdminAnnouncementNewPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminAnnouncements')
  const errorMessage = useAnnouncementErrorMessage()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: AnnouncementFormValues) {
    setSubmitting(true)
    setError(null)
    const result = await createAnnouncement(toUpsertAnnouncement(values))
    if (result.ok) {
      router.push(routes.adminAnnouncements(locale))
      return
    }
    setError(errorMessage(result.error))
    setSubmitting(false)
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6">
        <Link href={routes.adminAnnouncements(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-xl font-semibold">{t('createTitle')}</h1>
        {error && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
        <AnnouncementForm
          initial={emptyAnnouncementForm(getTodayJst())}
          submitLabel={t('create')}
          submitting={submitting}
          onSubmit={(values) => void handleSubmit(values)}
        />
      </div>
    </AppShell>
  )
}

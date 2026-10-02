'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminAnnouncementResponse } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { AnnouncementForm } from '../../_components/announcement-form'
import {
  announcementFormFrom,
  fetchAnnouncement,
  toUpsertAnnouncement,
  updateAnnouncement,
  type AnnouncementFormValues,
} from '../../admin.announcement'
import { useAnnouncementErrorMessage } from '../../use-announcement-error'

export default function AdminAnnouncementEditPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminAnnouncements')
  const errorMessage = useAnnouncementErrorMessage()
  const [announcement, setAnnouncement] = useState<AdminAnnouncementResponse | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    void fetchAnnouncement(id).then((result) => {
      if (result.ok) setAnnouncement(result.data)
      else setError(errorMessage(result.error))
    })
  }, [ready, id, errorMessage])

  async function handleSubmit(values: AnnouncementFormValues) {
    setSubmitting(true)
    setError(null)
    const result = await updateAnnouncement(id, toUpsertAnnouncement(values))
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
        <h1 className="mb-6 text-xl font-semibold">{t('editTitle')}</h1>
        {error && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
        {announcement && (
          <AnnouncementForm
            initial={announcementFormFrom(announcement)}
            savedTour={announcement.tour}
            submitLabel={t('save')}
            submitting={submitting}
            onSubmit={(values) => void handleSubmit(values)}
          />
        )}
      </div>
    </AppShell>
  )
}

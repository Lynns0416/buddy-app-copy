'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import { TourStatusSchema } from '@peace-buddy/types'
import type { AdminTourDetailResponse, GroupResponse } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../../_components/tour-form'
import type { TourFormValues } from '../../_components/tour-form'

export default function AdminTourEditPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    Promise.all([apiClient.getAdminTour(id), apiClient.listGroups()])
      .then(([fetchedTour, fetchedGroups]) => {
        if (
          fetchedTour.status === TourStatusSchema.enum.cancelled ||
          fetchedTour.status === TourStatusSchema.enum.completed
        ) {
          router.replace(routes.adminTourDetail(locale, id))
        } else {
          setTour(fetchedTour)
          setGroups(fetchedGroups)
        }
      })
      .catch(() => setLoadError(t('actionError')))
  }, [ready, id, locale, router, t])

  async function handleSubmit(values: TourFormValues) {
    await apiClient.updateAdminTour(id, values)
    router.push(routes.adminTourDetail(locale, id))
  }

  if (!ready) return null
  if (loadError) return (
    <AppShell variant="admin">
      <p className="text-sm text-destructive">{loadError}</p>
    </AppShell>
  )
  if (!tour) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={routes.adminTourDetail(locale, id)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('backToDetail')}
        </Link>
      </div>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-semibold">{t('editTitle')}</h1>
        <TourForm
          defaultValues={tour}
          groups={groups}
          cancelHref={routes.adminTourDetail(locale, id)}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  )
}

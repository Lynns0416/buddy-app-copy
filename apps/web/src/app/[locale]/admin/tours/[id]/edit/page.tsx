'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminTourDetailResponse, GroupResponse, AppError } from '@peace-buddy/types'
import { TourStatusSchema, AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../../_components/tour-form'
import type { TourFormValues } from '../../_components/tour-form'
import { fetchTour, fetchGroups, updateTour } from '../../admin.tour'

export default function AdminTourEditPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  function errorMessage(err: AppError): string {
    switch (err.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  useEffect(() => {
    if (!ready) return
    Promise.all([fetchTour(id), fetchGroups()])
      .then(([tourResult, groupsResult]) => {
        if (!tourResult.ok) {
          setLoadError(errorMessage(tourResult.error))
          return
        }
        if (!groupsResult.ok) {
          setLoadError(errorMessage(groupsResult.error))
          return
        }
        if (
          tourResult.data.status === TourStatusSchema.enum.cancelled ||
          tourResult.data.status === TourStatusSchema.enum.completed
        ) {
          router.replace(routes.adminTourDetail(locale, id))
        } else {
          setTour(tourResult.data)
          setGroups(groupsResult.data)
        }
      })
  }, [ready, id, locale, router]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(values: TourFormValues) {
    const result = await updateTour(id, values as Record<string, unknown>)
    if (result.ok) router.push(routes.adminTourDetail(locale, id))
    else setLoadError(errorMessage(result.error))
  }

  if (!ready) return null
  if (loadError) return (
    <AppShell variant="admin">
      <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
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

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminTourDetailResponse, GroupResponse, PlaceResponse, AppError } from '@peace-buddy/types'
import { TourStatusSchema, AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../../_components/tour-form'
import type { TourFormValues } from '../../_components/tour-form'
import { sessionChanges, sessionConflictKey } from '../../_components/session-changes'
import { fetchTour, fetchGroups, fetchPlaces, updateTour, updateTourSession } from '../../admin.tour'

export default function AdminTourEditPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [places, setPlaces] = useState<PlaceResponse[]>([])
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
    Promise.all([fetchTour(id), fetchGroups(), fetchPlaces()])
      .then(([tourResult, groupsResult, placesResult]) => {
        if (!tourResult.ok) {
          setLoadError(errorMessage(tourResult.error))
          return
        }
        if (!groupsResult.ok) {
          setLoadError(errorMessage(groupsResult.error))
          return
        }
        if (!placesResult.ok) {
          setLoadError(errorMessage(placesResult.error))
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
          setPlaces(placesResult.data)
        }
      })
  }, [ready, id, locale, router]) // eslint-disable-line react-hooks/exhaustive-deps

  // A failed save throws so the form shows the error above itself and keeps
  // the admin's input. A retry may resend a session that already saved; the API
  // treats an unchanged place or meeting time as no change.
  async function handleSubmit(values: TourFormValues) {
    if (!tour) return
    const { sessions, ...tourFields } = values
    const result = await updateTour(id, tourFields as Record<string, unknown>)
    if (!result.ok) throw new Error(errorMessage(result.error))
    // Sessions are saved through their own endpoint, one call each.
    for (const [idx, session] of tour.sessions.entries()) {
      const sessionValues = sessions[idx]
      if (!sessionValues) continue
      const changes = sessionChanges(session, sessionValues)
      if (Object.keys(changes).length === 0) continue
      const sessionResult = await updateTourSession(id, session.id, changes)
      if (!sessionResult.ok) {
        const conflictKey = sessionResult.error.code === AppErrorCodeSchema.enum.conflict ? sessionConflictKey(changes) : null
        throw new Error(conflictKey ? t(`session.error.${conflictKey}`) : errorMessage(sessionResult.error))
      }
    }
    router.push(routes.adminTourDetail(locale, id))
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
          places={places}
          cancelHref={routes.adminTourDetail(locale, id)}
          onSubmit={handleSubmit}
          hideSessionManagement
        />
      </div>
    </AppShell>
  )
}

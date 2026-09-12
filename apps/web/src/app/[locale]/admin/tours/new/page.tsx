'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { GroupResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../_components/tour-form'
import type { TourFormValues } from '../_components/tour-form'
import { fetchGroups, createTour, groupIdFromParams } from '../admin.tour'

export default function AdminTourNewPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('adminTours')
  const tGroups = useTranslations('adminGroups')
  const initialGroupId = groupIdFromParams(new URLSearchParams(searchParams.toString()))
  // Arriving from a group means leaving back to it; arriving from the tour list means the tour list.
  const cancelHref = initialGroupId
    ? routes.adminGroupDetail(locale, initialGroupId)
    : routes.adminTours(locale)
  // The picker may have been changed after arrival, so the created tour's own group is the target.
  const successHref = (groupId: string) =>
    initialGroupId ? routes.adminGroupDetail(locale, groupId) : routes.adminTours(locale)
  const [groups, setGroups] = useState<GroupResponse[]>([])
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

  useEffect(() => {
    if (!ready) return
    fetchGroups().then((result) => {
      if (result.ok) setGroups(result.data)
      else setError(errorMessage(result.error))
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(values: TourFormValues) {
    setError(null)
    const result = await createTour({
      ...values,
      description: values.description ?? undefined,
      adminMemo: values.adminMemo ?? undefined,
      maybeDeadline: values.maybeDeadline ?? undefined,
    } as Record<string, unknown>)
    if (result.ok) router.push(successHref(values.groupId))
    else setError(errorMessage(result.error))
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={cancelHref} className="text-sm text-muted-foreground hover:text-foreground">
          ← {initialGroupId ? tGroups('backToDetail') : t('back')}
        </Link>
      </div>
      <div className="mx-auto max-w-lg">
        <h1 className="mb-6 text-xl font-semibold">{t('createTitle')}</h1>

        {error && (
          <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
        )}

        <TourForm
          groups={groups}
          initialGroupId={initialGroupId}
          cancelHref={cancelHref}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  )
}

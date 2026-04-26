'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { GroupResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../_components/tour-form'
import type { TourFormValues } from '../_components/tour-form'
import { fetchGroups, createTour } from '../admin.tour'

export default function AdminTourNewPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminTours')
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
    if (result.ok) router.push(routes.adminTours(locale))
    else setError(errorMessage(result.error))
  }

  if (!ready) return null

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

        <TourForm
          groups={groups}
          cancelHref={routes.adminTours(locale)}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  )
}

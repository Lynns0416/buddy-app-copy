'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { GroupResponse } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { TourForm } from '../_components/tour-form'
import type { TourFormValues } from '../_components/tour-form'

export default function AdminTourNewPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminTours')
  const [groups, setGroups] = useState<GroupResponse[]>([])

  useEffect(() => {
    if (!ready) return
    apiClient.listGroups().then(setGroups).catch(() => {})
  }, [ready])

  async function handleSubmit(values: TourFormValues) {
    await apiClient.createAdminTour({
      ...values,
      description: values.description ?? undefined,
      adminMemo: values.adminMemo ?? undefined,
      maybeDeadline: values.maybeDeadline ?? undefined,
    })
    router.push(routes.adminTours(locale))
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
        <TourForm
          groups={groups}
          cancelHref={routes.adminTours(locale)}
          onSubmit={handleSubmit}
        />
      </div>
    </AppShell>
  )
}

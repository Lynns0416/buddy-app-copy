'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminProfileEvaluationResponse } from '@peace-buddy/types'
import { getAdminProfileEvaluation } from '../../evaluations/admin.evaluation'

interface AdminProfileEvaluationSummaryProps {
  buddyId: string
}

export function AdminProfileEvaluationSummary({ buddyId }: AdminProfileEvaluationSummaryProps) {
  const { locale } = useAdminGuard()
  const t = useTranslations('adminEvaluations')
  const [ev, setEv] = useState<AdminProfileEvaluationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAdminProfileEvaluation(buddyId).then((result) => {
      if (!result.ok) {
        setError(t('error.unknown'))
      } else {
        setEv(result.data)
      }
      setLoading(false)
    })
  }, [buddyId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null

  if (error) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <p className="text-sm">
        {t('table.overallRating')}:{' '}
        <span className="font-medium">{ev?.overallRating ?? '—'}</span>
      </p>
      <Link
        href={routes.adminBuddyProfileEvaluation(locale, buddyId)}
        className="text-sm text-blue-600 hover:underline"
      >
        {ev === null ? t('detail.addLink') : t('detail.editLink')}
      </Link>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { Button } from '@/components/ui/button'
import { EvaluationScoreGrid } from '@/components/evaluation-score-grid'
import type { AdminProfileEvaluationResponse } from '@peace-buddy/types'
import { listAdminProfileEvaluations } from '../../evaluations/admin.evaluation'

interface AdminProfileEvaluationSummaryProps {
  buddyId: string
}

export function AdminProfileEvaluationSummary({ buddyId }: AdminProfileEvaluationSummaryProps) {
  const { locale } = useAdminGuard()
  const { dbUser } = useAuth()
  const t = useTranslations('adminEvaluations')
  const [evals, setEvals] = useState<AdminProfileEvaluationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listAdminProfileEvaluations(buddyId).then((result) => {
      if (!result.ok) {
        setError(t('error.unknown'))
      } else {
        setEvals(result.data)
      }
      setLoading(false)
    })
  }, [buddyId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null

  if (error) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
  }

  const myEval = dbUser ? evals.find((ev) => ev.createdBy === dbUser.id) : undefined

  return (
    <div className="space-y-3">
      {evals.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('empty.noEvaluations')}</p>
      )}

      {evals.map((ev) => (
        <div key={ev.id} className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{ev.createdByName}</p>
            {dbUser !== null && ev.createdBy === dbUser?.id && (
              <Link
                href={routes.adminBuddyProfileEvaluation(locale, buddyId)}
                className="text-sm text-blue-600 hover:underline whitespace-nowrap"
              >
                {t('actions.edit')} →
              </Link>
            )}
          </div>
          <EvaluationScoreGrid scores={ev} />
        </div>
      ))}

      {dbUser !== null && !myEval && (
        <Link href={routes.adminBuddyProfileEvaluation(locale, buddyId)}>
          <Button size="sm" variant="outline">
            {t('actions.addEvaluation')}
          </Button>
        </Link>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import type { AdminBuddyDetailResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { getBuddyStatusLabel } from '@/lib/status-display'
import { routes } from '@/lib/routes'
import { fetchBuddy, mapBuddyError } from '../admin.buddy'
import { ProfilePhoto } from '../../../buddy/profile/_components/profile-photo'
import { BuddyForm } from '../_components/buddy-form'
import { BuddyBookingHistory } from '../_components/buddy-booking-history'
import { BuddyPerTourEvaluations } from '../_components/buddy-per-tour-evaluations'
import { BuddySelfEvaluations } from '../_components/buddy-self-evaluations'
import { AdminProfileEvaluationSummary } from '../_components/admin-profile-evaluation-summary'

export default function AdminBuddyDetailPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('adminBuddies')
  const tBuddyStatus = useTranslations('buddyStatus')
  const tEval = useTranslations('adminEvaluations')
  const [buddy, setBuddy] = useState<AdminBuddyDetailResponse | null>(null)
  const [fetched, setFetched] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    fetchBuddy(id).then((result) => {
      if (result.ok) {
        setBuddy(result.data)
      } else {
        setFetchError(mapBuddyError(t, result.error))
      }
      setFetched(true)
    })
  }, [ready, id, t])

  if (!ready || !fetched) return null

  const backRoute = buddy?.status === BuddyStatusSchema.enum.trainee
    ? routes.adminTrainees(locale)
    : routes.adminBuddies(locale)

  if (fetchError || !buddy) {
    return (
      <AppShell variant="admin">
        <div className="flex items-center gap-4 mb-6">
          <Link href={backRoute} className="text-sm text-blue-600 hover:underline">
            ← {t('back')}
          </Link>
        </div>
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError || t('error.notFound')}
        </p>
      </AppShell>
    )
  }

  return (
    <AppShell variant="admin">
      <div className="flex items-center gap-4 mb-6">
        <Link href={backRoute} className="text-sm text-blue-600 hover:underline">
          ← {t('back')}
        </Link>
      </div>

      <div className="max-w-2xl">
        <div className="mb-4 flex items-center gap-4">
          <ProfilePhoto photoUrl={buddy.photoUrl} displayName={buddy.displayName} readOnly />
          <div>
            <h1 className="text-2xl font-semibold">{buddy.displayName}</h1>
            <p className="text-muted-foreground">{buddy.email}</p>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 mb-6">
          <div className="grid gap-4 mb-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('realName')}</p>
              <p>{buddy.realName}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('status')}</p>
              <p>{getBuddyStatusLabel(tBuddyStatus, buddy.status)}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('createdAt')}</p>
              <p>{new Date(buddy.createdAt).toLocaleDateString(locale)}</p>
            </div>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold">{t('editForm')}</h2>
        <BuddyForm buddy={buddy} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{t('bookingHistoryTitle')}</h2>
        {buddy.absenceSummary.absentWithoutReport > 0 && (
          <p className="mb-3 text-sm font-medium text-destructive">
            {t('absenceSummary', { count: buddy.absenceSummary.absentWithoutReport })}
          </p>
        )}
        <BuddyBookingHistory bookings={buddy.bookings} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.profileEvaluation')}</h2>
        <AdminProfileEvaluationSummary buddyId={buddy.id} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.perTourEvaluations')}</h2>
        <BuddyPerTourEvaluations buddyId={buddy.id} bookings={buddy.bookings} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.selfEvaluations')}</h2>
        <BuddySelfEvaluations buddyId={buddy.id} />
      </div>
    </AppShell>
  )
}

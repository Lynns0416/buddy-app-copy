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
import { BuddyReflections } from '../_components/buddy-reflections'
import { AdminProfileEvaluationSummary } from '../_components/admin-profile-evaluation-summary'
import { BuddyStatsSummary } from '../_components/buddy-stats-summary'
import { formatDate } from '@/lib/format-date'

export default function AdminBuddyDetailPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const params = useParams()
  const id = params.id as string
  const t = useTranslations('adminBuddies')
  const tBuddyStatus = useTranslations('buddyStatus')
  const tEval = useTranslations('adminEvaluations')
  const tProfile = useTranslations('profile')
  const tLang = useTranslations('languages')
  const tStats = useTranslations('adminBuddyStats')
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
              <p>{formatDate(buddy.createdAt)}</p>
            </div>
          </div>
        </div>

        <h2 className="mb-4 text-lg font-semibold">{t('profileSectionTitle')}</h2>
        <div className="rounded-lg border bg-card p-6 mb-6">
          {!buddy.buddyProfile ? (
            <p className="text-sm text-muted-foreground">{t('noProfile')}</p>
          ) : (
            <div className="grid gap-4">
              {buddy.buddyProfile.bio && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{tProfile('bio')}</p>
                  <p className="whitespace-pre-wrap text-sm">{buddy.buddyProfile.bio}</p>
                </div>
              )}
              {buddy.buddyProfile.languages.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{tProfile('languages')}</p>
                  <p className="text-sm">{buddy.buddyProfile.languages.map((l) => tLang(l as Parameters<typeof tLang>[0])).join(', ')}</p>
                </div>
              )}
              {buddy.buddyProfile.skills.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{tProfile('skills')}</p>
                  <ul className="text-sm list-disc list-inside">
                    {buddy.buddyProfile.skills.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              {buddy.buddyProfile.contactInfo && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{tProfile('contactInfo')}</p>
                  <p className="whitespace-pre-wrap text-sm">{buddy.buddyProfile.contactInfo}</p>
                </div>
              )}
              {!buddy.buddyProfile.bio && !buddy.buddyProfile.contactInfo && buddy.buddyProfile.languages.length === 0 && buddy.buddyProfile.skills.length === 0 && (
                <p className="text-sm text-muted-foreground">{t('noProfile')}</p>
              )}
            </div>
          )}
        </div>

        <h2 className="mb-4 text-lg font-semibold">{t('editForm')}</h2>
        <BuddyForm buddy={buddy} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tStats('detail.title')}</h2>
        <BuddyStatsSummary buddy={buddy} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{t('bookingHistoryTitle')}</h2>
        {buddy.absenceSummary.absentWithoutReport > 0 && (
          <p className="mb-3 text-sm font-medium text-destructive">
            {t('absenceSummary', { count: buddy.absenceSummary.absentWithoutReport })}
          </p>
        )}
        <BuddyBookingHistory bookings={buddy.bookings} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.reflections')}</h2>
        <BuddyReflections buddyId={buddy.id} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.profileEvaluation')}</h2>
        <AdminProfileEvaluationSummary buddyId={buddy.id} />

        <h2 className="mt-10 mb-4 text-lg font-semibold">{tEval('sections.perTourEvaluations')}</h2>
        <BuddyPerTourEvaluations buddyId={buddy.id} bookings={buddy.bookings} />
      </div>
    </AppShell>
  )
}

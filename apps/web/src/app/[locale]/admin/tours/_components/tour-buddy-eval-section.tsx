'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminEvaluationResponse, AdminTourBookingEntry } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { listAdminEvaluations } from '../../evaluations/admin.evaluation'
import { TourPerBuddyEvaluationForm } from './tour-per-buddy-evaluation-form'

interface TourBuddyEvalSectionProps {
  tourId: string
  bookings: AdminTourBookingEntry[]
}

export function TourBuddyEvalSection({ tourId, bookings }: TourBuddyEvalSectionProps) {
  const { locale } = useAdminGuard()
  const t = useTranslations('adminEvaluations')
  const [evalsByBuddy, setEvalsByBuddy] = useState<Map<string, AdminEvaluationResponse>>(new Map())
  const [loading, setLoading] = useState(true)
  const [addingFor, setAddingFor] = useState<string | null>(null)

  const confirmedBookings = bookings.filter(
    (b) => b.status === BookingStatusSchema.enum.confirmed,
  )

  useEffect(() => {
    listAdminEvaluations({ tourId }).then((result) => {
      if (result.ok) {
        const map = new Map<string, AdminEvaluationResponse>()
        for (const ev of result.data) map.set(ev.buddyId, ev)
        setEvalsByBuddy(map)
      }
      setLoading(false)
    })
  }, [tourId])

  function handleSaved(buddyId: string, saved: AdminEvaluationResponse) {
    setEvalsByBuddy((prev) => new Map(prev).set(buddyId, saved))
    setAddingFor(null)
  }

  if (loading) return null

  if (confirmedBookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty.noEvaluations')}</p>
  }

  return (
    <div className="space-y-3">
      {confirmedBookings.map((booking) => {
        const existing = evalsByBuddy.get(booking.buddyId)
        const isAdding = addingFor === booking.buddyId

        return (
          <div key={booking.buddyId} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{booking.displayName}</p>
              {!isAdding && (
                existing ? (
                  <Link
                    href={routes.adminEvaluationDetail(locale, existing.id)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {t('actions.view')} →
                  </Link>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAddingFor(booking.buddyId)}>
                    {t('actions.addEvaluation')}
                  </Button>
                )
              )}
            </div>

            {!isAdding && existing && (
              <p className="text-sm text-muted-foreground">
                {t('table.overallRating')}: {existing.overallRating ?? '—'}
              </p>
            )}

            {isAdding && (
              <TourPerBuddyEvaluationForm
                buddyId={booking.buddyId}
                tourId={tourId}
                onSaved={(saved) => handleSaved(booking.buddyId, saved)}
                onCancel={() => setAddingFor(null)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

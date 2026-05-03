'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminEvaluationResponse, AdminTourBookingEntry } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { listAdminEvaluations } from '../../evaluations/admin.evaluation'
import { TourPerBuddyEvaluationForm } from './tour-per-buddy-evaluation-form'

interface TourBuddyEvalSectionProps {
  tourId: string
  bookings: AdminTourBookingEntry[]
}

export function TourBuddyEvalSection({ tourId, bookings }: TourBuddyEvalSectionProps) {
  const { locale } = useAdminGuard()
  const { dbUser } = useAuth()
  const t = useTranslations('adminEvaluations')
  const [evalsByBuddy, setEvalsByBuddy] = useState<Map<string, AdminEvaluationResponse[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [addingFor, setAddingFor] = useState<string | null>(null)

  const confirmedBookings = bookings.filter(
    (b) => b.status === BookingStatusSchema.enum.confirmed,
  )

  useEffect(() => {
    listAdminEvaluations({ tourId }).then((result) => {
      if (result.ok) {
        const map = new Map<string, AdminEvaluationResponse[]>()
        for (const ev of result.data) {
          const list = map.get(ev.buddyId) ?? []
          list.push(ev)
          map.set(ev.buddyId, list)
        }
        setEvalsByBuddy(map)
      }
      setLoading(false)
    })
  }, [tourId])

  function handleSaved(buddyId: string, saved: AdminEvaluationResponse) {
    setEvalsByBuddy((prev) => {
      const next = new Map(prev)
      next.set(buddyId, [...(next.get(buddyId) ?? []), saved])
      return next
    })
    setAddingFor(null)
  }

  if (loading) return null

  if (confirmedBookings.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty.noEvaluations')}</p>
  }

  return (
    <div className="space-y-3">
      {confirmedBookings.map((booking) => {
        const evals = evalsByBuddy.get(booking.buddyId) ?? []
        const myEval = evals.find((ev) => ev.createdBy === dbUser?.id)
        const isAdding = addingFor === booking.buddyId

        return (
          <div key={booking.buddyId} className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">{booking.displayName}</p>
              {!isAdding && !myEval && (
                <Button size="sm" variant="outline" onClick={() => setAddingFor(booking.buddyId)}>
                  {t('actions.addEvaluation')}
                </Button>
              )}
            </div>

            {!isAdding && evals.length > 0 && (
              <div className="space-y-1">
                {evals.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {ev.createdByEmail} · {t('table.overallRating')}: {ev.overallRating ?? '—'}
                    </span>
                    <Link
                      href={routes.adminEvaluationDetail(locale, ev.id)}
                      className="text-blue-600 hover:underline whitespace-nowrap"
                    >
                      {ev.createdBy === dbUser?.id ? t('actions.edit') : t('actions.view')} →
                    </Link>
                  </div>
                ))}
              </div>
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

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AdminEvaluationResponse, AdminBuddyBookingEntry } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { SortIcon } from '@/components/sort-icon'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { listAdminEvaluations } from '../../evaluations/admin.evaluation'
import { BuddyPerTourEvaluationForm } from './buddy-per-tour-evaluation-form'

type SortField = 'tourDate' | 'overallRating' | 'updatedAt'
type SortDir = 'asc' | 'desc'

function tourLabel(bookings: AdminBuddyBookingEntry[], tourId: string): string {
  const b = bookings.find((b) => b.tourId === tourId)
  return b ? `${b.tour.tourDate.slice(0, 10)} — ${b.tour.group.name}` : tourId
}

function sortEvals(
  evals: AdminEvaluationResponse[],
  bookings: AdminBuddyBookingEntry[],
  field: SortField,
  dir: SortDir,
): AdminEvaluationResponse[] {
  return [...evals].sort((a, b) => {
    let cmp = 0
    if (field === 'overallRating') {
      cmp = (a.overallRating ?? 0) - (b.overallRating ?? 0)
    } else if (field === 'updatedAt') {
      cmp = a.updatedAt.localeCompare(b.updatedAt)
    } else {
      const aDate = bookings.find((bk) => bk.tourId === a.tourId)?.tour.tourDate ?? ''
      const bDate = bookings.find((bk) => bk.tourId === b.tourId)?.tour.tourDate ?? ''
      cmp = aDate.localeCompare(bDate)
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

interface BuddyPerTourEvaluationsProps {
  buddyId: string
  bookings: AdminBuddyBookingEntry[]
}

export function BuddyPerTourEvaluations({ buddyId, bookings }: BuddyPerTourEvaluationsProps) {
  const { locale } = useAdminGuard()
  const { dbUser } = useAuth()
  const t = useTranslations('adminEvaluations')
  const [evals, setEvals] = useState<AdminEvaluationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [sortField, setSortField] = useState<SortField>('tourDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const completedBookings = bookings.filter(
    (b) =>
      b.status === BookingStatusSchema.enum.confirmed &&
      b.tour.status === TourStatusSchema.enum.completed,
  )

  useEffect(() => {
    listAdminEvaluations({ buddyId }).then((result) => {
      if (!result.ok) {
        setLoadError(t('error.unknown'))
      } else {
        setEvals(result.data)
      }
      setLoading(false)
    })
  }, [buddyId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  function handleSaved(saved: AdminEvaluationResponse) {
    setEvals((prev) => [...prev, saved])
    setAdding(false)
  }

  if (loading) return null

  if (loadError) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
  }

  const sorted = sortEvals(evals, bookings, sortField, sortDir)

  const SORT_COLS: { field: SortField; label: string }[] = [
    { field: 'tourDate', label: t('table.tourDate') },
    { field: 'overallRating', label: t('table.overallRating') },
    { field: 'updatedAt', label: t('table.updatedAt') },
  ]

  return (
    <div className="space-y-4">
      {evals.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-4 px-4 text-xs text-muted-foreground">
            {SORT_COLS.map(({ field, label }) => (
              <button
                key={field}
                className="inline-flex items-center gap-0.5 hover:text-foreground"
                onClick={() => handleSort(field)}
              >
                {label}
                <SortIcon active={sortField === field} dir={sortDir} />
              </button>
            ))}
          </div>
          {sorted.map((ev) => (
            <div
              key={ev.id}
              className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{tourLabel(bookings, ev.tourId)}</p>
                <p className="text-xs text-muted-foreground">
                  {t('table.overallRating')}: {ev.overallRating ?? '—'}
                  {' · '}
                  {t('table.evaluator')}: {ev.createdByEmail}
                  {' · '}
                  {new Date(ev.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <Link
                href={routes.adminEvaluationDetail(locale, ev.id)}
                className="text-sm text-blue-600 hover:underline whitespace-nowrap"
              >
                {ev.createdBy === dbUser?.id ? t('actions.edit') : t('actions.view')} →
              </Link>
            </div>
          ))}
        </div>
      )}

      {evals.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">{t('empty.noEvaluations')}</p>
      )}

      {adding ? (
        <BuddyPerTourEvaluationForm
          buddyId={buddyId}
          completedBookings={completedBookings.filter(
            (b) => !evals.some((ev) => ev.tourId === b.tourId && ev.createdBy === dbUser?.id),
          )}
          onSaved={handleSaved}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={completedBookings.every(
            (b) => evals.some((ev) => ev.tourId === b.tourId && ev.createdBy === dbUser?.id),
          )}
          onClick={() => setAdding(true)}
        >
          {t('actions.addEvaluation')}
        </Button>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { TourStatusSchema, TourActionSchema, AppErrorCodeSchema } from '@peace-buddy/types'
import type { AdminTourDetailResponse, TourStatus, TourAction, BookingStatus, AppError } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import {
  sortBookings, nextBookingSort, fetchTour, transitionTour, toggleTourBooking, deleteTour,
  type BookingSortField,
} from '../admin.tour'

const STATUS_VARIANT: Record<TourStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  maybe: 'bg-amber-100 text-amber-800 border-amber-200',
  waitlist: 'bg-blue-100 text-blue-800 border-blue-200',
  declined: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default function AdminTourDetailPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [bookingSortField, setBookingSortField] = useState<BookingSortField>('bookedAt')
  const [bookingSortDir, setBookingSortDir] = useState<'asc' | 'desc'>('asc')

  function handleBookingSort(field: BookingSortField) {
    const next = nextBookingSort({ field: bookingSortField, dir: bookingSortDir }, field)
    setBookingSortField(next.field)
    setBookingSortDir(next.dir)
  }

  function errorMessage(error: AppError): string {
    switch (error.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  useEffect(() => {
    if (!ready) return
    fetchTour(id).then((result) => {
      if (result.ok) setTour(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready, id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTransition(action: TourAction, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setActing(true)
    setActionError(null)
    const result = await transitionTour(id, action)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  async function handleToggleBooking() {
    if (!tour) return
    setActing(true)
    setActionError(null)
    const result = await toggleTourBooking(id, tour.bookingOpen)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDelete'))) return
    setActing(true)
    setActionError(null)
    const result = await deleteTour(id)
    if (result.ok) router.push(routes.adminTours(locale))
    else {
      setActionError(errorMessage(result.error))
      setActing(false)
    }
  }

  const tourStatusLabel: Record<TourStatus, string> = {
    draft: t('statusDraft'),
    published: t('statusPublished'),
    cancelled: t('statusCancelled'),
    completed: t('statusCompleted'),
  }

  const bookingStatusLabel: Record<BookingStatus, string> = {
    confirmed: t('statusConfirmed'),
    maybe: t('statusMaybe'),
    waitlist: t('statusWaitlist'),
    declined: t('statusDeclined'),
  }

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!tour) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link href={routes.adminTours(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
        {(tour.status === TourStatusSchema.enum.draft || tour.status === TourStatusSchema.enum.published) && (
          <Button asChild size="sm">
            <Link href={routes.adminTourEdit(locale, tour.id)}>{t('edit')}</Link>
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{actionError}</p>
      )}

      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{tour.group.name}</h1>
          <Badge variant={STATUS_VARIANT[tour.status]}>{tourStatusLabel[tour.status]}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="font-medium tabular-nums">{tour.tourDate.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('meetingTime')}</dt>
            <dd className="font-medium tabular-nums">{tour.meetingTime.slice(11, 16)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('location')}</dt>
            <dd className="font-medium">{tour.location}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('capacity')}</dt>
            <dd className="font-medium">{tour.capacity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('cancellationDeadline')}</dt>
            <dd className="font-medium tabular-nums">{tour.cancellationDeadline.slice(0, 10)}</dd>
          </div>
          {tour.maybeDeadline && (
            <div>
              <dt className="text-muted-foreground">{t('maybeDeadline')}</dt>
              <dd className="font-medium tabular-nums">{tour.maybeDeadline.slice(0, 10)}</dd>
            </div>
          )}
          {tour.description && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('description')}</dt>
              <dd className="font-medium whitespace-pre-wrap">{tour.description}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">{t('bookingOpen')}</dt>
            <dd className="font-medium">{tour.bookingOpen ? t('bookingOpenYes') : t('bookingOpenNo')}</dd>
          </div>
          {tour.adminMemo && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('adminMemo')}</dt>
              <dd className="font-medium whitespace-pre-wrap">{tour.adminMemo}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(tour.status === TourStatusSchema.enum.draft || tour.status === TourStatusSchema.enum.published) && (
          <Button
            size="sm"
            variant={tour.bookingOpen ? 'secondary' : 'outline'}
            disabled={acting}
            onClick={handleToggleBooking}
          >
            {tour.bookingOpen ? t('closeBooking') : t('openBooking')}
          </Button>
        )}
        {tour.status === TourStatusSchema.enum.draft && (
          <>
            <Button size="sm" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.publish)}>
              {t('publish')}
            </Button>
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.cancel, t('confirmCancel'))}>
              {t('cancelTour')}
            </Button>
            <Button size="sm" variant="destructive" disabled={acting} onClick={handleDelete}>
              {t('deleteTour')}
            </Button>
          </>
        )}
        {tour.status === TourStatusSchema.enum.published && (
          <>
            <Button size="sm" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.complete, t('confirmComplete'))}>
              {t('completeTour')}
            </Button>
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.cancel, t('confirmCancel'))}>
              {t('cancelTour')}
            </Button>
          </>
        )}
      </div>

      <h2 className="mb-3 text-base font-semibold">{t('bookings')}</h2>
      {tour.bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noBookings')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {([
                  { field: 'displayName' as const, label: t('buddyName') },
                  { field: 'status' as const, label: t('bookingStatus') },
                  { field: 'bookedAt' as const, label: t('bookedAt') },
                ]).map(({ field, label }) => (
                  <TableHead key={field}>
                    <button
                      className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                      onClick={() => handleBookingSort(field)}
                    >
                      {label}
                      <SortIcon active={bookingSortField === field} dir={bookingSortDir} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortBookings(tour.bookings, bookingSortField, bookingSortDir).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.displayName}</TableCell>
                  <TableCell>
                    <Badge className={BOOKING_STATUS_CLASS[b.status]}>{bookingStatusLabel[b.status]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {new Date(b.bookedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}

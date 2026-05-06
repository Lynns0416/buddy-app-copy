'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import type { BookingStatus, CancellationReasonBody, CancellationCategory } from '@peace-buddy/types'
import { TourStatusSchema, BookingStatusSchema, CancellationCategorySchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTourDetail } from '../../hooks/use-tour-detail'
import { createInitialBooking, updateBookingStatus, mapErrorToI18nKey } from './dashboard.booking'
import { CANCEL_CATEGORIES } from '../../lib/constants'
import { isPastDeadline, canSelectMaybeStatus, isBookingAllowed } from '../../lib/deadline'
import { getBookingStatusLabel, bookingStatusBadgeVariant } from '@/lib/status-display'
import { TourSelfEvalSection } from '../../self-evaluations/_components/tour-self-eval-section'

export default function TourDetailPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('tourDetail')
  const tBookingStatus = useTranslations('bookingStatus')
  const { tour, error: notFound, refetch } = useTourDetail(id, !loading && !!firebaseUser)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Cancellation reason form state (only shown for confirmed → declined)
  const [cancelRequested, setCancelRequested] = useState(false)
  const [cancelCategory, setCancelCategory] = useState<CancellationCategory | ''>('')
  const [cancelFreeText, setCancelFreeText] = useState('')
  const [cancelUnavoidable, setCancelUnavoidable] = useState(false)

  const handleBook = async () => {
    setActing(true)
    setActionError(null)
    const result = await createInitialBooking(id)
    if (result.ok) {
      await refetch()
    } else {
      const key = result.specialMessage || mapErrorToI18nKey(result.error.code)
      setActionError(t(key))
    }
    setActing(false)
  }

  const handleUpdate = async (status: string) => {
    setActing(true)
    setActionError(null)
    const result = await updateBookingStatus(id, status)
    if (result.ok) {
      await refetch()
    } else {
      const key = mapErrorToI18nKey(result.error.code)
      setActionError(t(key))
    }
    setActing(false)
  }

  const handleCancelConfirmed = async () => {
    if (!cancelCategory) return
    const reason: CancellationReasonBody = {
      category: cancelCategory as CancellationCategory,
      freeText: cancelFreeText.trim() || undefined,
      unavoidable: cancelUnavoidable,
    }
    setActing(true)
    setActionError(null)
    const result = await updateBookingStatus(id, BookingStatusSchema.enum.declined, reason)
    if (result.ok) {
      setCancelRequested(false)
      await refetch()
    } else {
      const key = mapErrorToI18nKey(result.error.code)
      setActionError(t(key))
    }
    setActing(false)
  }

  if (loading) return null

  if (notFound || !tour) {
    return (
      <AppShell variant="buddy">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </AppShell>
    )
  }

  const cancelCategoryLabel: Record<CancellationCategory, string> = {
    [CancellationCategorySchema.enum.health]: t('cancelReasonHealth'),
    [CancellationCategorySchema.enum.emergency]: t('cancelReasonEmergency'),
    [CancellationCategorySchema.enum.personal]: t('cancelReasonPersonal'),
    [CancellationCategorySchema.enum.work]: t('cancelReasonWork'),
    [CancellationCategorySchema.enum.other]: t('cancelReasonOther'),
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const isPastCancellationDeadline = isPastDeadline(todayStr, tour.cancellationDeadline)
  const isPastMaybeDeadline = tour.maybeDeadline ? isPastDeadline(todayStr, tour.maybeDeadline) : false

  const isBookable = isBookingAllowed(tour.status, tour.bookingOpen, tour.tourDate)

  const canSelectMaybe = canSelectMaybeStatus(isPastMaybeDeadline, isPastCancellationDeadline)
  const showMaybeDeadline = tour.maybeDeadline && !isPastCancellationDeadline

  return (
    <AppShell variant="buddy">
      <div className="mb-6">
        <Link href={routes.dashboard(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-6">
        <h1 className="mb-4 text-xl font-semibold">{tour.group.name}</h1>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <CalendarDays size={14} className="text-muted-foreground" />
              {tour.tourDate.slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('meetingTime')}</dt>
            <dd className="flex items-center gap-1.5 font-medium tabular-nums">
              <Clock size={14} className="text-muted-foreground" />
              {tour.meetingTime.slice(11, 16)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('location')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <MapPin size={14} className="text-muted-foreground" />
              {tour.location}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('capacity')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Users size={14} className="text-muted-foreground" />
              {tour.myCapacity ?? tour.capacity}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('remaining')}</dt>
            <dd className="flex items-center gap-1.5 font-medium tabular-nums">
              <Users size={14} className="text-muted-foreground" />
              {tour.myRemaining ?? tour.remaining}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('participantCount')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <Users size={14} className="text-muted-foreground" />
              {tour.participantCount}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('cancellationDeadline')}</dt>
            <dd className={`font-medium tabular-nums${isPastCancellationDeadline ? ' text-destructive' : ''}`}>
              {tour.cancellationDeadline.slice(0, 10)}
            </dd>
          </div>
          {showMaybeDeadline && (
            <div>
              <dt className="text-muted-foreground">{t('maybeDeadline')}</dt>
              <dd className={`font-medium tabular-nums${isPastMaybeDeadline ? ' text-destructive' : ''}`}>
                {tour.maybeDeadline ? tour.maybeDeadline.slice(0, 10) : ''}
              </dd>
            </div>
          )}
          {tour.description && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('description')}</dt>
              <dd className="mt-1 whitespace-pre-wrap font-medium">{tour.description}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{t('seatCounts')}</h2>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">
              {(tour.myCapacity ?? tour.capacity) - (tour.myRemaining ?? tour.remaining)}
            </p>
            <p className="text-muted-foreground">{t('confirmed')}</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{tour.seatCounts.maybe}</p>
            <p className="text-muted-foreground">{t('maybe')}</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{tour.seatCounts.waitlist}</p>
            <p className="text-muted-foreground">{t('waitlist')}</p>
          </div>
          <div className="rounded-md border p-3 text-center">
            <p className="text-2xl font-bold tabular-nums">{tour.seatCounts.declined}</p>
            <p className="text-muted-foreground">{t('declined')}</p>
          </div>
        </div>
      </div>

      {dbUser && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">{t('myStatus')}</h2>
          {tour.myBookingStatus ? (
            <Badge variant={bookingStatusBadgeVariant[tour.myBookingStatus]}>{getBookingStatusLabel(tBookingStatus, tour.myBookingStatus)}</Badge>
          ) : (
            <p className="text-sm text-muted-foreground">{t('noBooking')}</p>
          )}
          {tour.status !== TourStatusSchema.enum.cancelled && tour.status !== TourStatusSchema.enum.completed && (
            <div className="mt-4">
              {cancelRequested ? (
                <div className="space-y-4 rounded-md border p-4">
                  <h3 className="text-sm font-semibold">{t('cancelReasonTitle')}</h3>
                  <div className="space-y-1">
                    <Label htmlFor="cancel-category">{t('cancelReasonCategory')}</Label>
                    <Select value={cancelCategory} onValueChange={(v) => setCancelCategory(v as CancellationCategory)}>
                      <SelectTrigger id="cancel-category">
                        <SelectValue placeholder={t('cancelReasonCategoryPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CANCEL_CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cancelCategoryLabel[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cancel-freetext">{t('cancelReasonFreeText')}</Label>
                    <Textarea
                      id="cancel-freetext"
                      value={cancelFreeText}
                      onChange={(e) => setCancelFreeText(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cancelUnavoidable}
                      onChange={(e) => setCancelUnavoidable(e.target.checked)}
                      className="h-4 w-4"
                    />
                    {t('cancelReasonUnavoidable')}
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      disabled={!cancelCategory || acting}
                      onClick={() => void handleCancelConfirmed()}
                    >
                      {t('cancelReasonSubmit')}
                    </Button>
                    <Button variant="outline" disabled={acting} onClick={() => setCancelRequested(false)}>
                      {t('cancelReasonBack')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tour.myBookingStatus === null && tour.status === TourStatusSchema.enum.published && tour.bookingOpen && (
                    <Button onClick={() => void handleBook()} disabled={acting}>
                      {t('book')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.declined && isBookable && (tour.myRemaining ?? tour.remaining) > 0 && (
                    <Button variant="outline" onClick={() => void handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                      {t('revert')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.confirmed && canSelectMaybe && (
                    <Button variant="outline" onClick={() => void handleUpdate(BookingStatusSchema.enum.maybe)} disabled={acting}>
                      {t('setMaybe')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.maybe && isBookable && (
                    <Button onClick={() => handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                      {t('confirmBooking')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.confirmed && !isPastCancellationDeadline && (
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setCancelRequested(true)}
                      disabled={acting}
                    >
                      {t('cancelBooking')}
                    </Button>
                  )}
                  {(tour.myBookingStatus === BookingStatusSchema.enum.maybe ||
                    tour.myBookingStatus === BookingStatusSchema.enum.waitlist) &&
                    !isPastCancellationDeadline && (
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => void handleUpdate(BookingStatusSchema.enum.declined)}
                      disabled={acting}
                    >
                      {t('cancelBooking')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
        </div>
      )}

      {tour.status === TourStatusSchema.enum.completed &&
        tour.myBookingStatus === BookingStatusSchema.enum.confirmed && (
        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">{t('selfEvalTitle')}</h2>
          <TourSelfEvalSection tourId={id} />
        </div>
      )}
    </AppShell>
  )
}

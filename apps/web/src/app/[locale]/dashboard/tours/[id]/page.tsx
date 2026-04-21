'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'
import type { TourDetailResponse, BookingStatus, UpdateBookingBody, CancellationReasonBody, CancellationCategory } from '@peace-buddy/types'
import { TourStatusSchema, BookingStatusSchema, CancellationCategorySchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const MY_STATUS_VARIANT: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  [BookingStatusSchema.enum.confirmed]: 'default',
  [BookingStatusSchema.enum.maybe]: 'secondary',
  [BookingStatusSchema.enum.waitlist]: 'outline',
  [BookingStatusSchema.enum.declined]: 'destructive',
}

const CANCEL_CATEGORIES: CancellationCategory[] = [
  CancellationCategorySchema.enum.health,
  CancellationCategorySchema.enum.emergency,
  CancellationCategorySchema.enum.personal,
  CancellationCategorySchema.enum.work,
  CancellationCategorySchema.enum.other,
]

export default function TourDetailPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('tourDetail')
  const [tour, setTour] = useState<TourDetailResponse | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Cancellation reason form state (only shown for confirmed → declined)
  const [cancelRequested, setCancelRequested] = useState(false)
  const [cancelCategory, setCancelCategory] = useState<CancellationCategory | ''>('')
  const [cancelFreeText, setCancelFreeText] = useState('')
  const [cancelUnavoidable, setCancelUnavoidable] = useState(false)

  useEffect(() => {
    if (!loading && firebaseUser) {
      apiClient.getTour(id)
        .then(setTour)
        .catch(() => setNotFound(true))
    }
  }, [loading, firebaseUser, id])

  const refreshTour = async () => {
    const updated = await apiClient.getTour(id)
    setTour(updated)
  }

  const handleInitialResponse = async (intent: BookingStatus) => {
    setActing(true)
    setActionError(null)
    try {
      await apiClient.createBooking(id)
      if (intent !== BookingStatusSchema.enum.confirmed) {
        await apiClient.updateBooking(id, intent as UpdateBookingBody['status'])
      }
      await refreshTour()
    } catch {
      setActionError(t('bookingError'))
    } finally {
      setActing(false)
    }
  }

  const handleUpdate = async (status: UpdateBookingBody['status']) => {
    setActing(true)
    setActionError(null)
    try {
      await apiClient.updateBooking(id, status)
      await refreshTour()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setActionError(t('tourFull'))
      else if (err instanceof ApiError && err.status === 422) setActionError(t('deadlinePassed'))
      else setActionError(t('bookingError'))
    } finally {
      setActing(false)
    }
  }

  const handleCancelConfirmed = async () => {
    if (!cancelCategory) return
    const reason: CancellationReasonBody = {
      category: cancelCategory,
      freeText: cancelFreeText.trim() || undefined,
      unavoidable: cancelUnavoidable,
    }
    setActing(true)
    setActionError(null)
    try {
      await apiClient.updateBooking(id, BookingStatusSchema.enum.declined, reason)
      setCancelRequested(false)
      await refreshTour()
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) setActionError(t('deadlinePassed'))
      else setActionError(t('bookingError'))
    } finally {
      setActing(false)
    }
  }

  if (loading || (!tour && !notFound)) return null

  if (notFound) {
    return (
      <AppShell variant="buddy">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </AppShell>
    )
  }

  if (!tour) return null

  const myStatusKey = tour.myBookingStatus
    ? (`status${tour.myBookingStatus.charAt(0).toUpperCase()}${tour.myBookingStatus.slice(1)}` as 'statusConfirmed')
    : null

  const isBookable =
    tour.status === TourStatusSchema.enum.published &&
    tour.bookingOpen &&
    new Date(tour.tourDate) > new Date()

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
              {tour.capacity}
            </dd>
          </div>
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
            <p className="text-2xl font-bold tabular-nums">{tour.seatCounts.confirmed}</p>
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
        <p className="mt-3 text-sm text-muted-foreground">
          {t('remainingSeats')}: <span className="font-semibold text-foreground tabular-nums">{tour.remainingSeats}</span>
        </p>
      </div>

      {dbUser && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="mb-3 text-base font-semibold">{t('myStatus')}</h2>
          {myStatusKey ? (
            <Badge variant={MY_STATUS_VARIANT[tour.myBookingStatus!]}>{t(myStatusKey)}</Badge>
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
                            {t(`cancelReason${cat.charAt(0).toUpperCase()}${cat.slice(1)}` as 'cancelReasonHealth')}
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
                      onClick={handleCancelConfirmed}
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
                  {tour.myBookingStatus === null && isBookable && (
                    <>
                      <Button onClick={() => handleInitialResponse(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                        {t('join')}
                      </Button>
                      <Button variant="secondary" onClick={() => handleInitialResponse(BookingStatusSchema.enum.maybe)} disabled={acting}>
                        {t('respondMaybe')}
                      </Button>
                      <Button variant="outline" onClick={() => handleInitialResponse(BookingStatusSchema.enum.declined)} disabled={acting}>
                        {t('decline')}
                      </Button>
                    </>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.declined && isBookable && tour.remainingSeats > 0 && (
                    <Button variant="outline" onClick={() => handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                      {t('revert')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.confirmed && (
                    <Button variant="outline" onClick={() => handleUpdate(BookingStatusSchema.enum.maybe)} disabled={acting}>
                      {t('setMaybe')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.maybe && isBookable && (
                    <Button onClick={() => handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                      {t('confirmBooking')}
                    </Button>
                  )}
                  {tour.myBookingStatus === BookingStatusSchema.enum.confirmed && (
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
                    tour.myBookingStatus === BookingStatusSchema.enum.waitlist) && (
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleUpdate(BookingStatusSchema.enum.declined)}
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
    </AppShell>
  )
}

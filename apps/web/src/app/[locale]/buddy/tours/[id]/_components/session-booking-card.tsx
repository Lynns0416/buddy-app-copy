'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { TourSessionDetailResponse, TourStatus, CancellationReasonBody, CancellationCategory } from '@peace-buddy/types'
import { TourStatusSchema, BookingStatusSchema, CancellationCategorySchema, getTodayJst } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Clock, Users } from 'lucide-react'
import { createInitialBooking, updateBookingStatus, reportCantGo, mapErrorToI18nKey } from '../buddy.booking'
import { CANCEL_CATEGORIES } from '../../../lib/constants'
import { isPastDeadline, canSelectMaybeStatus, isBookingAllowed } from '../../../lib/deadline'
import { getBookingStatusLabel, bookingStatusBadgeVariant } from '@/lib/status-display'

interface Props {
  tourId: string
  session: TourSessionDetailResponse
  totalSessions: number
  tourStatus: TourStatus
  bookingOpen: boolean
  cancellationDeadline: string
  maybeDeadline: string | null
  tourDate: string
  onRefetch: () => Promise<void>
}

export function SessionBookingCard({
  tourId,
  session,
  totalSessions,
  tourStatus,
  bookingOpen,
  cancellationDeadline,
  maybeDeadline,
  tourDate,
  onRefetch,
}: Props) {
  const t = useTranslations('tourDetail')
  const tBookingStatus = useTranslations('bookingStatus')

  const [acting, setActing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [cancelRequested, setCancelRequested] = useState(false)
  const [cancelCategory, setCancelCategory] = useState<CancellationCategory | ''>('')
  const [cancelFreeText, setCancelFreeText] = useState('')
  const [cantGoRequested, setCantGoRequested] = useState(false)
  const [cantGoCategory, setCantGoCategory] = useState<CancellationCategory | ''>('')
  const [cantGoFreeText, setCantGoFreeText] = useState('')

  const todayStr = getTodayJst()
  const isPastCancellationDeadline = isPastDeadline(todayStr, cancellationDeadline)
  const isPastMaybeDeadline = maybeDeadline ? isPastDeadline(todayStr, maybeDeadline) : false
  const isBookable = isBookingAllowed(tourStatus, bookingOpen, tourDate, todayStr)
  const canSelectMaybe = canSelectMaybeStatus(isPastMaybeDeadline, isPastCancellationDeadline)

  const sessionLabel = session.label ?? (totalSessions > 1 ? t(`session.defaultLabel.${session.order}`) : null)

  const handleBook = async () => {
    setActing(true)
    setActionError(null)
    const result = await createInitialBooking(tourId, session.id)
    if (result.ok) {
      await onRefetch()
    } else {
      const key = result.specialMessage ?? mapErrorToI18nKey(result.error.code)
      setActionError(t(key))
    }
    setActing(false)
  }

  const handleUpdate = async (status: string) => {
    setActing(true)
    setActionError(null)
    const result = await updateBookingStatus(tourId, session.id, status)
    if (result.ok) {
      await onRefetch()
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
    }
    setActing(true)
    setActionError(null)
    const result = await updateBookingStatus(tourId, session.id, BookingStatusSchema.enum.declined, reason)
    if (result.ok) {
      setCancelRequested(false)
      await onRefetch()
    } else {
      const key = mapErrorToI18nKey(result.error.code)
      setActionError(t(key))
    }
    setActing(false)
  }

  const handleCantGoConfirmed = async () => {
    if (!cantGoCategory) return
    setActing(true)
    setActionError(null)
    const result = await reportCantGo(tourId, session.id, {
      category: cantGoCategory as CancellationCategory,
      freeText: cantGoFreeText.trim() || undefined,
    })
    if (result.ok) {
      setCantGoRequested(false)
      await onRefetch()
    } else {
      setActionError(t('bookingError'))
    }
    setActing(false)
  }

  const cancelCategoryLabel: Record<CancellationCategory, string> = {
    [CancellationCategorySchema.enum.health]: t('cancelReasonHealth'),
    [CancellationCategorySchema.enum.emergency]: t('cancelReasonEmergency'),
    [CancellationCategorySchema.enum.personal]: t('cancelReasonPersonal'),
    [CancellationCategorySchema.enum.work]: t('cancelReasonWork'),
    [CancellationCategorySchema.enum.other]: t('cancelReasonOther'),
  }

  const effectiveCapacity = session.myCapacity ?? session.capacity
  const effectiveRemaining = session.myRemaining ?? session.remaining

  return (
    <div className="rounded-lg border bg-card p-4">
      {sessionLabel && <h3 className="mb-3 text-sm font-semibold">{sessionLabel}</h3>}

      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5 text-foreground font-bold">
          <Clock size={14} />
          {session.meetingTime.slice(11, 16)}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          {t('capacity')}: {effectiveCapacity}
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          {t('remaining')}: {effectiveRemaining}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{effectiveCapacity - effectiveRemaining}</p>
          <p className="text-xs text-muted-foreground">{t('confirmed')}</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{session.seatCounts.maybe}</p>
          <p className="text-xs text-muted-foreground">{t('maybe')}</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{session.seatCounts.waitlist}</p>
          <p className="text-xs text-muted-foreground">{t('waitlist')}</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <p className="text-lg font-bold tabular-nums">{session.seatCounts.declined}</p>
          <p className="text-xs text-muted-foreground">{t('declined')}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t('myStatus')}</p>
        {session.myBookingStatus ? (
          <Badge variant={bookingStatusBadgeVariant[session.myBookingStatus]}>
            {getBookingStatusLabel(tBookingStatus, session.myBookingStatus)}
          </Badge>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noBooking')}</p>
        )}
      </div>

      {tourStatus !== TourStatusSchema.enum.cancelled && tourStatus !== TourStatusSchema.enum.completed && (
        <div className="mt-3">
          {cantGoRequested ? (
            <div className="space-y-3 rounded-md border p-3">
              <h4 className="text-sm font-semibold">{t('cantGoTitle')}</h4>
              <div className="space-y-1">
                <Label htmlFor={`cantgo-category-${session.id}`}>{t('cancelReasonCategory')}</Label>
                <Select value={cantGoCategory} onValueChange={(v) => setCantGoCategory(v as CancellationCategory)}>
                  <SelectTrigger id={`cantgo-category-${session.id}`}>
                    <SelectValue placeholder={t('cancelReasonCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cancelCategoryLabel[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cantgo-freetext-${session.id}`}>{t('cancelReasonFreeText')}</Label>
                <Textarea
                  id={`cantgo-freetext-${session.id}`}
                  value={cantGoFreeText}
                  onChange={(e) => setCantGoFreeText(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!cantGoCategory || acting}
                  onClick={() => void handleCantGoConfirmed()}
                >
                  {t('cantGoSubmit')}
                </Button>
                <Button variant="outline" size="sm" disabled={acting} onClick={() => setCantGoRequested(false)}>
                  {t('cancelReasonBack')}
                </Button>
              </div>
            </div>
          ) : cancelRequested ? (
            <div className="space-y-3 rounded-md border p-3">
              <h4 className="text-sm font-semibold">{t('cancelReasonTitle')}</h4>
              <div className="space-y-1">
                <Label htmlFor={`cancel-category-${session.id}`}>{t('cancelReasonCategory')}</Label>
                <Select value={cancelCategory} onValueChange={(v) => setCancelCategory(v as CancellationCategory)}>
                  <SelectTrigger id={`cancel-category-${session.id}`}>
                    <SelectValue placeholder={t('cancelReasonCategoryPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCEL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cancelCategoryLabel[cat]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`cancel-freetext-${session.id}`}>{t('cancelReasonFreeText')}</Label>
                <Textarea
                  id={`cancel-freetext-${session.id}`}
                  value={cancelFreeText}
                  onChange={(e) => setCancelFreeText(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={!cancelCategory || acting}
                  onClick={() => void handleCancelConfirmed()}
                >
                  {t('cancelReasonSubmit')}
                </Button>
                <Button variant="outline" size="sm" disabled={acting} onClick={() => setCancelRequested(false)}>
                  {t('cancelReasonBack')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {session.myBookingStatus === null && isBookable && (
                <Button size="sm" onClick={() => void handleBook()} disabled={acting}>
                  {t('book')}
                </Button>
              )}
              {session.myBookingStatus === BookingStatusSchema.enum.declined && isBookable && effectiveRemaining > 0 && (
                <Button size="sm" variant="outline" onClick={() => void handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                  {t('revert')}
                </Button>
              )}
              {session.myBookingStatus === BookingStatusSchema.enum.confirmed && canSelectMaybe && (
                <Button size="sm" variant="outline" onClick={() => void handleUpdate(BookingStatusSchema.enum.maybe)} disabled={acting}>
                  {t('setMaybe')}
                </Button>
              )}
              {session.myBookingStatus === BookingStatusSchema.enum.maybe && isBookable && (
                <Button size="sm" onClick={() => void handleUpdate(BookingStatusSchema.enum.confirmed)} disabled={acting}>
                  {t('confirmBooking')}
                </Button>
              )}
              {session.myBookingStatus === BookingStatusSchema.enum.confirmed && !isPastCancellationDeadline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCancelRequested(true)}
                  disabled={acting}
                >
                  {t('cancelBooking')}
                </Button>
              )}
              {(session.myBookingStatus === BookingStatusSchema.enum.maybe ||
                session.myBookingStatus === BookingStatusSchema.enum.waitlist) &&
                !isPastCancellationDeadline && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void handleUpdate(BookingStatusSchema.enum.declined)}
                  disabled={acting}
                >
                  {t('cancelBooking')}
                </Button>
              )}
              {isPastCancellationDeadline &&
                session.myBookingStatus !== null &&
                session.myBookingStatus !== BookingStatusSchema.enum.declined && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setCantGoRequested(true)}
                  disabled={acting}
                >
                  {t('cantGo')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {actionError && <p className="mt-2 text-sm text-destructive">{actionError}</p>}
    </div>
  )
}

'use client'

import { useId, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import type { TourListSessionResponse, TourResponse } from '@peace-buddy/types'
import { BookingStatusSchema, getTodayJst } from '@peace-buddy/types'
import { routes } from '@/lib/routes'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { bookingStatusBadgeVariant, getBookingStatusLabel } from '@/lib/status-display'
import { OPEN_TOURS_PREVIEW, buddiesNeeded } from '../buddy.home'
import { createInitialBooking, mapErrorToI18nKey } from '../tours/[id]/buddy.booking'
import { canSelectMaybeStatus, isPastDeadline } from '../lib/deadline'
import { BookingResponseButtons, type BookingResponse } from './booking-response-buttons'
import { formatDate } from '@/lib/format-date'
import { placeName, placeNames } from '@/lib/place-names'

// Answering straight from Home, one session at a time: 参加希望, 未定 or 参加不可,
// as on the tour page. Only 参加希望 takes a seat, so only it asks the buddy to
// confirm the time and place first. Changing a live booking stays on the tour page.
function SessionRow({
  tour,
  session,
  onBooked,
}: {
  tour: TourResponse
  session: TourListSessionResponse
  onBooked: () => void
}) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('tour')
  const tHome = useTranslations('home')
  const tDetail = useTranslations('tourDetail')
  const tBookingStatus = useTranslations('bookingStatus')
  const [confirming, setConfirming] = useState(false)
  const today = getTodayJst()
  const canMaybe = canSelectMaybeStatus(
    tour.maybeDeadline ? isPastDeadline(today, tour.maybeDeadline) : false,
    isPastDeadline(today, tour.cancellationDeadline),
  )
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const time = session.meetingTime.slice(11, 16)
  const needed = buddiesNeeded(session)

  const respond = async (response: BookingResponse) => {
    setActing(true)
    setError(null)
    const status = response === BookingStatusSchema.enum.confirmed ? undefined : response
    const result = await createInitialBooking(tour.id, session.id, status)
    setActing(false)
    if (result.ok) {
      setConfirming(false)
      onBooked()
    } else {
      setError(tDetail(result.specialMessage ?? mapErrorToI18nKey(result.error.code)))
    }
  }

  return (
    <div className="border-t pt-4 pb-1 first:border-t-0 first:pt-0 last:pb-0">
      {session.label && <p className="mb-1 text-sm font-medium text-foreground">{session.label}</p>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          {time}
          {session.myBookingStatus && (
            <Badge variant={bookingStatusBadgeVariant[session.myBookingStatus]}>
              {getBookingStatusLabel(tBookingStatus, session.myBookingStatus)}
            </Badge>
          )}
        </span>
        {needed > 0 ? (
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <Users size={14} />
            {tHome('open.needed', { count: needed })}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Users size={14} />
            {t('buddyCount')}: {session.minBuddies}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          {t('participantCount')}: {session.participantCount}
        </span>
      </div>
      {(session.myBookingStatus === null || session.myBookingStatus === BookingStatusSchema.enum.declined) &&
        (confirming ? (
          <div className="mt-2 flex flex-col gap-2 rounded-md border p-3">
            <p className="text-sm">{tHome('open.confirm', { time, place: placeName(session.place, locale) })}</p>
            <div className="flex gap-2">
              <Button size="sm" className="min-h-11" disabled={acting} onClick={() => void respond(BookingStatusSchema.enum.confirmed)}>
                {tHome('open.confirmBook')}
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" disabled={acting} onClick={() => setConfirming(false)}>
                {tHome('open.back')}
              </Button>
            </div>
          </div>
        ) : (
          <BookingResponseButtons
            className="mt-2"
            size="compact"
            current={session.myBookingStatus}
            canMaybe={canMaybe}
            disabled={acting}
            onRespond={(response) =>
              response === BookingStatusSchema.enum.confirmed ? setConfirming(true) : void respond(response)
            }
          />
        ))}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}

// `tours` is null until loaded, then expected already filtered to what the buddy
// can book, the tours most short of buddies first.
export function OpenTours({
  tours,
  error,
  onBooked,
}: {
  tours: TourResponse[] | null
  error: boolean
  onBooked: () => void
}) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('tour')
  const tHome = useTranslations('home')
  const [showAll, setShowAll] = useState(false)
  const headingId = useId()

  const list = tours ?? []
  const visible = showAll ? list : list.slice(0, OPEN_TOURS_PREVIEW)

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('title')}</h2>
      {error ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('loadError')}
        </p>
      ) : tours === null ? null : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTours')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((tour) => (
            <div key={tour.id} className="rounded-lg border bg-card p-4">
              <Link href={routes.buddyTour(locale, tour.id)} className="mb-3 block font-medium text-primary hover:underline">
                {tour.group.name}
              </Link>
              {/* Tour level: the date and the location are the same for every session */}
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {formatDate(tour.tourDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {placeNames(tour.places, locale)}
                </span>
              </div>
              {/* One section per session — buddy numbers and participants are per session, never summed */}
              <div className="flex flex-col gap-2">
                {tour.sessions.map((s) => (
                  <SessionRow key={s.id} tour={tour} session={s} onBooked={onBooked} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!error && list.length > OPEN_TOURS_PREVIEW && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          {showAll ? tHome('open.showFewer') : tHome('open.showAll', { count: list.length })}
        </button>
      )}
    </section>
  )
}

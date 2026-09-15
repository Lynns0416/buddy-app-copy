'use client'

import { useId, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import type { TourResponse } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { routes } from '@/lib/routes'
import { Badge } from '@/components/ui/badge'
import { bookingStatusBadgeVariant, getBookingStatusLabel } from '@/lib/status-display'
import { OPEN_TOURS_PREVIEW } from '../buddy.home'

// `tours` is null until loaded, then expected already filtered to what the buddy
// can book, nearest first.
export function OpenTours({ tours, error }: { tours: TourResponse[] | null; error: boolean }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('tour')
  const tHome = useTranslations('home')
  const tBookingStatus = useTranslations('bookingStatus')
  const [showAll, setShowAll] = useState(false)
  const headingId = useId()

  const list = tours ?? []
  const visible = showAll ? list : list.slice(0, OPEN_TOURS_PREVIEW)

  return (
    <section aria-labelledby={headingId}>
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
            <Link key={tour.id} href={routes.buddyTour(locale, tour.id)} className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors">
              <p className="mb-3 font-medium">{tour.group.name}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {tour.tourDate.slice(0, 10)}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Clock size={14} />
                  {tour.sessions.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5 pr-1.5">
                      {s.meetingTime.slice(11, 16)}
                      {/* declined means the buddy cancelled and can book again — on the card that is not booked */}
                      {s.myBookingStatus && s.myBookingStatus !== BookingStatusSchema.enum.declined && (
                        <Badge variant={bookingStatusBadgeVariant[s.myBookingStatus]}>
                          {getBookingStatusLabel(tBookingStatus, s.myBookingStatus)}
                        </Badge>
                      )}
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  {tour.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {t('capacity')}: {tour.sessions.reduce((sum, s) => sum + s.capacity, 0)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {t('participantCount')}: {tour.participantCount}
                </span>
              </div>
            </Link>
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

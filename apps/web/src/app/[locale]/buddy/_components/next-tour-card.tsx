'use client'

import { useId } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import type { MyTourBookingEntry } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { routes } from '@/lib/routes'
import { formatDate } from '@/lib/format-date'

export function NextTourCard({ entry }: { entry: MyTourBookingEntry | null }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('home')
  const headingId = useId()

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('nextTour.title')}</h2>
      {entry ? (
        <Link
          href={routes.buddyTour(locale, entry.tourId)}
          className="block rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
        >
          <p className="mb-3 font-medium">{entry.group.name}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={14} />
              {formatDate(entry.tourDate)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {entry.bookings
                .filter((b) => b.bookingStatus === BookingStatusSchema.enum.confirmed)
                .map((b) => b.meetingTime.slice(11, 16))
                .join(' / ')}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin size={14} />
              {entry.location}
            </span>
          </div>
        </Link>
      ) : (
        <p className="text-sm text-muted-foreground">{t('nextTour.empty')}</p>
      )}
    </section>
  )
}

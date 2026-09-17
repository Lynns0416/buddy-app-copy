'use client'

import { useId } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Clock, MapPin, UserRound, Users } from 'lucide-react'
import type { TourDetailResponse } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'
import { routes } from '@/lib/routes'

// Shown in place of the next-tour card on the day of the buddy's confirmed tour.
// Other buddies are a count, and staff in charge a name, by decision (#211).
export function TourDayPanel({ tour }: { tour: TourDetailResponse }) {
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('home')
  const tGroupType = useTranslations('groupType')
  const headingId = useId()

  const mySessions = tour.sessions.filter((s) => s.myBookingStatus === BookingStatusSchema.enum.confirmed)

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 text-base font-semibold">{t('tourDay.title')}</h2>
      <div className="rounded-lg border border-primary/40 bg-card p-4">
        <p className="font-medium">{tour.group.name}</p>
        <p className="mb-4 text-sm text-muted-foreground">{tGroupType(tour.group.type)}</p>

        <ul className="mb-4 space-y-3">
          {mySessions.map((s) => (
            <li key={s.id}>
              <p className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
                <Clock size={20} />
                {s.meetingTime.slice(11, 16)}
                {s.label && <span className="text-base font-normal text-muted-foreground">{s.label}</span>}
              </p>
              <p className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {t('tourDay.participants', { count: s.participantCount })}
                </span>
                <span>{t('tourDay.otherBuddies', { count: Math.max(0, s.seatCounts.confirmed - 1) })}</span>
              </p>
            </li>
          ))}
        </ul>

        <p className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <MapPin size={18} />
          {tour.location}
        </p>

        {tour.staffInCharge && (
          <p className="mb-4 flex items-center gap-2 text-sm">
            <UserRound size={14} />
            {t('tourDay.staffInCharge', { name: tour.staffInCharge.name })}
          </p>
        )}

        {tour.description && (
          <div className="mb-4">
            <h3 className="text-sm text-muted-foreground">{t('tourDay.brief')}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm">{tour.description}</p>
          </div>
        )}

        <Link href={routes.buddyTour(locale, tour.id)} className="text-sm font-medium text-primary hover:underline">
          {t('tourDay.details')}
        </Link>
      </div>
    </section>
  )
}

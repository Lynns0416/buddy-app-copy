'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, CalendarPlus, MapPin } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { triggerBlobDownload } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { TourStatusSchema, BookingStatusSchema, getTodayJst } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { useTourDetail } from '../../hooks/use-tour-detail'
import { downloadTourCalendar } from '../../buddy.tour'
import { SessionBookingCard } from './_components/session-booking-card'
import { TourSelfEvalSection } from '../../self-evaluations/_components/tour-self-eval-section'
import { formatDate } from '@/lib/format-date'

export default function TourDetailPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('tourDetail')
  const { tour, error: notFound, refetch } = useTourDetail(id, !loading && !!firebaseUser)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(false)

  if (loading) return null

  if (notFound || !tour) {
    return (
      <AppShell variant="buddy">
        <p className="text-sm text-muted-foreground">{t('notFound')}</p>
      </AppShell>
    )
  }

  const todayStr = getTodayJst()
  const isPastCancellationDeadline = tour.cancellationDeadline.slice(0, 10) < todayStr
  const showMaybeDeadline = tour.maybeDeadline && !isPastCancellationDeadline

  const hasConfirmedBooking = tour.sessions.some(
    (s) => s.myBookingStatus === BookingStatusSchema.enum.confirmed
  )

  const handleDownloadCalendar = async () => {
    setDownloading(true)
    setDownloadError(false)
    const result = await downloadTourCalendar(tour.id)
    if (result.ok) {
      triggerBlobDownload(result.data, `tour-${tour.id}.ics`)
    } else {
      setDownloadError(true)
    }
    setDownloading(false)
  }

  return (
    <AppShell variant="buddy">
      <div className="mb-6">
        <Link href={routes.buddy(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      {/* Tour info */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">{tour.group.name}</h1>
          {hasConfirmedBooking && (
            <Button size="sm" variant="outline" disabled={downloading} onClick={handleDownloadCalendar}>
              <CalendarPlus size={14} className="mr-1.5" />
              {t('addToCalendar')}
            </Button>
          )}
        </div>
        {downloadError && (
          <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {t('addToCalendarError')}
          </p>
        )}
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="flex items-center gap-1.5 font-medium">
              <CalendarDays size={14} className="text-muted-foreground" />
              {formatDate(tour.tourDate)}
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
            <dt className="text-muted-foreground">{t('participantCount')}</dt>
            <dd className="font-medium">{tour.participantCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('cancellationDeadline')}</dt>
            <dd className={`font-medium tabular-nums${isPastCancellationDeadline ? ' text-destructive' : ''}`}>
              {formatDate(tour.cancellationDeadline)}
            </dd>
          </div>
          {showMaybeDeadline && (
            <div>
              <dt className="text-muted-foreground">{t('maybeDeadline')}</dt>
              <dd className="font-medium tabular-nums">
                {tour.maybeDeadline ? formatDate(tour.maybeDeadline) : ''}
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

      {/* Sessions */}
      {dbUser && (
        <div className="mb-6 flex flex-col gap-4">
          {tour.sessions.map((session) => (
            <SessionBookingCard
              key={session.id}
              tourId={tour.id}
              session={session}
              totalSessions={tour.sessions.length}
              tourStatus={tour.status}
              bookingOpen={tour.bookingOpen}
              cancellationDeadline={tour.cancellationDeadline}
              maybeDeadline={tour.maybeDeadline}
              tourDate={tour.tourDate}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}

      {tour.status === TourStatusSchema.enum.completed && hasConfirmedBooking && (
        <div className="mt-6 rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-base font-semibold">{t('selfEvalTitle')}</h2>
          <TourSelfEvalSection tourId={id} />
        </div>
      )}
    </AppShell>
  )
}

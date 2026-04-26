'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { AppShell } from '@/components/app-shell'
import type { MyBookingEntry } from '@peace-buddy/types'

function BookingRow({ entry, viewLabel }: { entry: MyBookingEntry; viewLabel: string }) {
  const { locale } = useParams<{ locale: string }>()
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{entry.tour.group.name}</p>
        <p className="text-muted-foreground">
          {entry.tour.tourDate.slice(0, 10)} · {entry.tour.meetingTime.slice(11, 16)} · {entry.tour.location}
        </p>
      </div>
      <Link
        href={routes.dashboardTour(locale, entry.tourId)}
        className="shrink-0 text-sm font-medium text-primary hover:underline"
      >
        {viewLabel}
      </Link>
    </div>
  )
}

export default function BookingHistoryPage() {
  const { firebaseUser, loading } = useAuth()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('bookingHistory')

  const { bookings } = useMyBookings(!loading && !!firebaseUser)

  if (loading || (!bookings)) return null

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = bookings.filter((b) => b.tour.tourDate.slice(0, 10) >= today)
  const past = bookings.filter((b) => b.tour.tourDate.slice(0, 10) < today)

  return (
    <AppShell variant="buddy">
      <div className="mb-6">
        <Link href={routes.dashboard(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold">{t('upcoming')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noUpcoming')}</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => (
              <BookingRow key={b.id} entry={b} viewLabel={t('viewTour')} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">{t('past')}</h2>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noPast')}</p>
        ) : (
          <div className="space-y-2">
            {past.map((b) => (
              <BookingRow key={b.id} entry={b} viewLabel={t('viewTour')} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  )
}

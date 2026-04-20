'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { TourDetailResponse, BookingStatus } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'

const MY_STATUS_VARIANT: Record<BookingStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  confirmed: 'default',
  maybe: 'secondary',
  waitlist: 'outline',
  declined: 'destructive',
}

export default function TourDetailPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('tourDetail')
  const [tour, setTour] = useState<TourDetailResponse | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!loading && firebaseUser) {
      apiClient.getTour(id)
        .then(setTour)
        .catch(() => setNotFound(true))
    }
  }, [loading, firebaseUser, id])

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
        </div>
      )}
    </AppShell>
  )
}

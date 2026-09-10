'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { CalendarDays, MapPin, Users, Clock } from 'lucide-react'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { apiClient } from '@/lib/api-client'
import type { TourResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { fetchUpcomingTours } from './buddy.tour'
import { getTourStatusLabel, tourStatusBadgeVariant } from '@/lib/status-display'

export default function BuddyTourPage() {
  const { firebaseUser, dbUser, loading, setBuddyProfile } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('tour')
  const tTourStatus = useTranslations('tourStatus')
  const [tours, setTours] = useState<TourResponse[]>([])
  const sentToOnboarding = useRef(false)

  useEffect(() => {
    if (loading) return

    if (!firebaseUser) {
      router.replace(routes.login(locale))
      return
    }

    const profile = dbUser?.buddyProfile
    if (!profile) return

    if (profile.status === BuddyStatusSchema.enum.pending) {
      router.replace(routes.pending(locale))
      return
    }

    // An approved buddy still carries the display name upsertUser derived from
    // their email and an empty real name. Send them to their profile once, then
    // stamp the visit so the tour list is theirs from then on whether or not
    // they changed anything.
    const approved =
      profile.status === BuddyStatusSchema.enum.trainee || profile.status === BuddyStatusSchema.enum.active
    if (approved && !profile.onboardingSeenAt && !sentToOnboarding.current) {
      sentToOnboarding.current = true
      void apiClient
        .markOnboardingSeen()
        .then(setBuddyProfile)
        .catch(() => {
          // Leaving onboardingSeenAt unset sends them here again next visit,
          // which is the safe direction to fail in.
        })
      router.replace(routes.buddyProfileOnboarding(locale))
    }
  }, [loading, firebaseUser, dbUser, locale, router, setBuddyProfile])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.active) {
      const from = new Date().toISOString().split('T')[0]
      void fetchUpcomingTours(from).then((result) => {
        if (result.ok) setTours(result.data)
      })
    }
  }, [loading, firebaseUser, dbUser])

  if (loading || !dbUser) return null

  if (dbUser.buddyProfile?.status !== BuddyStatusSchema.enum.active) {
    const message =
      dbUser.buddyProfile?.status === BuddyStatusSchema.enum.trainee ? t('traineeMessage') : t('notRegistered')
    return (
      <AppShell variant="buddy">
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell variant="buddy">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      <div className="mb-6">
        <Link href={routes.buddyHistory(locale)} className="text-sm font-medium text-primary hover:underline">
          {t('myBookingsLink')}
        </Link>
      </div>

      {tours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTours')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {tours.map((tour) => (
            <Link key={tour.id} href={routes.buddyTour(locale, tour.id)} className="rounded-lg border bg-card p-4 hover:bg-accent transition-colors">
              <div className="mb-3 flex items-start justify-between gap-2">
                <p className="font-medium">{tour.group.name}</p>
                <Badge variant={tourStatusBadgeVariant[tour.status]} className="shrink-0">
                  {getTourStatusLabel(tTourStatus, tour.status)}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {tour.tourDate.slice(0, 10)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} />
                  {tour.sessions.map((s) => s.meetingTime.slice(11, 16)).join(' / ')}
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
    </AppShell>
  )
}

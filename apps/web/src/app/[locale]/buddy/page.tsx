'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../lib/auth'
import { routes } from '../../../lib/routes'
import { apiClient } from '@/lib/api-client'
import type { TourDetailResponse, TourReflectionResponse, TourResponse } from '@peace-buddy/types'
import { BuddyStatusSchema, getTodayJst } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { useMyBookings } from '@/hooks/use-my-bookings'
import { fetchUpcomingTours } from './buddy.tour'
import { bookableTours, findActionItems, findUpcomingConfirmed, isTourDay } from './buddy.home'
import { buildRecord } from './record/buddy.record'
import { UpcomingTours } from './_components/upcoming-tours'
import { TourDayPanel } from './_components/tour-day-panel'
import { ActionItems } from './_components/action-items'
import { RecordAhead } from './_components/record-ahead'
import { OpenTours } from './_components/open-tours'
import { BuddyLinks } from './_components/buddy-links'

// Home by the buddy's situation (#265, PRD §11.1): the tour-day panel on the
// day; anything owed, kept short; for a buddy who has toured, the note carried
// to the next tour and the next milestone; then the tours to book, the most
// short of buddies first. Their own confirmed tours and the reference links
// close the page.

export default function BuddyHomePage() {
  const { firebaseUser, dbUser, loading, setBuddyProfile } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('tour')
  const tHome = useTranslations('home')
  const [tours, setTours] = useState<TourResponse[] | null>(null)
  const [toursError, setToursError] = useState(false)
  const [toursVersion, setToursVersion] = useState(0)
  const [reflections, setReflections] = useState<TourReflectionResponse[] | null>(null)
  const [tourDayDetail, setTourDayDetail] = useState<TourDetailResponse | null>(null)
  const sentToOnboarding = useRef(false)

  // A buddy not yet sent to their profile is redirected there, so nothing is fetched for them.
  const isActive =
    !loading &&
    !!firebaseUser &&
    dbUser?.buddyProfile?.status === BuddyStatusSchema.enum.active &&
    !!dbUser.buddyProfile.onboardingSeenAt
  const { bookings, error: bookingsError, reload: reloadBookings } = useMyBookings(isActive)

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
    // stamp the visit so the home screen is theirs from then on whether or not
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
    if (isActive) {
      void fetchUpcomingTours(getTodayJst()).then((result) => {
        if (result.ok) setTours(result.data)
        else setToursError(true)
      })
    }
  }, [isActive, toursVersion])

  useEffect(() => {
    if (!isActive) return
    apiClient
      .listMyReflections()
      .then(setReflections)
      .catch(() => {
        // Without reflections Home leaves out the record part; the rest still works.
      })
  }, [isActive])

  const onBooked = () => {
    setToursVersion((v) => v + 1)
    reloadBookings()
  }

  // On the day of the next confirmed tour, the panel needs the tour's detail.
  // Until it loads, or if it fails, the usual next-tour card stands in.
  const today = getTodayJst()
  const upcoming = bookings ? findUpcomingConfirmed(bookings, today) : []
  const nextTour = upcoming[0] ?? null
  const tourDayId = isTourDay(nextTour, today) ? nextTour.tourId : null
  useEffect(() => {
    if (!tourDayId) return
    let cancelled = false
    apiClient
      .getTour(tourDayId)
      .then((tour) => {
        if (!cancelled) setTourDayDetail(tour)
      })
      .catch(() => {
        // The next-tour card stays, which still gives time and place.
      })
    return () => {
      cancelled = true
    }
  }, [tourDayId])

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

  const showTourDay = tourDayDetail !== null && tourDayDetail.id === tourDayId
  const record = bookings && reflections ? buildRecord(bookings, reflections, today) : null

  return (
    <AppShell variant="buddy">
      <h1 className="mb-6 text-xl font-semibold">{tHome('title')}</h1>

      {bookingsError && (
        <p role="alert" className="mb-8 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {tHome('bookingsLoadError')}
        </p>
      )}
      {showTourDay && <TourDayPanel tour={tourDayDetail} />}
      {bookings && <ActionItems items={findActionItems(bookings, today)} />}
      {record && <RecordAhead record={record} />}

      <OpenTours tours={tours && bookableTours(tours, today)} error={toursError} onBooked={onBooked} />

      {bookings && <UpcomingTours entries={showTourDay ? upcoming.slice(1) : upcoming} />}
      <BuddyLinks />
    </AppShell>
  )
}

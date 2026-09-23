'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import type { TourReflectionResponse } from '@peace-buddy/types'
import { formatDate } from '@/lib/format-date'
import { useTourDetail } from '../../../hooks/use-tour-detail'
import { listMyReflections } from './reflection'
import { mapReflectionError } from './reflection-form-state'
import { SessionReflection } from './_components/session-reflection'

export default function TourReflectionPage() {
  const { firebaseUser, loading } = useAuth()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('reflections')
  const tt = useTranslations('tourDetail')
  const { tour, error: notFound } = useTourDetail(id, !loading && !!firebaseUser)
  const [reflections, setReflections] = useState<TourReflectionResponse[] | null>(null)
  const [loadErrorCode, setLoadErrorCode] = useState<string | null>(null)

  useEffect(() => {
    if (loading || !firebaseUser) return
    listMyReflections({ tourId: id }).then((result) => {
      if (result.ok) setReflections(result.data)
      else setLoadErrorCode(result.error.code)
    })
  }, [id, loading, firebaseUser])

  if (loading) return null

  if (notFound || !tour) {
    return (
      <AppShell variant="buddy">
        <p className="text-sm text-muted-foreground">{tt('notFound')}</p>
      </AppShell>
    )
  }

  // Only sessions the buddy actually guided can be reflected on — the API
  // refuses the rest, so the page does not offer them.
  const mySessions = tour.sessions.filter(
    (s) => s.myBookingStatus === BookingStatusSchema.enum.confirmed,
  )
  const eligible = tour.status === TourStatusSchema.enum.completed && mySessions.length > 0

  return (
    <AppShell variant="buddy">
      <div className="mb-6">
        <Link
          href={routes.buddyTour(locale, id)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t('backToTour')}
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">
          {tour.group.name} · {formatDate(tour.tourDate)}
        </p>
      </div>

      {loadErrorCode && (
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {mapReflectionError(t, loadErrorCode)}
        </p>
      )}

      {!eligible && <p className="text-sm text-muted-foreground">{t('notEligible')}</p>}

      {eligible && reflections && (
        <div className="flex flex-col gap-4">
          {mySessions.map((session) => (
            <SessionReflection
              key={session.id}
              sessionId={session.id}
              heading={
                session.label ??
                (tour.sessions.length > 1 ? tt(`session.defaultLabel.${session.order}`) : null)
              }
              existing={reflections.find((r) => r.sessionId === session.id) ?? null}
            />
          ))}
        </div>
      )}
    </AppShell>
  )
}

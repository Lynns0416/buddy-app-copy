'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { TourStatusSchema, TourActionSchema, AppErrorCodeSchema, BookingStatusSchema } from '@peace-buddy/types'
import type { AdminTourDetailResponse, TourAction, AppError } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { fetchTour, transitionTour, toggleTourBooking, deleteTour, removeTourSession } from '../admin.tour'
import { getTourStatusLabel, tourStatusBadgeVariant } from '@/lib/status-display'
import { TourBookingsTable } from '../_components/tour-bookings-table'
import { TourBuddyEvalSection } from '../_components/tour-buddy-eval-section'
import { CompleteTourModal } from '../_components/complete-tour-modal'
import { TierCapacityForm } from '../_components/tier-capacity-form'
import { AddSessionForm } from '../_components/add-session-form'

export default function AdminTourDetailPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const tTourStatus = useTranslations('tourStatus')
  const tEval = useTranslations('adminEvaluations')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [showAddSession, setShowAddSession] = useState(false)

  function errorMessage(error: AppError): string {
    switch (error.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  useEffect(() => {
    if (!ready) return
    fetchTour(id).then((result) => {
      if (result.ok) setTour(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready, id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTransition(action: TourAction, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setActing(true)
    setActionError(null)
    const result = await transitionTour(id, action)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  async function handleComplete() {
    setCompleteModalOpen(false)
    setActing(true)
    setActionError(null)
    const result = await transitionTour(id, TourActionSchema.enum.complete)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  async function handleToggleBooking() {
    if (!tour) return
    setActing(true)
    setActionError(null)
    const result = await toggleTourBooking(id, tour.bookingOpen)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDelete'))) return
    setActing(true)
    setActionError(null)
    const result = await deleteTour(id)
    if (result.ok) router.push(routes.adminTours(locale))
    else {
      setActionError(errorMessage(result.error))
      setActing(false)
    }
  }

  async function handleRemoveSession(sessionId: string) {
    if (!window.confirm(t('session.confirmRemove'))) return
    setActing(true)
    setActionError(null)
    const result = await removeTourSession(id, sessionId)
    if (result.ok) setTour(result.data)
    else setActionError(errorMessage(result.error))
    setActing(false)
  }

  const isEditable = tour
    ? tour.status === TourStatusSchema.enum.draft || tour.status === TourStatusSchema.enum.published
    : false

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!tour) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link href={routes.adminTours(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
        {isEditable && (
          <Button asChild size="sm">
            <Link href={routes.adminTourEdit(locale, tour.id)}>{t('edit')}</Link>
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{actionError}</p>
      )}

      {/* Tour detail */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{tour.group.name}</h1>
          <Badge variant={tourStatusBadgeVariant[tour.status]}>{getTourStatusLabel(tTourStatus, tour.status)}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="font-medium tabular-nums">{tour.tourDate.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('location')}</dt>
            <dd className="font-medium">{tour.location}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('capacity')}</dt>
            <dd className="font-medium">{tour.capacity}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('cancellationDeadline')}</dt>
            <dd className="font-medium tabular-nums">{tour.cancellationDeadline.slice(0, 10)}</dd>
          </div>
          {tour.maybeDeadline && (
            <div>
              <dt className="text-muted-foreground">{t('maybeDeadline')}</dt>
              <dd className="font-medium tabular-nums">{tour.maybeDeadline.slice(0, 10)}</dd>
            </div>
          )}
          {tour.description && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('description')}</dt>
              <dd className="font-medium whitespace-pre-wrap">{tour.description}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">{t('bookingOpen')}</dt>
            <dd className="font-medium">{tour.bookingOpen ? t('bookingOpenYes') : t('bookingOpenNo')}</dd>
          </div>
          {tour.adminMemo && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('adminMemo')}</dt>
              <dd className="font-medium whitespace-pre-wrap">{tour.adminMemo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Sessions */}
      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{t('session.defaultLabel.1')} / {t('session.defaultLabel.2')}</h2>
        <div className="flex flex-col gap-3">
          {tour.sessions.map((session) => (
            <div key={session.id} className="rounded-md border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold">
                  {session.label ?? (tour.sessions.length > 1 ? t(`session.defaultLabel.${session.order}`) : null)}
                </p>
                {isEditable && session.order > 1 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    disabled={acting}
                    onClick={() => void handleRemoveSession(session.id)}
                  >
                    {t('session.remove')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <span>{t('meetingTime')}: {session.meetingTime.slice(11, 16)}</span>
                <span>{t('capacity')}: {session.capacity}</span>
                <span>{t('participantCount')}: {session.participantCount}</span>
              </div>
            </div>
          ))}

          {isEditable && tour.sessions.length < 2 && !showAddSession && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setShowAddSession(true)}
            >
              {t('session.add')}
            </Button>
          )}

          {showAddSession && (
            <AddSessionForm
              tourId={tour.id}
              onAdded={(updated) => { setTour(updated); setShowAddSession(false) }}
              onCancel={() => setShowAddSession(false)}
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {isEditable && (
          <Button
            size="sm"
            variant={tour.bookingOpen ? 'secondary' : 'outline'}
            disabled={acting}
            onClick={handleToggleBooking}
          >
            {tour.bookingOpen ? t('closeBooking') : t('openBooking')}
          </Button>
        )}
        {tour.status === TourStatusSchema.enum.draft && (
          <>
            <Button size="sm" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.publish)}>
              {t('publish')}
            </Button>
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.cancel, t('confirmCancel'))}>
              {t('cancelTour')}
            </Button>
            <Button size="sm" variant="destructive" disabled={acting} onClick={handleDelete}>
              {t('deleteTour')}
            </Button>
          </>
        )}
        {tour.status === TourStatusSchema.enum.published && (
          <>
            <Button size="sm" disabled={acting} onClick={() => setCompleteModalOpen(true)}>
              {t('completeTour')}
            </Button>
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.cancel, t('confirmCancel'))}>
              {t('cancelTour')}
            </Button>
          </>
        )}
      </div>

      {/* Tier capacity per session */}
      <div className="mb-6 flex flex-col gap-4">
        {tour.sessions.map((session) => (
          <TierCapacityForm
            key={session.id}
            tourId={tour.id}
            sessionId={session.id}
            sessionOrder={session.order}
            sessionLabel={session.label}
            totalSessions={tour.sessions.length}
            capacity={session.capacity}
          />
        ))}
      </div>

      {/* Bookings */}
      <h2 className="mb-3 text-base font-semibold">{t('bookings')}</h2>
      <TourBookingsTable bookings={tour.bookings} totalSessions={tour.sessions.length} />

      {tour.status === TourStatusSchema.enum.completed && (
        <>
          <h2 className="mt-8 mb-3 text-base font-semibold">{tEval('sections.perTourEvaluations')}</h2>
          <TourBuddyEvalSection tourId={tour.id} bookings={tour.bookings} />
        </>
      )}

      <CompleteTourModal
        open={completeModalOpen}
        confirmedBuddies={tour.bookings
          .filter((b) => b.status === BookingStatusSchema.enum.confirmed)
          .map((b) => b.displayName)}
        loading={acting}
        onConfirm={() => void handleComplete()}
        onCancel={() => setCompleteModalOpen(false)}
      />
    </AppShell>
  )
}

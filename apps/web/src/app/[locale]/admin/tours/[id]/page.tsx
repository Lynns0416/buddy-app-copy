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
import { fetchTour, transitionTour, toggleTourBooking, deleteTour, removeTourSession, downloadTourCalendar } from '../admin.tour'
import { triggerBlobDownload } from '@/lib/api'
import { getTourStatusLabel, tourStatusBadgeVariant } from '@/lib/status-display'
import { placeName, placeNames } from '@/lib/place-names'
import { TourBookingsTable } from '../_components/tour-bookings-table'
import { TourBuddyEvalSection } from '../_components/tour-buddy-eval-section'
import { CompleteTourModal } from '../_components/complete-tour-modal'
import { TierCapacityForm } from '../_components/tier-capacity-form'
import { AddSessionForm } from '../_components/add-session-form'
import { BelowMinimumBadge } from '../_components/below-minimum-badge'
import { TourAdminAssignment } from '../_components/tour-admin-assignment'
import { useAllAdmins } from '../hooks/use-all-admins'
import { formatDate } from '@/lib/format-date'
import { MarkdownText } from '@/components/markdown-text'

export default function AdminTourDetailPage() {
  const { ready, locale } = useAdminGuard()
  const allAdmins = useAllAdmins()
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
    if (!window.confirm(t(tour.bookingOpen ? 'confirmCloseBooking' : 'confirmOpenBooking'))) return
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

  async function handleDownloadCalendar() {
    setActing(true)
    setActionError(null)
    const result = await downloadTourCalendar(id)
    if (result.ok) triggerBlobDownload(result.data, `tour-${id}.ics`)
    else setActionError(errorMessage(result.error))
    setActing(false)
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

  const firstSession = tour.sessions.find((s) => s.order === 1)

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
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('tourDate')}</dt>
            <dd className="font-medium tabular-nums">{formatDate(tour.tourDate)}</dd>
          </div>
          {firstSession?.startTime && (
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">{t('startTime')}</dt>
              <dd className="font-medium tabular-nums">{firstSession.startTime.slice(11, 16)}</dd>
            </div>
          )}
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('location')}</dt>
            <dd className="font-medium">{placeNames(tour.places, locale)}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('capacity')}</dt>
            <dd className="font-medium">{tour.capacity}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('participantCount')}</dt>
            <dd className="font-medium">{tour.participantCount}</dd>
          </div>
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('cancellationDeadline')}</dt>
            <dd className="font-medium tabular-nums">{formatDate(tour.cancellationDeadline)}</dd>
          </div>
          {tour.maybeDeadline && (
            <div>
              <dt className="mb-1 text-xs text-muted-foreground">{t('maybeDeadline')}</dt>
              <dd className="font-medium tabular-nums">{formatDate(tour.maybeDeadline)}</dd>
            </div>
          )}
          {tour.description && (
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs text-muted-foreground">{t('description')}</dt>
              <dd className="font-medium"><MarkdownText>{tour.description}</MarkdownText></dd>
            </div>
          )}
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">{t('bookingOpen')}</dt>
            <dd className="font-medium">{tour.bookingOpen ? t('bookingOpenYes') : t('bookingOpenNo')}</dd>
          </div>
          {tour.adminMemo && (
            <div className="sm:col-span-2">
              <dt className="mb-1 text-xs text-muted-foreground">{t('adminMemo')}</dt>
              <dd className="font-medium"><MarkdownText>{tour.adminMemo}</MarkdownText></dd>
            </div>
          )}
        </dl>
      </div>

      {/* Sessions */}
      <div className="mb-6 flex flex-col gap-4">
        {tour.sessions.map((session) => {
          const sessionLabel = session.label ?? (tour.sessions.length > 1 ? t(`session.defaultLabel.${session.order}`) : null)
          return (
            <div key={session.id} className="rounded-lg border bg-card p-6">
              {(sessionLabel || (isEditable && session.order > 1)) && (
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-base font-semibold">{sessionLabel}</p>
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
              )}
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('location')}</div>
                    <div className="font-medium">{placeName(session.place, locale)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('meetingTime')}</div>
                    <div className="font-medium tabular-nums">{session.meetingTime.slice(11, 16)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('capacity')}</div>
                    <div className="font-medium tabular-nums">{session.capacity}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('minBuddies')}</div>
                    <div className="font-medium tabular-nums">{session.minBuddies ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">{t('participantCount')}</div>
                    <div className="font-medium tabular-nums flex items-center gap-2">
                      <span>{session.participantCount}</span>
                      {session.belowMinimum && <BelowMinimumBadge />}
                    </div>
                  </div>
                </div>
                <TierCapacityForm
                  tourId={tour.id}
                  sessionId={session.id}
                  capacity={session.capacity}
                />
              </div>
            </div>
          )
        })}

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

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={acting} onClick={handleDownloadCalendar}>
          {t('addToCalendar')}
        </Button>
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

      {/* Admin assignment */}
      <div className="mb-6">
        <TourAdminAssignment
          tourId={tour.id}
          assignedAdmins={tour.assignedAdmins}
          staffInChargeId={tour.staffInChargeId}
          allAdmins={allAdmins}
          onUpdate={setTour}
        />
      </div>

      {/* Bookings */}
      <h2 className="mb-3 text-base font-semibold">{t('bookings')}</h2>
      <TourBookingsTable bookings={tour.bookings} totalSessions={tour.sessions.length} />

      {tour.status === TourStatusSchema.enum.completed && (
        <>
          <h2 className="mt-8 mb-3 text-base font-semibold">{tEval('sections.perTourEvaluations')}</h2>
          <TourBuddyEvalSection tourId={tour.id} bookings={tour.bookings} />
          <h2 className="mt-8 mb-3 text-base font-semibold">{t('reflections.title')}</h2>
          <Link
            href={routes.adminReflectionStats(locale, tour.id)}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            {t('reflections.view')}
          </Link>
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

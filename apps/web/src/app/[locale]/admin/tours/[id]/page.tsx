'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import { TourStatusSchema, TourActionSchema } from '@peace-buddy/types'
import type { AdminTourDetailResponse, TourStatus, TourAction } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_VARIANT: Record<TourStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

export default function AdminTourDetailPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!ready) return
    apiClient.getAdminTour(id)
      .then(setTour)
      .catch(() => setFetchError(t('actionError')))
  }, [ready, id, t])

  async function handleTransition(action: TourAction, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setActing(true)
    setActionError(null)
    try {
      const updated = await apiClient.transitionAdminTourStatus(id, action)
      setTour(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('actionError'))
    } finally {
      setActing(false)
    }
  }

  async function handleToggleBooking() {
    if (!tour) return
    setActing(true)
    setActionError(null)
    try {
      const updated = await apiClient.updateAdminTour(id, { bookingOpen: !tour.bookingOpen })
      setTour(updated)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('actionError'))
    } finally {
      setActing(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('confirmDelete'))) return
    setActing(true)
    setActionError(null)
    try {
      await apiClient.deleteAdminTour(id)
      router.push(routes.adminTours(locale))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('actionError'))
      setActing(false)
    }
  }

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!tour) return null

  const statusLabel = t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link href={routes.adminTours(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
        {(tour.status === TourStatusSchema.enum.draft || tour.status === TourStatusSchema.enum.published) && (
          <Button asChild size="sm">
            <Link href={routes.adminTourEdit(locale, tour.id)}>{t('edit')}</Link>
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{actionError}</p>
      )}

      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{tour.group.name}</h1>
          <Badge variant={STATUS_VARIANT[tour.status]}>{statusLabel}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{t('tourDate')}</dt>
            <dd className="font-medium tabular-nums">{tour.tourDate.slice(0, 10)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('meetingTime')}</dt>
            <dd className="font-medium tabular-nums">{tour.meetingTime.slice(11, 16)}</dd>
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

      <div className="mb-6 flex flex-wrap gap-2">
        {(tour.status === TourStatusSchema.enum.draft || tour.status === TourStatusSchema.enum.published) && (
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
            <Button size="sm" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.complete, t('confirmComplete'))}>
              {t('completeTour')}
            </Button>
            <Button size="sm" variant="outline" disabled={acting} onClick={() => handleTransition(TourActionSchema.enum.cancel, t('confirmCancel'))}>
              {t('cancelTour')}
            </Button>
          </>
        )}
      </div>

      <h2 className="mb-3 text-base font-semibold">{t('bookings')}</h2>
      {tour.bookings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noBookings')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('buddyName')}</TableHead>
                <TableHead>{t('bookingStatus')}</TableHead>
                <TableHead>{t('bookedAt')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tour.bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.displayName}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{b.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {new Date(b.bookedAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}

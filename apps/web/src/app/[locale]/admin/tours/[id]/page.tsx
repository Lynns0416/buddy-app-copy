'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../../lib/auth'
import { routes } from '../../../../../lib/routes'
import { apiRequest } from '../../../../../lib/api'
import type { AdminTourDetailResponse, TourStatus } from '@peace-buddy/types'
import { UserRoleSchema } from '@peace-buddy/types'
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
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale, id } = useParams<{ locale: string; id: string }>()
  const t = useTranslations('adminTours')
  const [tour, setTour] = useState<AdminTourDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.role !== UserRoleSchema.enum.admin && dbUser.role !== UserRoleSchema.enum.super_admin) {
        router.replace(routes.home(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser && (dbUser.role === UserRoleSchema.enum.admin || dbUser.role === UserRoleSchema.enum.super_admin)) {
      apiRequest<AdminTourDetailResponse>(`/admin/tours/${id}`)
        .then(setTour)
        .catch(() => setFetchError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser, id])

  async function handleTransition(action: 'publish' | 'cancel' | 'complete', confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return
    setActing(true)
    setActionError(null)
    try {
      const updated = await apiRequest<AdminTourDetailResponse>(`/admin/tours/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      })
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
      await apiRequest<void>(`/admin/tours/${id}`, { method: 'DELETE' })
      router.push(routes.adminTours(locale))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('actionError'))
      setActing(false)
    }
  }

  if (loading || !dbUser) return null

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
        {(tour.status === 'draft' || tour.status === 'published') && (
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
          {tour.adminMemo && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('adminMemo')}</dt>
              <dd className="font-medium whitespace-pre-wrap">{tour.adminMemo}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Status actions */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tour.status === 'draft' && (
          <>
            <Button
              size="sm"
              disabled={acting}
              onClick={() => handleTransition('publish')}
            >
              {t('publish')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={acting}
              onClick={() => handleTransition('cancel', t('confirmCancel'))}
            >
              {t('cancelTour')}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={acting}
              onClick={handleDelete}
            >
              {t('deleteTour')}
            </Button>
          </>
        )}
        {tour.status === 'published' && (
          <>
            <Button
              size="sm"
              disabled={acting}
              onClick={() => handleTransition('complete', t('confirmComplete'))}
            >
              {t('completeTour')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={acting}
              onClick={() => handleTransition('cancel', t('confirmCancel'))}
            >
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

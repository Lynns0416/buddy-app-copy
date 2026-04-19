'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import { apiRequest } from '../../../../lib/api'
import type { AdminTourSummaryResponse, TourStatus } from '@peace-buddy/types'
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

export default function AdminToursPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminTours')
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

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
      apiRequest<AdminTourSummaryResponse[]>('/admin/tours')
        .then(setTours)
        .catch(() => setFetchError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser])

  if (loading || !dbUser) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button asChild size="sm">
          <Link href={routes.adminTourNew(locale)}>{t('newTour')}</Link>
        </Button>
      </div>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {tours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tourDate')}</TableHead>
                <TableHead>{t('group')}</TableHead>
                <TableHead>{t('location')}</TableHead>
                <TableHead>{t('capacity')}</TableHead>
                <TableHead>{t('confirmedCount')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tours.map((tour) => (
                <TableRow key={tour.id}>
                  <TableCell className="tabular-nums">{tour.tourDate.slice(0, 10)}</TableCell>
                  <TableCell>{tour.group.name}</TableCell>
                  <TableCell>{tour.location}</TableCell>
                  <TableCell>{tour.capacity}</TableCell>
                  <TableCell>{tour.confirmedCount}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[tour.status]}>{t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={routes.adminTourDetail(locale, tour.id)}>{t('edit')}</Link>
                    </Button>
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

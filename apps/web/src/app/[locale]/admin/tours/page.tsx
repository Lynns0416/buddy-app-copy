'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { AdminTourSummaryResponse, TourStatus } from '@peace-buddy/types'
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
  const { ready, locale } = useAdminGuard()
  const t = useTranslations('adminTours')
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    apiClient.listAdminTours()
      .then(setTours)
      .catch(() => setFetchError(t('actionError')))
  }, [ready, t])

  if (!ready) return null

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
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {tours.map((tour) => (
              <div key={tour.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-sm font-medium">{tour.tourDate.slice(0, 10)}</span>
                  <Badge variant={STATUS_VARIANT[tour.status]}>
                    {t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')}
                  </Badge>
                </div>
                <p className="mb-2 font-medium">{tour.group.name}</p>
                <p className="mb-3 text-sm text-muted-foreground">{tour.location}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('confirmedCount')} {tour.confirmedCount} / {tour.capacity}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={routes.adminTourDetail(locale, tour.id)}>{t('edit')}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* sm+: scrollable table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">{t('tourDate')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('group')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('location')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('capacity')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('confirmedCount')}</TableHead>
                  <TableHead className="whitespace-nowrap">{t('status')}</TableHead>
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
                      <Badge variant={STATUS_VARIANT[tour.status]}>
                        {t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')}
                      </Badge>
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
        </>
      )}
    </AppShell>
  )
}

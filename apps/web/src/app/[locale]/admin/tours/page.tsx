'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminTourSummaryResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchTours, sortTours, nextTourListSort, type TourListSortField } from './admin.tour'
import { BelowMinimumBadge } from './_components/below-minimum-badge'
import { getTourStatusLabel, tourStatusBadgeVariant } from '@/lib/status-display'
import { getTodayLocal } from '@/lib/date'
import { TodayDivider } from './_components/today-divider'

export default function AdminToursPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminTours')
  const tTourStatus = useTranslations('tourStatus')
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<TourListSortField>('tourDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
    fetchTours().then((result) => {
      if (result.ok) setTours(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: TourListSortField) {
    const next = nextTourListSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortTours(tours, sortField, sortDir)
  const todayStr = getTodayLocal()
  const isUpcoming = (tour: AdminTourSummaryResponse) => tour.tourDate.slice(0, 10) >= todayStr
  const dividerEnabled = sortField === 'tourDate'

  const desktopColumns = [
    { field: 'tourDate' as const, label: t('tourDate') },
    { field: 'group' as const, label: t('group') },
    { field: 'location' as const, label: t('location') },
    { field: 'capacity' as const, label: t('capacity') },
    { field: 'participantCount' as const, label: t('participantCount') },
    { field: 'confirmedCount' as const, label: t('confirmedCount') },
    { field: 'status' as const, label: t('status') },
  ]
  const desktopColSpan = desktopColumns.length + 1

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

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="lg:hidden space-y-2">
            <div className="flex flex-wrap gap-2 mb-3">
              {([
                { field: 'tourDate' as const, label: t('tourDate') },
                { field: 'group' as const, label: t('group') },
                { field: 'status' as const, label: t('status') },
              ]).map(({ field, label }) => (
                <button
                  key={field}
                  className="inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort(field)}
                >
                  {label}
                  <SortIcon active={sortField === field} dir={sortDir} />
                </button>
              ))}
            </div>
            {sorted.map((tour, idx) => {
              const showDivider = dividerEnabled && idx > 0 && isUpcoming(tour) !== isUpcoming(sorted[idx - 1])
              return (
                <Fragment key={tour.id}>
                  {showDivider && (
                    <div className="py-1">
                      <TodayDivider date={todayStr} label={t('todayDivider')} />
                    </div>
                  )}
                  <div
                    className="rounded-lg border bg-card p-4 cursor-pointer active:bg-muted/50"
                    onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{tour.group.name}</p>
                        <p className="tabular-nums text-sm text-muted-foreground">{tour.tourDate.slice(0, 10)}</p>
                      </div>
                      <Badge variant={tourStatusBadgeVariant[tour.status]}>
                        {getTourStatusLabel(tTourStatus, tour.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{tour.location}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{t('capacity')}: {tour.capacity}</span>
                      <span>{t('participantCount')}: {tour.participantCount}</span>
                      <span>{t('confirmedCount')}: {tour.confirmedCount}</span>
                      {tour.sessions.some((s) => s.belowMinimum) && <BelowMinimumBadge />}
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {desktopColumns.map(({ field, label }) => (
                    <TableHead key={field} className="whitespace-nowrap">
                      <button
                        className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                        onClick={() => handleSort(field)}
                      >
                        {label}
                        <SortIcon active={sortField === field} dir={sortDir} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((tour, idx) => {
                  const showDivider = dividerEnabled && idx > 0 && isUpcoming(tour) !== isUpcoming(sorted[idx - 1])
                  return (
                    <Fragment key={tour.id}>
                      {showDivider && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={desktopColSpan} className="py-1">
                            <TodayDivider date={todayStr} label={t('todayDivider')} />
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
                      >
                        <TableCell className="tabular-nums text-sm">{tour.tourDate.slice(0, 10)}</TableCell>
                        <TableCell className="font-medium">{tour.group.name}</TableCell>
                        <TableCell>{tour.location}</TableCell>
                        <TableCell className="text-center">{tour.capacity}</TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-2">
                            <span className="tabular-nums">{tour.participantCount}</span>
                            {tour.sessions.some((s) => s.belowMinimum) && <BelowMinimumBadge />}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{tour.confirmedCount}</TableCell>
                        <TableCell>
                          <Badge variant={tourStatusBadgeVariant[tour.status]}>
                            {getTourStatusLabel(tTourStatus, tour.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button asChild variant="outline" size="sm">
                            <Link href={routes.adminTourDetail(locale, tour.id)}>{t('edit')}</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  )
}

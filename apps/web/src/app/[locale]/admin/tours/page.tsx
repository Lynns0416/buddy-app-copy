'use client'

import { Fragment, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { AdminTourSummaryResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema, getTodayJst } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { placeName, placeNames } from '@/lib/place-names'
import {
  fetchTours,
  sortTours,
  nextTourListSort,
  filterTours,
  isTourFilterActive,
  tourFiltersFromParams,
  tourPageToParams,
  tourViewFromParams,
  tourMonthFromParams,
  TourViewSchema,
  type TourFilters,
  type TourListSortField,
  type TourView,
} from './admin.tour'
import { BelowMinimumBadge } from './_components/below-minimum-badge'
import { TourFilterBar } from './_components/tour-filters'
import { getTourStatusLabel, tourStatusBadgeVariant } from '@/lib/status-display'
import { TodayDivider } from './_components/today-divider'
import { TourCalendar } from './_components/tour-calendar'
import { formatDate } from '@/lib/format-date'

export default function AdminToursPage() {
  return (
    <Suspense>
      <AdminToursList />
    </Suspense>
  )
}

function AdminToursList() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations('adminTours')
  const tTourStatus = useTranslations('tourStatus')
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<TourListSortField>('tourDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filters, setFilters] = useState<TourFilters>(() => tourFiltersFromParams(new URLSearchParams(searchParams.toString())))
  const [view, setView] = useState<TourView>(() => tourViewFromParams(new URLSearchParams(searchParams.toString())))
  const [month, setMonth] = useState<string>(() => tourMonthFromParams(new URLSearchParams(searchParams.toString()), getTodayJst()))

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

  const todayStr = getTodayJst()

  // Replace rather than push: a history entry per keystroke would make Back unusable.
  function syncUrl(next: { filters?: TourFilters; view?: TourView; month?: string }) {
    const nextFilters = next.filters ?? filters
    const nextView = next.view ?? view
    const nextMonth = next.month ?? month
    if (next.filters !== undefined) setFilters(next.filters)
    if (next.view !== undefined) setView(next.view)
    if (next.month !== undefined) setMonth(next.month)
    const query = tourPageToParams(nextFilters, nextView, nextMonth, todayStr).toString()
    window.history.replaceState(null, '', query ? `${pathname}?${query}` : pathname)
  }

  const isCalendar = view === TourViewSchema.enum.calendar
  const filtered = filterTours(tours, filters, todayStr)
  const sorted = sortTours(filtered, sortField, sortDir, locale)
  const filtersActive = isTourFilterActive(filters)
  const isUpcoming = (tour: AdminTourSummaryResponse) => tour.tourDate.slice(0, 10) >= todayStr
  const dividerEnabled = sortField === 'tourDate'

  // The count headers are far longer than their 1-3 digit values, and a nowrap
  // header is the column's floor — which is what squeezes group and location.
  // Dropping nowrap lets them wrap and releases that width. min-w-24 is the floor:
  // ja breaks per character, so 最大バディ数 / 参加希望者数 land on two lines rather
  // than collapsing. It buys nothing in en, where Participants / Confirmed are
  // single words with no break opportunity and keep their full width regardless.
  const countHead = 'min-w-24'
  const desktopColumns: { field: TourListSortField; label: string; headClass: string }[] = [
    { field: 'tourDate', label: t('tourDate'), headClass: 'whitespace-nowrap' },
    { field: 'group', label: t('group'), headClass: 'whitespace-nowrap' },
    { field: 'places', label: t('location'), headClass: 'whitespace-nowrap' },
    { field: 'capacity', label: t('capacity'), headClass: countHead },
    { field: 'participantCount', label: t('participantCount'), headClass: countHead },
    { field: 'confirmedCount', label: t('confirmedCount'), headClass: countHead },
    { field: 'status', label: t('status'), headClass: 'whitespace-nowrap' },
  ]
  const desktopColSpan = desktopColumns.length + 1

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border p-0.5" role="group" aria-label={t('view.label')}>
            {TourViewSchema.options.map((option) => (
              <button
                key={option}
                aria-pressed={view === option}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  view === option ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => syncUrl({ view: option })}
              >
                {t(`view.${option}`)}
              </button>
            ))}
          </div>
          <Button asChild size="sm">
            <Link href={routes.adminTourNew(locale)}>{t('newTour')}</Link>
          </Button>
        </div>
      </div>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {isCalendar ? (
        <TourCalendar
          tours={tours}
          month={month}
          today={todayStr}
          locale={locale}
          onMonthChange={(next) => syncUrl({ month: next })}
        />
      ) : (
        <>
        <TourFilterBar
          filters={filters}
          onChange={(next) => syncUrl({ filters: next })}
          suggestions={tours.flatMap((tour) => [tour.group.name, ...tour.places.map((p) => placeName(p, locale))])}
          resultCount={sorted.length}
          totalCount={tours.length}
        />

        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{filtersActive ? t('noMatches') : t('noResults')}</p>
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
                        <TodayDivider date={formatDate(todayStr)} label={t('todayDivider')} />
                      </div>
                    )}
                    <div
                      className="rounded-lg border bg-card p-4 cursor-pointer active:bg-muted/50"
                      onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{tour.group.name}</p>
                          <p className="tabular-nums text-sm text-muted-foreground">{formatDate(tour.tourDate)}</p>
                        </div>
                        <Badge variant={tourStatusBadgeVariant[tour.status]}>
                          {getTourStatusLabel(tTourStatus, tour.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{placeNames(tour.places, locale)}</p>
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
                    {desktopColumns.map(({ field, label, headClass }) => (
                      <TableHead key={field} className={headClass}>
                        <button
                          className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                          onClick={() => handleSort(field)}
                        >
                          {label}
                          <SortIcon active={sortField === field} dir={sortDir} />
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="w-px" />
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
                              <TodayDivider date={formatDate(todayStr)} label={t('todayDivider')} />
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
                        >
                          <TableCell className="whitespace-nowrap tabular-nums text-sm">{formatDate(tour.tourDate)}</TableCell>
                          <TableCell className="font-medium">{tour.group.name}</TableCell>
                          <TableCell>{placeNames(tour.places, locale)}</TableCell>
                          <TableCell className="text-center">{tour.capacity}</TableCell>
                          <TableCell className="text-center">
                            <div className="inline-flex items-center gap-2">
                              <span className="tabular-nums">{tour.participantCount}</span>
                              {tour.sessions.some((s) => s.belowMinimum) && <BelowMinimumBadge />}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{tour.confirmedCount}</TableCell>
                          <TableCell className="whitespace-nowrap">
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
        </>
      )}
    </AppShell>
  )
}

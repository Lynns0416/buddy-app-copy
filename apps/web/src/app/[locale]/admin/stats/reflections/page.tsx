'use client'

import { Fragment, Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import type { AdminReflectionStatsResponse, AdminReflectionStatsRow } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon, type SortDir } from '@/components/sort-icon'
import { routes } from '@/lib/routes'
import { ASC, DESC } from '@/lib/constants'
import { formatDate } from '@/lib/format-date'
import { momentLocation, placeName } from '@/lib/place-names'
import { buddyName } from '../../buddies/admin.buddy'
import { ReflectionDetail } from '../../_components/reflection-detail'
import {
  buildReflectionOverview,
  defaultReflectionStatsFilters,
  emptyReflectionStatsScope,
  fetchReflectionStats,
  filterByBuddy,
  filterReflections,
  sortReflections,
  type ReflectionFocus,
  type ReflectionSortField,
} from './admin.reflection-stats'
import { ReflectionStatsFilterBar } from './_components/reflection-filters'
import { ReflectionOverviewPanel } from './_components/reflection-overview'

export default function AdminReflectionStatsPage() {
  return (
    <Suspense>
      <ReflectionStats />
    </Suspense>
  )
}

function ReflectionStats() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const t = useTranslations('adminReflectionStats')
  const tBuddies = useTranslations('adminBuddies')
  const tTours = useTranslations('adminTours')

  const [scope, setScope] = useState(() => ({
    ...emptyReflectionStatsScope,
    tourId: searchParams.get('tourId') ?? '',
  }))
  const [filters, setFilters] = useState(defaultReflectionStatsFilters)
  const [data, setData] = useState<AdminReflectionStatsResponse | null>(null)
  const [fetchError, setFetchError] = useState(false)
  const [sortField, setSortField] = useState<ReflectionSortField>('tourDate')
  const [sortDir, setSortDir] = useState<SortDir>(DESC)
  const [focus, setFocus] = useState<ReflectionFocus | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    let current = true
    fetchReflectionStats(scope).then((result) => {
      if (!current) return
      if (result.ok) {
        setData(result.data)
        setFetchError(false)
      } else {
        setFetchError(true)
      }
    })
    return () => { current = false }
  }, [ready, scope])

  function handleSort(field: ReflectionSortField) {
    if (sortField === field) {
      setSortDir((d) => (d === ASC ? DESC : ASC))
    } else {
      setSortField(field)
      setSortDir(ASC)
    }
  }

  function clearTour() {
    setScope({ ...scope, tourId: '' })
    router.replace(pathname)
  }

  if (!ready) return null

  const rows = data?.reflections ?? []
  const filtered = filterReflections(rows, filters)
  // The overview covers every filtered row; a click on it narrows the list only.
  const focused = focus ? filtered.filter(focus.match) : filtered
  const sorted = sortReflections(focused, sortField, sortDir, locale)

  const tourRow = scope.tourId ? rows.find((r) => r.tourId === scope.tourId) : undefined
  const tourLabel = tourRow ? `${formatDate(tourRow.tourDate)} ${tourRow.group.name}` : null

  const sessionName = (row: AdminReflectionStatsRow) =>
    row.sessionLabel ?? tTours(`session.defaultLabel.${row.sessionOrder}`)
  // The session's place, then each moment's spot or note — leaving out the
  // place name a spot-less place's form fills in, which would only repeat it.
  const whereLabel = (row: AdminReflectionStatsRow) => {
    const place = placeName(row.place, locale)
    const notes = row.moments
      .map((m) => (m.spot ? placeName(m.spot, locale) : momentLocation(m, locale)))
      .filter((note) => note && note !== row.place.nameJa && note !== row.place.nameEn)
    return notes.length > 0 ? `${place} — ${notes.join(locale === 'en' ? ', ' : '、')}` : place
  }

  const columns: { field: ReflectionSortField; label: string }[] = [
    { field: 'tourDate', label: t('columns.tourDate') },
    { field: 'group', label: t('columns.group') },
    { field: 'session', label: t('columns.session') },
    { field: 'buddy', label: t('columns.buddy') },
    { field: 'place', label: t('columns.place') },
    { field: 'submittedAt', label: t('columns.submittedAt') },
  ]

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('error.load')}</p>
      )}

      <ReflectionStatsFilterBar
        scope={scope}
        onScopeChange={setScope}
        tourLabel={tourLabel}
        onClearTour={clearTour}
        filters={filters}
        onFiltersChange={setFilters}
        places={data?.places ?? []}
        resultCount={filtered.length}
        totalCount={rows.length}
      />

      {data && filtered.length > 0 && (
        <ReflectionOverviewPanel
          overview={buildReflectionOverview(
            filtered,
            data.places,
            filterByBuddy(rows, filters),
            filterByBuddy(data.buddies, filters),
          )}
          places={data.places}
          onFocus={setFocus}
        />
      )}

      {focus && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span>{t('overview.focused', { label: focus.label, count: focused.length })}</span>
          <Button variant="outline" size="sm" onClick={() => setFocus(null)}>
            {t('overview.clearFocus')}
          </Button>
        </div>
      )}

      {data && sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(({ field, label }) => (
                  <TableHead key={field}>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort(field)}
                    >
                      {label}
                      <SortIcon active={sortField === field} dir={sortDir} />
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => {
                const expanded = expandedId === row.id
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <button
                          type="button"
                          className="font-medium text-blue-600 hover:underline"
                          aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : row.id)}
                        >
                          {formatDate(row.tourDate)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Link href={routes.adminTourDetail(locale, row.tourId)} className="hover:underline">
                          {row.group.name}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{sessionName(row)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link href={routes.adminBuddyDetail(locale, row.buddyId)} className="hover:underline">
                          {buddyName(tBuddies, { displayName: row.buddyDisplayName, realName: row.buddyRealName })}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-40 text-sm">{whereLabel(row)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums text-sm text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={columns.length}>
                          <ReflectionDetail reflection={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}

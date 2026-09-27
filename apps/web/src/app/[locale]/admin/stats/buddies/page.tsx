'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import type { AdminBuddyStatsResponse, AppError } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon, type SortDir } from '@/components/sort-icon'
import { InfoHint } from '@/components/info-hint'
import { routes } from '@/lib/routes'
import { ASC, DESC } from '@/lib/constants'
import { buddyName, mapBuddyError } from '../../buddies/admin.buddy'
import {
  buildStatColumns,
  defaultBuddyStatsFilters,
  defaultVisibleColumns,
  emptyBuddyStatsScope,
  fetchBuddyStats,
  filterBuddyStats,
  formatStat,
  loadVisibleColumns,
  nextStatSort,
  saveVisibleColumns,
  sortBuddyStats,
  statDescription,
  statLabel,
  type StatSortField,
} from './admin.buddy-stats'
import { BuddyStatsFilterBar } from './_components/stats-filters'
import { ColumnPicker } from './_components/column-picker'
import { BuddyStatsOverviewPanel } from './_components/stats-overview'
import { buildOverview, type OverviewFocus } from './stats-overview'
import { useStatTranslators } from './use-stat-translators'

export default function AdminBuddyStatsPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const t = useTranslations('adminBuddyStats')
  const tBuddies = useTranslations('adminBuddies')
  const tr = useStatTranslators()

  const [scope, setScope] = useState(emptyBuddyStatsScope)
  const [filters, setFilters] = useState(defaultBuddyStatsFilters)
  const [data, setData] = useState<AdminBuddyStatsResponse | null>(null)
  const [fetchError, setFetchError] = useState<AppError | null>(null)
  const [sortField, setSortField] = useState<StatSortField>('displayName')
  const [sortDir, setSortDir] = useState<SortDir>(ASC)
  const [focus, setFocus] = useState<OverviewFocus | null>(null)

  const columns = useMemo(() => buildStatColumns(data?.places ?? []), [data])
  // The saved choice is read once; nothing renders before the admin guard is
  // ready, which the server render never is, so it cannot mismatch.
  const [visible, setVisible] = useState<string[]>(() => loadVisibleColumns(defaultVisibleColumns(buildStatColumns([]))))

  useEffect(() => {
    if (!ready) return
    let current = true
    fetchBuddyStats(scope).then((result) => {
      if (!current) return
      if (result.ok) {
        setData(result.data)
        setFetchError(null)
      } else {
        setFetchError(result.error)
      }
    })
    return () => { current = false }
  }, [ready, scope])

  function changeVisible(ids: string[]) {
    setVisible(ids)
    saveVisibleColumns(ids)
  }

  function handleSort(field: StatSortField) {
    const next = nextStatSort({ field: sortField, dir: sortDir }, field, columns)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  function applyFocus(next: OverviewFocus) {
    setFocus(next)
    if (next.sortField) {
      setSortField(next.sortField)
      setSortDir(DESC)
    }
  }

  if (!ready) return null

  const rows = data?.buddies ?? []
  const filtered = filterBuddyStats(rows, filters)
  // The overview covers every filtered row; a click on it narrows the table only.
  const focused = focus?.match ? filtered.filter(focus.match) : filtered
  const sorted = sortBuddyStats(focused, columns, sortField, sortDir)
  // The sorted column shows even when the admin has hidden it, so a click on
  // the overview always shows the number it sorted by.
  const shownColumns = columns.filter((c) => visible.includes(c.id) || c.id === sortField)
  const labelOf = (column: (typeof columns)[number]) => statLabel(column.label, tr, locale)

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {mapBuddyError(tBuddies, fetchError)}
        </p>
      )}

      <BuddyStatsFilterBar
        scope={scope}
        onScopeChange={setScope}
        filters={filters}
        onFiltersChange={setFilters}
        places={data?.places ?? []}
        resultCount={filtered.length}
        totalCount={rows.length}
      />

      {data && filtered.length > 0 && (
        <BuddyStatsOverviewPanel
          overview={buildOverview(filtered, data.places)}
          places={data.places}
          tr={tr}
          onFocus={applyFocus}
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

      <ColumnPicker
        columns={columns}
        visible={visible}
        labelOf={labelOf}
        onChange={changeVisible}
        onReset={() => changeVisible(defaultVisibleColumns(columns))}
      />

      {data && sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : data && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card">
                  <button
                    className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort('displayName')}
                  >
                    {t('columns.name')}
                    <SortIcon active={sortField === 'displayName'} dir={sortDir} />
                  </button>
                </TableHead>
                {shownColumns.map((column) => {
                  const description = statDescription(column.label.key, tr)
                  return (
                    <TableHead key={column.id} className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <button
                          className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                          onClick={() => handleSort(column.id)}
                        >
                          {labelOf(column)}
                          <SortIcon active={sortField === column.id} dir={sortDir} />
                        </button>
                        {description && <InfoHint label={t('about', { label: labelOf(column) })} text={description} />}
                      </span>
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="sticky left-0 z-10 whitespace-nowrap bg-card">
                    <Link href={routes.adminBuddyDetail(locale, row.id)} className="font-medium text-blue-600 hover:underline">
                      {buddyName(tBuddies, row)}
                    </Link>
                  </TableCell>
                  {shownColumns.map((column) => (
                    <TableCell key={column.id} className="whitespace-nowrap text-right tabular-nums">
                      {formatStat(column, row, tr)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}

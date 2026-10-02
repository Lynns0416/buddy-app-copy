'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AppError, AttendanceMonthResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema, AttendanceMonthSchema, getTodayJst } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { SortIcon, type SortDir } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { routes } from '@/lib/routes'
import { triggerBlobDownload } from '@/lib/api'
import { formatDate, formatDateTime, formatMonth } from '@/lib/format-date'
import { ASC } from '@/lib/constants'
import {
  CSV_COLUMNS,
  buildAttendanceCsv,
  emptyMonthFilters,
  filterMonth,
  formatDuration,
  nextSort,
  shiftMonth,
  sortMonth,
  type CsvColumn,
  type MonthFilters,
  type MonthSortField,
} from '@/lib/attendance'
import { fetchAttendanceMonth, lockMonth, resolveFlag, unlockMonth } from './admin.attendance'
import { AttendanceFilterBar } from './_components/attendance-filters'
import { memberTypeLabelKey } from '../buddies/admin.buddy'

// PRD §11.10: one row per buddy per day, open flags, lock and the finance CSV.
// The CSV holds the rows the filters leave.
export default function AdminAttendancePage() {
  return (
    <Suspense>
      <AttendanceMonth />
    </Suspense>
  )
}

function AttendanceMonth() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('adminAttendance')
  const tBuddies = useTranslations('adminBuddies')

  const param = AttendanceMonthSchema.safeParse(searchParams.get('month'))
  const month = param.success ? param.data : getTodayJst().slice(0, 7)

  const [loaded, setLoaded] = useState<AttendanceMonthResponse | null>(null)
  // A month still loading shows nothing rather than the previous month.
  const data = loaded?.month === month ? loaded : null
  const [error, setError] = useState<AppError | null>(null)
  const [acting, setActing] = useState(false)
  const [sortField, setSortField] = useState<MonthSortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>(ASC)
  const [filters, setFilters] = useState<MonthFilters>(emptyMonthFilters)

  function errorMessage(e: AppError): string {
    switch (e.code) {
      case AppErrorCodeSchema.enum.conflict: return t('error.conflict')
      case AppErrorCodeSchema.enum.network:  return t('error.network')
      default:                               return t('error.unknown')
    }
  }

  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!ready) return
    let current = true
    fetchAttendanceMonth(month).then((result) => {
      if (!current) return
      if (result.ok) {
        setLoaded(result.data)
        setError(null)
      } else {
        setError(result.error)
      }
    })
    return () => { current = false }
  }, [ready, month, version])

  async function act(action: () => Promise<{ ok: boolean; error?: AppError }>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return
    setActing(true)
    const result = await action()
    if (result.ok) setVersion((v) => v + 1)
    else if (result.error) setError(result.error)
    setActing(false)
  }

  function handleSort(field: MonthSortField) {
    const next = nextSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  // A date range belongs to the month it was picked in.
  function goToMonth(delta: number) {
    setFilters((f) => ({ ...f, from: '', to: '' }))
    router.push(routes.adminAttendance(locale, shiftMonth(month, delta)))
  }

  function handleExport() {
    if (!data) return
    const headers = Object.fromEntries(CSV_COLUMNS.map((c) => [c, t(`csv.${c}`)])) as Record<CsvColumn, string>
    const csv = buildAttendanceCsv(filtered, headers, {
      absent: t('absent'),
      memberType: (m) => tBuddies(memberTypeLabelKey(m) as Parameters<typeof tBuddies>[0]),
    })
    triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `attendance-${month}.csv`)
  }

  const filtered = data ? filterMonth(data.days, filters) : []

  if (!ready) return null

  const days = sortMonth(filtered, sortField, sortDir)
  const header = (field: MonthSortField, label: string) => (
    <TableHead>
      <button className="inline-flex items-center font-medium transition-colors hover:text-foreground" onClick={() => handleSort(field)}>
        {label}
        <SortIcon active={sortField === field} dir={sortDir} />
      </button>
    </TableHead>
  )
  const firstTourOn = (date: string, buddyId: string) =>
    data?.days.find((d) => d.date === date && d.buddyId === buddyId)?.tours[0]?.tourId

  return (
    <AppShell variant="admin">
      <h1 className="mb-4 text-xl font-semibold">{t('pageTitle')}</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" aria-label={t('previousMonth')} onClick={() => goToMonth(-1)}>
          ←
        </Button>
        <span className="min-w-20 text-center font-medium tabular-nums">{formatMonth(month)}</span>
        <Button size="sm" variant="outline" aria-label={t('nextMonth')} onClick={() => goToMonth(1)}>
          →
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {data && (data.lock ? (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => void act(() => unlockMonth(month), t('confirmUnlock'))}>
              {t('unlock')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={acting} onClick={() => void act(() => lockMonth(month), t('confirmLock'))}>
              {t('lock')}
            </Button>
          ))}
          <Button size="sm" disabled={filtered.length === 0} onClick={handleExport}>
            {t('exportCsv')}
          </Button>
        </div>
      </div>

      {data?.lock && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('lockedBy', { name: data.lock.lockedByName, at: formatDateTime(data.lock.lockedAt) })}
        </p>
      )}

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{errorMessage(error)}</p>}

      {data && data.openFlags.length > 0 && (
        <section className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <h2 className="mb-2 text-sm font-semibold">{t('openFlags', { count: data.openFlags.length })}</h2>
          <ul className="space-y-2 text-sm">
            {data.openFlags.map((f) => {
              const tourId = firstTourOn(f.date, f.buddyId)
              return (
                <li key={f.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p>
                      <span className="tabular-nums">{formatDate(f.date)}</span> · {f.displayName}
                      {tourId && (
                        <>
                          {' · '}
                          <Link href={routes.adminTourDetail(locale, tourId)} className="text-blue-600 hover:underline">
                            {t('openTour')}
                          </Link>
                        </>
                      )}
                    </p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{f.note}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={acting} onClick={() => void act(() => resolveFlag(f.id))}>
                    {t('resolve')}
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {data && data.days.length > 0 && (
        <AttendanceFilterBar
          filters={filters}
          onChange={setFilters}
          month={month}
          buddyNames={data.days.map((d) => d.displayName)}
          groupNames={data.days.flatMap((d) => d.tours.map((tour) => tour.groupName))}
          resultCount={filtered.length}
          totalCount={data.days.length}
        />
      )}

      {data && (days.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(data.days.length === 0 ? 'noDays' : 'filters.noMatches')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {header('date', t('date'))}
                {header('buddy', t('buddy'))}
                {header('tours', t('tours'))}
                {header('start', t('start'))}
                {header('end', t('end'))}
                {header('break', t('break'))}
                {header('hours', t('hours'))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((d) => (
                <TableRow key={`${d.date}:${d.buddyId}`}>
                  <TableCell className="tabular-nums">{formatDate(d.date)}</TableCell>
                  <TableCell>
                    <Link href={routes.adminBuddyDetail(locale, d.buddyId)} className="font-medium hover:underline">
                      {d.displayName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {d.tours.map((tour, i) => (
                      <span key={tour.tourId}>
                        {i > 0 && ' / '}
                        <Link href={routes.adminTourDetail(locale, tour.tourId)} className="hover:underline">{tour.groupName}</Link>
                      </span>
                    ))}
                  </TableCell>
                  {d.absent ? (
                    <TableCell colSpan={3} className="font-medium text-destructive">{t('absent')}</TableCell>
                  ) : (
                    <>
                      <TableCell className={`tabular-nums ${d.lateMinutes > 0 ? 'bg-amber-50 dark:bg-amber-950/40' : ''}`}>
                        {d.start}
                        {d.lateMinutes > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            {t('lateBy', { minutes: d.lateMinutes })}{d.lateExcused === false ? ` · ${t('notExcused')}` : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {d.end ?? <span className="text-amber-700 dark:text-amber-400">{t('noFinishTime')}</span>}
                      </TableCell>
                      <TableCell className="tabular-nums">{d.breakMinutes > 0 ? t('minutes', { minutes: d.breakMinutes }) : '—'}</TableCell>
                    </>
                  )}
                  <TableCell className="tabular-nums">{d.minutes === null ? '—' : formatDuration(d.minutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </AppShell>
  )
}

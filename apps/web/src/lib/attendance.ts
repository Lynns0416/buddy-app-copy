import type { AdminAttendanceDay, MemberType, TourAttendanceRow, UpdateAttendance } from '@peace-buddy/types'
import type { SortDir } from '@/components/sort-icon'
import { ASC, DESC } from './constants'

// The attendance record (#262, PRD §11.10). Times are `HH:MM`, so they compare
// as strings.

// `H:MM` for a number of minutes: 330 → `5:30`.
export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
}

// `YYYY-MM` shifted by whole months.
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

// `YYYY-MM-DD` of a month's last day.
export function lastDayOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

// Every `YYYY-MM-DD` of a month, in order.
export function daysOf(month: string): string[] {
  const last = Number(lastDayOf(month).slice(8))
  return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

// The row's whole exception state as the body the API replaces it with, so an
// editor that changes the start keeps the end, and the other way round.
export function toUpdate(row: TourAttendanceRow): UpdateAttendance {
  return {
    absent: row.absent,
    absenceReported: row.absent ? row.absenceReported : null,
    arrivalTime: row.arrivalTime,
    lateReason: row.lateReason,
    lateNote: row.lateNote,
    lateExcused: row.lateExcused,
    leaveTime: row.leaveTime,
    leaveNote: row.leaveNote,
  }
}

// ── Sorting ────────────────────────────────────────────────────────────────

export function nextSort<F extends string>(current: { field: F; dir: SortDir }, clicked: F): { field: F; dir: SortDir } {
  if (clicked === current.field) return { field: clicked, dir: current.dir === ASC ? DESC : ASC }
  return { field: clicked, dir: ASC }
}

// Empty values sort last in both directions.
function compareNullable<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number, dir: SortDir): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === ASC ? cmp(a, b) : -cmp(a, b)
}

const byString = (a: string, b: string) => a.localeCompare(b)
const byNumber = (a: number, b: number) => a - b

export type SheetSortField = 'buddy' | 'start' | 'end' | 'hours'

export function sortSheet(rows: TourAttendanceRow[], field: SheetSortField, dir: SortDir): TourAttendanceRow[] {
  const value = (r: TourAttendanceRow): string | number | null => {
    switch (field) {
      case 'buddy': return r.displayName
      case 'start': return r.absent ? null : (r.arrivalTime ?? r.defaultArrival)
      case 'end':   return r.absent ? null : r.leaveTime
      case 'hours': return r.minutes
    }
  }
  return [...rows].sort((a, b) => {
    const va = value(a)
    const vb = value(b)
    return typeof va === 'number' || typeof vb === 'number'
      ? compareNullable(va as number | null, vb as number | null, byNumber, dir)
      : compareNullable(va, vb, byString, dir)
  })
}

export type MonthSortField = 'date' | 'buddy' | 'tours' | 'start' | 'end' | 'break' | 'hours'

// The groups of the day, as the Tours column lists them.
function tourNames(d: AdminAttendanceDay): string {
  return d.tours.map((tour) => tour.groupName).join(' / ')
}

export function sortMonth(days: AdminAttendanceDay[], field: MonthSortField, dir: SortDir): AdminAttendanceDay[] {
  return [...days].sort((a, b) => {
    switch (field) {
      case 'date':  return compareNullable(a.date, b.date, byString, dir) || a.displayName.localeCompare(b.displayName)
      case 'buddy': return compareNullable(a.displayName, b.displayName, byString, dir) || a.date.localeCompare(b.date)
      case 'tours': return compareNullable(tourNames(a), tourNames(b), byString, dir) || a.date.localeCompare(b.date)
      case 'start': return compareNullable(a.start, b.start, byString, dir)
      case 'end':   return compareNullable(a.end, b.end, byString, dir)
      case 'break': return compareNullable(a.breakMinutes, b.breakMinutes, byNumber, dir)
      case 'hours': return compareNullable(a.minutes, b.minutes, byNumber, dir)
    }
  })
}

// ── Filtering ──────────────────────────────────────────────────────────────

export const MONTH_STATUSES = ['absent', 'late', 'lateUnavoidable', 'finishMissing'] as const
export type MonthStatus = (typeof MONTH_STATUSES)[number]

// Empty text, list or date means "any". Dates are `YYYY-MM-DD`, inclusive.
export type MonthFilters = {
  buddy: string
  tour: string
  memberTypes: MemberType[]
  statuses: MonthStatus[]
  from: string
  to: string
}

export const emptyMonthFilters: MonthFilters = { buddy: '', tour: '', memberTypes: [], statuses: [], from: '', to: '' }

export function isMonthFilterActive(f: MonthFilters): boolean {
  return f.buddy.trim() !== '' || f.tour.trim() !== '' || f.memberTypes.length > 0 || f.statuses.length > 0 || f.from !== '' || f.to !== ''
}

function hasStatus(d: AdminAttendanceDay, status: MonthStatus): boolean {
  switch (status) {
    case 'absent':          return d.absent
    // Late not excused is just 遅刻; excused is 遅刻（やむを得ない）.
    case 'late':            return !d.absent && d.lateMinutes > 0 && d.lateExcused === false
    case 'lateUnavoidable': return !d.absent && d.lateMinutes > 0 && d.lateExcused === true
    case 'finishMissing':   return !d.absent && d.finishMissing
  }
}

// Names match on display name or real name, ignoring case. A day matches the
// statuses when it has any one of them.
export function filterMonth(days: AdminAttendanceDay[], f: MonthFilters): AdminAttendanceDay[] {
  const buddy = f.buddy.trim().toLowerCase()
  const tour = f.tour.trim().toLowerCase()
  return days.filter(
    (d) =>
      (buddy === '' || d.displayName.toLowerCase().includes(buddy) || d.realName.toLowerCase().includes(buddy)) &&
      (tour === '' || d.tours.some((t) => t.groupName.toLowerCase().includes(tour))) &&
      (f.memberTypes.length === 0 || f.memberTypes.includes(d.memberType)) &&
      (f.statuses.length === 0 || f.statuses.some((s) => hasStatus(d, s))) &&
      (f.from === '' || d.date >= f.from) &&
      (f.to === '' || d.date <= f.to),
  )
}

// ── Finance CSV ────────────────────────────────────────────────────────────

export const CSV_COLUMNS = [
  'date',
  'displayName',
  'realName',
  'memberType',
  'start',
  'end',
  'breakMinutes',
  'minutes',
  'hours',
  'absent',
  'lateMinutes',
  'tours',
] as const
export type CsvColumn = (typeof CSV_COLUMNS)[number]

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

// One row per buddy per day, for finance. Headers and labels come translated;
// the absent column holds the absent label, or nothing for a day worked.
// A byte-order mark leads so spreadsheet apps read Japanese names as UTF-8.
export function buildAttendanceCsv(
  days: AdminAttendanceDay[],
  headers: Record<CsvColumn, string>,
  labels: { absent: string; memberType: (m: AdminAttendanceDay['memberType']) => string },
): string {
  const lines = [CSV_COLUMNS.map((c) => headers[c])]
  for (const d of sortMonth(days, 'date', ASC)) {
    const cells: Record<CsvColumn, string> = {
      date: d.date,
      displayName: d.displayName,
      realName: d.realName,
      memberType: labels.memberType(d.memberType),
      start: d.start ?? '',
      end: d.end ?? '',
      breakMinutes: String(d.breakMinutes),
      minutes: d.minutes === null ? '' : String(d.minutes),
      hours: d.minutes === null ? '' : (d.minutes / 60).toFixed(2),
      absent: d.absent ? labels.absent : '',
      lateMinutes: String(d.lateMinutes),
      tours: d.tours.map((t) => t.groupName).join(' / '),
    }
    lines.push(CSV_COLUMNS.map((c) => cells[c]))
  }
  return '﻿' + lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

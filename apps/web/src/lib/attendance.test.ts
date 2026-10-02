import { describe, it, expect } from 'vitest'
import type { AdminAttendanceDay, TourAttendanceRow } from '@peace-buddy/types'
import {
  CSV_COLUMNS,
  buildAttendanceCsv,
  daysOf,
  emptyMonthFilters,
  filterMonth,
  formatDuration,
  isMonthFilterActive,
  lastDayOf,
  nextSort,
  shiftMonth,
  sortMonth,
  sortSheet,
  toUpdate,
} from './attendance'

function row(overrides: Partial<TourAttendanceRow> = {}): TourAttendanceRow {
  return {
    buddyId: 'b1',
    displayName: 'Aya',
    realName: '綾',
    memberType: 'buddy',
    defaultArrival: '10:00',
    arrivalTime: null,
    lateMinutes: 0,
    lateReason: null,
    lateNote: null,
    lateExcused: null,
    leaveTime: null,
    leaveNote: null,
    earlyMinutes: 0,
    absent: false,
    absenceReported: null,
    breakMinutes: 0,
    minutes: 330,
    ...overrides,
  }
}

function day(overrides: Partial<AdminAttendanceDay> = {}): AdminAttendanceDay {
  return {
    date: '2026-06-10',
    buddyId: 'b1',
    displayName: 'Aya',
    realName: '綾',
    memberType: 'buddy',
    tours: [{ tourId: 't1', groupName: 'Sakura School' }],
    start: '10:00',
    end: '15:30',
    breakMinutes: 0,
    minutes: 330,
    absent: false,
    finishMissing: false,
    lateMinutes: 0,
    lateExcused: null,
    ...overrides,
  }
}

describe('formatDuration and shiftMonth', () => {
  it('formats minutes as H:MM', () => {
    expect(formatDuration(330)).toBe('5:30')
    expect(formatDuration(45)).toBe('0:45')
  })

  it('moves across a year boundary', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })

  it('finds the last day of a month', () => {
    expect(lastDayOf('2026-02')).toBe('2026-02-28')
    expect(lastDayOf('2026-12')).toBe('2026-12-31')
  })
})

describe('toUpdate', () => {
  it('carries the whole exception state, so one editor keeps what the other set', () => {
    expect(toUpdate(row({ arrivalTime: '10:25', lateReason: 'transport_delay', lateExcused: true, leaveTime: '14:00', breakMinutes: 45 }))).toEqual({
      absent: false,
      absenceReported: null,
      arrivalTime: '10:25',
      lateReason: 'transport_delay',
      lateNote: null,
      lateExcused: true,
      leaveTime: '14:00',
      leaveNote: null,
    })
  })
})

describe('sorting', () => {
  it('sorts the sheet by start, absent buddies last both ways', () => {
    const rows = [row({ buddyId: 'late', arrivalTime: '10:25' }), row({ buddyId: 'absent', absent: true }), row({ buddyId: 'on-time' })]
    expect(sortSheet(rows, 'start', 'asc').map((r) => r.buddyId)).toEqual(['on-time', 'late', 'absent'])
    expect(sortSheet(rows, 'start', 'desc').map((r) => r.buddyId)).toEqual(['late', 'on-time', 'absent'])
  })

  it('sorts the month by hours, unknown hours last', () => {
    const days = [day({ buddyId: 'a', minutes: 100 }), day({ buddyId: 'b', minutes: null }), day({ buddyId: 'c', minutes: 300 })]
    expect(sortMonth(days, 'hours', 'desc').map((d) => d.buddyId)).toEqual(['c', 'a', 'b'])
  })

  it('sorts the month by the groups of the day', () => {
    const days = [
      day({ buddyId: 'a', tours: [{ tourId: 't3', groupName: 'Sakura' }] }),
      day({ buddyId: 'b', tours: [{ tourId: 't1', groupName: 'Aoba' }, { tourId: 't2', groupName: 'Midori' }] }),
    ]
    expect(sortMonth(days, 'tours', 'asc').map((d) => d.buddyId)).toEqual(['b', 'a'])
    expect(sortMonth(days, 'tours', 'desc').map((d) => d.buddyId)).toEqual(['a', 'b'])
  })

  it('flips the direction on the same column and starts ascending on a new one', () => {
    expect(nextSort({ field: 'date', dir: 'asc' }, 'date')).toEqual({ field: 'date', dir: 'desc' })
    expect(nextSort({ field: 'date', dir: 'desc' }, 'hours')).toEqual({ field: 'hours', dir: 'asc' })
  })
})

describe('filterMonth', () => {
  const days = [
    day({ buddyId: 'aya', date: '2026-06-03' }),
    day({ buddyId: 'ken', displayName: 'Ken', realName: '健', memberType: 'plab_member', date: '2026-06-10', tours: [{ tourId: 't2', groupName: 'Hikari Church' }] }),
    day({ buddyId: 'absent', date: '2026-06-17', absent: true, start: null, end: null, minutes: 0 }),
    day({ buddyId: 'unavoidable', date: '2026-06-20', lateMinutes: 25, lateExcused: true }),
    day({ buddyId: 'late', date: '2026-06-24', lateMinutes: 10, lateExcused: false }),
    day({ buddyId: 'waiting', date: '2026-06-30', end: null, minutes: null, finishMissing: true }),
  ]
  const ids = (filters: Partial<typeof emptyMonthFilters>) =>
    filterMonth(days, { ...emptyMonthFilters, ...filters }).map((d) => d.buddyId)

  it('keeps every day with no filter', () => {
    expect(ids({})).toHaveLength(days.length)
    expect(isMonthFilterActive(emptyMonthFilters)).toBe(false)
    expect(isMonthFilterActive({ ...emptyMonthFilters, from: '2026-06-10' })).toBe(true)
  })

  it('matches the buddy on display or real name, and the tour on its group name, ignoring case', () => {
    expect(ids({ buddy: 'ken' })).toEqual(['ken'])
    expect(ids({ buddy: '健' })).toEqual(['ken'])
    expect(ids({ tour: 'hikari' })).toEqual(['ken'])
  })

  it('filters by member type and by any of the chosen statuses', () => {
    expect(ids({ memberTypes: ['plab_member'] })).toEqual(['ken'])
    expect(ids({ statuses: ['late'] })).toEqual(['late'])
    expect(ids({ statuses: ['lateUnavoidable'] })).toEqual(['unavoidable'])
    expect(ids({ statuses: ['absent', 'finishMissing'] })).toEqual(['absent', 'waiting'])
  })

  it('keeps dates within the range, both ends included', () => {
    expect(ids({ from: '2026-06-10', to: '2026-06-20' })).toEqual(['ken', 'absent', 'unavoidable'])
  })
})

describe('buildAttendanceCsv', () => {
  const headers = Object.fromEntries(CSV_COLUMNS.map((c) => [c, c])) as Record<(typeof CSV_COLUMNS)[number], string>
  const labels = { absent: 'ABSENT', memberType: (m: string) => m }

  it('writes one row per buddy per day with a BOM and CRLF', () => {
    const csv = buildAttendanceCsv(
      [
        day({ date: '2026-06-11', displayName: 'Ken', minutes: 255, breakMinutes: 45, lateMinutes: 25, lateExcused: false }),
        day({ absent: true, start: null, end: null, minutes: 0, tours: [{ tourId: 't1', groupName: 'A, "B"' }] }),
      ],
      headers,
      labels,
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(CSV_COLUMNS.join(','))
    expect(lines[1]).toBe('2026-06-10,Aya,綾,buddy,,,0,0,0.00,ABSENT,0,"A, ""B"""')
    expect(lines[2]).toBe('2026-06-11,Ken,綾,buddy,10:00,15:30,45,255,4.25,,25,Sakura School')
  })

  it('leaves the hours empty while the finish time is missing', () => {
    const csv = buildAttendanceCsv([day({ end: null, minutes: null, finishMissing: true })], headers, labels)
    expect(csv.slice(1).trimEnd().split('\r\n')[1]).toBe('2026-06-10,Aya,綾,buddy,10:00,,0,,,,0,Sakura School')
  })
})

describe('daysOf', () => {
  it('lists every day of the month, leap February included', () => {
    expect(daysOf('2026-09')).toHaveLength(30)
    expect(daysOf('2028-02').at(-1)).toBe('2028-02-29')
    expect(daysOf('2026-09')[0]).toBe('2026-09-01')
  })
})

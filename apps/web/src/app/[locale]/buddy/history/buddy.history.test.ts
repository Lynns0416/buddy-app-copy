import { describe, it, expect } from 'vitest'
import type { MyTourBookingEntry } from '@peace-buddy/types'
import { filterPast, findPastAttended, groupByYear, summarize } from './buddy.history'

const TODAY = '2026-09-17'

function entry(
  tourId: string,
  tourDate: string,
  overrides: Partial<MyTourBookingEntry> = {},
): MyTourBookingEntry {
  return {
    tourId,
    tourDate: `${tourDate}T00:00:00.000Z`,
    places: [{ id: 'place-1', nameJa: 'Hiroshima', nameEn: 'Hiroshima' }],
    status: 'completed',
    maybeDeadline: null,
    reflectionSubmitted: true,
    absent: false,
    group: { name: `Group ${tourId}`, type: 'school' },
    bookings: [{
      bookingId: `b-${tourId}`,
      sessionId: `s-${tourId}`,
      sessionOrder: 1,
      sessionLabel: null,
      meetingTime: '1970-01-01T09:00:00.000Z',
      startTime: null,
      endTime: null,
      place: { id: 'place-1', nameJa: '長崎', nameEn: 'Nagasaki' },
      bookingStatus: 'confirmed',
      bookedAt: '2026-01-01T00:00:00.000Z',
    }],
    ...overrides,
  }
}

const ids = (entries: MyTourBookingEntry[]) => entries.map((e) => e.tourId)

describe('findPastAttended', () => {
  it('leaves out a tour the attendance record marks the buddy absent from', () => {
    expect(ids(findPastAttended([entry('absent', '2026-09-10', { absent: true }), entry('present', '2026-09-11')], TODAY))).toEqual(['present'])
  })

  it('excludes tours from today on', () => {
    expect(ids(findPastAttended([entry('today', TODAY), entry('past', '2026-09-16')], TODAY))).toEqual(['past'])
  })

  it('excludes a tour the org cancelled', () => {
    expect(findPastAttended([entry('t', '2026-01-01', { status: 'cancelled' })], TODAY)).toEqual([])
  })

  it('excludes a tour with no confirmed session', () => {
    const e = entry('t', '2026-01-01')
    const bookings = [
      { ...e.bookings[0], bookingStatus: 'maybe' as const },
      { ...e.bookings[0], sessionId: 's2', bookingStatus: 'waitlist' as const },
    ]
    expect(findPastAttended([{ ...e, bookings }], TODAY)).toEqual([])
  })

  it('includes a tour with one confirmed session among others', () => {
    const e = entry('t', '2026-01-01')
    const bookings = [
      { ...e.bookings[0], bookingStatus: 'waitlist' as const },
      { ...e.bookings[0], sessionId: 's2' },
    ]
    expect(ids(findPastAttended([{ ...e, bookings }], TODAY))).toEqual(['t'])
  })

  it('orders newest first', () => {
    const result = findPastAttended([entry('old', '2024-03-01'), entry('new', '2026-03-01')], TODAY)
    expect(ids(result)).toEqual(['new', 'old'])
  })
})

describe('summarize', () => {
  it('returns null with no past tours', () => {
    expect(summarize([])).toBeNull()
  })

  it('counts tours and distinct groups, since the earliest tour', () => {
    const past = [
      entry('a', '2026-03-01', { group: { name: 'Sakura', type: 'school' } }),
      entry('b', '2025-06-01', { group: { name: 'Minato', type: 'company' } }),
      entry('c', '2024-11-01', { group: { name: 'Sakura', type: 'school' } }),
    ]
    expect(summarize(past)).toEqual({ tours: 3, groups: 2, since: '2024-11-01' })
  })
})

describe('groupByYear', () => {
  it('groups consecutive entries by year, keeping order', () => {
    const groups = groupByYear([entry('a', '2026-03-01'), entry('b', '2026-01-01'), entry('c', '2024-11-01')])
    expect(groups.map((g) => [g.year, ids(g.entries)])).toEqual([
      ['2026', ['a', 'b']],
      ['2024', ['c']],
    ])
  })
})

describe('filterPast', () => {
  const past = [
    entry('school-done', '2026-01-01'),
    entry('school-open', '2026-01-02', { reflectionSubmitted: false }),
    entry('company-open', '2026-01-03', { reflectionSubmitted: false, group: { name: 'Minato Co.', type: 'company' } }),
  ]

  it('returns everything with no filter', () => {
    expect(ids(filterPast(past, { unreflectedOnly: false, groupName: '' }))).toEqual(['school-done', 'school-open', 'company-open'])
  })

  it('keeps only tours without a reflection', () => {
    expect(ids(filterPast(past, { unreflectedOnly: true, groupName: '' }))).toEqual(['school-open', 'company-open'])
  })

  it('keeps only group names containing the text, ignoring case', () => {
    expect(ids(filterPast(past, { unreflectedOnly: false, groupName: 'm' }))).toEqual(['company-open'])
  })

  it('applies both filters together', () => {
    expect(ids(filterPast(past, { unreflectedOnly: true, groupName: 'school' }))).toEqual(['school-open'])
  })
})

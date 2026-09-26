import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatMonth } from './format-date'

describe('formatDate', () => {
  it('formats a date as yyyy/MM/dd', () => {
    expect(formatDate('2026-09-10T00:00:00.000Z')).toBe('2026/09/10')
  })

  it('keeps the day of a `@db.Date` value, which arrives as UTC midnight', () => {
    expect(formatDate('2026-01-01T00:00:00.000Z')).toBe('2026/01/01')
  })

  it('shows a late-evening timestamp on its Japanese date, not the UTC one', () => {
    // 2026-09-10 23:30 JST is still 14:30 on the 10th in UTC.
    expect(formatDate('2026-09-10T14:30:00.000Z')).toBe('2026/09/10')
  })

  it('rolls over to the next date at JST midnight, while UTC is a day behind', () => {
    expect(formatDate('2026-09-10T15:00:00.000Z')).toBe('2026/09/11')
  })

  // The today divider and the calendar's mobile agenda pass a bare `YYYY-MM-DD`
  // — `getTodayJst()` and a cell key. A date-only string parses as UTC midnight,
  // so the shift must leave the day alone rather than move it forward.
  it('leaves a bare YYYY-MM-DD on its own day', () => {
    expect(formatDate('2026-09-20')).toBe('2026/09/20')
  })

  it('leaves a bare YYYY-MM-DD on its own day at both ends of the year', () => {
    expect(formatDate('2026-01-01')).toBe('2026/01/01')
    expect(formatDate('2026-12-31')).toBe('2026/12/31')
  })
})

describe('formatDateTime', () => {
  it('formats the date and the time in Japan', () => {
    expect(formatDateTime('2026-09-10T01:05:00.000Z')).toBe('2026/09/10 10:05')
  })

  it('carries the date across the JST midnight boundary with the time', () => {
    expect(formatDateTime('2026-09-10T15:00:00.000Z')).toBe('2026/09/11 00:00')
  })
})

describe('formatMonth', () => {
  it('formats a JST month as yyyy/MM', () => {
    expect(formatMonth('2026-09')).toBe('2026/09')
  })
})

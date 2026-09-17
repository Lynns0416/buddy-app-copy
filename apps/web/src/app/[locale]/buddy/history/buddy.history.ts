import type { MyTourBookingEntry } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'

export type HistorySummary = { tours: number; groups: number; since: string }

export type YearGroup = { year: string; entries: MyTourBookingEntry[] }

export type PastFilter = { unevaluatedOnly: boolean; groupName: string }

function dateOf(iso: string): string {
  return iso.slice(0, 10)
}

// There is no attendance record. A past tour counts as attended when the org did
// not cancel it and the buddy held a confirmed seat on at least one session.
function isAttended(entry: MyTourBookingEntry): boolean {
  return (
    entry.status !== TourStatusSchema.enum.cancelled &&
    entry.bookings.some((b) => b.bookingStatus === BookingStatusSchema.enum.confirmed)
  )
}

export function findUpcoming(bookings: MyTourBookingEntry[], today: string): MyTourBookingEntry[] {
  return bookings.filter((e) => dateOf(e.tourDate) >= today)
}

// Past tours the buddy did not attend are not listed at all (see decisions.md).
export function findPastAttended(bookings: MyTourBookingEntry[], today: string): MyTourBookingEntry[] {
  return bookings
    .filter((e) => dateOf(e.tourDate) < today && isAttended(e))
    .sort((a, b) => b.tourDate.localeCompare(a.tourDate))
}

export function summarize(past: MyTourBookingEntry[]): HistorySummary | null {
  if (past.length === 0) return null
  return {
    tours: past.length,
    groups: new Set(past.map((e) => e.group.name)).size,
    since: dateOf(past[past.length - 1].tourDate),
  }
}

// Expects entries newest first, as findPastAttended returns them.
export function groupByYear(entries: MyTourBookingEntry[]): YearGroup[] {
  const groups: YearGroup[] = []
  for (const entry of entries) {
    const year = entry.tourDate.slice(0, 4)
    const last = groups[groups.length - 1]
    if (last?.year === year) last.entries.push(entry)
    else groups.push({ year, entries: [entry] })
  }
  return groups
}

export function filterPast(entries: MyTourBookingEntry[], filter: PastFilter): MyTourBookingEntry[] {
  const name = filter.groupName.trim().toLowerCase()
  return entries.filter(
    (e) =>
      (!filter.unevaluatedOnly || !e.selfEvaluationSubmitted) &&
      e.group.name.toLowerCase().includes(name),
  )
}

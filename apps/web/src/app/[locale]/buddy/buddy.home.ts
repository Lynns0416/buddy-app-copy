import type { MyTourBookingEntry, TourResponse, BookingStatus } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import { isBookingAllowed, isPastDeadline } from './lib/deadline'

// How long after a tour a missing reflection is still asked for. Writing one has
// no deadline, so without a window every tour never reflected on stays listed.
export const REFLECTION_PROMPT_DAYS = 30

// Open tours shown before the buddy expands the list.
export const OPEN_TOURS_PREVIEW = 3

export type ActionItem =
  | { kind: 'maybe'; entry: MyTourBookingEntry; deadlinePassed: boolean }
  | { kind: 'reflection'; entry: MyTourBookingEntry }
  | { kind: 'waitlist'; entry: MyTourBookingEntry }

function dateOf(iso: string): string {
  return iso.slice(0, 10)
}

function shiftDate(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function hasBooking(entry: MyTourBookingEntry, status: BookingStatus): boolean {
  return entry.bookings.some((b) => b.bookingStatus === status)
}

function isUpcoming(entry: MyTourBookingEntry, today: string): boolean {
  return entry.status === TourStatusSchema.enum.published && dateOf(entry.tourDate) >= today
}

function byTourDate(a: MyTourBookingEntry, b: MyTourBookingEntry): number {
  return a.tourDate.localeCompare(b.tourDate)
}

// A Maybe or Waitlist booking is not a commitment yet, so it never makes a tour
// "next" — those tours are listed as action items instead.
export function findNextTour(bookings: MyTourBookingEntry[], today: string): MyTourBookingEntry | null {
  return (
    bookings
      .filter((e) => isUpcoming(e, today) && hasBooking(e, BookingStatusSchema.enum.confirmed))
      .sort(byTourDate)[0] ?? null
  )
}

// The next confirmed tour is held today in Japan, so the home screen leads with
// what the buddy needs for it instead of the usual next-tour card.
export function isTourDay(nextTour: MyTourBookingEntry | null, today: string): nextTour is MyTourBookingEntry {
  return nextTour !== null && dateOf(nextTour.tourDate) === today
}

export function findActionItems(bookings: MyTourBookingEntry[], today: string): ActionItem[] {
  const upcoming = bookings.filter((e) => isUpcoming(e, today)).sort(byTourDate)
  const reflectSince = shiftDate(today, -REFLECTION_PROMPT_DAYS)

  const maybe: ActionItem[] = upcoming
    .filter((e) => hasBooking(e, BookingStatusSchema.enum.maybe))
    .map((entry) => ({
      kind: 'maybe',
      entry,
      deadlinePassed: entry.maybeDeadline !== null && isPastDeadline(today, entry.maybeDeadline),
    }))

  const reflection: ActionItem[] = bookings
    .filter(
      (e) =>
        e.status === TourStatusSchema.enum.completed &&
        hasBooking(e, BookingStatusSchema.enum.confirmed) &&
        !e.reflectionSubmitted &&
        dateOf(e.tourDate) >= reflectSince,
    )
    .sort(byTourDate)
    .map((entry) => ({ kind: 'reflection', entry }))

  const waitlist: ActionItem[] = upcoming
    .filter((e) => hasBooking(e, BookingStatusSchema.enum.waitlist))
    .map((entry) => ({ kind: 'waitlist', entry }))

  return [...maybe, ...reflection, ...waitlist]
}

export function bookableTours(tours: TourResponse[], today: string): TourResponse[] {
  return tours.filter((t) => isBookingAllowed(t.status, t.bookingOpen, t.tourDate, today))
}

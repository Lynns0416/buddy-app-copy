import type { MyTourBookingEntry, TourResponse, BookingStatus } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import { isBookingAllowed, isPastDeadline } from './lib/deadline'

// How long after a tour a missing self-evaluation is still asked for. Submission
// has no deadline, so without a window every tour never evaluated stays listed.
export const SELF_EVAL_PROMPT_DAYS = 30

// Open tours shown before the buddy expands the list.
export const OPEN_TOURS_PREVIEW = 3

export type ActionItem =
  | { kind: 'maybe'; entry: MyTourBookingEntry; deadlinePassed: boolean }
  | { kind: 'selfEvaluation'; entry: MyTourBookingEntry }
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

export function findActionItems(bookings: MyTourBookingEntry[], today: string): ActionItem[] {
  const upcoming = bookings.filter((e) => isUpcoming(e, today)).sort(byTourDate)
  const evalSince = shiftDate(today, -SELF_EVAL_PROMPT_DAYS)

  const maybe: ActionItem[] = upcoming
    .filter((e) => hasBooking(e, BookingStatusSchema.enum.maybe))
    .map((entry) => ({
      kind: 'maybe',
      entry,
      deadlinePassed: entry.maybeDeadline !== null && isPastDeadline(today, entry.maybeDeadline),
    }))

  const selfEvaluation: ActionItem[] = bookings
    .filter(
      (e) =>
        e.status === TourStatusSchema.enum.completed &&
        hasBooking(e, BookingStatusSchema.enum.confirmed) &&
        !e.selfEvaluationSubmitted &&
        dateOf(e.tourDate) >= evalSince,
    )
    .sort(byTourDate)
    .map((entry) => ({ kind: 'selfEvaluation', entry }))

  const waitlist: ActionItem[] = upcoming
    .filter((e) => hasBooking(e, BookingStatusSchema.enum.waitlist))
    .map((entry) => ({ kind: 'waitlist', entry }))

  return [...maybe, ...selfEvaluation, ...waitlist]
}

export function bookableTours(tours: TourResponse[]): TourResponse[] {
  return tours.filter((t) => isBookingAllowed(t.status, t.bookingOpen, t.tourDate))
}

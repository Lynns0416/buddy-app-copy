import type { MyTourBookingEntry, TourResponse, TourListSessionResponse, BookingStatus, MyAnnouncementResponse } from '@peace-buddy/types'
import { BookingStatusSchema, LocaleSchema, TourStatusSchema } from '@peace-buddy/types'
import { isBookingAllowed, isPastDeadline } from './lib/deadline'

// How long after a tour a missing reflection is still asked for. Writing one has
// no deadline, so without a window every tour never reflected on stays listed.
export const REFLECTION_PROMPT_DAYS = 30

// Open tours shown before the buddy expands the list.
export const OPEN_TOURS_PREVIEW = 3

// Announcements shown before the buddy expands the list, in PLAB members' order.
export const ANNOUNCEMENTS_PREVIEW = 3

// An `en` buddy reads the English version when PLAB members wrote one;
// everyone else, and anything without one, reads the Japanese.
export function announcementText(a: MyAnnouncementResponse, locale: string): { title: string; body: string } {
  if (locale === LocaleSchema.enum.en && a.titleEn !== null && a.bodyEn !== null) return { title: a.titleEn, body: a.bodyEn }
  return { title: a.titleJa, body: a.bodyJa }
}

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
// "upcoming" here — those tours are listed as action items instead.
export function findUpcomingConfirmed(bookings: MyTourBookingEntry[], today: string): MyTourBookingEntry[] {
  return bookings
    .filter((e) => isUpcoming(e, today) && hasBooking(e, BookingStatusSchema.enum.confirmed))
    .sort(byTourDate)
}

export function findNextTour(bookings: MyTourBookingEntry[], today: string): MyTourBookingEntry | null {
  return findUpcomingConfirmed(bookings, today)[0] ?? null
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

// How many more confirmed buddies a session needs to reach its minBuddies —
// the admin "short of buddies" rule (PRD §11.7).
export function buddiesNeeded(session: TourListSessionResponse): number {
  return Math.max(0, session.minBuddies - session.confirmedCount)
}

// Sessions are never summed (PRD §11.7), so a tour is as short as its shortest session.
function tourNeed(tour: TourResponse): number {
  return Math.max(0, ...tour.sessions.map(buddiesNeeded))
}

// Tours short of buddies first, the most short first; the rest nearest first.
// `tours` arrive nearest first, and the sort is stable, so ties keep that order.
export function bookableTours(tours: TourResponse[], today: string): TourResponse[] {
  return tours
    .filter((t) => isBookingAllowed(t.status, t.bookingOpen, t.tourDate, today))
    .sort((a, b) => tourNeed(b) - tourNeed(a))
}

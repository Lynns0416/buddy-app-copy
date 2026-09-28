import type { MyTourBookingEntry, PlaceSummary, TourReflectionMomentResponse, TourReflectionResponse } from '@peace-buddy/types'
import { BookingStatusSchema, TourStatusSchema } from '@peace-buddy/types'
import { findPastAttended } from '../history/buddy.history'

// The buddy's own record (PRD §11.9). Tours count as attended by the history
// page's rule, never the admin stats rule: that one leaves out tours an admin
// recorded as a no-show, and a count that dropped would tell the buddy so
// (docs/decisions.md 2026-09-27).

export type PlaceCount = { place: PlaceSummary; tours: number }
export type GroupCount = { name: string; tours: number }

export type LastTour = {
  entry: MyTourBookingEntry
  // Which time the buddy has had this group, and been at each place, counting this tour.
  groupVisit: number
  placeVisits: PlaceCount[]
  didWell: string | null
  // Only a completed tour takes a reflection (PRD §9.3).
  canReflect: boolean
}

export type NextTourNote = {
  couldImprove: string
  fromTourDate: string
  nextTour: MyTourBookingEntry | null
}

export type Milestone =
  | { kind: 'firstTour'; date: string; tourId: string }
  | { kind: 'nthTour'; date: string; tourId: string; count: number }
  | { kind: 'firstPlace'; date: string; tourId: string; place: PlaceSummary }
  | { kind: 'groupAgain'; date: string; tourId: string; groupName: string }

export type OpenQuestion = { reflectionId: string; tourId: string; tourDate: string; groupName: string; text: string }
export type Moment = { moment: TourReflectionMomentResponse; tourId: string; tourDate: string; groupName: string }

export type BuddyRecord = {
  lastTour: LastTour
  nextTourNote: NextTourNote | null
  milestones: Milestone[]
  openQuestions: OpenQuestion[]
  moments: Moment[]
  tours: number
  groups: number
  // Start-to-end time of the sessions held. Tour time, not working hours (#262).
  minutesOnTour: number
  sessionsWithoutTimes: number
  places: PlaceCount[]
  // Tours per group, by group name as the history page counts groups (§8.8).
  perGroup: GroupCount[]
}

// The 5th tour, the 10th, and every 10th after it.
function isMilestoneCount(n: number): boolean {
  return n === 5 || (n >= 10 && n % 10 === 0)
}

function confirmedSessions(entry: MyTourBookingEntry) {
  return entry.bookings.filter((b) => b.bookingStatus === BookingStatusSchema.enum.confirmed)
}

// The distinct places of the buddy's own confirmed sessions, in session order.
function ownPlaces(entry: MyTourBookingEntry): PlaceSummary[] {
  return [...new Map(confirmedSessions(entry).map((s) => [s.place.id, s.place])).values()]
}

const dateOf = (iso: string) => iso.slice(0, 10)
const blankToNull = (text: string | null) => (text?.trim() ? text.trim() : null)

function byCount<T extends { tours: number }>(counts: Map<string, T>): T[] {
  return [...counts.values()].sort((a, b) => b.tours - a.tours)
}

export function buildRecord(
  bookings: MyTourBookingEntry[],
  reflections: TourReflectionResponse[],
  today: string,
): BuddyRecord | null {
  const past = findPastAttended(bookings, today)
  if (past.length === 0) return null

  // Walk the tours oldest first, so each tour sees the visits before it.
  const placeCounts = new Map<string, PlaceCount>()
  const groupCounts = new Map<string, GroupCount>()
  const milestones: Milestone[] = []
  let groupVisit = 0
  let placeVisits: PlaceCount[] = []
  const oldestFirst = [...past].reverse()
  oldestFirst.forEach((entry, i) => {
    const date = dateOf(entry.tourDate)
    const { tourId } = entry
    const n = i + 1
    if (n === 1) milestones.push({ kind: 'firstTour', date, tourId })
    else if (isMilestoneCount(n)) milestones.push({ kind: 'nthTour', date, tourId, count: n })

    const group = groupCounts.get(entry.group.name) ?? { name: entry.group.name, tours: 0 }
    group.tours += 1
    groupCounts.set(group.name, group)
    if (group.tours === 2) milestones.push({ kind: 'groupAgain', date, tourId, groupName: group.name })

    placeVisits = ownPlaces(entry).map((place) => {
      const count = placeCounts.get(place.id) ?? { place, tours: 0 }
      count.tours += 1
      placeCounts.set(place.id, count)
      // The first tour's places are already "the first tour".
      if (count.tours === 1 && n > 1) milestones.push({ kind: 'firstPlace', date, tourId, place })
      return { place, tours: count.tours }
    })
    groupVisit = group.tours
  })

  const tourById = new Map(past.map((e) => [e.tourId, e]))
  // Newest tour first; within a tour, the order the sessions ran.
  const own = reflections
    .flatMap((r) => {
      const tour = tourById.get(r.tourId)
      return tour ? [{ r, tour }] : []
    })
    .sort((a, b) => b.tour.tourDate.localeCompare(a.tour.tourDate) || a.r.sessionOrder - b.r.sessionOrder)

  const latest = past[0]
  const withImprove = own.flatMap(({ r, tour }) => {
    const text = blankToNull(r.couldImprove)
    return text ? [{ text, tour }] : []
  })[0]
  const nextTour =
    bookings
      .filter(
        (e) =>
          dateOf(e.tourDate) >= today &&
          e.status === TourStatusSchema.enum.published &&
          confirmedSessions(e).length > 0,
      )
      .sort((a, b) => a.tourDate.localeCompare(b.tourDate))[0] ?? null

  let minutesOnTour = 0
  let sessionsWithoutTimes = 0
  for (const s of past.flatMap(confirmedSessions)) {
    if (s.startTime && s.endTime && s.endTime > s.startTime) {
      minutesOnTour += (Date.parse(s.endTime) - Date.parse(s.startTime)) / 60000
    } else {
      sessionsWithoutTimes += 1
    }
  }

  return {
    lastTour: {
      entry: latest,
      groupVisit,
      placeVisits,
      didWell: own.filter(({ r }) => r.tourId === latest.tourId).map(({ r }) => blankToNull(r.didWell)).find(Boolean) ?? null,
      canReflect: !latest.reflectionSubmitted && latest.status === TourStatusSchema.enum.completed,
    },
    nextTourNote: withImprove ? { couldImprove: withImprove.text, fromTourDate: withImprove.tour.tourDate, nextTour } : null,
    milestones: milestones.reverse(),
    openQuestions: own.flatMap(({ r, tour }) => {
      const text = blankToNull(r.openQuestions)
      return text ? [{ reflectionId: r.id, tourId: r.tourId, tourDate: tour.tourDate, groupName: tour.group.name, text }] : []
    }),
    moments: own.flatMap(({ r, tour }) =>
      r.moments.map((moment) => ({ moment, tourId: r.tourId, tourDate: tour.tourDate, groupName: tour.group.name })),
    ),
    tours: past.length,
    groups: groupCounts.size,
    minutesOnTour,
    sessionsWithoutTimes,
    places: byCount(placeCounts),
    perGroup: byCount(groupCounts),
  }
}

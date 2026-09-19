import { TourStatusSchema } from '@peace-buddy/types'
import type { TourStatus } from '@peace-buddy/types'
import { buildVCalendar } from './ics'
import type { IcsEvent, IcsEventStatus } from './ics'

// Not a resolvable hostname — RFC 5545 only requires a UID to be a globally
// unique token, and it never needs to be dereferenced.
const UID_DOMAIN = 'peace-buddy.internal'

// A session's default duration when neither startTime nor endTime is set —
// which is the common case; see docs/decisions.md, "#199".
const DEFAULT_DURATION_MS = 60 * 60 * 1000

export type TourForIcs = {
  tourDate: Date
  status: TourStatus
  group: { name: string }
  location: string
  description: string | null
}

// Cancelling a tour does not touch the Booking rows, so a buddy who already
// downloaded the file still holds a confirmed booking and would otherwise keep
// a dead event on their phone. The UID is stable per session, so re-downloading
// rewrites the same entry — carrying STATUS is what makes that re-download
// able to *retract* the event rather than only re-add it — as far as the
// client allows: no SEQUENCE is emitted (TourSession has no revision counter
// to derive one from), so a strict client may not apply the retraction without
// a manual re-import. See docs/decisions.md, "#199".
// A draft tour is not a commitment yet, so it maps to TENTATIVE.
function icsStatusFor(status: TourStatus): IcsEventStatus {
  if (status === TourStatusSchema.enum.cancelled) return 'CANCELLED'
  if (status === TourStatusSchema.enum.draft) return 'TENTATIVE'
  return 'CONFIRMED'
}

export type SessionForIcs = {
  id: string
  label: string | null
  meetingTime: Date
  startTime: Date | null
  endTime: Date | null
}

// The Prisma `select` that produces exactly TourForIcs + SessionForIcs. Shared
// by tour.service's getTourIcs and adminTour.service's getAdminTourIcs: the two
// endpoints differ only in which sessions they pass on, so a field added to the
// types above must not have to be remembered in two unrelated services.
export const icsTourSelect = {
  tourDate: true,
  status: true,
  location: true,
  description: true,
  group: { select: { name: true } },
  sessions: {
    select: { id: true, label: true, meetingTime: true, startTime: true, endTime: true },
    orderBy: { order: 'asc' as const },
  },
} as const

// TourSession's time columns (`@db.Time`) are written by combining the
// admin's entered HH:MM directly onto `setUTCHours` — see adminTour.service's
// `parseTime` — so the UTC hour/minute already *is* the intended JST
// wall-clock hour/minute, not a real UTC time. Building the actual instant
// means taking that HH:MM together with the tour's JST calendar date and
// subtracting the fixed 9h offset, the same offset getTodayJst uses (no
// timezone library — Japan has no DST, so a fixed offset is exact).
function combineJstDateTime(tourDate: Date, time: Date): Date {
  const jstWallClock = Date.UTC(
    tourDate.getUTCFullYear(),
    tourDate.getUTCMonth(),
    tourDate.getUTCDate(),
    time.getUTCHours(),
    time.getUTCMinutes(),
  )
  return new Date(jstWallClock - 9 * 60 * 60 * 1000)
}

export function buildTourIcsEvents(tour: TourForIcs, sessions: SessionForIcs[]): IcsEvent[] {
  const status = icsStatusFor(tour.status)

  return sessions.map((session) => {
    const start = combineJstDateTime(tour.tourDate, session.startTime ?? session.meetingTime)
    const explicitEnd = session.endTime ? combineJstDateTime(tour.tourDate, session.endTime) : null

    // RFC 5545 requires DTEND > DTSTART. `startTime` and `endTime` are
    // independent optional fields with no ordering constraint in
    // CreateTourSessionSchema / UpdateTourSessionSchema and no check in the
    // session service, so the API accepts `endTime` alone (measured against
    // `meetingTime` here) or an `endTime` before `startTime`. Fall back to the
    // default duration rather than emit an event no calendar will accept.
    const end = explicitEnd && explicitEnd.getTime() > start.getTime()
      ? explicitEnd
      : new Date(start.getTime() + DEFAULT_DURATION_MS)

    return {
      uid: `session-${session.id}@${UID_DOMAIN}`,
      dtstart: start,
      dtend: end,
      summary: session.label ? `${tour.group.name} (${session.label})` : tour.group.name,
      status,
      location: tour.location,
      description: tour.description,
    }
  })
}

export function buildTourIcs(tour: TourForIcs, sessions: SessionForIcs[]): string {
  return buildVCalendar(buildTourIcsEvents(tour, sessions))
}

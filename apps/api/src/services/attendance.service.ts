import { Prisma } from '@prisma/client'
import {
  AttendanceChangeKindSchema,
  BookingStatusSchema,
  NotifEventKindSchema,
  TourStatusSchema,
  type AdminAttendanceDay,
  type AttendanceChangeEntry,
  type AttendanceChangeKind,
  type AttendanceDay,
  type AttendanceMonthResponse,
  type AttendanceTourRef,
  type CreateAttendanceFlag,
  type LateReason,
  type MemberType,
  type MyAttendanceResponse,
  type SetAttendanceBreak,
  type TourAttendanceResponse,
  type TourAttendanceRow,
  type UpdateAttendance,
} from '@peace-buddy/types'
import { db } from '../lib/db'
import { enqueueInAppForAllAdmins, enqueueSlackForAdmins } from './notification.service'

// The attendance record (#262, PRD §11.10, docs/decisions.md 2026-10-01).
// Defaults plus exceptions: a buddy starts at the meeting time of their first
// confirmed session and ends at the day's finish time, unless a row says
// otherwise. Hours per buddy per day are first arrival → last leave − breaks.
// A break belongs to the tour: everyone on it takes it together.

export class AttendanceTourNotFoundError extends Error {}
export class AttendanceBuddyNotFoundError extends Error {}
export class AttendanceTourNotCompletedError extends Error {}
export class AttendanceMonthLockedError extends Error {}
export class AttendanceInvalidError extends Error {}
export class AttendanceDateNotFoundError extends Error {}
export class AttendanceMonthAlreadyLockedError extends Error {}
export class AttendanceMonthNotLockedError extends Error {}
export class AttendanceFlagNotFoundError extends Error {}
export class AttendanceFlagResolvedError extends Error {}
export class AttendanceFlagOpenError extends Error {}

// ---- Times ----
//
// A `@db.Time` column comes back as a Date on 1970-01-01 whose UTC clock is
// the Japanese clock time, as meetingTime is written. Minutes since midnight
// keep the arithmetic plain.

export function toMinutes(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

export function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatMinutes(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function timeOf(min: number): Date {
  const d = new Date(0)
  d.setUTCHours(Math.floor(min / 60), min % 60, 0, 0)
  return d
}

function dateOf(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthStart(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`)
}

function nextMonthStart(month: string): Date {
  const d = monthStart(month)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

function monthOf(date: Date): string {
  return date.toISOString().slice(0, 7)
}

// ---- Pure computation ----

export type AttendanceRecord = {
  absent: boolean
  absenceReported: boolean | null
  arrivalTime: Date | null
  lateReason: LateReason | null
  lateNote: string | null
  lateExcused: boolean | null
  leaveTime: Date | null
  leaveNote: string | null
}

const attendanceSelect = {
  buddyId: true,
  absent: true,
  absenceReported: true,
  arrivalTime: true,
  lateReason: true,
  lateNote: true,
  lateExcused: true,
  leaveTime: true,
  leaveNote: true,
} as const

// A tour's break in minutes since midnight; start and end both or neither.
export type TourBreak = { start: number | null; end: number | null; minutes: number }

const breakSelect = { breakStart: true, breakEnd: true, breakMinutes: true } as const

function toTourBreak(row: { breakStart: Date | null; breakEnd: Date | null; breakMinutes: number } | null): TourBreak | null {
  if (!row) return null
  return {
    start: row.breakStart ? toMinutes(row.breakStart) : null,
    end: row.breakEnd ? toMinutes(row.breakEnd) : null,
    minutes: row.breakMinutes,
  }
}

// The part of the tour's break inside one buddy's start → end. A break with
// times counts only where it overlaps; one given as minutes counts whole,
// up to the buddy's own span.
export function breakWithin(brk: TourBreak | null, start: number, end: number | null): number {
  if (!brk) return 0
  if (brk.start !== null && brk.end !== null) {
    return Math.max(0, Math.min(brk.end, end ?? brk.end) - Math.max(brk.start, start))
  }
  return end === null ? brk.minutes : Math.min(brk.minutes, Math.max(0, end - start))
}

export type TourSpan = {
  absent: boolean
  start: number
  // Null while the day has no finish time and the buddy no leave time.
  end: number | null
  breakMinutes: number
  lateMinutes: number
  lateExcused: boolean | null
}

// One buddy on one tour. The finish time is only a default: a leave time of
// the buddy's own wins, whatever order the two were entered in.
export function tourSpan(
  defaultArrival: number,
  rec: AttendanceRecord | null,
  finish: number | null,
  brk: TourBreak | null = null,
): TourSpan {
  const start = rec?.arrivalTime ? toMinutes(rec.arrivalTime) : defaultArrival
  const end = rec?.leaveTime ? toMinutes(rec.leaveTime) : finish
  const absent = rec?.absent ?? false
  return {
    absent,
    start,
    end,
    breakMinutes: absent ? 0 : breakWithin(brk, start, end),
    lateMinutes: Math.max(0, start - defaultArrival),
    lateExcused: rec?.lateExcused ?? null,
  }
}

export function spanMinutes(span: TourSpan): number | null {
  if (span.absent) return 0
  if (span.end === null) return null
  return Math.max(0, span.end - span.start - span.breakMinutes)
}

export type DayTotals = Omit<AttendanceDay, 'date' | 'tours'> & { lateMinutes: number; lateExcused: boolean | null }

// One buddy on one day: first arrival → last leave − breaks, over the tours
// they were not absent from. The gap between two tours is paid unless a break
// is recorded. Absent from every tour is 0 hours.
export function combineDay(spans: TourSpan[]): DayTotals {
  const present = spans.filter((s) => !s.absent)
  if (present.length === 0) {
    return { start: null, end: null, breakMinutes: 0, minutes: 0, absent: true, finishMissing: false, lateMinutes: 0, lateExcused: null }
  }
  const start = Math.min(...present.map((s) => s.start))
  const finishMissing = present.some((s) => s.end === null)
  const end = finishMissing ? null : Math.max(...present.map((s) => s.end as number))
  const breakMinutes = present.reduce((sum, s) => sum + s.breakMinutes, 0)
  const late = present.filter((s) => s.lateMinutes > 0)
  return {
    start: formatMinutes(start),
    end: end === null ? null : formatMinutes(end),
    breakMinutes,
    minutes: end === null ? null : Math.max(0, end - start - breakMinutes),
    absent: false,
    finishMissing,
    lateMinutes: late.reduce((sum, s) => sum + s.lateMinutes, 0),
    // Unexcused if any lateness that day was; null when on time.
    lateExcused: late.length === 0 ? null : late.every((s) => s.lateExcused === true),
  }
}

// ---- Loading ----

const confirmed = BookingStatusSchema.enum.confirmed

const tourSelect = {
  id: true,
  tourDate: true,
  status: true,
  group: { select: { name: true } },
  sessions: {
    select: {
      meetingTime: true,
      bookings: {
        where: { status: confirmed },
        select: { buddyId: true, buddy: { select: { displayName: true, realName: true, memberType: true } } },
      },
    },
  },
  attendances: { select: attendanceSelect },
  attendanceBreak: { select: breakSelect },
} satisfies Prisma.TourSelect

type LoadedTour = Prisma.TourGetPayload<{ select: typeof tourSelect }>

type BuddyOnTour = {
  buddyId: string
  displayName: string
  realName: string
  memberType: MemberType
  defaultArrival: number
  record: AttendanceRecord | null
}

// Everyone confirmed on the tour, each with the meeting time of their earliest
// confirmed session as their default start.
function buddiesOn(tour: LoadedTour): BuddyOnTour[] {
  const byBuddy = new Map<string, BuddyOnTour>()
  for (const session of tour.sessions) {
    const meeting = toMinutes(session.meetingTime)
    for (const b of session.bookings) {
      const existing = byBuddy.get(b.buddyId)
      if (existing) {
        existing.defaultArrival = Math.min(existing.defaultArrival, meeting)
        continue
      }
      byBuddy.set(b.buddyId, {
        buddyId: b.buddyId,
        displayName: b.buddy.displayName,
        realName: b.buddy.realName,
        memberType: b.buddy.memberType as MemberType,
        defaultArrival: meeting,
        record: null,
      })
    }
  }
  for (const rec of tour.attendances) {
    const entry = byBuddy.get(rec.buddyId)
    if (entry) entry.record = { ...rec, lateReason: rec.lateReason as LateReason | null }
  }
  return [...byBuddy.values()]
}

async function loadFinishTimes(dates: Date[]): Promise<Map<string, number>> {
  if (dates.length === 0) return new Map()
  const rows = await db.attendanceDay.findMany({
    where: { date: { in: dates } },
    select: { date: true, finishTime: true },
  })
  return new Map(rows.map((r) => [dateOf(r.date), toMinutes(r.finishTime)]))
}

async function isLocked(date: Date): Promise<boolean> {
  const lock = await db.attendanceMonthLock.findUnique({
    where: { month: monthStart(monthOf(date)) },
    select: { id: true },
  })
  return lock !== null
}

function adminName(user: { email: string; adminProfile: { name: string } | null }): string {
  return user.adminProfile?.name ?? user.email.split('@')[0]
}

type DayEntry = {
  date: string
  buddy: Omit<BuddyOnTour, 'defaultArrival' | 'record'>
  tours: AttendanceTourRef[]
  spans: TourSpan[]
}

// Groups completed tours into one entry per buddy per date.
function groupDays(tours: LoadedTour[], finishTimes: Map<string, number>, buddyId?: string): DayEntry[] {
  const days = new Map<string, DayEntry>()
  for (const tour of tours) {
    const date = dateOf(tour.tourDate)
    const finish = finishTimes.get(date) ?? null
    const brk = toTourBreak(tour.attendanceBreak)
    for (const b of buddiesOn(tour)) {
      if (buddyId && b.buddyId !== buddyId) continue
      const key = `${date}:${b.buddyId}`
      const entry = days.get(key) ?? {
        date,
        buddy: { buddyId: b.buddyId, displayName: b.displayName, realName: b.realName, memberType: b.memberType },
        tours: [],
        spans: [],
      }
      entry.tours.push({ tourId: tour.id, groupName: tour.group.name })
      entry.spans.push(tourSpan(b.defaultArrival, b.record, finish, brk))
      days.set(key, entry)
    }
  }
  return [...days.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.buddy.displayName.localeCompare(b.buddy.displayName),
  )
}

async function loadCompletedTours(where: Prisma.TourWhereInput): Promise<LoadedTour[]> {
  return db.tour.findMany({
    where: { ...where, status: TourStatusSchema.enum.completed },
    select: tourSelect,
    orderBy: { tourDate: 'asc' },
  })
}

// ---- Change log ----

type LogRecord = Record<string, string | number | boolean | null>

function toLog(rec: AttendanceRecord | null): LogRecord | null {
  if (!rec) return null
  const time = (d: Date | null) => (d ? formatMinutes(toMinutes(d)) : null)
  return {
    absent: rec.absent,
    absenceReported: rec.absenceReported,
    arrivalTime: time(rec.arrivalTime),
    lateReason: rec.lateReason,
    lateNote: rec.lateNote,
    lateExcused: rec.lateExcused,
    leaveTime: time(rec.leaveTime),
    leaveNote: rec.leaveNote,
  }
}

function breakLog(brk: TourBreak | null): LogRecord | null {
  if (!brk) return null
  return {
    breakStart: brk.start === null ? null : formatMinutes(brk.start),
    breakEnd: brk.end === null ? null : formatMinutes(brk.end),
    breakMinutes: brk.minutes,
  }
}

// A missing side is the default: for a buddy, not absent and every other
// field empty; for a break, no break.
export function changedFields(before: unknown, after: unknown, empty: LogRecord = { absent: false }): string[] {
  const b = (before ?? empty) as LogRecord
  const a = (after ?? empty) as LogRecord
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])]
  return keys.filter((k) => (b[k] ?? null) !== (a[k] ?? null))
}

function jsonOrNull(value: LogRecord | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value ?? Prisma.DbNull
}

// ---- Tour sheet ----

function toRow(b: BuddyOnTour, finish: number | null, brk: TourBreak | null): TourAttendanceRow {
  const rec = b.record
  const span = tourSpan(b.defaultArrival, rec, finish, brk)
  const time = (d: Date | null | undefined) => (d ? formatMinutes(toMinutes(d)) : null)
  return {
    buddyId: b.buddyId,
    displayName: b.displayName,
    realName: b.realName,
    memberType: b.memberType,
    defaultArrival: formatMinutes(b.defaultArrival),
    arrivalTime: time(rec?.arrivalTime),
    lateMinutes: span.absent ? 0 : span.lateMinutes,
    lateReason: rec?.lateReason ?? null,
    lateNote: rec?.lateNote ?? null,
    lateExcused: rec?.lateExcused ?? null,
    leaveTime: time(rec?.leaveTime),
    leaveNote: rec?.leaveNote ?? null,
    earlyMinutes: finish === null ? null : rec?.leaveTime ? Math.max(0, finish - toMinutes(rec.leaveTime)) : 0,
    absent: span.absent,
    absenceReported: rec?.absenceReported ?? null,
    breakMinutes: span.breakMinutes,
    minutes: spanMinutes(span),
  }
}

export async function getTourAttendance(tourId: string): Promise<TourAttendanceResponse | null> {
  const tour = await db.tour.findUnique({ where: { id: tourId }, select: tourSelect })
  if (!tour) return null

  const [sameDay, finishTimes, locked, changes] = await Promise.all([
    loadCompletedTours({ tourDate: tour.tourDate, id: { not: tour.id } }),
    loadFinishTimes([tour.tourDate]),
    isLocked(tour.tourDate),
    db.attendanceChange.findMany({
      where: {
        date: tour.tourDate,
        OR: [
          { kind: { in: [AttendanceChangeKindSchema.enum.finish_time, AttendanceChangeKindSchema.enum.attendance] } },
          { kind: AttendanceChangeKindSchema.enum.tour_break, tourId: tour.id },
        ],
      },
      select: {
        id: true,
        kind: true,
        buddyId: true,
        before: true,
        after: true,
        createdAt: true,
        changer: { select: { email: true, adminProfile: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  const finish = finishTimes.get(dateOf(tour.tourDate)) ?? null
  const completed = tour.status === TourStatusSchema.enum.completed
  const buddies = buddiesOn(tour)
  const brk = toTourBreak(tour.attendanceBreak)

  // Everyone that day whose end is the finish time, on every completed tour.
  // A buddy on two tours of the date counts once.
  const dayTours = completed ? [tour, ...sameDay] : sameDay
  const followingFinish = new Set(
    dayTours
      .flatMap(buddiesOn)
      .filter((b) => !b.record?.absent && !b.record?.leaveTime)
      .map((b) => b.buddyId),
  ).size

  const names = new Map(dayTours.flatMap(buddiesOn).map((b) => [b.buddyId, b.displayName]))
  for (const b of buddies) names.set(b.buddyId, b.displayName)
  const missing = changes.filter((c) => c.buddyId && !names.has(c.buddyId)).map((c) => c.buddyId as string)
  if (missing.length > 0) {
    const profiles = await db.buddyProfile.findMany({
      where: { id: { in: missing } },
      select: { id: true, displayName: true },
    })
    for (const p of profiles) names.set(p.id, p.displayName)
  }

  return {
    tourId: tour.id,
    date: dateOf(tour.tourDate),
    editable: completed && !locked,
    locked,
    finishTime: finish === null ? null : formatMinutes(finish),
    break: brk && {
      start: brk.start === null ? null : formatMinutes(brk.start),
      end: brk.end === null ? null : formatMinutes(brk.end),
      minutes: brk.minutes,
    },
    followingFinish,
    rows: buddies.map((b) => toRow(b, finish, brk)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    changes: changes.map(
      (c): AttendanceChangeEntry => ({
        id: c.id,
        kind: c.kind as AttendanceChangeKind,
        buddyName: c.buddyId ? (names.get(c.buddyId) ?? null) : null,
        fields: changedFields(c.before, c.after, c.kind === AttendanceChangeKindSchema.enum.tour_break ? {} : undefined),
        changedByName: adminName(c.changer),
        createdAt: c.createdAt.toISOString(),
      }),
    ),
  }
}

// ---- Writes ----

export async function setFinishTime(date: string, finishTime: string, userId: string): Promise<{ date: string; finishTime: string }> {
  const day = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(day.getTime())) throw new AttendanceInvalidError()
  const tours = await loadCompletedTours({ tourDate: day })
  if (tours.length === 0) throw new AttendanceDateNotFoundError()
  if (await isLocked(day)) throw new AttendanceMonthLockedError()

  // The finish time is the end of everyone present without a leave time of
  // their own, so it must fall after each of their starts, as a leave time must.
  const finish = parseMinutes(finishTime)
  const endsBeforeStart = tours
    .flatMap(buddiesOn)
    .some((b) => !b.record?.absent && !b.record?.leaveTime && finish <= (b.record?.arrivalTime ? toMinutes(b.record.arrivalTime) : b.defaultArrival))
  if (endsBeforeStart) throw new AttendanceInvalidError()

  const time = timeOf(finish)
  await db.$transaction(async (tx) => {
    const before = await tx.attendanceDay.findUnique({ where: { date: day }, select: { finishTime: true } })
    const beforeTime = before ? formatMinutes(toMinutes(before.finishTime)) : null
    if (beforeTime === finishTime) return
    await tx.attendanceDay.upsert({
      where: { date: day },
      update: { finishTime: time, updatedBy: userId },
      create: { date: day, finishTime: time, updatedBy: userId },
    })
    await tx.attendanceChange.create({
      data: {
        kind: AttendanceChangeKindSchema.enum.finish_time,
        date: day,
        before: beforeTime === null ? Prisma.DbNull : { finishTime: beforeTime },
        after: { finishTime },
        changedBy: userId,
      },
    })
  })
  return { date, finishTime }
}

// Replaces one buddy's exceptions on a tour. The default state deletes the row.
export async function updateAttendance(
  tourId: string,
  buddyId: string,
  input: UpdateAttendance,
  userId: string,
): Promise<TourAttendanceResponse> {
  const tour = await db.tour.findUnique({
    where: { id: tourId },
    select: {
      tourDate: true,
      status: true,
      sessions: {
        select: { meetingTime: true, bookings: { where: { buddyId, status: confirmed }, select: { id: true } } },
      },
    },
  })
  if (!tour) throw new AttendanceTourNotFoundError()
  const meetings = tour.sessions.filter((s) => s.bookings.length > 0).map((s) => toMinutes(s.meetingTime))
  if (meetings.length === 0) throw new AttendanceBuddyNotFoundError()
  if (tour.status !== TourStatusSchema.enum.completed) throw new AttendanceTourNotCompletedError()
  if (await isLocked(tour.tourDate)) throw new AttendanceMonthLockedError()

  const defaultArrival = Math.min(...meetings)
  const finish = (await loadFinishTimes([tour.tourDate])).get(dateOf(tour.tourDate)) ?? null

  // An arrival at the default start is not an exception.
  const typedArrival = input.arrivalTime === null ? null : parseMinutes(input.arrivalTime)
  const arrival = typedArrival === defaultArrival ? null : typedArrival
  const late = arrival !== null && arrival > defaultArrival
  if (late && (input.lateReason === null || input.lateExcused === null)) throw new AttendanceInvalidError()
  const leave = input.leaveTime === null ? null : parseMinutes(input.leaveTime)

  const start = arrival ?? defaultArrival
  const end = leave ?? finish
  if (end !== null && end <= start) throw new AttendanceInvalidError()

  const data = {
    absent: input.absent,
    absenceReported: input.absent ? input.absenceReported : null,
    arrivalTime: arrival === null ? null : timeOf(arrival),
    lateReason: late ? input.lateReason : null,
    lateNote: late ? input.lateNote || null : null,
    lateExcused: late ? input.lateExcused : null,
    leaveTime: leave === null ? null : timeOf(leave),
    leaveNote: leave === null ? null : input.leaveNote || null,
  }
  const isDefault = !data.absent && data.arrivalTime === null && data.leaveTime === null

  await db.$transaction(async (tx) => {
    const where = { buddyId_tourId: { buddyId, tourId } }
    const found = await tx.attendance.findUnique({ where, select: attendanceSelect })
    const before = found ? { ...found, lateReason: found.lateReason as LateReason | null } : null
    let after: AttendanceRecord | null = null
    if (isDefault) {
      if (before) await tx.attendance.delete({ where })
    } else {
      const saved = await tx.attendance.upsert({
        where,
        update: { ...data, updatedBy: userId },
        create: { ...data, buddyId, tourId, updatedBy: userId },
        select: attendanceSelect,
      })
      after = { ...saved, lateReason: saved.lateReason as LateReason | null }
    }
    const beforeLog = toLog(before)
    const afterLog = toLog(after)
    if (changedFields(beforeLog, afterLog).length === 0) return
    await tx.attendanceChange.create({
      data: {
        kind: AttendanceChangeKindSchema.enum.attendance,
        date: tour.tourDate,
        buddyId,
        tourId,
        before: jsonOrNull(beforeLog),
        after: jsonOrNull(afterLog),
        changedBy: userId,
      },
    })
  })

  return (await getTourAttendance(tourId)) as TourAttendanceResponse
}

// Sets or removes the tour's break. It applies to everyone on the tour.
export async function setTourBreak(tourId: string, input: SetAttendanceBreak, userId: string): Promise<TourAttendanceResponse> {
  const tour = await db.tour.findUnique({ where: { id: tourId }, select: { tourDate: true, status: true } })
  if (!tour) throw new AttendanceTourNotFoundError()
  if (tour.status !== TourStatusSchema.enum.completed) throw new AttendanceTourNotCompletedError()
  if (await isLocked(tour.tourDate)) throw new AttendanceMonthLockedError()

  const brk = input.break
  const after: TourBreak | null =
    brk === null
      ? null
      : 'start' in brk
        ? { start: parseMinutes(brk.start), end: parseMinutes(brk.end), minutes: parseMinutes(brk.end) - parseMinutes(brk.start) }
        : { start: null, end: null, minutes: brk.minutes }

  await db.$transaction(async (tx) => {
    const found = await tx.attendanceBreak.findUnique({ where: { tourId }, select: breakSelect })
    const beforeLog = breakLog(toTourBreak(found))
    const afterLog = breakLog(after)
    if (changedFields(beforeLog, afterLog, {}).length === 0) return
    if (after === null) {
      await tx.attendanceBreak.delete({ where: { tourId } })
    } else {
      const data = {
        breakStart: after.start === null ? null : timeOf(after.start),
        breakEnd: after.end === null ? null : timeOf(after.end),
        breakMinutes: after.minutes,
        updatedBy: userId,
      }
      await tx.attendanceBreak.upsert({ where: { tourId }, update: data, create: { ...data, tourId } })
    }
    await tx.attendanceChange.create({
      data: {
        kind: AttendanceChangeKindSchema.enum.tour_break,
        date: tour.tourDate,
        tourId,
        before: jsonOrNull(beforeLog),
        after: jsonOrNull(afterLog),
        changedBy: userId,
      },
    })
  })

  return (await getTourAttendance(tourId)) as TourAttendanceResponse
}

// ---- Month ----

function toDay(entry: DayEntry): AttendanceDay & { lateMinutes: number; lateExcused: boolean | null } {
  return { date: entry.date, tours: entry.tours, ...combineDay(entry.spans) }
}

export async function getAttendanceMonth(month: string): Promise<AttendanceMonthResponse> {
  const range = { gte: monthStart(month), lt: nextMonthStart(month) }
  const [tours, lock, flags] = await Promise.all([
    loadCompletedTours({ tourDate: range }),
    db.attendanceMonthLock.findUnique({
      where: { month: monthStart(month) },
      select: { lockedAt: true, locker: { select: { email: true, adminProfile: { select: { name: true } } } } },
    }),
    db.attendanceFlag.findMany({
      where: { date: range, resolvedAt: null },
      select: { id: true, buddyId: true, date: true, note: true, createdAt: true, buddy: { select: { displayName: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const finishTimes = await loadFinishTimes([...new Set(tours.map((t) => t.tourDate.getTime()))].map((t) => new Date(t)))

  return {
    month,
    lock: lock ? { lockedAt: lock.lockedAt.toISOString(), lockedByName: adminName(lock.locker) } : null,
    days: groupDays(tours, finishTimes).map(
      (entry): AdminAttendanceDay => ({ ...entry.buddy, ...toDay(entry) }),
    ),
    openFlags: flags.map((f) => ({
      id: f.id,
      buddyId: f.buddyId,
      displayName: f.buddy.displayName,
      date: dateOf(f.date),
      note: f.note,
      createdAt: f.createdAt.toISOString(),
    })),
  }
}

export async function lockMonth(month: string, userId: string): Promise<void> {
  const start = monthStart(month)
  await db.$transaction(async (tx) => {
    const existing = await tx.attendanceMonthLock.findUnique({ where: { month: start }, select: { id: true } })
    if (existing) throw new AttendanceMonthAlreadyLockedError()
    await tx.attendanceMonthLock.create({ data: { month: start, lockedBy: userId } })
    await tx.attendanceChange.create({
      data: { kind: AttendanceChangeKindSchema.enum.month_locked, date: start, changedBy: userId },
    })
  })
}

export async function unlockMonth(month: string, userId: string): Promise<void> {
  const start = monthStart(month)
  await db.$transaction(async (tx) => {
    const existing = await tx.attendanceMonthLock.findUnique({ where: { month: start }, select: { id: true } })
    if (!existing) throw new AttendanceMonthNotLockedError()
    await tx.attendanceMonthLock.delete({ where: { month: start } })
    await tx.attendanceChange.create({
      data: { kind: AttendanceChangeKindSchema.enum.month_unlocked, date: start, changedBy: userId },
    })
  })
}

export async function resolveFlag(id: string, userId: string): Promise<void> {
  const flag = await db.attendanceFlag.findUnique({ where: { id }, select: { resolvedAt: true } })
  if (!flag) throw new AttendanceFlagNotFoundError()
  if (flag.resolvedAt) throw new AttendanceFlagResolvedError()
  await db.attendanceFlag.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: userId } })
}

// ---- Buddy side ----

export async function getMyAttendance(userId: string, month: string): Promise<MyAttendanceResponse> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true } })
  if (!buddy) return { month, days: [] }

  const range = { gte: monthStart(month), lt: nextMonthStart(month) }
  const [tours, flags] = await Promise.all([
    loadCompletedTours({ tourDate: range, bookings: { some: { buddyId: buddy.id, status: confirmed } } }),
    db.attendanceFlag.findMany({
      where: { buddyId: buddy.id, date: range },
      select: { id: true, date: true, note: true, createdAt: true, resolvedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  const finishTimes = await loadFinishTimes([...new Set(tours.map((t) => t.tourDate.getTime()))].map((t) => new Date(t)))
  // The latest flag per day wins.
  const flagByDate = new Map(flags.map((f) => [dateOf(f.date), f]))

  return {
    month,
    days: groupDays(tours, finishTimes, buddy.id).map((entry) => {
      // Late reasons and whether a lateness was excused stay with PLAB members.
      const t = combineDay(entry.spans)
      const flag = flagByDate.get(entry.date)
      return {
        date: entry.date,
        tours: entry.tours,
        start: t.start,
        end: t.end,
        breakMinutes: t.breakMinutes,
        minutes: t.minutes,
        absent: t.absent,
        finishMissing: t.finishMissing,
        flag: flag
          ? {
              id: flag.id,
              note: flag.note,
              createdAt: flag.createdAt.toISOString(),
              resolvedAt: flag.resolvedAt ? flag.resolvedAt.toISOString() : null,
            }
          : null,
      }
    }),
  }
}

export async function createAttendanceFlag(userId: string, input: CreateAttendanceFlag): Promise<{ id: string }> {
  const buddy = await db.buddyProfile.findUnique({ where: { userId }, select: { id: true, displayName: true } })
  if (!buddy) throw new AttendanceBuddyNotFoundError()
  const date = new Date(`${input.date}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new AttendanceInvalidError()

  const worked = await db.tour.count({
    where: {
      tourDate: date,
      status: TourStatusSchema.enum.completed,
      bookings: { some: { buddyId: buddy.id, status: confirmed } },
    },
  })
  if (worked === 0) throw new AttendanceBuddyNotFoundError()

  return db.$transaction(async (tx) => {
    const open = await tx.attendanceFlag.findFirst({
      where: { buddyId: buddy.id, date, resolvedAt: null },
      select: { id: true },
    })
    if (open) throw new AttendanceFlagOpenError()
    const flag = await tx.attendanceFlag.create({
      data: { buddyId: buddy.id, date, note: input.note },
      select: { id: true },
    })
    const args = {
      eventType: NotifEventKindSchema.enum.attendance_flagged,
      payload: {
        flagId: flag.id,
        buddyId: buddy.id,
        buddyName: buddy.displayName,
        date: input.date,
        month: input.date.slice(0, 7),
      },
    }
    await enqueueInAppForAllAdmins(args, tx)
    await enqueueSlackForAdmins(args, tx)
    return flag
  })
}

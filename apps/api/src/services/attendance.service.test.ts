import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import type { UpdateAttendance } from '@peace-buddy/types'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  tour: { findUnique: MockFn; findMany: MockFn; count: MockFn }
  attendanceDay: { findMany: MockFn; findUnique: MockFn; upsert: MockFn }
  attendanceMonthLock: { findUnique: MockFn; create: MockFn; delete: MockFn }
  attendance: { findUnique: MockFn; upsert: MockFn; delete: MockFn }
  attendanceBreak: { findUnique: MockFn; upsert: MockFn; delete: MockFn }
  attendanceChange: { create: MockFn; findMany: MockFn }
  attendanceFlag: { findMany: MockFn; findFirst: MockFn; findUnique: MockFn; create: MockFn; update: MockFn }
  buddyProfile: { findUnique: MockFn; findMany: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const mockDb = {
    tour: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    attendanceDay: { findMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    attendanceMonthLock: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    attendance: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    attendanceBreak: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    attendanceChange: { create: vi.fn(), findMany: vi.fn() },
    attendanceFlag: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    buddyProfile: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  }
  mockDb.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mockDb))
  return { db: mockDb }
})

vi.mock('./notification.service', () => ({
  enqueueInAppForAllAdmins: vi.fn(),
  enqueueSlackForAdmins: vi.fn(),
}))

import { db } from '../lib/db'
import { enqueueInAppForAllAdmins, enqueueSlackForAdmins } from './notification.service'
import {
  breakWithin,
  combineDay,
  changedFields,
  createAttendanceFlag,
  getAttendanceMonth,
  getTourAttendance,
  lockMonth,
  setFinishTime,
  setTourBreak,
  spanMinutes,
  tourSpan,
  unlockMonth,
  updateAttendance,
  AttendanceBuddyNotFoundError,
  AttendanceDateNotFoundError,
  AttendanceFlagOpenError,
  AttendanceInvalidError,
  AttendanceMonthAlreadyLockedError,
  AttendanceMonthLockedError,
  AttendanceMonthNotLockedError,
  AttendanceTourNotCompletedError,
  AttendanceTourNotFoundError,
  type AttendanceRecord,
} from './attendance.service'

const mdb = db as unknown as MockDb

function time(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`)
}

function min(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function record(overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    absent: false,
    absenceReported: null,
    arrivalTime: null,
    lateReason: null,
    lateNote: null,
    lateExcused: null,
    leaveTime: null,
    leaveNote: null,
    ...overrides,
  }
}

const DEFAULT_INPUT: UpdateAttendance = {
  absent: false,
  absenceReported: null,
  arrivalTime: null,
  lateReason: null,
  lateNote: null,
  lateExcused: null,
  leaveTime: null,
  leaveNote: null,
}

describe('tourSpan and combineDay', () => {
  it('follows the day: meeting time to finish time', () => {
    const span = tourSpan(min('10:00'), null, min('15:30'))
    expect(spanMinutes(span)).toBe(330)
    expect(combineDay([span])).toMatchObject({ start: '10:00', end: '15:30', minutes: 330, absent: false, finishMissing: false })
  })

  it('keeps a leave time of the buddy own whatever the finish time is', () => {
    const rec = record({ leaveTime: time('14:00') })
    expect(tourSpan(min('10:00'), rec, min('15:30')).end).toBe(min('14:00'))
    expect(tourSpan(min('10:00'), rec, min('17:00')).end).toBe(min('14:00'))
  })

  it('counts late minutes from the default start', () => {
    const span = tourSpan(min('10:00'), record({ arrivalTime: time('10:25'), lateExcused: false }), min('15:00'))
    expect(span.lateMinutes).toBe(25)
    expect(combineDay([span])).toMatchObject({ lateMinutes: 25, lateExcused: false, minutes: 275 })
  })

  it('takes away the tour break', () => {
    const span = tourSpan(min('10:00'), null, min('15:00'), { start: null, end: null, minutes: 45 })
    expect(combineDay([span])).toMatchObject({ breakMinutes: 45, minutes: 255 })
  })

  it('takes no break from an absent buddy', () => {
    const span = tourSpan(min('10:00'), record({ absent: true, absenceReported: true }), min('15:00'), { start: null, end: null, minutes: 45 })
    expect(span.breakMinutes).toBe(0)
  })

  it('pays the gap between two tours: first arrival to last leave', () => {
    const morning = tourSpan(min('09:00'), record({ leaveTime: time('11:30') }), min('16:00'))
    const afternoon = tourSpan(min('13:00'), null, min('16:00'))
    expect(combineDay([morning, afternoon])).toMatchObject({ start: '09:00', end: '16:00', minutes: 420 })
  })

  it('is 0 hours when absent, reported or not', () => {
    const span = tourSpan(min('10:00'), record({ absent: true, absenceReported: true }), min('15:00'))
    expect(spanMinutes(span)).toBe(0)
    expect(combineDay([span])).toMatchObject({ absent: true, minutes: 0, start: null, end: null })
  })

  it('leaves out the tour absent from when the buddy worked another that day', () => {
    const absent = tourSpan(min('09:00'), record({ absent: true, absenceReported: false }), min('16:00'))
    const worked = tourSpan(min('13:00'), null, min('16:00'))
    expect(combineDay([absent, worked])).toMatchObject({ start: '13:00', end: '16:00', minutes: 180, absent: false })
  })

  it('has no hours until the finish time is recorded', () => {
    const span = tourSpan(min('10:00'), null, null)
    expect(spanMinutes(span)).toBeNull()
    expect(combineDay([span])).toMatchObject({ minutes: null, end: null, finishMissing: true })
  })

  it('needs no finish time when the buddy left at a time of their own', () => {
    const span = tourSpan(min('10:00'), record({ leaveTime: time('12:00') }), null)
    expect(combineDay([span])).toMatchObject({ minutes: 120, finishMissing: false })
  })
})

describe('breakWithin', () => {
  const lunch = { start: min('12:00'), end: min('12:45'), minutes: 45 }

  it('counts only the part of a timed break inside the buddy span', () => {
    expect(breakWithin(lunch, min('10:00'), min('15:00'))).toBe(45)
    expect(breakWithin(lunch, min('10:00'), min('12:15'))).toBe(15)
    expect(breakWithin(lunch, min('13:00'), min('15:00'))).toBe(0)
    expect(breakWithin(lunch, min('10:00'), null)).toBe(45)
  })

  it('counts a break given as minutes whole, up to the span', () => {
    const minutes = { start: null, end: null, minutes: 45 }
    expect(breakWithin(minutes, min('10:00'), min('15:00'))).toBe(45)
    expect(breakWithin(minutes, min('10:00'), min('10:30'))).toBe(30)
    expect(breakWithin(null, min('10:00'), min('15:00'))).toBe(0)
  })
})

describe('changedFields', () => {
  it('lists the keys that differ, treating a missing side as null', () => {
    expect(changedFields({ arrivalTime: '10:25', absent: false }, { arrivalTime: '10:30', absent: false })).toEqual(['arrivalTime'])
    expect(changedFields(null, { absent: true, arrivalTime: null })).toEqual(['absent'])
    expect(changedFields({ finishTime: '15:00' }, { finishTime: '15:00' })).toEqual([])
    expect(changedFields(null, { breakStart: null, breakEnd: null, breakMinutes: 30 }, {})).toEqual(['breakMinutes'])
  })
})

const TOUR_DATE = new Date('2026-06-10T00:00:00.000Z')

function loadedTour(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    tourDate: TOUR_DATE,
    status: 'completed',
    group: { name: 'Sakura School' },
    sessions: [
      {
        meetingTime: time('10:00'),
        bookings: [
          { buddyId: 'b1', buddy: { displayName: 'Aya', realName: '綾', memberType: 'buddy' } },
          { buddyId: 'b2', buddy: { displayName: 'Ken', realName: '健', memberType: 'buddy' } },
        ],
      },
      {
        meetingTime: time('13:00'),
        bookings: [{ buddyId: 'b3', buddy: { displayName: 'Mio', realName: '澪', memberType: 'plab_member' } }],
      },
    ],
    attendances: [],
    ...overrides,
  }
}

describe('getTourAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.tour.findMany.mockResolvedValue([])
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    mdb.attendanceChange.findMany.mockResolvedValue([])
    mdb.attendanceDay.findMany.mockResolvedValue([{ date: TOUR_DATE, finishTime: time('15:30') }])
  })

  it('returns null for an unknown tour', async () => {
    mdb.tour.findUnique.mockResolvedValue(null)
    expect(await getTourAttendance('nope')).toBeNull()
  })

  it('gives each confirmed buddy the meeting time of their own session as the default start', async () => {
    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    const sheet = await getTourAttendance('t1')

    expect(sheet!.rows.map((r) => [r.displayName, r.defaultArrival, r.minutes])).toEqual([
      ['Aya', '10:00', 330],
      ['Ken', '10:00', 330],
      ['Mio', '13:00', 150],
    ])
    expect(sheet!.finishTime).toBe('15:30')
    expect(sheet!.editable).toBe(true)
  })

  it('counts the buddies following the finish time across every completed tour of the date', async () => {
    mdb.tour.findUnique.mockResolvedValue(
      loadedTour({
        attendances: [{ ...record({ leaveTime: time('14:00') }), buddyId: 'b1' }, { ...record({ absent: true, absenceReported: true }), buddyId: 'b2' }],
      }),
    )
    mdb.tour.findMany.mockResolvedValue([
      loadedTour({ id: 't2', sessions: [{ meetingTime: time('09:00'), bookings: [{ buddyId: 'b9', buddy: { displayName: 'Rin', realName: '凛', memberType: 'buddy' } }] }] }),
    ])
    const sheet = await getTourAttendance('t1')

    expect(sheet!.followingFinish).toBe(2)
    const aya = sheet!.rows.find((r) => r.buddyId === 'b1')!
    expect(aya).toMatchObject({ leaveTime: '14:00', earlyMinutes: 90, minutes: 240 })
    const ken = sheet!.rows.find((r) => r.buddyId === 'b2')!
    expect(ken).toMatchObject({ absent: true, absenceReported: true, minutes: 0 })
  })

  it('counts a buddy on two tours of the date once', async () => {
    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    mdb.tour.findMany.mockResolvedValue([
      loadedTour({ id: 't2', sessions: [{ meetingTime: time('16:00'), bookings: [{ buddyId: 'b1', buddy: { displayName: 'Aya', realName: '綾', memberType: 'buddy' } }] }] }),
    ])
    const sheet = await getTourAttendance('t1')

    expect(sheet!.followingFinish).toBe(3)
  })

  it('takes the tour break from everyone on the tour, as far as it falls in their span', async () => {
    mdb.tour.findUnique.mockResolvedValue(
      loadedTour({ attendanceBreak: { breakStart: time('12:00'), breakEnd: time('12:45'), breakMinutes: 45 } }),
    )
    const sheet = await getTourAttendance('t1')

    expect(sheet!.break).toEqual({ start: '12:00', end: '12:45', minutes: 45 })
    expect(sheet!.rows.map((r) => [r.displayName, r.breakMinutes, r.minutes])).toEqual([
      ['Aya', 45, 285],
      ['Ken', 45, 285],
      ['Mio', 0, 150],
    ])
  })

  it('is read-only before the tour is completed and while the month is locked', async () => {
    mdb.tour.findUnique.mockResolvedValue(loadedTour({ status: 'published' }))
    expect((await getTourAttendance('t1'))!.editable).toBe(false)

    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    mdb.attendanceMonthLock.findUnique.mockResolvedValue({ id: 'lock' })
    const sheet = await getTourAttendance('t1')
    expect(sheet!.editable).toBe(false)
    expect(sheet!.locked).toBe(true)
  })

  it('names who changed whose record and which fields', async () => {
    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    mdb.attendanceChange.findMany.mockResolvedValue([
      {
        id: 'c1',
        kind: 'attendance',
        buddyId: 'b1',
        before: null,
        after: { absent: false, arrivalTime: '10:25', lateExcused: false },
        createdAt: new Date('2026-06-10T08:00:00Z'),
        changer: { email: 'lynn@example.com', adminProfile: { name: 'Lynn' } },
      },
    ])
    const sheet = await getTourAttendance('t1')

    expect(sheet!.changes).toEqual([
      { id: 'c1', kind: 'attendance', buddyName: 'Aya', fields: ['arrivalTime', 'lateExcused'], changedByName: 'Lynn', createdAt: '2026-06-10T08:00:00.000Z' },
    ])
  })
})

function tourForUpdate(overrides: Record<string, unknown> = {}) {
  return {
    tourDate: TOUR_DATE,
    status: 'completed',
    sessions: [
      { meetingTime: time('10:00'), bookings: [{ id: 'bk1' }] },
      { meetingTime: time('13:00'), bookings: [] },
    ],
    ...overrides,
  }
}

describe('updateAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.tour.findUnique.mockResolvedValueOnce(tourForUpdate())
    // The sheet reloaded after the write.
    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    mdb.tour.findMany.mockResolvedValue([])
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    mdb.attendanceDay.findMany.mockResolvedValue([{ date: TOUR_DATE, finishTime: time('15:30') }])
    mdb.attendanceChange.findMany.mockResolvedValue([])
    mdb.attendance.findUnique.mockResolvedValue(null)
    mdb.attendance.upsert.mockImplementation((args: unknown) => {
      const { create } = args as { create: Record<string, unknown> }
      return Promise.resolve(create)
    })
  })

  it('refuses an unknown tour, a buddy not confirmed on it, a tour not completed and a locked month', async () => {
    mdb.tour.findUnique.mockReset()
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    await expect(updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')).rejects.toBeInstanceOf(AttendanceTourNotFoundError)

    mdb.tour.findUnique.mockResolvedValueOnce(tourForUpdate({ sessions: [{ meetingTime: time('10:00'), bookings: [] }] }))
    await expect(updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')).rejects.toBeInstanceOf(AttendanceBuddyNotFoundError)

    mdb.tour.findUnique.mockResolvedValueOnce(tourForUpdate({ status: 'published' }))
    await expect(updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')).rejects.toBeInstanceOf(AttendanceTourNotCompletedError)

    mdb.tour.findUnique.mockResolvedValueOnce(tourForUpdate())
    mdb.attendanceMonthLock.findUnique.mockResolvedValueOnce({ id: 'lock' })
    await expect(updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')).rejects.toBeInstanceOf(AttendanceMonthLockedError)
    expect(mdb.attendance.upsert).not.toHaveBeenCalled()
  })

  it('needs a reason and excused for a late arrival', async () => {
    await expect(
      updateAttendance('t1', 'b1', { ...DEFAULT_INPUT, arrivalTime: '10:25' }, 'u1'),
    ).rejects.toBeInstanceOf(AttendanceInvalidError)
  })

  it('stores a late arrival with its reason, and logs the change', async () => {
    await updateAttendance(
      't1',
      'b1',
      { ...DEFAULT_INPUT, arrivalTime: '10:25', lateReason: 'transport_delay', lateExcused: true },
      'u1',
    )

    const { create } = mdb.attendance.upsert.mock.calls[0][0] as { create: Record<string, unknown> }
    expect(create).toMatchObject({ buddyId: 'b1', tourId: 't1', arrivalTime: time('10:25'), lateReason: 'transport_delay', lateExcused: true, updatedBy: 'u1' })
    const { data } = mdb.attendanceChange.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data).toMatchObject({ kind: 'attendance', date: TOUR_DATE, buddyId: 'b1', tourId: 't1', changedBy: 'u1' })
    expect(data.after).toMatchObject({ arrivalTime: '10:25', lateExcused: true })
  })

  it('drops the late fields for an arrival that is not late, and an arrival at the default start', async () => {
    await updateAttendance(
      't1',
      'b1',
      { ...DEFAULT_INPUT, arrivalTime: '09:50', lateReason: 'other', lateNote: 'x', lateExcused: false, leaveTime: '14:00' },
      'u1',
    )
    const first = (mdb.attendance.upsert.mock.calls[0][0] as { create: Record<string, unknown> }).create
    expect(first).toMatchObject({ arrivalTime: time('09:50'), lateReason: null, lateNote: null, lateExcused: null })

    mdb.tour.findUnique.mockResolvedValueOnce(tourForUpdate())
    await updateAttendance('t1', 'b1', { ...DEFAULT_INPUT, arrivalTime: '10:00', leaveTime: '14:00' }, 'u1')
    const second = (mdb.attendance.upsert.mock.calls[1][0] as { create: Record<string, unknown> }).create
    expect(second.arrivalTime).toBeNull()
  })

  it('refuses a leave before the arrival', async () => {
    await expect(
      updateAttendance('t1', 'b1', { ...DEFAULT_INPUT, leaveTime: '09:30' }, 'u1'),
    ).rejects.toBeInstanceOf(AttendanceInvalidError)
  })

  it('deletes the row on "back to default" and logs what it held', async () => {
    mdb.attendance.findUnique.mockResolvedValue(record({ leaveTime: time('14:00') }))
    await updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')

    expect(mdb.attendance.delete).toHaveBeenCalledWith({ where: { buddyId_tourId: { buddyId: 'b1', tourId: 't1' } } })
    expect(mdb.attendance.upsert).not.toHaveBeenCalled()
    const { data } = mdb.attendanceChange.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data.before).toMatchObject({ leaveTime: '14:00' })
  })

  it('logs nothing when nothing changed', async () => {
    await updateAttendance('t1', 'b1', DEFAULT_INPUT, 'u1')
    expect(mdb.attendance.delete).not.toHaveBeenCalled()
    expect(mdb.attendanceChange.create).not.toHaveBeenCalled()
  })

  it('stores an absence with no times', async () => {
    await updateAttendance('t1', 'b1', { ...DEFAULT_INPUT, absent: true, absenceReported: false }, 'u1')
    const { create } = mdb.attendance.upsert.mock.calls[0][0] as { create: Record<string, unknown> }
    expect(create).toMatchObject({ absent: true, absenceReported: false, arrivalTime: null, leaveTime: null })
  })
})

describe('setTourBreak', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.tour.findUnique.mockResolvedValueOnce({ tourDate: TOUR_DATE, status: 'completed' })
    // The sheet reloaded after the write.
    mdb.tour.findUnique.mockResolvedValue(loadedTour())
    mdb.tour.findMany.mockResolvedValue([])
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    mdb.attendanceDay.findMany.mockResolvedValue([{ date: TOUR_DATE, finishTime: time('15:30') }])
    mdb.attendanceChange.findMany.mockResolvedValue([])
    mdb.attendanceBreak.findUnique.mockResolvedValue(null)
  })

  it('refuses an unknown tour, a tour not completed and a locked month', async () => {
    mdb.tour.findUnique.mockReset()
    mdb.tour.findUnique.mockResolvedValueOnce(null)
    await expect(setTourBreak('t1', { break: null }, 'u1')).rejects.toBeInstanceOf(AttendanceTourNotFoundError)

    mdb.tour.findUnique.mockResolvedValueOnce({ tourDate: TOUR_DATE, status: 'published' })
    await expect(setTourBreak('t1', { break: null }, 'u1')).rejects.toBeInstanceOf(AttendanceTourNotCompletedError)

    mdb.tour.findUnique.mockResolvedValueOnce({ tourDate: TOUR_DATE, status: 'completed' })
    mdb.attendanceMonthLock.findUnique.mockResolvedValueOnce({ id: 'lock' })
    await expect(setTourBreak('t1', { break: { minutes: 30 } }, 'u1')).rejects.toBeInstanceOf(AttendanceMonthLockedError)
    expect(mdb.attendanceBreak.upsert).not.toHaveBeenCalled()
  })

  it('derives the minutes from start and end, and logs the change against the tour', async () => {
    await setTourBreak('t1', { break: { start: '12:00', end: '12:45' } }, 'u1')

    const { create } = mdb.attendanceBreak.upsert.mock.calls[0][0] as { create: Record<string, unknown> }
    expect(create).toMatchObject({ tourId: 't1', breakStart: time('12:00'), breakEnd: time('12:45'), breakMinutes: 45, updatedBy: 'u1' })
    const { data } = mdb.attendanceChange.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(data).toMatchObject({ kind: 'tour_break', date: TOUR_DATE, tourId: 't1', after: { breakStart: '12:00', breakEnd: '12:45', breakMinutes: 45 } })
  })

  it('deletes the row when the break is removed, and logs nothing when nothing changed', async () => {
    mdb.attendanceBreak.findUnique.mockResolvedValue({ breakStart: null, breakEnd: null, breakMinutes: 30 })
    await setTourBreak('t1', { break: null }, 'u1')
    expect(mdb.attendanceBreak.delete).toHaveBeenCalledWith({ where: { tourId: 't1' } })

    vi.clearAllMocks()
    mdb.tour.findUnique.mockResolvedValueOnce({ tourDate: TOUR_DATE, status: 'completed' })
    mdb.attendanceBreak.findUnique.mockResolvedValue({ breakStart: null, breakEnd: null, breakMinutes: 30 })
    await setTourBreak('t1', { break: { minutes: 30 } }, 'u1')
    expect(mdb.attendanceBreak.upsert).not.toHaveBeenCalled()
    expect(mdb.attendanceChange.create).not.toHaveBeenCalled()
  })
})

describe('setFinishTime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.tour.findMany.mockResolvedValue([loadedTour()])
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    mdb.attendanceDay.findUnique.mockResolvedValue(null)
  })

  it('refuses a date with no completed tour, and a locked month', async () => {
    mdb.tour.findMany.mockResolvedValueOnce([])
    await expect(setFinishTime('2026-06-10', '15:30', 'u1')).rejects.toBeInstanceOf(AttendanceDateNotFoundError)

    mdb.attendanceMonthLock.findUnique.mockResolvedValueOnce({ id: 'lock' })
    await expect(setFinishTime('2026-06-10', '15:30', 'u1')).rejects.toBeInstanceOf(AttendanceMonthLockedError)
  })

  it('upserts the day and logs the change, without touching individual times', async () => {
    mdb.attendanceDay.findUnique.mockResolvedValue({ finishTime: time('15:00') })
    await setFinishTime('2026-06-10', '15:30', 'u1')

    expect(mdb.attendanceDay.upsert).toHaveBeenCalledWith({
      where: { date: TOUR_DATE },
      update: { finishTime: time('15:30'), updatedBy: 'u1' },
      create: { date: TOUR_DATE, finishTime: time('15:30'), updatedBy: 'u1' },
    })
    expect(mdb.attendanceChange.create).toHaveBeenCalledWith({
      data: { kind: 'finish_time', date: TOUR_DATE, before: { finishTime: '15:00' }, after: { finishTime: '15:30' }, changedBy: 'u1' },
    })
    expect(mdb.attendance.upsert).not.toHaveBeenCalled()
  })

  it('refuses a time at or before the start of a buddy who follows it', async () => {
    mdb.tour.findMany.mockResolvedValue([
      loadedTour({ attendances: [{ ...record({ arrivalTime: time('14:00'), lateReason: 'transport_delay', lateExcused: true }), buddyId: 'b1' }] }),
    ])
    await expect(setFinishTime('2026-06-10', '13:30', 'u1')).rejects.toBeInstanceOf(AttendanceInvalidError)
    await expect(setFinishTime('2026-06-10', '14:00', 'u1')).rejects.toBeInstanceOf(AttendanceInvalidError)
    expect(mdb.attendanceDay.upsert).not.toHaveBeenCalled()
  })

  it('ignores the start of a buddy absent or leaving at their own time', async () => {
    mdb.tour.findMany.mockResolvedValue([
      loadedTour({
        sessions: [{ meetingTime: time('13:00'), bookings: [{ buddyId: 'b1', buddy: { displayName: 'Aya', realName: '綾', memberType: 'buddy' } }, { buddyId: 'b2', buddy: { displayName: 'Ken', realName: '健', memberType: 'buddy' } }] }],
        attendances: [
          { ...record({ absent: true, absenceReported: true }), buddyId: 'b1' },
          { ...record({ leaveTime: time('16:00') }), buddyId: 'b2' },
        ],
      }),
    ])
    await setFinishTime('2026-06-10', '12:00', 'u1')
    expect(mdb.attendanceDay.upsert).toHaveBeenCalled()
  })

  it('does nothing when the time is unchanged', async () => {
    mdb.attendanceDay.findUnique.mockResolvedValue({ finishTime: time('15:30') })
    await setFinishTime('2026-06-10', '15:30', 'u1')
    expect(mdb.attendanceDay.upsert).not.toHaveBeenCalled()
    expect(mdb.attendanceChange.create).not.toHaveBeenCalled()
  })
})

describe('getAttendanceMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('gives one row per buddy per day over the completed tours of the month', async () => {
    mdb.tour.findMany.mockResolvedValue([
      loadedTour({ attendances: [{ ...record({ arrivalTime: time('10:25'), lateExcused: false }), buddyId: 'b1' }] }),
    ])
    mdb.attendanceMonthLock.findUnique.mockResolvedValue({ lockedAt: new Date('2026-07-01T00:00:00Z'), locker: { email: 'lynn@example.com', adminProfile: null } })
    mdb.attendanceFlag.findMany.mockResolvedValue([])
    mdb.attendanceDay.findMany.mockResolvedValue([{ date: TOUR_DATE, finishTime: time('15:30') }])

    const month = await getAttendanceMonth('2026-06')

    expect(mdb.tour.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tourDate: { gte: new Date('2026-06-01T00:00:00.000Z'), lt: new Date('2026-07-01T00:00:00.000Z') }, status: 'completed' },
      }),
    )
    expect(month.lock).toEqual({ lockedAt: '2026-07-01T00:00:00.000Z', lockedByName: 'lynn' })
    expect(month.days.map((d) => [d.displayName, d.start, d.end, d.minutes, d.lateMinutes, d.lateExcused])).toEqual([
      ['Aya', '10:25', '15:30', 305, 25, false],
      ['Ken', '10:00', '15:30', 330, 0, null],
      ['Mio', '13:00', '15:30', 150, 0, null],
    ])
  })
})

describe('lockMonth and unlockMonth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('locks an open month and logs it', async () => {
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    await lockMonth('2026-06', 'u1')
    const month = new Date('2026-06-01T00:00:00.000Z')
    expect(mdb.attendanceMonthLock.create).toHaveBeenCalledWith({ data: { month, lockedBy: 'u1' } })
    expect(mdb.attendanceChange.create).toHaveBeenCalledWith({ data: { kind: 'month_locked', date: month, changedBy: 'u1' } })
  })

  it('refuses to lock twice, and to unlock an open month', async () => {
    mdb.attendanceMonthLock.findUnique.mockResolvedValue({ id: 'lock' })
    await expect(lockMonth('2026-06', 'u1')).rejects.toBeInstanceOf(AttendanceMonthAlreadyLockedError)
    mdb.attendanceMonthLock.findUnique.mockResolvedValue(null)
    await expect(unlockMonth('2026-06', 'u1')).rejects.toBeInstanceOf(AttendanceMonthNotLockedError)
  })

  it('unlocks and logs it', async () => {
    mdb.attendanceMonthLock.findUnique.mockResolvedValue({ id: 'lock' })
    await unlockMonth('2026-06', 'u1')
    const month = new Date('2026-06-01T00:00:00.000Z')
    expect(mdb.attendanceMonthLock.delete).toHaveBeenCalledWith({ where: { month } })
    expect(mdb.attendanceChange.create).toHaveBeenCalledWith({ data: { kind: 'month_unlocked', date: month, changedBy: 'u1' } })
  })
})

describe('createAttendanceFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findUnique.mockResolvedValue({ id: 'b1', displayName: 'Aya' })
    mdb.tour.count.mockResolvedValue(1)
    mdb.attendanceFlag.findFirst.mockResolvedValue(null)
    mdb.attendanceFlag.create.mockResolvedValue({ id: 'f1' })
  })

  it('refuses a day the buddy has no record on', async () => {
    mdb.tour.count.mockResolvedValue(0)
    await expect(createAttendanceFlag('u1', { date: '2026-06-10', note: 'x' })).rejects.toBeInstanceOf(AttendanceBuddyNotFoundError)
  })

  it('refuses a second open flag on the same day', async () => {
    mdb.attendanceFlag.findFirst.mockResolvedValue({ id: 'f0' })
    await expect(createAttendanceFlag('u1', { date: '2026-06-10', note: 'x' })).rejects.toBeInstanceOf(AttendanceFlagOpenError)
    expect(mdb.attendanceFlag.create).not.toHaveBeenCalled()
  })

  it('creates the flag and notifies every PLAB member in-app and on Slack', async () => {
    const result = await createAttendanceFlag('u1', { date: '2026-06-10', note: 'I left at 14:00' })

    expect(result).toEqual({ id: 'f1' })
    expect(mdb.attendanceFlag.create).toHaveBeenCalledWith({
      data: { buddyId: 'b1', date: TOUR_DATE, note: 'I left at 14:00' },
      select: { id: true },
    })
    const args = {
      eventType: 'attendance_flagged',
      payload: { flagId: 'f1', buddyId: 'b1', buddyName: 'Aya', date: '2026-06-10', month: '2026-06' },
    }
    expect(enqueueInAppForAllAdmins).toHaveBeenCalledWith(args, mdb)
    expect(enqueueSlackForAdmins).toHaveBeenCalledWith(args, mdb)
  })
})

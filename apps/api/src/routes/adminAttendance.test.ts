import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminAttendanceRoutes, adminTourAttendanceRoutes } from './adminAttendance'
import type { AuthEnv } from '../types'
import type { AttendanceMonthResponse, TourAttendanceResponse } from '@peace-buddy/types'

vi.mock('../lib/db', () => ({ db: {} }))

vi.mock('../services/attendance.service', () => {
  const err = () => class extends Error {}
  return {
    getTourAttendance: vi.fn(),
    updateAttendance: vi.fn(),
    setTourBreak: vi.fn(),
    setFinishTime: vi.fn(),
    getAttendanceMonth: vi.fn(),
    lockMonth: vi.fn(),
    unlockMonth: vi.fn(),
    resolveFlag: vi.fn(),
    AttendanceTourNotFoundError: err(),
    AttendanceBuddyNotFoundError: err(),
    AttendanceTourNotCompletedError: err(),
    AttendanceMonthLockedError: err(),
    AttendanceInvalidError: err(),
    AttendanceDateNotFoundError: err(),
    AttendanceMonthAlreadyLockedError: err(),
    AttendanceMonthNotLockedError: err(),
    AttendanceFlagNotFoundError: err(),
    AttendanceFlagResolvedError: err(),
  }
})

import {
  getTourAttendance,
  updateAttendance,
  setTourBreak,
  setFinishTime,
  getAttendanceMonth,
  lockMonth,
  unlockMonth,
  resolveFlag,
  AttendanceTourNotCompletedError,
  AttendanceBuddyNotFoundError,
  AttendanceMonthLockedError,
  AttendanceInvalidError,
  AttendanceMonthAlreadyLockedError,
  AttendanceMonthNotLockedError,
  AttendanceFlagResolvedError,
} from '../services/attendance.service'

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-1', email: 'admin@example.com' })
    c.set('user', { id: 'admin-1', firebaseUid: 'uid-1', email: 'admin@example.com', role: 'admin' })
    return next()
  })
  app.route('/admin/tours', adminTourAttendanceRoutes)
  app.route('/admin/attendance', adminAttendanceRoutes)
  return app
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

const TOUR_ID = '11111111-1111-4111-8111-111111111111'
const BUDDY_ID = '22222222-2222-4222-8222-222222222222'

const sheet: TourAttendanceResponse = {
  tourId: TOUR_ID,
  date: '2026-06-10',
  editable: true,
  locked: false,
  finishTime: '15:30',
  break: null,
  followingFinish: 2,
  rows: [],
  changes: [],
}

const late = {
  absent: false,
  absenceReported: null,
  arrivalTime: '10:25',
  lateReason: 'transport_delay',
  lateNote: null,
  lateExcused: true,
  leaveTime: null,
  leaveNote: null,
}

describe('admin attendance routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET /admin/tours/:id/attendance returns the sheet, or 404', async () => {
    vi.mocked(getTourAttendance).mockResolvedValueOnce(sheet)
    const res = await buildApp().request(`/admin/tours/${TOUR_ID}/attendance`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(sheet)

    vi.mocked(getTourAttendance).mockResolvedValueOnce(null)
    expect((await buildApp().request(`/admin/tours/${TOUR_ID}/attendance`)).status).toBe(404)
  })

  it('PUT /admin/tours/:id/attendance/:buddyId passes the parsed body and the caller', async () => {
    vi.mocked(updateAttendance).mockResolvedValueOnce(sheet)
    const res = await buildApp().request(`/admin/tours/${TOUR_ID}/attendance/${BUDDY_ID}`, json('PUT', late))
    expect(res.status).toBe(200)
    expect(updateAttendance).toHaveBeenCalledWith(TOUR_ID, BUDDY_ID, late, 'admin-1')
  })

  it('PUT /admin/tours/:id/attendance/break sets the tour break, not a buddy record', async () => {
    vi.mocked(setTourBreak).mockResolvedValueOnce(sheet)
    const body = { break: { start: '12:00', end: '12:45' } }
    const res = await buildApp().request(`/admin/tours/${TOUR_ID}/attendance/break`, json('PUT', body))
    expect(res.status).toBe(200)
    expect(setTourBreak).toHaveBeenCalledWith(TOUR_ID, body, 'admin-1')
    expect(updateAttendance).not.toHaveBeenCalled()

    const backwards = { break: { start: '12:45', end: '12:00' } }
    expect((await buildApp().request(`/admin/tours/${TOUR_ID}/attendance/break`, json('PUT', backwards))).status).toBe(400)
  })

  it('PUT refuses an absence without reported, and "other" without a note', async () => {
    const app = buildApp()
    const absent = { ...late, arrivalTime: null, lateReason: null, lateExcused: null, absent: true }
    expect((await app.request(`/admin/tours/${TOUR_ID}/attendance/${BUDDY_ID}`, json('PUT', absent))).status).toBe(400)
    const other = { ...late, lateReason: 'other' }
    expect((await app.request(`/admin/tours/${TOUR_ID}/attendance/${BUDDY_ID}`, json('PUT', other))).status).toBe(400)
    expect(updateAttendance).not.toHaveBeenCalled()
  })

  it('PUT maps service errors to 400, 404 and 409', async () => {
    const app = buildApp()
    const put = () => app.request(`/admin/tours/${TOUR_ID}/attendance/${BUDDY_ID}`, json('PUT', late))
    vi.mocked(updateAttendance).mockRejectedValueOnce(new AttendanceInvalidError())
    expect((await put()).status).toBe(400)
    vi.mocked(updateAttendance).mockRejectedValueOnce(new AttendanceBuddyNotFoundError())
    expect((await put()).status).toBe(404)
    vi.mocked(updateAttendance).mockRejectedValueOnce(new AttendanceTourNotCompletedError())
    expect((await put()).status).toBe(409)
    vi.mocked(updateAttendance).mockRejectedValueOnce(new AttendanceMonthLockedError())
    expect((await put()).status).toBe(409)
  })

  it('PUT /admin/attendance/days/:date sets the finish time', async () => {
    vi.mocked(setFinishTime).mockResolvedValueOnce({ date: '2026-06-10', finishTime: '15:30' })
    const res = await buildApp().request('/admin/attendance/days/2026-06-10', json('PUT', { finishTime: '15:30' }))
    expect(res.status).toBe(200)
    expect(setFinishTime).toHaveBeenCalledWith('2026-06-10', '15:30', 'admin-1')

    expect((await buildApp().request('/admin/attendance/days/june', json('PUT', { finishTime: '15:30' }))).status).toBe(400)
    expect((await buildApp().request('/admin/attendance/days/2026-06-10', json('PUT', { finishTime: '3pm' }))).status).toBe(400)
  })

  it('GET /admin/attendance needs a month', async () => {
    const month: AttendanceMonthResponse = { month: '2026-06', lock: null, days: [], openFlags: [] }
    vi.mocked(getAttendanceMonth).mockResolvedValueOnce(month)
    const res = await buildApp().request('/admin/attendance?month=2026-06')
    expect(res.status).toBe(200)
    expect(getAttendanceMonth).toHaveBeenCalledWith('2026-06')

    expect((await buildApp().request('/admin/attendance')).status).toBe(400)
    expect((await buildApp().request('/admin/attendance?month=2026-13')).status).toBe(400)
  })

  it('locks and unlocks a month', async () => {
    const app = buildApp()
    expect((await app.request('/admin/attendance/locks', json('POST', { month: '2026-06' }))).status).toBe(201)
    expect(lockMonth).toHaveBeenCalledWith('2026-06', 'admin-1')
    vi.mocked(lockMonth).mockRejectedValueOnce(new AttendanceMonthAlreadyLockedError())
    expect((await app.request('/admin/attendance/locks', json('POST', { month: '2026-06' }))).status).toBe(409)

    expect((await app.request('/admin/attendance/locks/2026-06', { method: 'DELETE' })).status).toBe(204)
    expect(unlockMonth).toHaveBeenCalledWith('2026-06', 'admin-1')
    vi.mocked(unlockMonth).mockRejectedValueOnce(new AttendanceMonthNotLockedError())
    expect((await app.request('/admin/attendance/locks/2026-06', { method: 'DELETE' })).status).toBe(404)
  })

  it('resolves a flag, once', async () => {
    const app = buildApp()
    expect((await app.request('/admin/attendance/flags/f1/resolve', { method: 'POST' })).status).toBe(204)
    expect(resolveFlag).toHaveBeenCalledWith('f1', 'admin-1')
    vi.mocked(resolveFlag).mockRejectedValueOnce(new AttendanceFlagResolvedError())
    expect((await app.request('/admin/attendance/flags/f1/resolve', { method: 'POST' })).status).toBe(409)
  })
})

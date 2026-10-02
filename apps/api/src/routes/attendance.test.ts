import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { myAttendanceRoutes } from './attendance'
import type { AuthEnv } from '../types'

vi.mock('../lib/db', () => ({ db: {} }))

vi.mock('../services/attendance.service', () => ({
  getMyAttendance: vi.fn(),
  createAttendanceFlag: vi.fn(),
  AttendanceBuddyNotFoundError: class extends Error {},
  AttendanceInvalidError: class extends Error {},
  AttendanceFlagOpenError: class extends Error {},
}))

import {
  getMyAttendance,
  createAttendanceFlag,
  AttendanceBuddyNotFoundError,
  AttendanceFlagOpenError,
} from '../services/attendance.service'

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-2', email: 'buddy@example.com' })
    c.set('user', { id: 'user-2', firebaseUid: 'uid-2', email: 'buddy@example.com', role: 'buddy' })
    return next()
  })
  app.route('/me/attendance', myAttendanceRoutes)
  return app
}

function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

describe('my attendance routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it("GET /me/attendance returns the caller's month", async () => {
    vi.mocked(getMyAttendance).mockResolvedValueOnce({ month: '2026-06', days: [] })
    const res = await buildApp().request('/me/attendance?month=2026-06')
    expect(res.status).toBe(200)
    expect(getMyAttendance).toHaveBeenCalledWith('user-2', '2026-06')

    expect((await buildApp().request('/me/attendance?month=june')).status).toBe(400)
  })

  it('POST /me/attendance/flags creates a flag for the caller', async () => {
    vi.mocked(createAttendanceFlag).mockResolvedValueOnce({ id: 'f1' })
    const res = await buildApp().request('/me/attendance/flags', post({ date: '2026-06-10', note: 'I left at 14:00' }))
    expect(res.status).toBe(201)
    expect(createAttendanceFlag).toHaveBeenCalledWith('user-2', { date: '2026-06-10', note: 'I left at 14:00' })
  })

  it('POST refuses a blank note, a day with no record and a second open flag', async () => {
    const app = buildApp()
    expect((await app.request('/me/attendance/flags', post({ date: '2026-06-10', note: '  ' }))).status).toBe(400)
    vi.mocked(createAttendanceFlag).mockRejectedValueOnce(new AttendanceBuddyNotFoundError())
    expect((await app.request('/me/attendance/flags', post({ date: '2026-06-10', note: 'x' }))).status).toBe(404)
    vi.mocked(createAttendanceFlag).mockRejectedValueOnce(new AttendanceFlagOpenError())
    expect((await app.request('/me/attendance/flags', post({ date: '2026-06-10', note: 'x' }))).status).toBe(409)
  })
})

import { Hono } from 'hono'
import { AttendanceMonthSchema, CreateAttendanceFlagSchema } from '@peace-buddy/types'
import {
  getMyAttendance,
  createAttendanceFlag,
  AttendanceBuddyNotFoundError,
  AttendanceInvalidError,
  AttendanceFlagOpenError,
} from '../services/attendance.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

// The caller's own attendance record, mounted at /me/attendance.
const myAttendanceRoutes = new Hono<AuthEnv>()

myAttendanceRoutes.get('/', async (c) => {
  const month = AttendanceMonthSchema.safeParse(c.req.query('month'))
  if (!month.success) return c.json(apiError('invalid_request'), 400)
  const { id } = c.get('user')
  return c.json(await getMyAttendance(id, month.data))
})

myAttendanceRoutes.post('/flags', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }
  const parsed = CreateAttendanceFlagSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  const { id } = c.get('user')
  try {
    return c.json(await createAttendanceFlag(id, parsed.data), 201)
  } catch (e) {
    if (e instanceof AttendanceBuddyNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AttendanceInvalidError) return c.json(apiError('invalid_request'), 400)
    if (e instanceof AttendanceFlagOpenError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

export { myAttendanceRoutes }

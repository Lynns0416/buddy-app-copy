import { Hono } from 'hono'
import {
  AttendanceDateSchema,
  AttendanceMonthSchema,
  LockAttendanceMonthSchema,
  SetAttendanceBreakSchema,
  SetFinishTimeSchema,
  UpdateAttendanceSchema,
} from '@peace-buddy/types'
import {
  getTourAttendance,
  updateAttendance,
  setTourBreak,
  setFinishTime,
  getAttendanceMonth,
  lockMonth,
  unlockMonth,
  resolveFlag,
  AttendanceTourNotFoundError,
  AttendanceBuddyNotFoundError,
  AttendanceTourNotCompletedError,
  AttendanceMonthLockedError,
  AttendanceInvalidError,
  AttendanceDateNotFoundError,
  AttendanceMonthAlreadyLockedError,
  AttendanceMonthNotLockedError,
  AttendanceFlagNotFoundError,
  AttendanceFlagResolvedError,
} from '../services/attendance.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

// Mounted at /admin/tours, beside adminTourRoutes.
const adminTourAttendanceRoutes = new Hono<AuthEnv>()

adminTourAttendanceRoutes.get('/:id/attendance', async (c) => {
  const sheet = await getTourAttendance(c.req.param('id'))
  if (!sheet) return c.json(apiError('not_found'), 404)
  return c.json(sheet)
})

// Registered before /:buddyId so "break" is not read as a buddy id.
adminTourAttendanceRoutes.put('/:id/attendance/break', async (c) => {
  const parsed = SetAttendanceBreakSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  const { id: userId } = c.get('user')
  try {
    return c.json(await setTourBreak(c.req.param('id'), parsed.data, userId))
  } catch (e) {
    if (e instanceof AttendanceTourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AttendanceTourNotCompletedError || e instanceof AttendanceMonthLockedError)
      return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourAttendanceRoutes.put('/:id/attendance/:buddyId', async (c) => {
  const parsed = UpdateAttendanceSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  const { id: userId } = c.get('user')
  try {
    return c.json(await updateAttendance(c.req.param('id'), c.req.param('buddyId'), parsed.data, userId))
  } catch (e) {
    if (e instanceof AttendanceTourNotFoundError || e instanceof AttendanceBuddyNotFoundError)
      return c.json(apiError('not_found'), 404)
    if (e instanceof AttendanceTourNotCompletedError || e instanceof AttendanceMonthLockedError)
      return c.json(apiError('conflict'), 409)
    if (e instanceof AttendanceInvalidError) return c.json(apiError('invalid_request'), 400)
    throw e
  }
})

// Mounted at /admin/attendance.
const adminAttendanceRoutes = new Hono<AuthEnv>()

adminAttendanceRoutes.get('/', async (c) => {
  const month = AttendanceMonthSchema.safeParse(c.req.query('month'))
  if (!month.success) return c.json(apiError('invalid_request'), 400)
  return c.json(await getAttendanceMonth(month.data))
})

adminAttendanceRoutes.put('/days/:date', async (c) => {
  const date = AttendanceDateSchema.safeParse(c.req.param('date'))
  const parsed = SetFinishTimeSchema.safeParse(await readJson(c))
  if (!date.success || !parsed.success) return c.json(apiError('invalid_request'), 400)
  const { id: userId } = c.get('user')
  try {
    return c.json(await setFinishTime(date.data, parsed.data.finishTime, userId))
  } catch (e) {
    if (e instanceof AttendanceInvalidError) return c.json(apiError('invalid_request'), 400)
    if (e instanceof AttendanceDateNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AttendanceMonthLockedError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminAttendanceRoutes.post('/locks', async (c) => {
  const parsed = LockAttendanceMonthSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  const { id: userId } = c.get('user')
  try {
    await lockMonth(parsed.data.month, userId)
    return c.json({ month: parsed.data.month }, 201)
  } catch (e) {
    if (e instanceof AttendanceMonthAlreadyLockedError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminAttendanceRoutes.delete('/locks/:month', async (c) => {
  const month = AttendanceMonthSchema.safeParse(c.req.param('month'))
  if (!month.success) return c.json(apiError('invalid_request'), 400)
  const { id: userId } = c.get('user')
  try {
    await unlockMonth(month.data, userId)
    return c.body(null, 204)
  } catch (e) {
    if (e instanceof AttendanceMonthNotLockedError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

adminAttendanceRoutes.post('/flags/:id/resolve', async (c) => {
  const { id: userId } = c.get('user')
  try {
    await resolveFlag(c.req.param('id'), userId)
    return c.body(null, 204)
  } catch (e) {
    if (e instanceof AttendanceFlagNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AttendanceFlagResolvedError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

export { adminAttendanceRoutes, adminTourAttendanceRoutes }

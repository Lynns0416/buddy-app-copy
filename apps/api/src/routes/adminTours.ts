import { Hono } from 'hono'
import { TourStatusSchema, CreateTourSchema, UpdateTourSchema, TourStatusActionSchema, TierCapacitiesSchema, CreateTourSessionSchema, UpdateTourSessionSchema, AssignTourAdminSchema, SetStaffInChargeSchema } from '@peace-buddy/types'
import {
  listAdminTours,
  createTour,
  getAdminTourDetail,
  updateTour,
  transitionTourStatus,
  deleteTour,
  getAdminTourIcs,
  TourNotFoundError,
  TourTransitionError,
  TourImmutableError,
  TourNotDraftError,
} from '../services/adminTour.service'
import {
  addSession,
  updateSession,
  deleteSession,
  getSessionTierCapacities,
  upsertSessionTierCapacities,
  SessionNotFoundError,
  SessionHasBookingsError,
  LastSessionError,
  TooManySessionsError,
} from '../services/adminSession.service'
import {
  assignAdmin,
  unassignAdmin,
  setStaffInCharge,
  AdminNotFoundError,
  AdminAlreadyAssignedError,
  AdminNotAssignedError,
  StaffInChargeNotAssignedError,
  StaffInChargeRequiresReplacementError,
  StaffInChargeRequiredError,
} from '../services/tourAdminAssignment.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminTourRoutes = new Hono<AuthEnv>()

adminTourRoutes.get('/', async (c) => {
  const statusParam = c.req.query('status')
  if (statusParam !== undefined) {
    const parsed = TourStatusSchema.safeParse(statusParam)
    if (!parsed.success) return c.json(apiError('invalid_request'), 400)
    return c.json(await listAdminTours({ status: parsed.data }))
  }
  return c.json(await listAdminTours({}))
})

adminTourRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateTourSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  return c.json(await createTour(parsed.data), 201)
})

adminTourRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const tour = await getAdminTourDetail(id)
  if (!tour) return c.json(apiError('not_found'), 404)
  return c.json(tour)
})

adminTourRoutes.get('/:id/calendar.ics', async (c) => {
  const id = c.req.param('id')
  const ics = await getAdminTourIcs(id)
  if (!ics) return c.json(apiError('not_found'), 404)
  return c.body(ics, 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `attachment; filename="tour-${id}.ics"`,
  })
})

adminTourRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateTourSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await updateTour(id, parsed.data))
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof TourImmutableError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = TourStatusActionSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await transitionTourStatus(id, parsed.data.action))
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof TourTransitionError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')

  try {
    await deleteTour(id)
    return c.body(null, 204)
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof TourNotDraftError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

// Admin assignment

adminTourRoutes.post('/:id/admins', async (c) => {
  const tourId = c.req.param('id')
  const tour = await getAdminTourDetail(tourId)
  if (!tour) return c.json(apiError('not_found'), 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = AssignTourAdminSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await assignAdmin(tourId, parsed.data.adminId))
  } catch (e) {
    if (e instanceof AdminNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AdminAlreadyAssignedError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourRoutes.delete('/:id/admins/:adminId', async (c) => {
  const tourId = c.req.param('id')
  const adminId = c.req.param('adminId')

  try {
    return c.json(await unassignAdmin(tourId, adminId))
  } catch (e) {
    if (e instanceof AdminNotAssignedError) return c.json(apiError('not_found'), 404)
    if (e instanceof StaffInChargeRequiresReplacementError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourRoutes.put('/:id/staff-in-charge', async (c) => {
  const tourId = c.req.param('id')
  const tour = await getAdminTourDetail(tourId)
  if (!tour) return c.json(apiError('not_found'), 404)

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = SetStaffInChargeSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await setStaffInCharge(tourId, parsed.data.adminId))
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof StaffInChargeNotAssignedError) return c.json(apiError('conflict'), 409)
    if (e instanceof StaffInChargeRequiredError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

// Session management

adminTourRoutes.post('/:id/sessions', async (c) => {
  const tourId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateTourSessionSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await addSession(tourId, parsed.data), 201)
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof TourImmutableError) return c.json(apiError('conflict'), 409)
    if (e instanceof TooManySessionsError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminTourRoutes.put('/:id/sessions/:sessionId', async (c) => {
  const tourId = c.req.param('id')
  const sessionId = c.req.param('sessionId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateTourSessionSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await updateSession(tourId, sessionId, parsed.data))
  } catch (e) {
    if (e instanceof SessionNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

adminTourRoutes.delete('/:id/sessions/:sessionId', async (c) => {
  const tourId = c.req.param('id')
  const sessionId = c.req.param('sessionId')

  try {
    return c.json(await deleteSession(tourId, sessionId))
  } catch (e) {
    if (e instanceof SessionNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof SessionHasBookingsError) return c.json(apiError('conflict'), 409)
    if (e instanceof LastSessionError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

// Tier capacities (session-scoped)

adminTourRoutes.get('/:id/sessions/:sessionId/tier-capacities', async (c) => {
  const tourId = c.req.param('id')
  const sessionId = c.req.param('sessionId')
  const existing = await getAdminTourDetail(tourId)
  if (!existing) return c.json(apiError('not_found'), 404)
  if (!existing.sessions.find((s) => s.id === sessionId)) return c.json(apiError('not_found'), 404)
  return c.json(await getSessionTierCapacities(sessionId))
})

adminTourRoutes.patch('/:id/sessions/:sessionId/tier-capacities', async (c) => {
  const tourId = c.req.param('id')
  const sessionId = c.req.param('sessionId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = TierCapacitiesSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await upsertSessionTierCapacities(tourId, sessionId, parsed.data))
  } catch (e) {
    if (e instanceof SessionNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { adminTourRoutes }

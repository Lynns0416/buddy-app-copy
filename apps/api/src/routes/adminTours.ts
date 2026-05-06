import { Hono } from 'hono'
import { TourStatusSchema, CreateTourSchema, UpdateTourSchema, TourStatusActionSchema, TierCapacitiesSchema } from '@peace-buddy/types'
import {
  listAdminTours,
  createTour,
  getAdminTourDetail,
  updateTour,
  transitionTourStatus,
  deleteTour,
  getTierCapacities,
  upsertTierCapacities,
  TourNotFoundError,
  TourTransitionError,
  TourImmutableError,
  TourNotDraftError,
} from '../services/adminTour.service'
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

adminTourRoutes.get('/:id/tier-capacities', async (c) => {
  const id = c.req.param('id')
  const existing = await getAdminTourDetail(id)
  if (!existing) return c.json(apiError('not_found'), 404)
  return c.json(await getTierCapacities(id))
})

adminTourRoutes.patch('/:id/tier-capacities', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = TierCapacitiesSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    return c.json(await upsertTierCapacities(id, parsed.data))
  } catch (e) {
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { adminTourRoutes }

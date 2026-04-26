import { Hono } from 'hono'
import { TourStatusSchema, CreateTourSchema, UpdateTourSchema, TourStatusActionSchema } from '@peace-buddy/types'
import {
  listAdminTours,
  createTour,
  getAdminTourDetail,
  updateTour,
  transitionTourStatus,
  deleteTour,
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
    if (!parsed.success) return c.json({ error: 'Invalid status' }, 400)
    return c.json(await listAdminTours({ status: parsed.data }))
  }
  return c.json(await listAdminTours({}))
})

adminTourRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = CreateTourSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)

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
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = UpdateTourSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body', details: parsed.error.flatten() }, 400)

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
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = TourStatusActionSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400)

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

export { adminTourRoutes }

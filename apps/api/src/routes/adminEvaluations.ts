import { Hono } from 'hono'
import { CreateAdminEvaluationSchema, UpdateAdminEvaluationSchema } from '@peace-buddy/types'
import {
  createAdminEvaluation,
  listAdminEvaluations,
  getAdminEvaluation,
  updateAdminEvaluation,
  deleteAdminEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  BuddyNotFoundError,
  TourNotFoundError,
} from '../services/adminEvaluation.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminEvaluationRoutes = new Hono<AuthEnv>()

adminEvaluationRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateAdminEvaluationSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[adminEvaluations POST] Zod error:', JSON.stringify(parsed.error.flatten()))
    return c.json(apiError('invalid_request'), 400)
  }

  const { id } = c.get('user')
  try {
    return c.json(await createAdminEvaluation(parsed.data, id), 201)
  } catch (e) {
    if (e instanceof EvalAlreadyExistsError) return c.json(apiError('conflict'), 409)
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found', 'Buddy not found'), 404)
    if (e instanceof TourNotFoundError) return c.json(apiError('not_found', 'Tour not found'), 404)
    throw e
  }
})

adminEvaluationRoutes.get('/', async (c) => {
  const buddyId = c.req.query('buddyId')
  const tourId = c.req.query('tourId')
  return c.json(await listAdminEvaluations({ buddyId, tourId }))
})

adminEvaluationRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const evaluation = await getAdminEvaluation(id)
  if (!evaluation) return c.json(apiError('not_found'), 404)
  return c.json(evaluation)
})

adminEvaluationRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateAdminEvaluationSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[adminEvaluations PUT] Zod error:', JSON.stringify(parsed.error.flatten()))
    return c.json(apiError('invalid_request'), 400)
  }

  try {
    return c.json(await updateAdminEvaluation(id, parsed.data))
  } catch (e) {
    if (e instanceof EvalNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

adminEvaluationRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    await deleteAdminEvaluation(id)
    return c.body(null, 204)
  } catch (e) {
    if (e instanceof EvalNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { adminEvaluationRoutes }

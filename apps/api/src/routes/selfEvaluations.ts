import { Hono } from 'hono'
import { CreateSelfEvaluationSchema, UpdateSelfEvaluationSchema } from '@peace-buddy/types'
import {
  createSelfEvaluation,
  listMySelfEvaluations,
  updateSelfEvaluation,
  EvalNotFoundError,
  EvalAlreadyExistsError,
  EvalLockedError,
  NotEligibleError,
  BuddyNotFoundError,
} from '../services/selfEvaluation.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const selfEvaluationRoutes = new Hono<AuthEnv>()

selfEvaluationRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateSelfEvaluationSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const { id } = c.get('user')
  try {
    return c.json(await createSelfEvaluation(parsed.data, id), 201)
  } catch (e) {
    if (e instanceof EvalAlreadyExistsError) return c.json(apiError('conflict'), 409)
    if (e instanceof NotEligibleError) return c.json(apiError('forbidden'), 403)
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

selfEvaluationRoutes.get('/', async (c) => {
  const { id } = c.get('user')
  try {
    return c.json(await listMySelfEvaluations(id))
  } catch (e) {
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

selfEvaluationRoutes.put('/:id', async (c) => {
  const evalId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateSelfEvaluationSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const { id } = c.get('user')
  try {
    return c.json(await updateSelfEvaluation(evalId, parsed.data, id))
  } catch (e) {
    if (e instanceof EvalNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof EvalLockedError) return c.json(apiError('conflict', 'Edit window has closed'), 409)
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { selfEvaluationRoutes }

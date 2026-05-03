import { Hono } from 'hono'
import { UpsertAdminProfileEvaluationSchema } from '@peace-buddy/types'
import {
  upsertProfileEvaluation,
  getMyProfileEvaluation,
  listProfileEvaluations,
  BuddyNotFoundError,
} from '../services/adminProfileEvaluation.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminProfileEvaluationRoutes = new Hono<AuthEnv>()

adminProfileEvaluationRoutes.put('/:buddyId', async (c) => {
  const buddyId = c.req.param('buddyId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpsertAdminProfileEvaluationSchema.safeParse(body)
  if (!parsed.success) {
    console.error('[adminProfileEvaluations PUT] Zod error:', JSON.stringify(parsed.error.flatten()))
    return c.json(apiError('invalid_request'), 400)
  }

  const { id } = c.get('user')
  try {
    return c.json(await upsertProfileEvaluation(buddyId, parsed.data, id))
  } catch (e) {
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

adminProfileEvaluationRoutes.get('/:buddyId/mine', async (c) => {
  const buddyId = c.req.param('buddyId')
  const { id } = c.get('user')
  const evaluation = await getMyProfileEvaluation(buddyId, id)
  if (!evaluation) return c.json(apiError('not_found'), 404)
  return c.json(evaluation)
})

adminProfileEvaluationRoutes.get('/:buddyId', async (c) => {
  const buddyId = c.req.param('buddyId')
  return c.json(await listProfileEvaluations(buddyId))
})

export { adminProfileEvaluationRoutes }

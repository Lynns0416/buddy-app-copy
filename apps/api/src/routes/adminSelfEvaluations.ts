import { Hono } from 'hono'
import { listSelfEvaluations, getSelfEvaluation } from '../services/adminSelfEvaluation.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminSelfEvaluationRoutes = new Hono<AuthEnv>()

adminSelfEvaluationRoutes.get('/', async (c) => {
  const buddyId = c.req.query('buddyId')
  return c.json(await listSelfEvaluations({ buddyId }))
})

adminSelfEvaluationRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const evaluation = await getSelfEvaluation(id)
  if (!evaluation) return c.json(apiError('not_found'), 404)
  return c.json(evaluation)
})

export { adminSelfEvaluationRoutes }

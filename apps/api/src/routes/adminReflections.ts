import { Hono } from 'hono'
import { listReflections, getReflection } from '../services/adminReflection.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminReflectionRoutes = new Hono<AuthEnv>()

adminReflectionRoutes.get('/', async (c) => {
  const buddyId = c.req.query('buddyId')
  return c.json(await listReflections({ buddyId }))
})

adminReflectionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const reflection = await getReflection(id)
  if (!reflection) return c.json(apiError('not_found'), 404)
  return c.json(reflection)
})

export { adminReflectionRoutes }

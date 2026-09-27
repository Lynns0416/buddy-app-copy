import { Hono } from 'hono'
import { listReflections, getReflection } from '../services/adminReflection.service'
import { listReflectionStats } from '../services/adminReflectionStats.service'
import { apiError } from '../lib/api-error'
import { ReflectionStatsQuerySchema } from './statsQuery'
import type { AuthEnv } from '../types'

const adminReflectionRoutes = new Hono<AuthEnv>()

adminReflectionRoutes.get('/', async (c) => {
  const buddyId = c.req.query('buddyId')
  return c.json(await listReflections({ buddyId }))
})

// Registered before `/:id`, which would otherwise read `stats` as an id.
adminReflectionRoutes.get('/stats', async (c) => {
  const parsed = ReflectionStatsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Invalid query params' }, 400)
  return c.json(await listReflectionStats(parsed.data))
})

adminReflectionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const reflection = await getReflection(id)
  if (!reflection) return c.json(apiError('not_found'), 404)
  return c.json(reflection)
})

export { adminReflectionRoutes }

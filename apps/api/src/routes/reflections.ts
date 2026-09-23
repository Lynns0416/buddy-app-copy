import { Hono } from 'hono'
import { CreateTourReflectionSchema, UpdateTourReflectionSchema } from '@peace-buddy/types'
import {
  createReflection,
  listMyReflections,
  updateReflection,
  ReflectionNotFoundError,
  ReflectionAlreadyExistsError,
  ReflectionLockedError,
  NotEligibleError,
  BuddyNotFoundError,
} from '../services/reflection.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const reflectionRoutes = new Hono<AuthEnv>()

reflectionRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateTourReflectionSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const { id } = c.get('user')
  try {
    return c.json(await createReflection(parsed.data, id), 201)
  } catch (e) {
    if (e instanceof ReflectionAlreadyExistsError) return c.json(apiError('conflict'), 409)
    if (e instanceof NotEligibleError) return c.json(apiError('forbidden'), 403)
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

reflectionRoutes.get('/', async (c) => {
  const { id } = c.get('user')
  const tourId = c.req.query('tourId')
  try {
    return c.json(await listMyReflections(id, { tourId }))
  } catch (e) {
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

reflectionRoutes.put('/:id', async (c) => {
  const reflectionId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateTourReflectionSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const { id } = c.get('user')
  try {
    return c.json(await updateReflection(reflectionId, parsed.data, id))
  } catch (e) {
    if (e instanceof ReflectionNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof ReflectionLockedError) return c.json(apiError('conflict', 'Edit window has closed'), 409)
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { reflectionRoutes }

import { Hono } from 'hono'
import { CreateAdminProfileSchema, UpdateAdminProfileSchema } from '@peace-buddy/types'
import {
  getAdminProfile,
  listAdminProfiles,
  createAdminProfile,
  updateAdminProfile,
  softDeleteAdminProfile,
  HasActiveTourAssignmentsError,
} from '../services/adminProfile.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

export const adminProfileRoutes = new Hono<AuthEnv>()

adminProfileRoutes.get('/profile', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json(apiError('forbidden'), 403)
  }

  const profile = await getAdminProfile(user.id)
  if (!profile) return c.json(apiError('not_found'), 404)
  return c.json(profile)
})

adminProfileRoutes.get('/profiles', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json(apiError('forbidden'), 403)
  }

  const profiles = await listAdminProfiles()
  return c.json(profiles)
})

adminProfileRoutes.patch('/profile', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json(apiError('forbidden'), 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateAdminProfileSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(apiError('invalid_request'), 400)
  }

  const profile = await updateAdminProfile(user.id, parsed.data.name)
  if (!profile) return c.json(apiError('not_found'), 404)
  return c.json(profile)
})

adminProfileRoutes.post('/profiles', async (c) => {
  const user = c.get('user')

  if (user.role !== 'super_admin') {
    return c.json(apiError('forbidden'), 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateAdminProfileSchema.safeParse(body)
  if (!parsed.success) {
    return c.json(apiError('invalid_request'), 400)
  }

  const profile = await createAdminProfile(parsed.data.userId, parsed.data.name)
  if (!profile) return c.json(apiError('conflict'), 409)
  return c.json(profile, 201)
})

adminProfileRoutes.delete('/profiles/:userId', async (c) => {
  const user = c.get('user')
  const userId = c.req.param('userId')

  if (user.role !== 'super_admin') {
    return c.json(apiError('forbidden'), 403)
  }

  if (user.id === userId) {
    return c.json(apiError('invalid_request'), 400)
  }

  try {
    const profile = await softDeleteAdminProfile(userId)
    if (!profile) return c.json(apiError('not_found'), 404)
    return c.json(profile)
  } catch (e) {
    if (e instanceof HasActiveTourAssignmentsError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

import { Hono } from 'hono'
import { CreateAdminProfileSchema, UpdateAdminProfileSchema } from '@peace-buddy/types'
import {
  getAdminProfile,
  listAdminProfiles,
  createAdminProfile,
  updateAdminProfile,
  softDeleteAdminProfile,
} from '../services/adminProfile.service'
import type { AuthEnv } from '../types'

export const adminProfileRoutes = new Hono<AuthEnv>()

adminProfileRoutes.get('/profile', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const profile = await getAdminProfile(user.id)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  return c.json(profile)
})

adminProfileRoutes.get('/profiles', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const profiles = await listAdminProfiles()
  return c.json(profiles)
})

adminProfileRoutes.patch('/profile', async (c) => {
  const user = c.get('user')

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = UpdateAdminProfileSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const profile = await updateAdminProfile(user.id, data.name)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  return c.json(profile)
})

adminProfileRoutes.post('/profiles', async (c) => {
  const user = c.get('user')

  // Only super_admin can create new admin profiles
  if (user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = CreateAdminProfileSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const profile = await createAdminProfile(data.userId, data.name)
  if (!profile) return c.json({ error: 'Admin already exists for this user' }, 409)
  return c.json(profile, 201)
})

adminProfileRoutes.delete('/profiles/:userId', async (c) => {
  const user = c.get('user')
  const userId = c.req.param('userId')

  // Only super_admin can soft delete admin profiles
  if (user.role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }

  // Prevent self-deletion
  if (user.id === userId) {
    return c.json({ error: 'Cannot delete your own profile' }, 400)
  }

  const profile = await softDeleteAdminProfile(userId)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)
  return c.json(profile)
})

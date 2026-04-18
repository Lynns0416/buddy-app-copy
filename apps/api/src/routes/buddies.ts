import { Hono } from 'hono'
import { UpdateBuddyProfileSchema } from '@peace-buddy/types'
import { getBuddyProfile, updateBuddyProfile } from '../services/buddy.service'
import type { AuthEnv } from '../types'

const buddyRoutes = new Hono<AuthEnv>()

buddyRoutes.get('/profile', async (c) => {
  const { id } = c.get('user')

  const profile = await getBuddyProfile(id)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)

  return c.json(profile)
})

buddyRoutes.put('/profile', async (c) => {
  const { id } = c.get('user')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = UpdateBuddyProfileSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const profile = await updateBuddyProfile(id, data)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)

  return c.json(profile)
})

export { buddyRoutes }

import { Hono } from 'hono'
import { BuddyStatusSchema, BuddyTierSchema, UpdateBuddyStatusSchema, UpdateAdminBuddyProfileSchema } from '@peace-buddy/types'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile } from '../services/admin.service'
import { adminGroupRoutes } from './adminGroups'
import { adminTourRoutes } from './adminTours'
import { adminEvaluationRoutes } from './adminEvaluations'
import { adminProfileEvaluationRoutes } from './adminProfileEvaluations'
import { adminSelfEvaluationRoutes } from './adminSelfEvaluations'
import { adminProfileRoutes } from './adminProfiles'
import type { AuthEnv } from '../types'

const adminRoutes = new Hono<AuthEnv>()

adminRoutes.route('/groups', adminGroupRoutes)
adminRoutes.route('/tours', adminTourRoutes)
adminRoutes.route('/evaluations', adminEvaluationRoutes)
adminRoutes.route('/profile-evaluations', adminProfileEvaluationRoutes)
adminRoutes.route('/self-evaluations', adminSelfEvaluationRoutes)
adminRoutes.route('', adminProfileRoutes)

adminRoutes.get('/buddies', async (c) => {
  const statusParam = c.req.query('status')
  const tierParam = c.req.query('tier')

  let status
  if (statusParam !== undefined) {
    const parsed = BuddyStatusSchema.safeParse(statusParam)
    if (!parsed.success) return c.json({ error: 'Invalid status' }, 400)
    status = parsed.data
  }

  let tier
  if (tierParam !== undefined) {
    const parsed = BuddyTierSchema.safeParse(tierParam)
    if (!parsed.success) return c.json({ error: 'Invalid tier' }, 400)
    tier = parsed.data
  }

  return c.json(await listBuddies(status, tier))
})

adminRoutes.get('/buddies/:id', async (c) => {
  const id = c.req.param('id')
  const buddy = await getBuddyDetail(id)
  if (!buddy) return c.json({ error: 'Buddy not found' }, 404)
  return c.json(buddy)
})

adminRoutes.put('/buddies/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = UpdateAdminBuddyProfileSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const buddy = await updateBuddyProfile(id, data.tier, data.internalNotes)
  if (!buddy) return c.json({ error: 'Buddy not found' }, 404)

  return c.json(buddy)
})

adminRoutes.put('/buddies/:id/status', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = UpdateBuddyStatusSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const buddy = await updateBuddyStatus(id, data.status)
  if (!buddy) return c.json({ error: 'Buddy not found' }, 404)

  return c.json(buddy)
})

export { adminRoutes }

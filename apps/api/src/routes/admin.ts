import { Hono } from 'hono'
import { BuddyStatusSchema, BuddyTierSchema, MemberTypeSchema, UpdateBuddyStatusSchema, UpdateAdminBuddyProfileSchema, AdminUpdateCancellationSchema, AdminUpdateBookingStatusSchema } from '@peace-buddy/types'
import { listBuddies, updateBuddyStatus, getBuddyDetail, updateBuddyProfile, updateCancellationReason, updateAdminBookingStatus } from '../services/admin.service'
import { adminGroupRoutes } from './adminGroups'
import { adminPlaceRoutes } from './adminPlaces'
import { adminTourRoutes } from './adminTours'
import { adminEvaluationRoutes } from './adminEvaluations'
import { adminProfileEvaluationRoutes } from './adminProfileEvaluations'
import { adminReflectionRoutes } from './adminReflections'
import { adminProfileRoutes } from './adminProfiles'
import { adminDashboardRoutes } from './adminDashboard'
import { adminAttendanceRoutes, adminTourAttendanceRoutes } from './adminAttendance'
import { adminAnnouncementRoutes } from './adminAnnouncements'
import { listBuddyStats } from '../services/adminBuddyStats.service'
import { BuddyStatsQuerySchema } from './statsQuery'
import type { AuthEnv } from '../types'

const adminRoutes = new Hono<AuthEnv>()

adminRoutes.route('/groups', adminGroupRoutes)
adminRoutes.route('/places', adminPlaceRoutes)
adminRoutes.route('/tours', adminTourRoutes)
adminRoutes.route('/tours', adminTourAttendanceRoutes)
adminRoutes.route('/attendance', adminAttendanceRoutes)
adminRoutes.route('/evaluations', adminEvaluationRoutes)
adminRoutes.route('/profile-evaluations', adminProfileEvaluationRoutes)
adminRoutes.route('/reflections', adminReflectionRoutes)
adminRoutes.route('/dashboard', adminDashboardRoutes)
adminRoutes.route('/announcements', adminAnnouncementRoutes)
adminRoutes.route('', adminProfileRoutes)

adminRoutes.get('/buddies', async (c) => {
  const statusParam = c.req.query('status')
  const tierParam = c.req.query('tier')
  const memberTypeParam = c.req.query('memberType')

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

  let memberType
  if (memberTypeParam !== undefined) {
    const parsed = MemberTypeSchema.safeParse(memberTypeParam)
    if (!parsed.success) return c.json({ error: 'Invalid memberType' }, 400)
    memberType = parsed.data
  }

  return c.json(await listBuddies(status, tier, memberType))
})

// Registered before `/buddies/:id`, which would otherwise read `stats` as an id.
adminRoutes.get('/buddies/stats', async (c) => {
  const parsed = BuddyStatsQuerySchema.safeParse(c.req.query())
  if (!parsed.success) return c.json({ error: 'Invalid query params' }, 400)
  return c.json(await listBuddyStats(parsed.data))
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

  const buddy = await updateBuddyProfile(id, data.tier, data.internalNotes, data.memberType)
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

adminRoutes.patch('/bookings/:bookingId/cancellation-reason', async (c) => {
  const bookingId = c.req.param('bookingId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = AdminUpdateCancellationSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400)

  const result = await updateCancellationReason(bookingId, parsed.data.unavoidable)
  if (!result) return c.json({ error: 'Cancellation reason not found' }, 404)
  return c.json(result)
})

adminRoutes.patch('/bookings/:bookingId/status', async (c) => {
  const bookingId = c.req.param('bookingId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = AdminUpdateBookingStatusSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400)

  const result = await updateAdminBookingStatus(bookingId, parsed.data.status)
  if (!result) return c.json({ error: 'Booking not found' }, 404)
  return c.json(result)
})

export { adminRoutes }

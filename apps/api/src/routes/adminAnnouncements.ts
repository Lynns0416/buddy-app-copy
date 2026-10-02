import { Hono } from 'hono'
import { AnnouncementAudienceInputSchema, ReorderAnnouncementsSchema, UpsertAnnouncementSchema } from '@peace-buddy/types'
import {
  listAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  reorderAnnouncements,
  countAudience,
  AnnouncementNotFoundError,
  AnnouncementReferenceError,
  AnnouncementOrderMismatchError,
} from '../services/announcement.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

async function readJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    return undefined
  }
}

const adminAnnouncementRoutes = new Hono<AuthEnv>()

adminAnnouncementRoutes.get('/', async (c) => {
  return c.json(await listAnnouncements())
})

adminAnnouncementRoutes.post('/', async (c) => {
  const parsed = UpsertAnnouncementSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  try {
    return c.json(await createAnnouncement(parsed.data, c.get('user').id), 201)
  } catch (e) {
    if (e instanceof AnnouncementReferenceError) return c.json(apiError('invalid_request'), 400)
    throw e
  }
})

// Registered before /:id so "order" and "audience-count" are not read as ids.
adminAnnouncementRoutes.put('/order', async (c) => {
  const parsed = ReorderAnnouncementsSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  try {
    return c.json(await reorderAnnouncements(parsed.data.ids))
  } catch (e) {
    if (e instanceof AnnouncementOrderMismatchError) return c.json(apiError('conflict'), 409)
    throw e
  }
})

adminAnnouncementRoutes.post('/audience-count', async (c) => {
  const parsed = AnnouncementAudienceInputSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  return c.json({ count: await countAudience(parsed.data) })
})

adminAnnouncementRoutes.get('/:id', async (c) => {
  const announcement = await getAnnouncement(c.req.param('id'))
  if (!announcement) return c.json(apiError('not_found'), 404)
  return c.json(announcement)
})

adminAnnouncementRoutes.put('/:id', async (c) => {
  const parsed = UpsertAnnouncementSchema.safeParse(await readJson(c))
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)
  try {
    return c.json(await updateAnnouncement(c.req.param('id'), parsed.data, c.get('user').id))
  } catch (e) {
    if (e instanceof AnnouncementNotFoundError) return c.json(apiError('not_found'), 404)
    if (e instanceof AnnouncementReferenceError) return c.json(apiError('invalid_request'), 400)
    throw e
  }
})

adminAnnouncementRoutes.delete('/:id', async (c) => {
  try {
    await deleteAnnouncement(c.req.param('id'))
    return c.body(null, 204)
  } catch (e) {
    if (e instanceof AnnouncementNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

export { adminAnnouncementRoutes }

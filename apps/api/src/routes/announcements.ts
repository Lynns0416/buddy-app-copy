import { Hono } from 'hono'
import { listMyAnnouncements } from '../services/announcement.service'
import type { AuthEnv } from '../types'

// Mounted at /me/announcements: only what the caller matches, never the audience.
const myAnnouncementRoutes = new Hono<AuthEnv>()

myAnnouncementRoutes.get('/', async (c) => {
  return c.json(await listMyAnnouncements(c.get('user').id))
})

export { myAnnouncementRoutes }

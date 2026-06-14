import { Hono } from 'hono'
import { MarkNotificationsReadSchema } from '@peace-buddy/types'
import { apiError } from '../lib/api-error'
import { countUnread, listNotifications, markRead } from '../services/notification.service'
import type { AuthEnv } from '../types'

const notificationRoutes = new Hono<AuthEnv>()

notificationRoutes.get('/', async (c) => {
  const { id } = c.get('user')
  const [items, unreadCount] = await Promise.all([listNotifications(id), countUnread(id)])
  return c.json({ items, unreadCount })
})

notificationRoutes.post('/read', async (c) => {
  const { id } = c.get('user')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = MarkNotificationsReadSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  await markRead(id, parsed.data)
  return c.json({ ok: true })
})

export { notificationRoutes }

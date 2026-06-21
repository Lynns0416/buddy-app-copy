import { Hono } from 'hono'
import { UpdateNotificationPreferencesSchema } from '@peace-buddy/types'
import { apiError } from '../lib/api-error'
import {
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
} from '../services/notificationPreference.service'
import type { AuthEnv } from '../types'

const notificationPreferenceRoutes = new Hono<AuthEnv>()

notificationPreferenceRoutes.get('/', async (c) => {
  const { id } = c.get('user')
  const result = await getAdminNotificationPreferences(id)
  return c.json(result)
})

notificationPreferenceRoutes.put('/', async (c) => {
  const { id } = c.get('user')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateNotificationPreferencesSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  try {
    const result = await updateAdminNotificationPreferences(id, parsed.data)
    return c.json(result)
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('duplicate eventType')) {
      return c.json(apiError('invalid_request', e.message), 400)
    }
    throw e
  }
})

export { notificationPreferenceRoutes }

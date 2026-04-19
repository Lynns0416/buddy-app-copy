import { createMiddleware } from 'hono/factory'
import type { AuthEnv } from '../types'

export const adminAuthMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const { role } = c.get('user')
  if (role !== 'admin' && role !== 'super_admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return next()
})

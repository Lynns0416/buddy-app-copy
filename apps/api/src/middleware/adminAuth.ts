import { createMiddleware } from 'hono/factory'
import { UserRoleSchema } from '@peace-buddy/types'
import type { AuthEnv } from '../types'

export const adminAuthMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const { role } = c.get('user')
  if (role !== UserRoleSchema.enum.admin && role !== UserRoleSchema.enum.super_admin) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return next()
})

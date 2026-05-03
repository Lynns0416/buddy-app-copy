import { createMiddleware } from 'hono/factory'
import { db } from '../lib/db'
import type { AuthEnv } from '../types'

export const ensureAdminProfile = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user')
  const firebaseUser = c.get('firebaseUser')
  const name = firebaseUser.name ?? user.email.split('@')[0]

  try {
    await db.adminProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, name },
      select: { id: true },
    })
  } catch {
    // Profile creation is a side effect — do not block the request on failure
  }

  return next()
})

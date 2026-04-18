import { createMiddleware } from 'hono/factory'
import { db } from '../lib/db'
import { verifyFirebaseToken } from './firebaseAuth'
import type { AuthEnv } from '../types'

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const firebaseUser = await verifyFirebaseToken(token)
    c.set('firebaseUser', firebaseUser)

    const user = await db.user.findUnique({
      where: { firebaseUid: firebaseUser.uid },
      select: { id: true, firebaseUid: true, email: true, role: true },
    })

    if (!user) {
      return c.json({ error: 'User not found' }, 401)
    }

    c.set('user', { ...user, role: user.role as string })
    return next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})

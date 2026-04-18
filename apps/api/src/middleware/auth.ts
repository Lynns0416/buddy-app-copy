import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/firebase'
import { db } from '../lib/db'

type Variables = {
  user: {
    id: string
    firebaseUid: string
    email: string
    role: string
  }
}

export const authMiddleware = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    // Scheduler routes use secret header
    if (c.req.path.startsWith('/jobs/')) {
      const secret = c.req.header('X-Scheduler-Secret')
      if (!secret || secret !== process.env.SCHEDULER_SECRET) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return next()
    }

    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.slice(7)

    try {
      const decoded = await auth.verifyIdToken(token)
      const user = await db.user.findUnique({
        where: { firebaseUid: decoded.uid },
        select: { id: true, firebaseUid: true, email: true, role: true },
      })

      if (!user) {
        return c.json({ error: 'User not found' }, 401)
      }

      c.set('user', user)
      return next()
    } catch {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  }
)

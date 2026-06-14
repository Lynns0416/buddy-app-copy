import { createMiddleware } from 'hono/factory'
import { timingSafeEqual } from 'node:crypto'
import type { SchedulerEnv } from '../types'

export const schedulerAuthMiddleware = createMiddleware<SchedulerEnv>(async (c, next) => {
  const provided = c.req.header('X-Scheduler-Secret')
  const expected = process.env.SCHEDULER_SECRET
  if (!provided || !expected) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
})

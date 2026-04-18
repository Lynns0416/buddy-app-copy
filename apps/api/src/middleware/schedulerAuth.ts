import { createMiddleware } from 'hono/factory'
import type { SchedulerEnv } from '../types'

export const schedulerAuthMiddleware = createMiddleware<SchedulerEnv>(async (c, next) => {
  const secret = c.req.header('X-Scheduler-Secret')
  if (!secret || secret !== process.env.SCHEDULER_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
})

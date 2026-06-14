import { Hono } from 'hono'
import { dispatchPending } from '../services/notificationDispatcher.service'
import type { SchedulerEnv } from '../types'

const jobRoutes = new Hono<SchedulerEnv>()

jobRoutes.post('/notifications/dispatch', async (c) => {
  const result = await dispatchPending()
  return c.json(result)
})

export { jobRoutes }

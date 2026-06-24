import { Hono } from 'hono'
import { dispatchPending } from '../services/notificationDispatcher.service'
import { enqueueTourReminders } from '../services/tourReminder.service'
import { enqueueMaybeReminders } from '../services/maybeReminder.service'
import type { SchedulerEnv } from '../types'

const jobRoutes = new Hono<SchedulerEnv>()

jobRoutes.post('/notifications/dispatch', async (c) => {
  const result = await dispatchPending()
  return c.json(result)
})

jobRoutes.post('/notifications/reminders', async (c) => {
  const result = await enqueueTourReminders()
  return c.json(result)
})

jobRoutes.post('/notifications/maybe-reminders', async (c) => {
  const result = await enqueueMaybeReminders()
  return c.json(result)
})

export { jobRoutes }

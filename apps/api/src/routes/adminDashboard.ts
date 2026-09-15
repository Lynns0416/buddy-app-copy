import { Hono } from 'hono'
import { getAdminDashboard } from '../services/adminDashboard.service'
import type { AuthEnv } from '../types'

const adminDashboardRoutes = new Hono<AuthEnv>()

adminDashboardRoutes.get('/', async (c) => {
  return c.json(await getAdminDashboard())
})

export { adminDashboardRoutes }

import { Hono } from 'hono'
import type { AuthEnv } from '../types'

const adminRoutes = new Hono<AuthEnv>()

export { adminRoutes }

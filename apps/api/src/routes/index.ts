import { Hono } from 'hono'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'
import { authMiddleware } from '../middleware/auth'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import { ensureAdminProfile } from '../middleware/ensureAdminProfile'
import { schedulerAuthMiddleware } from '../middleware/schedulerAuth'
import { registerHandler, authRoutes } from './auth'
import { buddyRoutes } from './buddies'
import { tourRoutes } from './tours'
import { adminRoutes } from './admin'
import { reflectionRoutes } from './reflections'
import { notificationRoutes } from './notifications'
import {
  notificationPreferenceRoutes,
  buddyNotificationPreferenceRoutes,
} from './notificationPreferences'
import { jobRoutes } from './jobs'
import type { FirebaseEnv, AuthEnv, SchedulerEnv } from '../types'

// Public routes: Firebase token required, but no DB user record needed
const publicApp = new Hono<FirebaseEnv>()
publicApp.post('/auth/register', firebaseAuthMiddleware, registerHandler)

// Protected routes: Firebase token + DB user record required.
// Each route group declares authMiddleware explicitly so the protected app
// doesn't claim wildcard ownership of all paths (which would block scheduler
// routes mounted alongside it).
const protectedApp = new Hono<AuthEnv>()
protectedApp.use('/auth/*', authMiddleware)
protectedApp.route('/auth', authRoutes)
protectedApp.use('/me/*', authMiddleware)
protectedApp.route('/me', buddyRoutes)
protectedApp.route('/me/reflections', reflectionRoutes)
protectedApp.route('/me/notifications', notificationRoutes)
protectedApp.route('/me/notification-preferences', buddyNotificationPreferenceRoutes)
protectedApp.use('/tours/*', authMiddleware)
protectedApp.route('/tours', tourRoutes)
protectedApp.use('/admin/*', authMiddleware)
protectedApp.use('/admin/*', adminAuthMiddleware)
protectedApp.use('/admin/*', ensureAdminProfile)
protectedApp.route('/admin', adminRoutes)
protectedApp.route('/admin/notification-preferences', notificationPreferenceRoutes)

// Scheduler routes: X-Scheduler-Secret header required
const schedulerApp = new Hono<SchedulerEnv>()
schedulerApp.use('/jobs/*', schedulerAuthMiddleware)
schedulerApp.route('/jobs', jobRoutes)

const routes = new Hono()
routes.route('/', publicApp)
routes.route('/', schedulerApp)
routes.route('/', protectedApp)

export { routes }

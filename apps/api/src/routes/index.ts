import { Hono } from 'hono'
import { firebaseAuthMiddleware } from '../middleware/firebaseAuth'
import { authMiddleware } from '../middleware/auth'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import { ensureAdminProfile } from '../middleware/ensureAdminProfile'
import { registerHandler, authRoutes } from './auth'
import { buddyRoutes } from './buddies'
import { tourRoutes } from './tours'
import { applicationsRoutes } from './applications'
import { adminRoutes } from './admin'
import { selfEvaluationRoutes } from './selfEvaluations'
import type { FirebaseEnv, AuthEnv } from '../types'

// TODO: import route modules as they are implemented
// import { schedulerAuthMiddleware } from '../middleware/schedulerAuth'
// import { bookingRoutes } from './bookings'
// import { evaluationRoutes } from './evaluations'
// import { notificationRoutes } from './notifications'
// import { configRoutes } from './config'
// import { jobRoutes } from './jobs'

// Public routes: Firebase token required, but no DB user record needed
const publicApp = new Hono<FirebaseEnv>()
publicApp.post('/auth/register', firebaseAuthMiddleware, registerHandler)

// Protected routes: Firebase token + DB user record required
const protectedApp = new Hono<AuthEnv>()
protectedApp.use('*', authMiddleware)
protectedApp.route('/auth', authRoutes)
protectedApp.route('/me', buddyRoutes)
protectedApp.route('/me/self-evaluations', selfEvaluationRoutes)
protectedApp.route('/applications', applicationsRoutes)
protectedApp.route('/tours', tourRoutes)
protectedApp.use('/admin/*', adminAuthMiddleware)
protectedApp.use('/admin/*', ensureAdminProfile)
protectedApp.route('/admin', adminRoutes)
// protectedApp.route('/bookings', bookingRoutes)
// protectedApp.route('/evaluations', evaluationRoutes)
// protectedApp.route('/notifications', notificationRoutes)
// protectedApp.route('/config', configRoutes)

// Scheduler routes (add when implementing background jobs):
// const schedulerApp = new Hono<SchedulerEnv>()
// schedulerApp.use('*', schedulerAuthMiddleware)
// schedulerApp.route('/jobs', jobRoutes)

const routes = new Hono()
routes.route('/', publicApp)
routes.route('/', protectedApp)
// routes.route('/', schedulerApp)

export { routes }

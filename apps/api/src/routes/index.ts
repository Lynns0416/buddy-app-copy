import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'

// TODO: import route modules as they are implemented
// import { authRoutes } from './auth'
// import { buddyRoutes } from './buddies'
// import { tourRoutes } from './tours'
// import { bookingRoutes } from './bookings'
// import { evaluationRoutes } from './evaluations'
// import { notificationRoutes } from './notifications'
// import { configRoutes } from './config'
// import { jobRoutes } from './jobs'

const routes = new Hono()

// TODO: /auth/register and /auth/me need special handling —
// /auth/register requires a valid Firebase token to decode the UID but no
// DB user record exists yet, so authMiddleware (which does a DB lookup)
// must either be skipped for that route or made optional.
// Consider mounting authRoutes before the authMiddleware use() call, or
// implementing a separate lightweight Firebase-only middleware for /auth/register.

routes.use('*', authMiddleware)

// routes.route('/auth', authRoutes)
// routes.route('/buddies', buddyRoutes)
// routes.route('/tours', tourRoutes)
// routes.route('/bookings', bookingRoutes)
// routes.route('/evaluations', evaluationRoutes)
// routes.route('/notifications', notificationRoutes)
// routes.route('/config', configRoutes)
// routes.route('/jobs', jobRoutes)

export { routes }

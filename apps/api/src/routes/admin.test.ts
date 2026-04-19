import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

function buildApp(role: string) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'admin@example.com' })
    c.set('user', { id: 'user-1', firebaseUid: 'uid-123', email: 'admin@example.com', role })
    return next()
  })
  app.use('/admin/*', adminAuthMiddleware)
  app.route('/admin', adminRoutes)
  return app
}

describe('admin routes — auth', () => {
  it('returns 401 with no token', async () => {
    const res = await routes.request('/admin/')
    expect(res.status).toBe(401)
  })

  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/admin/')
    expect(res.status).toBe(403)
  })

  it('returns 403 for trainee role', async () => {
    const res = await buildApp('trainee').request('/admin/')
    expect(res.status).toBe(403)
  })

  it('passes through for admin role', async () => {
    const res = await buildApp('admin').request('/admin/')
    // No routes defined yet — 404 means middleware passed
    expect(res.status).toBe(404)
  })

  it('passes through for super_admin role', async () => {
    const res = await buildApp('super_admin').request('/admin/')
    expect(res.status).toBe(404)
  })
})

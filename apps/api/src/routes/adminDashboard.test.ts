import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { AdminDashboardResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/adminDashboard.service', () => ({
  getAdminDashboard: vi.fn(),
}))

import { getAdminDashboard } from '../services/adminDashboard.service'

const mockGet = vi.mocked(getAdminDashboard)

function buildApp(role: string) {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-admin', email: 'admin@example.com' })
    c.set('user', { id: 'admin-1', firebaseUid: 'uid-admin', email: 'admin@example.com', role })
    return next()
  })
  app.use('/admin/*', adminAuthMiddleware)
  app.route('/admin', adminRoutes)
  return app
}

const dashboard: AdminDashboardResponse = {
  pendingBuddies: [{ id: 'b1', displayName: 'Aya', createdAt: '2026-06-01T00:00:00.000Z' }],
  overdueMaybeTours: [],
  underfilledTours: [],
  underfilledLookaheadDays: 14,
  toursMissingEvaluations: [],
}

describe('GET /admin/dashboard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/admin/dashboard')
    expect(res.status).toBe(401)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('returns 403 for buddy role', async () => {
    const res = await buildApp('buddy').request('/admin/dashboard')
    expect(res.status).toBe(403)
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('returns the worklist', async () => {
    mockGet.mockResolvedValueOnce(dashboard)

    const res = await buildApp('admin').request('/admin/dashboard')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(dashboard)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { notificationPreferenceRoutes } from './notificationPreferences'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/notificationPreference.service', () => ({
  getAdminNotificationPreferences: vi.fn(),
  updateAdminNotificationPreferences: vi.fn(),
}))

import {
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
} from '../services/notificationPreference.service'

const mockGet = vi.mocked(getAdminNotificationPreferences)
const mockUpdate = vi.mocked(updateAdminNotificationPreferences)

const adminUser = { id: 'admin-1', firebaseUid: 'uid-a', email: 'admin@example.com', role: 'admin' }

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: adminUser.firebaseUid, email: adminUser.email })
    c.set('user', adminUser)
    return next()
  })
  app.route('/admin/notification-preferences', notificationPreferenceRoutes)
  return app
}

const validBody = {
  preferences: [
    {
      eventType: 'cancellation',
      emailEnabled: true,
      emailMode: 'immediate',
      slackEnabled: false,
    },
  ],
}

describe('GET /admin/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a token', async () => {
    const res = await routes.request('/admin/notification-preferences')
    expect(res.status).toBe(401)
  })

  it('returns the admin preferences for the authenticated admin', async () => {
    mockGet.mockResolvedValueOnce({ preferences: [] })
    const res = await buildApp().request('/admin/notification-preferences')
    expect(res.status).toBe(200)
    expect(mockGet).toHaveBeenCalledWith('admin-1')
  })
})

describe('PUT /admin/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a token', async () => {
    const res = await routes.request('/admin/notification-preferences', { method: 'PUT' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not JSON', async () => {
    const res = await buildApp().request('/admin/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when payload fails schema (bad emailMode)', async () => {
    const res = await buildApp().request('/admin/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: [
          { eventType: 'cancellation', emailEnabled: true, emailMode: 'whenever', slackEnabled: false },
        ],
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when payload fails schema (unknown eventType)', async () => {
    const res = await buildApp().request('/admin/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        preferences: [
          { eventType: 'unknown_event', emailEnabled: true, emailMode: 'immediate', slackEnabled: false },
        ],
      }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when service rejects duplicate eventTypes', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('duplicate eventType in preferences: cancellation'))
    const res = await buildApp().request('/admin/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 with the refreshed preferences on success', async () => {
    mockUpdate.mockResolvedValueOnce({ preferences: validBody.preferences as never })
    const res = await buildApp().request('/admin/notification-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith('admin-1', validBody)
  })
})

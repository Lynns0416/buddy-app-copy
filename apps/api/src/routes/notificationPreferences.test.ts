import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import {
  notificationPreferenceRoutes,
  buddyNotificationPreferenceRoutes,
} from './notificationPreferences'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/notificationPreference.service', () => ({
  getAdminNotificationPreferences: vi.fn(),
  updateAdminNotificationPreferences: vi.fn(),
  getBuddyNotificationPreferences: vi.fn(),
  updateBuddyNotificationPreferences: vi.fn(),
}))

import {
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
  getBuddyNotificationPreferences,
  updateBuddyNotificationPreferences,
} from '../services/notificationPreference.service'

const mockGet = vi.mocked(getAdminNotificationPreferences)
const mockUpdate = vi.mocked(updateAdminNotificationPreferences)
const mockBuddyGet = vi.mocked(getBuddyNotificationPreferences)
const mockBuddyUpdate = vi.mocked(updateBuddyNotificationPreferences)

const adminUser = { id: 'admin-1', firebaseUid: 'uid-a', email: 'admin@example.com', role: 'admin' }
const buddyUser = { id: 'buddy-1', firebaseUid: 'uid-b', email: 'buddy@example.com', role: 'buddy' }

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

function buildBuddyApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: buddyUser.firebaseUid, email: buddyUser.email })
    c.set('user', buddyUser)
    return next()
  })
  app.route('/me/notification-preferences', buddyNotificationPreferenceRoutes)
  return app
}

function buddyPut(body: unknown) {
  return buildBuddyApp().request('/me/notification-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
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

describe('GET /me/notification-preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a token', async () => {
    const res = await routes.request('/me/notification-preferences')
    expect(res.status).toBe(401)
  })

  it('returns the preferences for the authenticated buddy', async () => {
    mockBuddyGet.mockResolvedValueOnce({ preferences: [] })
    const res = await buildBuddyApp().request('/me/notification-preferences')
    expect(res.status).toBe(200)
    expect(mockBuddyGet).toHaveBeenCalledWith('buddy-1')
  })
})

describe('PUT /me/notification-preferences', () => {
  const validBuddyBody = {
    preferences: [{ eventType: 'tour_published', emailEnabled: false }],
  }

  beforeEach(() => vi.clearAllMocks())

  it('returns 401 without a token', async () => {
    const res = await routes.request('/me/notification-preferences', { method: 'PUT' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not JSON', async () => {
    const res = await buddyPut('not json')
    expect(res.status).toBe(400)
    expect(mockBuddyUpdate).not.toHaveBeenCalled()
  })

  // The unmutable set is enforced here, not by leaving the toggle off the page:
  // these four are not in BuddyNotifEventTypeSchema, so a hand-rolled request
  // naming one is refused.
  it.each(['tour_cancelled', 'waitlist_promoted', 'account_approved', 'account_rejected'])(
    'returns 400 for the unmutable event %s',
    async (eventType) => {
      const res = await buddyPut({ preferences: [{ eventType, emailEnabled: false }] })
      expect(res.status).toBe(400)
      expect(mockBuddyUpdate).not.toHaveBeenCalled()
    },
  )

  it('returns 400 for an admin event type', async () => {
    const res = await buddyPut({ preferences: [{ eventType: 'cancellation', emailEnabled: false }] })
    expect(res.status).toBe(400)
    expect(mockBuddyUpdate).not.toHaveBeenCalled()
  })

  it('returns 400 when the service rejects duplicate eventTypes', async () => {
    mockBuddyUpdate.mockRejectedValueOnce(
      new Error('duplicate eventType in preferences: tour_published'),
    )
    const res = await buddyPut(validBuddyBody)
    expect(res.status).toBe(400)
  })

  it('returns 200 with the refreshed preferences on success', async () => {
    mockBuddyUpdate.mockResolvedValueOnce({ preferences: validBuddyBody.preferences as never })
    const res = await buddyPut(validBuddyBody)
    expect(res.status).toBe(200)
    expect(mockBuddyUpdate).toHaveBeenCalledWith('buddy-1', validBuddyBody)
  })
})

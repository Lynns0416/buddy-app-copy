import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { routes } from './index'
import { notificationRoutes } from './notifications'
import type { AuthEnv } from '../types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/notification.service', () => ({
  listNotifications: vi.fn(),
  countUnread: vi.fn(),
  markRead: vi.fn(),
}))

import { listNotifications, countUnread, markRead } from '../services/notification.service'

const mockList = vi.mocked(listNotifications)
const mockCount = vi.mocked(countUnread)
const mockMarkRead = vi.mocked(markRead)

const dbUser = { id: 'user-1', firebaseUid: 'uid-123', email: 'test@example.com', role: 'buddy' }

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: dbUser.firebaseUid, email: dbUser.email })
    c.set('user', dbUser)
    return next()
  })
  app.route('/me/notifications', notificationRoutes)
  return app
}

describe('GET /me/notifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/me/notifications')
    expect(res.status).toBe(401)
  })

  it('returns 200 with items and unreadCount', async () => {
    mockList.mockResolvedValueOnce([
      { id: 'n1', type: 'account_approved', payload: {}, readAt: null, createdAt: '2026-06-01T00:00:00.000Z' },
    ])
    mockCount.mockResolvedValueOnce(1)

    const res = await buildApp().request('/me/notifications')
    expect(res.status).toBe(200)
    const body = await res.json() as { items: unknown[]; unreadCount: number }
    expect(body.unreadCount).toBe(1)
    expect(body.items).toHaveLength(1)
  })

  it('scopes to the authenticated user', async () => {
    mockList.mockResolvedValueOnce([])
    mockCount.mockResolvedValueOnce(0)
    await buildApp().request('/me/notifications')
    expect(mockList).toHaveBeenCalledWith('user-1')
    expect(mockCount).toHaveBeenCalledWith('user-1')
  })
})

describe('POST /me/notifications/read', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 with no token', async () => {
    const res = await routes.request('/me/notifications/read', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  it('returns 400 when body is not JSON', async () => {
    const res = await buildApp().request('/me/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    expect(res.status).toBe(400)
    expect(mockMarkRead).not.toHaveBeenCalled()
  })

  it('returns 400 when body fails schema (empty ids array)', async () => {
    const res = await buildApp().request('/me/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither ids nor all is supplied', async () => {
    const res = await buildApp().request('/me/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 200 and calls markRead with ids form', async () => {
    mockMarkRead.mockResolvedValueOnce(undefined)
    const ids = ['11111111-1111-1111-1111-111111111111']
    const res = await buildApp().request('/me/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    expect(res.status).toBe(200)
    expect(mockMarkRead).toHaveBeenCalledWith('user-1', { ids })
  })

  it('returns 200 and calls markRead with {all: true}', async () => {
    mockMarkRead.mockResolvedValueOnce(undefined)
    const res = await buildApp().request('/me/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    expect(res.status).toBe(200)
    expect(mockMarkRead).toHaveBeenCalledWith('user-1', { all: true })
  })
})

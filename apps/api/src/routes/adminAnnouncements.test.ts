import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminAnnouncementRoutes } from './adminAnnouncements'
import { myAnnouncementRoutes } from './announcements'
import type { AuthEnv } from '../types'
import type { AdminAnnouncementResponse } from '@peace-buddy/types'

vi.mock('../lib/db', () => ({ db: {} }))

vi.mock('../services/announcement.service', () => {
  const err = () => class extends Error {}
  return {
    listAnnouncements: vi.fn(),
    getAnnouncement: vi.fn(),
    createAnnouncement: vi.fn(),
    updateAnnouncement: vi.fn(),
    deleteAnnouncement: vi.fn(),
    reorderAnnouncements: vi.fn(),
    countAudience: vi.fn(),
    listMyAnnouncements: vi.fn(),
    AnnouncementNotFoundError: err(),
    AnnouncementReferenceError: err(),
    AnnouncementOrderMismatchError: err(),
  }
})

import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  reorderAnnouncements,
  countAudience,
  listMyAnnouncements,
  AnnouncementNotFoundError,
  AnnouncementOrderMismatchError,
  AnnouncementReferenceError,
} from '../services/announcement.service'

const mockCreate = vi.mocked(createAnnouncement)
const mockUpdate = vi.mocked(updateAnnouncement)
const mockDelete = vi.mocked(deleteAnnouncement)
const mockReorder = vi.mocked(reorderAnnouncements)
const mockCount = vi.mocked(countAudience)
const mockListMine = vi.mocked(listMyAnnouncements)

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-1', email: 'admin@example.com' })
    c.set('user', { id: 'user-1', firebaseUid: 'uid-1', email: 'admin@example.com', role: 'admin' })
    return next()
  })
  app.route('/admin/announcements', adminAnnouncementRoutes)
  app.route('/me/announcements', myAnnouncementRoutes)
  return app
}

const ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const validBody = {
  titleJa: 'お知らせ',
  bodyJa: '本文',
  titleEn: null,
  bodyEn: null,
  audience: 'rule',
  statuses: ['trainee'],
  tiers: [],
  buddyIds: [],
  startDate: '2026-10-01',
  endDate: '2026-10-10',
  tourId: null,
}

const mockAnnouncement = { id: ID } as AdminAnnouncementResponse

function send(method: string, path: string, body: unknown) {
  return buildApp().request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => vi.clearAllMocks())

describe('POST /admin/announcements', () => {
  it('creates with the caller as author', async () => {
    mockCreate.mockResolvedValueOnce(mockAnnouncement)

    const res = await send('POST', '/admin/announcements', validBody)

    expect(res.status).toBe(201)
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ titleJa: 'お知らせ' }), 'user-1')
  })

  it.each([
    ['an end date before the start date', { endDate: '2026-09-30' }],
    ['no Japanese title', { titleJa: '  ' }],
    ['an English title without an English body', { titleEn: 'Notice' }],
    ['picked buddies with none picked', { audience: 'selected' }],
    ['a status that never reaches Home', { statuses: ['suspended'] }],
  ])('rejects %s', async (_, overrides) => {
    const res = await send('POST', '/admin/announcements', { ...validBody, ...overrides })

    expect(res.status).toBe(400)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('accepts an end date equal to the start date', async () => {
    mockCreate.mockResolvedValueOnce(mockAnnouncement)

    const res = await send('POST', '/admin/announcements', { ...validBody, endDate: '2026-10-01' })

    expect(res.status).toBe(201)
  })

  it('returns 400 when a linked tour or buddy does not exist', async () => {
    mockCreate.mockRejectedValueOnce(new AnnouncementReferenceError())

    const res = await send('POST', '/admin/announcements', validBody)

    expect(res.status).toBe(400)
  })
})

describe('PUT /admin/announcements/:id', () => {
  it('updates with the caller as editor', async () => {
    mockUpdate.mockResolvedValueOnce(mockAnnouncement)

    const res = await send('PUT', `/admin/announcements/${ID}`, validBody)

    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledWith(ID, expect.objectContaining({ audience: 'rule' }), 'user-1')
  })

  it('returns 404 when it does not exist', async () => {
    mockUpdate.mockRejectedValueOnce(new AnnouncementNotFoundError())

    const res = await send('PUT', `/admin/announcements/${ID}`, validBody)

    expect(res.status).toBe(404)
  })
})

describe('DELETE /admin/announcements/:id', () => {
  it('returns 204', async () => {
    mockDelete.mockResolvedValueOnce()

    const res = await buildApp().request(`/admin/announcements/${ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
  })

  it('returns 404 when it does not exist', async () => {
    mockDelete.mockRejectedValueOnce(new AnnouncementNotFoundError())

    const res = await buildApp().request(`/admin/announcements/${ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })
})

describe('PUT /admin/announcements/order', () => {
  it('passes the order through', async () => {
    mockReorder.mockResolvedValueOnce([])

    const res = await send('PUT', '/admin/announcements/order', { ids: [ID] })

    expect(res.status).toBe(200)
    expect(mockReorder).toHaveBeenCalledWith([ID])
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 409 when the ids are not every announcement once', async () => {
    mockReorder.mockRejectedValueOnce(new AnnouncementOrderMismatchError())

    const res = await send('PUT', '/admin/announcements/order', { ids: [ID] })

    expect(res.status).toBe(409)
  })
})

describe('POST /admin/announcements/audience-count', () => {
  it('returns the count', async () => {
    mockCount.mockResolvedValueOnce(12)

    const res = await send('POST', '/admin/announcements/audience-count', {
      audience: 'rule',
      statuses: [],
      tiers: ['star'],
      buddyIds: [],
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: 12 })
  })
})

describe('GET /me/announcements', () => {
  it('lists what the caller matches', async () => {
    mockListMine.mockResolvedValueOnce([])

    const res = await buildApp().request('/me/announcements')

    expect(res.status).toBe(200)
    expect(mockListMine).toHaveBeenCalledWith('user-1')
  })
})

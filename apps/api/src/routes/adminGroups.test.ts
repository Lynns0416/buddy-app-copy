import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { GroupResponse, GroupDetailResponse } from '@peace-buddy/types'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../lib/db', () => ({
  db: { user: { findUnique: vi.fn() } },
}))

vi.mock('../services/admin.service', () => ({
  listBuddies: vi.fn(),
  updateBuddyStatus: vi.fn(),
}))

vi.mock('../services/group.service', () => ({
  listGroups: vi.fn(),
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  getGroup: vi.fn(),
}))

import { listGroups, createGroup, updateGroup, getGroup } from '../services/group.service'

const mockListGroups = vi.mocked(listGroups)
const mockCreateGroup = vi.mocked(createGroup)
const mockUpdateGroup = vi.mocked(updateGroup)
const mockGetGroup = vi.mocked(getGroup)

function buildApp() {
  const app = new Hono<AuthEnv>()
  app.use('*', (c, next) => {
    c.set('firebaseUser', { uid: 'uid-123', email: 'admin@example.com' })
    c.set('user', { id: 'user-1', firebaseUid: 'uid-123', email: 'admin@example.com', role: 'admin' })
    return next()
  })
  app.use('/admin/*', adminAuthMiddleware)
  app.route('/admin', adminRoutes)
  return app
}

const mockGroup: GroupResponse = {
  id: 'group-1',
  name: 'Test School',
  type: 'school',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mockGroupDetail: GroupDetailResponse = { ...mockGroup, tours: [] }

describe('GET /admin/groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns group list', async () => {
    mockListGroups.mockResolvedValueOnce([mockGroup])
    const res = await buildApp().request('/admin/groups')
    expect(res.status).toBe(200)
    const body = await res.json() as GroupResponse[]
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('group-1')
  })
})

describe('POST /admin/groups', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a group and returns 201', async () => {
    mockCreateGroup.mockResolvedValueOnce(mockGroup)
    const res = await buildApp().request('/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test School', type: 'school' }),
    })
    expect(res.status).toBe(201)
    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test School', type: 'school' })
    )
  })

  it('returns 400 when name is missing', async () => {
    const res = await buildApp().request('/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'school' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when type is missing', async () => {
    const res = await buildApp().request('/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'No Type' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid type', async () => {
    const res = await buildApp().request('/admin/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', type: 'invalid' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/groups', {
      method: 'POST',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /admin/groups/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns group detail', async () => {
    mockGetGroup.mockResolvedValueOnce(mockGroupDetail)
    const res = await buildApp().request('/admin/groups/group-1')
    expect(res.status).toBe(200)
    const body = await res.json() as GroupDetailResponse
    expect(body.id).toBe('group-1')
    expect(body.tours).toEqual([])
  })

  it('returns 404 when not found', async () => {
    mockGetGroup.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/groups/missing')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })
})

describe('PUT /admin/groups/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a group', async () => {
    mockUpdateGroup.mockResolvedValueOnce({ ...mockGroup, name: 'Renamed' })
    const res = await buildApp().request('/admin/groups/group-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdateGroup).toHaveBeenCalledWith(
      'group-1',
      expect.objectContaining({ name: 'Renamed' })
    )
  })

  it('returns 404 when group not found', async () => {
    mockUpdateGroup.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/groups/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ code: 'not_found' })
  })

  it('returns 400 for invalid type', async () => {
    const res = await buildApp().request('/admin/groups/group-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'invalid' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for non-JSON body', async () => {
    const res = await buildApp().request('/admin/groups/group-1', {
      method: 'PUT',
      body: 'not json',
    })
    expect(res.status).toBe(400)
  })
})

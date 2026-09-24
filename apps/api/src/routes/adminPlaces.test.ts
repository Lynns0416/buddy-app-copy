import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminRoutes } from './admin'
import { adminAuthMiddleware } from '../middleware/adminAuth'
import type { AuthEnv } from '../types'
import type { PlaceResponse, PlaceDetailResponse, SpotResponse } from '@peace-buddy/types'

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

vi.mock('../services/place.service', () => ({
  listPlaces: vi.fn(),
  createPlace: vi.fn(),
  updatePlace: vi.fn(),
  getPlace: vi.fn(),
  createSpot: vi.fn(),
  updateSpot: vi.fn(),
}))

import { listPlaces, createPlace, updatePlace, getPlace, createSpot, updateSpot } from '../services/place.service'

const mockListPlaces = vi.mocked(listPlaces)
const mockCreatePlace = vi.mocked(createPlace)
const mockUpdatePlace = vi.mocked(updatePlace)
const mockGetPlace = vi.mocked(getPlace)
const mockCreateSpot = vi.mocked(createSpot)
const mockUpdateSpot = vi.mocked(updateSpot)

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

const mockPlace: PlaceResponse = {
  id: 'place-1',
  nameJa: '平和公園',
  nameEn: 'Peace Park',
  sortOrder: 1,
  active: true,
}

const mockSpot: SpotResponse = {
  id: 'spot-1',
  placeId: 'place-1',
  nameJa: '平和祈念像',
  nameEn: 'Peace Statue',
  sortOrder: 1,
  active: true,
}

describe('GET /admin/places', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns place list', async () => {
    mockListPlaces.mockResolvedValueOnce([mockPlace])
    const res = await buildApp().request('/admin/places')
    expect(res.status).toBe(200)
    const body = (await res.json()) as PlaceResponse[]
    expect(body).toHaveLength(1)
  })
})

describe('POST /admin/places', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a place and returns 201', async () => {
    mockCreatePlace.mockResolvedValueOnce(mockPlace)
    const res = await buildApp().request('/admin/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameJa: '平和公園', nameEn: 'Peace Park', sortOrder: 1 }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 400 when nameEn is missing', async () => {
    const res = await buildApp().request('/admin/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameJa: '平和公園', sortOrder: 1 }),
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /admin/places/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns place detail with spots', async () => {
    const detail: PlaceDetailResponse = { ...mockPlace, spots: [mockSpot] }
    mockGetPlace.mockResolvedValueOnce(detail)
    const res = await buildApp().request('/admin/places/place-1')
    expect(res.status).toBe(200)
    const body = (await res.json()) as PlaceDetailResponse
    expect(body.spots).toHaveLength(1)
  })

  it('returns 404 when not found', async () => {
    mockGetPlace.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/places/missing')
    expect(res.status).toBe(404)
  })
})

describe('PUT /admin/places/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a place', async () => {
    mockUpdatePlace.mockResolvedValueOnce({ ...mockPlace, active: false })
    const res = await buildApp().request('/admin/places/place-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when place not found', async () => {
    mockUpdatePlace.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/places/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    expect(res.status).toBe(404)
  })
})

describe('POST /admin/places/:id/spots', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a spot and returns 201', async () => {
    mockCreateSpot.mockResolvedValueOnce(mockSpot)
    const res = await buildApp().request('/admin/places/place-1/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameJa: '平和祈念像', nameEn: 'Peace Statue', sortOrder: 1 }),
    })
    expect(res.status).toBe(201)
  })

  it('returns 404 when the place does not exist', async () => {
    mockCreateSpot.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/places/missing/spots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nameJa: 'x', nameEn: 'x', sortOrder: 1 }),
    })
    expect(res.status).toBe(404)
  })
})

describe('PUT /admin/places/:id/spots/:spotId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates a spot', async () => {
    mockUpdateSpot.mockResolvedValueOnce({ ...mockSpot, active: false })
    const res = await buildApp().request('/admin/places/place-1/spots/spot-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    expect(res.status).toBe(200)
  })

  it('returns 404 when the spot does not exist', async () => {
    mockUpdateSpot.mockResolvedValueOnce(null)
    const res = await buildApp().request('/admin/places/place-1/spots/missing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false }),
    })
    expect(res.status).toBe(404)
  })
})

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { routes } from './index'

vi.mock('../lib/firebase', () => ({
  auth: { verifyIdToken: vi.fn() },
}))

vi.mock('../services/notificationDispatcher.service', () => ({
  dispatchPending: vi.fn(),
}))

import { dispatchPending } from '../services/notificationDispatcher.service'

const mockDispatch = vi.mocked(dispatchPending)

const ORIGINAL_SECRET = process.env.SCHEDULER_SECRET

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SCHEDULER_SECRET = 'test-secret'
})

afterAll(() => {
  process.env.SCHEDULER_SECRET = ORIGINAL_SECRET
})

describe('POST /jobs/notifications/dispatch', () => {
  it('returns 401 when X-Scheduler-Secret is missing', async () => {
    const res = await routes.request('/jobs/notifications/dispatch', { method: 'POST' })
    expect(res.status).toBe(401)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('returns 401 when X-Scheduler-Secret does not match', async () => {
    const res = await routes.request('/jobs/notifications/dispatch', {
      method: 'POST',
      headers: { 'X-Scheduler-Secret': 'wrong' },
    })
    expect(res.status).toBe(401)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('returns 401 even when a Bearer token is provided (this route is scheduler-only)', async () => {
    const res = await routes.request('/jobs/notifications/dispatch', {
      method: 'POST',
      headers: { Authorization: 'Bearer some-firebase-token' },
    })
    expect(res.status).toBe(401)
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it('returns 200 with dispatch result when secret matches', async () => {
    mockDispatch.mockResolvedValueOnce({ picked: 2, sent: 2, failed: 0, dead: 0, skipped: 0 })

    const res = await routes.request('/jobs/notifications/dispatch', {
      method: 'POST',
      headers: { 'X-Scheduler-Secret': 'test-secret' },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, number>
    expect(body).toEqual({ picked: 2, sent: 2, failed: 0, dead: 0, skipped: 0 })
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })
})

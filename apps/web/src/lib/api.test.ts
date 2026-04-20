import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./firebase', () => ({
  firebaseAuth: { currentUser: null },
}))

import { apiRequest } from './api'
import { firebaseAuth } from './firebase'

const auth = firebaseAuth as { currentUser: null | { getIdToken: () => Promise<string> } }

function mockFetch(response: Partial<Response>): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
}

beforeEach(() => {
  auth.currentUser = null
  vi.unstubAllGlobals()
})

describe('apiRequest', () => {
  it('sends request to API_URL with Content-Type header', async () => {
    mockFetch({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) })
    const result = await apiRequest('/test')
    expect(result).toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/test',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    )
  })

  it('includes Authorization header when user is logged in', async () => {
    auth.currentUser = { getIdToken: async () => 'tok-abc' }
    mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) })
    await apiRequest('/protected')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
      }),
    )
  })

  it('omits Authorization header when no user', async () => {
    mockFetch({ ok: true, status: 200, json: () => Promise.resolve({}) })
    await apiRequest('/public')
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  it('throws with server error message on non-ok response', async () => {
    mockFetch({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Not found' }) })
    await expect(apiRequest('/missing')).rejects.toThrow('Not found')
  })

  it('throws generic message when error body cannot be parsed', async () => {
    mockFetch({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) })
    await expect(apiRequest('/error')).rejects.toThrow('Request failed')
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch({ ok: true, status: 204 })
    const result = await apiRequest<void>('/gone')
    expect(result).toBeUndefined()
  })

  it('passes through method and body options', async () => {
    mockFetch({ ok: true, status: 201, json: () => Promise.resolve({ id: '1' }) })
    await apiRequest('/items', { method: 'POST', body: JSON.stringify({ name: 'x' }) })
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'x' }) }),
    )
  })
})

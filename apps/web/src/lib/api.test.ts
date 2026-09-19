import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./firebase', () => ({
  firebaseAuth: { currentUser: null },
}))

import { apiRequest, apiDownload, triggerBlobDownload } from './api'
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

describe('apiDownload', () => {
  const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' })

  it('returns the response body as a blob', async () => {
    mockFetch({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    await expect(apiDownload('/tours/t1/calendar.ics')).resolves.toBe(blob)
    expect(fetch).toHaveBeenCalledWith('http://localhost:8080/tours/t1/calendar.ics', expect.anything())
  })

  it('includes Authorization header when user is logged in', async () => {
    auth.currentUser = { getIdToken: async () => 'tok-abc' }
    mockFetch({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    await apiDownload('/tours/t1/calendar.ics')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok-abc' }),
      }),
    )
  })

  it('does not send a JSON Content-Type — this is a GET with no body', async () => {
    mockFetch({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    await apiDownload('/tours/t1/calendar.ics')
    const headers = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })

  it('throws an ApiError carrying the status on a non-ok response', async () => {
    mockFetch({ ok: false, status: 404, json: () => Promise.resolve({ code: 'not_found' }) })
    await expect(apiDownload('/tours/missing/calendar.ics')).rejects.toMatchObject({ status: 404 })
  })

  it('throws generic message when the error body cannot be parsed', async () => {
    mockFetch({ ok: false, status: 500, json: () => Promise.reject(new Error('parse fail')) })
    await expect(apiDownload('/tours/t1/calendar.ics')).rejects.toThrow('Request failed')
  })
})

describe('triggerBlobDownload', () => {
  const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' })

  // Subclass rather than spread: `createObjectURL`/`revokeObjectURL` are
  // non-enumerable statics, and a plain object would also stop `new URL()`
  // working for anything else running in the same test.
  function stubObjectUrl() {
    const createObjectURL = vi.fn().mockReturnValue('blob:stub-url')
    const revokeObjectURL = vi.fn()
    class StubURL extends URL {
      static createObjectURL = createObjectURL
      static revokeObjectURL = revokeObjectURL
    }
    vi.stubGlobal('URL', StubURL)
    return { createObjectURL, revokeObjectURL }
  }

  function spyOnAnchorClick(onClick: (this: HTMLAnchorElement) => void) {
    return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(onClick)
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('clicks an anchor carrying the blob url and the given filename', () => {
    const { createObjectURL } = stubObjectUrl()
    const clicked: HTMLAnchorElement[] = []
    spyOnAnchorClick(function () { clicked.push(this) })

    triggerBlobDownload(blob, 'tour-t1.ics')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toHaveLength(1)
    expect(clicked[0].getAttribute('href')).toBe('blob:stub-url')
    expect(clicked[0].download).toBe('tour-t1.ics')
  })

  it('has the anchor in the document at click time, and removes it afterwards', () => {
    // Firefox only dispatches the download for a connected anchor.
    vi.useFakeTimers()
    stubObjectUrl()
    let connectedAtClick: boolean | null = null
    const clicked: HTMLAnchorElement[] = []
    spyOnAnchorClick(function () {
      connectedAtClick = this.isConnected
      clicked.push(this)
    })

    triggerBlobDownload(blob, 'tour-t1.ics')

    expect(connectedAtClick).toBe(true)
    vi.runAllTimers()
    expect(clicked[0].isConnected).toBe(false)
  })

  it('keeps the blob url alive past the click, revoking it only on a later task', () => {
    // Revoking in the same tick as the click can abort the save before the
    // browser has read the blob.
    vi.useFakeTimers()
    const { revokeObjectURL } = stubObjectUrl()
    spyOnAnchorClick(() => {})

    triggerBlobDownload(blob, 'tour-t1.ics')

    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:stub-url')
  })
})

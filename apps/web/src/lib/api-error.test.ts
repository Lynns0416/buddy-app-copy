import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyApiError } from './api-error'

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  }
  return { ApiError }
})

import { ApiError } from '@/lib/api'

describe('classifyApiError', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns not_found for 404', () => {
    const err = new ApiError('Not found', 404)
    const result = classifyApiError(err)
    expect(result).toEqual({ code: 'not_found' })
  })

  it('returns forbidden for 403', () => {
    const err = new ApiError('Forbidden', 403)
    const result = classifyApiError(err)
    expect(result).toEqual({ code: 'forbidden' })
  })

  it('returns conflict for 409', () => {
    const err = new ApiError('Conflict', 409)
    const result = classifyApiError(err)
    expect(result).toEqual({ code: 'conflict' })
  })

  it('returns unknown for unmapped ApiError status', () => {
    const err = new ApiError('Server error', 500)
    const result = classifyApiError(err)
    expect(result).toEqual({ code: 'unknown' })
  })

  it('returns network for non-ApiError error', () => {
    const err = new TypeError('Network error')
    const result = classifyApiError(err)
    expect(result).toEqual({ code: 'network' })
  })

  it('returns network for unknown error type', () => {
    const result = classifyApiError(new Error('Unknown'))
    expect(result).toEqual({ code: 'network' })
  })
})

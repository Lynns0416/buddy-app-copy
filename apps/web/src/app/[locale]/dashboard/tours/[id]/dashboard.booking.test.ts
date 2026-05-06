import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInitialBooking, updateBookingStatus, mapErrorToI18nKey } from './dashboard.booking'
import type { BookingResponse } from '@peace-buddy/types'
import { BookingStatusSchema } from '@peace-buddy/types'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    createBooking: vi.fn(),
    updateBooking: vi.fn(),
  },
}))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    constructor(public message: string, public status: number) {
      super(message)
    }
  }
  return { ApiError }
})

vi.mock('../../../../../lib/api-error', () => {
  return {
    classifyApiError: (err: unknown) => {
      if (err instanceof Error && err.message.includes('409')) return { code: 'conflict' }
      if (err instanceof Error && err.message.includes('422')) return { code: 'invalid_request' }
      if (err instanceof Error && err.message.includes('network')) return { code: 'network' }
      return { code: 'unknown' }
    },
  }
})

import { apiClient } from '@/lib/api-client'
import { ApiError } from '@/lib/api'

const mockCreateBooking = vi.mocked(apiClient.createBooking)
const mockUpdateBooking = vi.mocked(apiClient.updateBooking)

const stubBooking: BookingResponse = {
  id: 'bk1',
  tourId: 't1',
  buddyTier: 'junior',
  status: BookingStatusSchema.enum.confirmed,
  bookedAt: '2025-04-15T10:00:00Z',
  updatedAt: '2025-04-15T10:00:00Z',
}

describe('createInitialBooking', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok on success', async () => {
    mockCreateBooking.mockResolvedValue(stubBooking)
    const result = await createInitialBooking('t1')
    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockCreateBooking).toHaveBeenCalledWith('t1')
  })

  it('returns error on tour full (409)', async () => {
    mockCreateBooking.mockRejectedValue(new Error('409'))
    const result = await createInitialBooking('t1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('conflict')
    }
  })

  it('returns network error on request failure', async () => {
    mockCreateBooking.mockRejectedValue(new Error('network'))
    const result = await createInitialBooking('t1')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('network')
    }
  })
})

describe('updateBookingStatus', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns ok on success without reason', async () => {
    mockUpdateBooking.mockResolvedValue(stubBooking)
    const result = await updateBookingStatus('t1', BookingStatusSchema.enum.maybe)
    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockUpdateBooking).toHaveBeenCalledWith('t1', 'maybe', undefined)
  })

  it('returns ok on success with cancellation reason', async () => {
    mockUpdateBooking.mockResolvedValue(stubBooking)
    const reason = { category: 'health' as const, unavoidable: true }
    const result = await updateBookingStatus('t1', BookingStatusSchema.enum.declined, reason)
    expect(result).toEqual({ ok: true, data: undefined })
  })

  it('returns conflict error on tour full (409)', async () => {
    mockUpdateBooking.mockRejectedValue(new Error('409'))
    const result = await updateBookingStatus('t1', BookingStatusSchema.enum.confirmed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('conflict')
    }
  })

  it('returns invalid_request error on deadline passed (422)', async () => {
    mockUpdateBooking.mockRejectedValue(new Error('422'))
    const result = await updateBookingStatus('t1', BookingStatusSchema.enum.confirmed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('invalid_request')
    }
  })

  it('includes specialMessage for Maybe deadline passed', async () => {
    mockUpdateBooking.mockRejectedValue(new ApiError('Maybe deadline has passed', 422))
    const result = await updateBookingStatus('t1', BookingStatusSchema.enum.confirmed)
    expect(result.ok).toBe(false)
    expect(result.specialMessage).toBe('maybeDeadlinePassed')
  })
})

describe('mapErrorToI18nKey', () => {
  it('maps conflict to tourFull', () => {
    expect(mapErrorToI18nKey('conflict')).toBe('tourFull')
  })

  it('maps invalid_request to deadlinePassed', () => {
    expect(mapErrorToI18nKey('invalid_request')).toBe('deadlinePassed')
  })

  it('maps other codes to bookingError', () => {
    expect(mapErrorToI18nKey('network')).toBe('bookingError')
    expect(mapErrorToI18nKey('not_found')).toBe('bookingError')
  })
})

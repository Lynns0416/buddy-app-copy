import { describe, it, expect } from 'vitest'
import { getTodayJst } from './date'

describe('getTodayJst', () => {
  it('is already the next day in Japan while UTC is still on the previous one', () => {
    expect(getTodayJst(new Date('2026-09-14T15:00:00.000Z'))).toBe('2026-09-15')
  })

  it('is still the same day in Japan at the last millisecond before JST midnight', () => {
    expect(getTodayJst(new Date('2026-09-15T14:59:59.999Z'))).toBe('2026-09-15')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import {
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
} from './notificationPreference.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  notificationPreference: { findMany: MockFn; upsert: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb = {
    notificationPreference: { findMany: vi.fn(), upsert: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((arg: unknown) => {
    if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[])
    if (typeof arg === 'function') return (arg as (tx: unknown) => Promise<unknown>)(mockDb)
    return Promise.resolve(arg)
  })
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

beforeEach(() => vi.clearAllMocks())

describe('getAdminNotificationPreferences', () => {
  it('returns one row per event type, backfilling defaults when none stored', async () => {
    mdb.notificationPreference.findMany.mockResolvedValueOnce([])
    const result = await getAdminNotificationPreferences('admin-1')
    expect(result.preferences).toHaveLength(5)
    const map = new Map(result.preferences.map((p) => [p.eventType, p]))
    // PRD §10.2 defaults — Slack is the admin channel, email off unless opted in.
    expect(map.get('new_signup')).toEqual({ eventType: 'new_signup', emailEnabled: false, emailMode: 'immediate', slackEnabled: true })
    expect(map.get('cancellation')).toEqual({ eventType: 'cancellation', emailEnabled: false, emailMode: 'immediate', slackEnabled: true })
  })

  it('overlays stored rows on top of defaults', async () => {
    mdb.notificationPreference.findMany.mockResolvedValueOnce([
      { eventType: 'new_signup', emailEnabled: false, emailMode: 'immediate', slackEnabled: true },
    ])
    const result = await getAdminNotificationPreferences('admin-1')
    const stored = result.preferences.find((p) => p.eventType === 'new_signup')
    expect(stored).toEqual({ eventType: 'new_signup', emailEnabled: false, emailMode: 'immediate', slackEnabled: true })
    // unaffected types still get defaults
    const cancellation = result.preferences.find((p) => p.eventType === 'cancellation')
    expect(cancellation?.emailMode).toBe('immediate')
  })

  it('scopes findMany to the adminId', async () => {
    mdb.notificationPreference.findMany.mockResolvedValueOnce([])
    await getAdminNotificationPreferences('admin-42')
    expect(mdb.notificationPreference.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { adminId: 'admin-42' } }),
    )
  })
})

describe('updateAdminNotificationPreferences', () => {
  it('upserts each preference row', async () => {
    mdb.notificationPreference.findMany.mockResolvedValueOnce([])
    await updateAdminNotificationPreferences('admin-1', {
      preferences: [
        { eventType: 'cancellation', emailEnabled: true, emailMode: 'immediate', slackEnabled: false },
        { eventType: 'new_booking', emailEnabled: false, emailMode: 'digest', slackEnabled: true },
      ],
    })
    expect(mdb.notificationPreference.upsert).toHaveBeenCalledTimes(2)
    type UpsertCall = { where: unknown; create: { adminId: string; eventType: string } }
    const calls = mdb.notificationPreference.upsert.mock.calls.map((c) => c[0] as UpsertCall)
    expect(calls[0].where).toEqual({ adminId_eventType: { adminId: 'admin-1', eventType: 'cancellation' } })
    expect(calls[0].create).toMatchObject({ adminId: 'admin-1', eventType: 'cancellation' })
  })

  it('throws on duplicate event types in input', async () => {
    await expect(
      updateAdminNotificationPreferences('admin-1', {
        preferences: [
          { eventType: 'cancellation', emailEnabled: true, emailMode: 'immediate', slackEnabled: false },
          { eventType: 'cancellation', emailEnabled: false, emailMode: 'digest', slackEnabled: false },
        ],
      }),
    ).rejects.toThrow(/duplicate eventType/)
    expect(mdb.notificationPreference.upsert).not.toHaveBeenCalled()
  })

  it('returns the refreshed preferences after upsert', async () => {
    mdb.notificationPreference.findMany.mockResolvedValueOnce([
      { eventType: 'cancellation', emailEnabled: false, emailMode: 'digest', slackEnabled: true },
    ])
    const result = await updateAdminNotificationPreferences('admin-1', {
      preferences: [
        { eventType: 'cancellation', emailEnabled: false, emailMode: 'digest', slackEnabled: true },
      ],
    })
    expect(result.preferences.find((p) => p.eventType === 'cancellation')).toEqual({
      eventType: 'cancellation',
      emailEnabled: false,
      emailMode: 'digest',
      slackEnabled: true,
    })
  })
})

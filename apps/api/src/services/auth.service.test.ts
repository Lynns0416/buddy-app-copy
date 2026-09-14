import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { upsertUser, getUser } from './auth.service'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  user: { upsert: MockFn; findUnique: MockFn; findMany: MockFn }
  notificationJob: { createMany: MockFn }
  $transaction: MockFn
}

vi.mock('../lib/db', () => {
  const $transaction = vi.fn()
  const mockDb = {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    notificationJob: { createMany: vi.fn() },
    $transaction,
  }
  $transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) => fn(mockDb))
  return { db: mockDb }
})

import { db } from '../lib/db'
const mdb = db as unknown as MockDb

// Typed wrapper: expect.objectContaining returns `any` in this Vitest version
function oc<T extends Record<string, unknown>>(v: T): T {
  return expect.objectContaining(v) as unknown as T
}

const mockUserRow = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'buddy',
  createdAt: new Date('2026-01-01'),
  buddyProfile: {
    id: 'profile-1',
    status: 'pending',
    displayName: 'Test User',
    realName: '',
    photoUrl: null,
    bio: null,
    contactInfo: null,
    languages: [],
    skills: [],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
}

describe('upsertUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.user.findUnique.mockResolvedValue({ id: 'user-1' })
    mdb.user.findMany.mockResolvedValue([])
  })

  it('calls db.user.upsert with correct create args', async () => {
    mdb.user.upsert.mockResolvedValueOnce(mockUserRow)

    await upsertUser('uid-123', 'test@example.com', {
      displayName: 'Test User',
      realName: 'Real Name',
      languages: ['japanese', 'english'],
    })

    expect(mdb.user.upsert).toHaveBeenCalledWith(
      oc({
        where: { firebaseUid: 'uid-123' },
        create: oc({
          firebaseUid: 'uid-123',
          email: 'test@example.com',
          role: 'buddy',
          buddyProfile: {
            create: oc({
              status: 'pending',
              displayName: 'Test User',
              realName: 'Real Name',
              languages: ['japanese', 'english'],
            }),
          },
        }),
        update: { email: 'test@example.com' },
      })
    )
  })

  it('leaves the stored email alone when the token carried no email claim', async () => {
    mdb.user.upsert.mockResolvedValueOnce(mockUserRow)

    // verifyFirebaseToken falls back to '' when the ID token has no email claim
    await upsertUser('uid-123', '', {})

    expect(mdb.user.upsert).toHaveBeenCalledWith(oc({ update: {} }))
  })

  it('refreshes email on re-sign-in so a changed provider address is not kept stale', async () => {
    mdb.user.upsert.mockResolvedValueOnce({ ...mockUserRow, email: 'new@example.com' })

    await upsertUser('uid-123', 'new@example.com', {})

    expect(mdb.user.upsert).toHaveBeenCalledWith(
      oc({
        where: { firebaseUid: 'uid-123' },
        update: { email: 'new@example.com' },
      })
    )
  })

  it('falls back to email prefix when displayName is not provided', async () => {
    mdb.user.upsert.mockResolvedValueOnce(mockUserRow)

    await upsertUser('uid-123', 'hello@example.com', {})

    expect(mdb.user.upsert).toHaveBeenCalledWith(
      oc({
        create: oc({
          buddyProfile: {
            create: oc({ displayName: 'hello' }),
          },
        }),
      })
    )
  })

  it('returns the user record', async () => {
    mdb.user.upsert.mockResolvedValueOnce(mockUserRow)

    const result = await upsertUser('uid-123', 'test@example.com', {})

    expect(result).toEqual(mockUserRow)
  })

  it('does not include admin-only fields in the select', async () => {
    mdb.user.upsert.mockResolvedValueOnce(mockUserRow)

    await upsertUser('uid-123', 'test@example.com', {})

    const call = mdb.user.upsert.mock.calls[0][0] as { select: Record<string, unknown> & { buddyProfile: { select: Record<string, unknown> } } }
    expect(call.select).toBeDefined()
    expect(call.select.buddyProfile.select.internalNotes).toBeUndefined()
    expect(call.select.buddyProfile.select.memberType).toBeUndefined()
    expect(call.select.firebaseUid).toBeUndefined()
  })
})

describe('getUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when user is not found', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(null)

    const result = await getUser('unknown-id')

    expect(result).toBeNull()
  })

  it('returns the user when found', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(mockUserRow)

    const result = await getUser('user-1')

    expect(result).toEqual(mockUserRow)
  })

  it('queries by id', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(mockUserRow)

    await getUser('user-1')

    expect(mdb.user.findUnique).toHaveBeenCalledWith(
      oc({ where: { id: 'user-1' } })
    )
  })

  it('does not include admin-only fields in the select', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(mockUserRow)

    await getUser('user-1')

    const call = mdb.user.findUnique.mock.calls[0][0] as { select: Record<string, unknown> & { buddyProfile: { select: Record<string, unknown> } } }
    expect(call.select.buddyProfile.select.internalNotes).toBeUndefined()
    expect(call.select.buddyProfile.select.memberType).toBeUndefined()
    expect(call.select.firebaseUid).toBeUndefined()
  })

  it('includes the tier, which the buddy may see', async () => {
    mdb.user.findUnique.mockResolvedValueOnce(mockUserRow)

    await getUser('user-1')

    const call = mdb.user.findUnique.mock.calls[0][0] as { select: { buddyProfile: { select: Record<string, unknown> } } }
    expect(call.select.buddyProfile.select.tier).toBe(true)
  })
})

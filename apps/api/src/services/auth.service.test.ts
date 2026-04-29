/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { upsertUser, getUser } from './auth.service'

vi.mock('../lib/db', () => ({
  db: {
    user: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '../lib/db'

// eslint-disable-next-line @typescript-eslint/unbound-method
const mockUpsert = vi.mocked(db.user).upsert
// eslint-disable-next-line @typescript-eslint/unbound-method
const mockFindUnique = vi.mocked(db.user).findUnique

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
    availability: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
}

describe('upsertUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls db.user.upsert with correct create args', async () => {
    mockUpsert.mockResolvedValueOnce(mockUserRow as any)

    await upsertUser('uid-123', 'test@example.com', {
      displayName: 'Test User',
      realName: 'Real Name',
      languages: ['japanese', 'english'],
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { firebaseUid: 'uid-123' },
        create: expect.objectContaining({
          firebaseUid: 'uid-123',
          email: 'test@example.com',
          role: 'buddy',
          buddyProfile: {
            create: expect.objectContaining({
              status: 'pending',
              displayName: 'Test User',
              realName: 'Real Name',
              languages: ['japanese', 'english'],
            }),
          },
        }),
        update: {},
      })
    )
  })

  it('falls back to email prefix when displayName is not provided', async () => {
    mockUpsert.mockResolvedValueOnce(mockUserRow as any)

    await upsertUser('uid-123', 'hello@example.com', {})

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          buddyProfile: {
            create: expect.objectContaining({ displayName: 'hello' }),
          },
        }),
      })
    )
  })

  it('returns the user record', async () => {
    mockUpsert.mockResolvedValueOnce(mockUserRow as any)

    const result = await upsertUser('uid-123', 'test@example.com', {})

    expect(result).toEqual(mockUserRow)
  })

  it('does not include admin-only fields in the select', async () => {
    mockUpsert.mockResolvedValueOnce(mockUserRow as any)

    await upsertUser('uid-123', 'test@example.com', {})

    const call = mockUpsert.mock.calls[0][0] as any
    expect(call.select).toBeDefined()
    expect(call.select.buddyProfile.select.internalNotes).toBeUndefined()
    expect(call.select.buddyProfile.select.tier).toBeUndefined()
    expect(call.select.firebaseUid).toBeUndefined()
  })
})

describe('getUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when user is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null as any)

    const result = await getUser('unknown-id')

    expect(result).toBeNull()
  })

  it('returns the user when found', async () => {
    mockFindUnique.mockResolvedValueOnce(mockUserRow as any)

    const result = await getUser('user-1')

    expect(result).toEqual(mockUserRow)
  })

  it('queries by id', async () => {
    mockFindUnique.mockResolvedValueOnce(mockUserRow as any)

    await getUser('user-1')

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } })
    )
  })

  it('does not include admin-only fields in the select', async () => {
    mockFindUnique.mockResolvedValueOnce(mockUserRow as any)

    await getUser('user-1')

    const call = mockFindUnique.mock.calls[0][0] as any
    expect(call.select.buddyProfile.select.internalNotes).toBeUndefined()
    expect(call.select.buddyProfile.select.tier).toBeUndefined()
    expect(call.select.firebaseUid).toBeUndefined()
  })
})

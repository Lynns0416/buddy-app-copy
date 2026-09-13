import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

type MockFn = Mock<(...args: unknown[]) => unknown>
interface MockDb {
  buddyProfile: { findUnique: MockFn; update: MockFn }
}

vi.mock('../lib/db', () => {
  const mockDb: MockDb = {
    buddyProfile: { findUnique: vi.fn(), update: vi.fn() },
  }
  return { db: mockDb }
})

vi.mock('../lib/photoStorage', () => ({
  PhotoStorageUnconfiguredError: class PhotoStorageUnconfiguredError extends Error {},
  assertPhotoStorageConfigured: vi.fn(),
  putPhoto: vi.fn(),
  deletePhoto: vi.fn(),
  withPhotoLink: vi.fn(({ photoKey, ...rest }: { photoKey: string | null }) =>
    Promise.resolve({ ...rest, photoUrl: photoKey && `signed/${photoKey}` }),
  ),
}))

import { db } from '../lib/db'
import { assertPhotoStorageConfigured, deletePhoto, putPhoto } from '../lib/photoStorage'
import { uploadBuddyPhoto, deleteBuddyPhoto, PhotoStorageUnconfiguredError } from './buddyPhoto.service'

const mdb = db as unknown as MockDb
const mockAssertConfigured = vi.mocked(assertPhotoStorageConfigured)
const mockPutPhoto = vi.mocked(putPhoto)
const mockDeletePhoto = vi.mocked(deletePhoto)

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const photo = () => new File([jpeg], 'a.jpg', { type: 'image/jpeg' })
const previousKey = 'buddy-photos/profile-1/previous.jpg'

describe('uploadBuddyPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findUnique.mockResolvedValue({ id: 'profile-1', photoKey: previousKey })
    mdb.buddyProfile.update.mockImplementation((args) =>
      Promise.resolve({ id: 'profile-1', photoKey: (args as { data: { photoKey: string } }).data.photoKey }),
    )
  })

  it('rejects before touching the database when storage is unconfigured', async () => {
    mockAssertConfigured.mockImplementationOnce(() => {
      throw new PhotoStorageUnconfiguredError('STORAGE_ACCOUNT_URL')
    })

    await expect(uploadBuddyPhoto('user-1', photo())).rejects.toBeInstanceOf(PhotoStorageUnconfiguredError)
    expect(mdb.buddyProfile.findUnique).not.toHaveBeenCalled()
  })

  it('stores the blob name in the row, not a link', async () => {
    await uploadBuddyPhoto('user-1', photo())

    const [key, , contentType] = mockPutPhoto.mock.calls[0]
    expect(key).toMatch(/^buddy-photos\/profile-1\/[0-9a-f-]{36}\.jpg$/)
    expect(contentType).toBe('image/jpeg')
    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { photoKey: key } }),
    )
  })

  it('returns the profile with a signed link in place of the blob name', async () => {
    const result = await uploadBuddyPhoto('user-1', photo())

    const [key] = mockPutPhoto.mock.calls[0]
    expect(result).toEqual({ id: 'profile-1', photoUrl: `signed/${key}` })
  })

  it('deletes the previous blob only after the row points at the new one', async () => {
    await uploadBuddyPhoto('user-1', photo())

    expect(mockDeletePhoto).toHaveBeenCalledWith(previousKey)
    expect(mdb.buddyProfile.update.mock.invocationCallOrder[0])
      .toBeLessThan(mockDeletePhoto.mock.invocationCallOrder[0])
  })

  it('still succeeds when deleting the previous blob fails', async () => {
    mockDeletePhoto.mockRejectedValueOnce(new Error('network'))

    await expect(uploadBuddyPhoto('user-1', photo())).resolves.toBeDefined()
  })
})

describe('deleteBuddyPhoto', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mdb.buddyProfile.findUnique.mockResolvedValue({ photoKey: previousKey })
    mdb.buddyProfile.update.mockResolvedValue({ id: 'profile-1', photoKey: null })
  })

  it('clears the row and deletes the blob', async () => {
    const result = await deleteBuddyPhoto('user-1')

    expect(mdb.buddyProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { photoKey: null } }),
    )
    expect(mockDeletePhoto).toHaveBeenCalledWith(previousKey)
    expect(result).toEqual({ id: 'profile-1', photoUrl: null })
  })
})

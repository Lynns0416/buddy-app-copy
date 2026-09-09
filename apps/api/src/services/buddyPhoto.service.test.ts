import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

import { db } from '../lib/db'
import { uploadBuddyPhoto, PhotoStorageUnconfiguredError } from './buddyPhoto.service'

const mdb = db as unknown as MockDb

const R2_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
]

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const photo = () => new File([jpeg], 'a.jpg', { type: 'image/jpeg' })

describe('uploadBuddyPhoto R2 configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const name of R2_ENV_VARS) vi.stubEnv(name, 'set')
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each(R2_ENV_VARS)('rejects before touching the database when %s is missing', async (name) => {
    vi.stubEnv(name, '')

    await expect(uploadBuddyPhoto('user-1', photo())).rejects.toBeInstanceOf(PhotoStorageUnconfiguredError)
    expect(mdb.buddyProfile.findUnique).not.toHaveBeenCalled()
  })

  it('names every missing variable so the deploy step is identifiable', async () => {
    for (const name of R2_ENV_VARS) vi.stubEnv(name, '')

    await expect(uploadBuddyPhoto('user-1', photo())).rejects.toThrow(R2_ENV_VARS.join(', '))
  })
})

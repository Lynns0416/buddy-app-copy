import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Constructing the credential must not probe the instance metadata endpoint;
// every test that reaches Azure stubs getUserDelegationKey instead.
vi.mock('@azure/identity', () => ({
  ManagedIdentityCredential: class ManagedIdentityCredential {
    getToken() {
      return Promise.resolve({ token: 'token', expiresOnTimestamp: 0 })
    }
  },
}))

const AZURE_ENV_VARS = [
  'STORAGE_ACCOUNT_URL',
  'STORAGE_IDENTITY_CLIENT_ID',
  'STORAGE_PHOTOS_CONTAINER',
]

// Azurite's published development account. The key is public by design.
const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;' +
  'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' +
  'BlobEndpoint=http://azurite:10000/devstoreaccount1;'

// The module caches its client, so each test loads a fresh copy against the
// environment it stubbed.
async function load() {
  vi.resetModules()
  return import('./photoStorage')
}

describe('photo storage configuration', () => {
  beforeEach(() => {
    vi.stubEnv('STORAGE_CONNECTION_STRING', '')
    vi.stubEnv('STORAGE_LINK_BASE_URL', '')
    for (const name of AZURE_ENV_VARS) vi.stubEnv(name, 'set')
  })
  afterEach(() => vi.unstubAllEnvs())

  it.each(AZURE_ENV_VARS)('rejects when %s is missing', async (name) => {
    vi.stubEnv(name, '')
    const { assertPhotoStorageConfigured, PhotoStorageUnconfiguredError } = await load()

    expect(() => assertPhotoStorageConfigured()).toThrow(PhotoStorageUnconfiguredError)
  })

  it('names every missing variable so the deploy step is identifiable', async () => {
    for (const name of AZURE_ENV_VARS) vi.stubEnv(name, '')
    const { assertPhotoStorageConfigured } = await load()

    expect(() => assertPhotoStorageConfigured()).toThrow(AZURE_ENV_VARS.join(', '))
  })

  it('needs only the container name alongside an Azurite connection string', async () => {
    for (const name of AZURE_ENV_VARS) vi.stubEnv(name, '')
    vi.stubEnv('STORAGE_CONNECTION_STRING', AZURITE_CONNECTION_STRING)
    const { assertPhotoStorageConfigured } = await load()

    expect(() => assertPhotoStorageConfigured()).toThrow('STORAGE_PHOTOS_CONTAINER')
    vi.stubEnv('STORAGE_PHOTOS_CONTAINER', 'photos')
    expect(() => assertPhotoStorageConfigured()).not.toThrow()
  })
})

describe('photoLink', () => {
  beforeEach(() => {
    for (const name of AZURE_ENV_VARS) vi.stubEnv(name, '')
    vi.stubEnv('STORAGE_CONNECTION_STRING', AZURITE_CONNECTION_STRING)
    vi.stubEnv('STORAGE_PHOTOS_CONTAINER', 'photos')
    vi.stubEnv('STORAGE_LINK_BASE_URL', 'http://localhost:10000/devstoreaccount1')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('returns null when there is no photo', async () => {
    const { photoLink } = await load()

    expect(await photoLink(null)).toBeNull()
  })

  it('signs a read-only link on the host the browser can reach', async () => {
    const { photoLink } = await load()

    const link = new URL((await photoLink('buddy-photos/profile-1/a.jpg')) ?? '')

    expect(`${link.origin}${link.pathname}`)
      .toBe('http://localhost:10000/devstoreaccount1/photos/buddy-photos/profile-1/a.jpg')
    expect(link.searchParams.get('sp')).toBe('r')
    expect(link.searchParams.get('sig')).toBeTruthy()
  })

  describe('caching', () => {
    afterEach(() => vi.useRealTimers())

    // Browsers and next/image cache by URL, so a link that changed on every
    // response would be fetched and resized again on every page load.
    it('signs the same link all day, expiring at the end of tomorrow UTC', async () => {
      const { photoLink } = await load()
      vi.useFakeTimers()

      vi.setSystemTime(new Date('2026-09-13T00:05:00Z'))
      const morning = await photoLink('buddy-photos/profile-1/a.jpg')
      vi.setSystemTime(new Date('2026-09-13T23:55:00Z'))
      const night = await photoLink('buddy-photos/profile-1/a.jpg')

      expect(night).toBe(morning)
      const expiry = new URL(morning ?? '').searchParams.get('se') ?? ''
      expect(new Date(expiry).getTime()).toBe(new Date('2026-09-15T00:00:00Z').getTime())
    })

    it('signs a new link the next day', async () => {
      const { photoLink } = await load()
      vi.useFakeTimers()

      vi.setSystemTime(new Date('2026-09-13T23:55:00Z'))
      const today = await photoLink('buddy-photos/profile-1/a.jpg')
      vi.setSystemTime(new Date('2026-09-14T00:05:00Z'))
      const tomorrow = await photoLink('buddy-photos/profile-1/a.jpg')

      expect(tomorrow).not.toBe(today)
    })
  })

  it('renders no photo rather than failing the read when storage is unconfigured', async () => {
    vi.stubEnv('STORAGE_CONNECTION_STRING', '')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { photoLink } = await load()

    expect(await photoLink('buddy-photos/profile-1/a.jpg')).toBeNull()
  })
})

// The branch that runs in production. Azurite signs with a shared key and never
// asks for a delegation key, so every test above exercises the branch that only
// ever runs locally.
describe('photoLink against Azure', () => {
  // Fields the SDK reads when it signs; start and expiry echo the request so
  // the cache sees the same window a real key would carry.
  const DELEGATION_KEY = {
    signedObjectId: '00000000-0000-0000-0000-000000000001',
    signedTenantId: '00000000-0000-0000-0000-000000000002',
    signedService: 'b',
    signedVersion: '2025-01-05',
    value: 'a2V5',
  }

  // Both imports follow the same resetModules, so the spy lands on the class
  // the module under test will construct.
  async function loadAzure() {
    vi.resetModules()
    const blob = await import('@azure/storage-blob')
    const getKey = vi
      .spyOn(blob.BlobServiceClient.prototype, 'getUserDelegationKey')
      // The method is overloaded; the cast picks the (startsOn, expiresOn) form.
      .mockImplementation(((startsOn: Date, expiresOn: Date) =>
        Promise.resolve({
          ...DELEGATION_KEY,
          signedStartsOn: startsOn,
          signedExpiresOn: expiresOn,
        })) as never)
    return { ...(await import('./photoStorage')), getKey }
  }

  beforeEach(() => {
    vi.stubEnv('STORAGE_CONNECTION_STRING', '')
    vi.stubEnv('STORAGE_LINK_BASE_URL', '')
    vi.stubEnv('STORAGE_ACCOUNT_URL', 'https://stpeacebuddystg.blob.core.windows.net')
    vi.stubEnv('STORAGE_IDENTITY_CLIENT_ID', 'client-id')
    vi.stubEnv('STORAGE_PHOTOS_CONTAINER', 'photos')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('signs with a user delegation key, on the account host', async () => {
    const { photoLink, getKey } = await loadAzure()

    const link = new URL((await photoLink('buddy-photos/profile-1/a.jpg')) ?? '')

    expect(`${link.origin}${link.pathname}`).toBe(
      'https://stpeacebuddystg.blob.core.windows.net/photos/buddy-photos/profile-1/a.jpg',
    )
    expect(link.searchParams.get('sp')).toBe('r')
    expect(link.searchParams.get('sig')).toBeTruthy()
    // Present only on a user delegation SAS — a shared-key signature has neither.
    expect(link.searchParams.get('skoid')).toBe(DELEGATION_KEY.signedObjectId)
    expect(getKey).toHaveBeenCalledTimes(1)
  })

  // An admin buddy list signs every photo in one Promise.all. Caching the
  // resolved key rather than the in-flight promise would send each of those to
  // Entra for a key of its own.
  it('asks for one delegation key however many links are signed at once', async () => {
    const { photoLink, getKey } = await loadAzure()

    const links = await Promise.all([
      photoLink('buddy-photos/profile-1/a.jpg'),
      photoLink('buddy-photos/profile-2/b.jpg'),
      photoLink('buddy-photos/profile-3/c.jpg'),
    ])

    expect(links.every((l) => l !== null)).toBe(true)
    expect(getKey).toHaveBeenCalledTimes(1)
  })

  it('reuses the key all day and asks for a new one once it no longer covers the link', async () => {
    const { photoLink, getKey } = await loadAzure()
    vi.useFakeTimers()

    vi.setSystemTime(new Date('2026-09-13T00:05:00Z'))
    await photoLink('buddy-photos/profile-1/a.jpg')
    vi.setSystemTime(new Date('2026-09-13T23:55:00Z'))
    await photoLink('buddy-photos/profile-1/a.jpg')
    expect(getKey).toHaveBeenCalledTimes(1)

    // Tomorrow's link expires past what a key minted yesterday covers.
    vi.setSystemTime(new Date('2026-09-14T00:05:00Z'))
    await photoLink('buddy-photos/profile-1/a.jpg')
    expect(getKey).toHaveBeenCalledTimes(2)
  })

  // Without this a transient Entra or Blob failure 500s GET /me, the buddy
  // profile and the admin buddy list — reads that have nothing to do with photos.
  it('renders no photo rather than failing the read when the key cannot be fetched', async () => {
    const { photoLink, getKey } = await loadAzure()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    getKey.mockRejectedValueOnce(new Error('AuthorizationPermissionMismatch'))

    expect(await photoLink('buddy-photos/profile-1/a.jpg')).toBeNull()
    expect(error).toHaveBeenCalled()
  })

  it('retries on the next read instead of caching the failure', async () => {
    const { photoLink, getKey } = await loadAzure()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    getKey.mockRejectedValueOnce(new Error('AuthorizationPermissionMismatch'))

    expect(await photoLink('buddy-photos/profile-1/a.jpg')).toBeNull()
    expect(await photoLink('buddy-photos/profile-1/a.jpg')).toContain('sig=')
    expect(getKey).toHaveBeenCalledTimes(2)
  })
})

describe('withPhotoLink', () => {
  beforeEach(() => vi.stubEnv('STORAGE_CONNECTION_STRING', ''))
  afterEach(() => vi.unstubAllEnvs())

  it('replaces photoKey with photoUrl', async () => {
    const { withPhotoLink } = await load()

    expect(await withPhotoLink({ id: 'profile-1', photoKey: null })).toEqual({ id: 'profile-1', photoUrl: null })
  })
})

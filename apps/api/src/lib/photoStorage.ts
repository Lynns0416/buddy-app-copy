import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  type ContainerClient,
  type UserDelegationKey,
} from '@azure/storage-blob'
import { ManagedIdentityCredential } from '@azure/identity'

// Buddy photos live in a private Blob container: anonymous access and shared-key
// auth are both off on the Azure account. The database holds only the blob name,
// and every response that carries a photo gets a read-only link signed here.
// See docs/decisions.md 2026-09-13, "Photos are stored as blob names".

export class PhotoStorageUnconfiguredError extends Error {}

const DAY_MS = 24 * 60 * 60 * 1000
// Start delegation keys slightly in the past so a clock a little ahead of
// Azure's does not ask for a key that is not valid yet.
const CLOCK_SKEW_MS = 5 * 60 * 1000
// A delegation key may live up to seven days. Two always covers a link that
// expires at the end of tomorrow.
const DELEGATION_KEY_LIFETIME_MS = 2 * DAY_MS

// Azure: the api reaches the account as its user-assigned storage identity.
// The app holds two identities, so the client id says which one to use.
const AZURE_ENV_VARS = [
  'STORAGE_ACCOUNT_URL',
  'STORAGE_IDENTITY_CLIENT_ID',
  'STORAGE_PHOTOS_CONTAINER',
] as const
// Azurite: STORAGE_CONNECTION_STRING carries its well-known development key,
// set by docker-compose.yml.
const AZURITE_ENV_VARS = ['STORAGE_PHOTOS_CONTAINER'] as const

interface PhotoStorage {
  service: BlobServiceClient
  container: ContainerClient
  // Set only for Azurite. Azure signs with a user delegation key instead.
  sharedKey: StorageSharedKeyCredential | null
  // Where browsers reach the account. Differs from the service URL only
  // locally, where the api reaches Azurite as `azurite` and the browser as
  // `localhost`. The signature does not cover the host, so the link still works.
  linkBaseUrl: string
}

interface CachedDelegationKey {
  // What the cached promise covers. Set to the requested expiry before the call
  // resolves so concurrent callers can share it, then narrowed to what Azure
  // actually granted in case it handed back less.
  expiresOn: Date
  key: Promise<UserDelegationKey>
}

let _storage: PhotoStorage | null = null
let _containerCreated = false
let _delegationKey: CachedDelegationKey | null = null

// Fail with the variable names, not with an SDK error that names neither the
// service nor the deploy step. See docs/decisions.md 2026-09-10.
function photoStorage(): PhotoStorage {
  const connectionString = process.env.STORAGE_CONNECTION_STRING
  const required = connectionString ? AZURITE_ENV_VARS : AZURE_ENV_VARS
  const missing = required.filter((name) => !process.env[name])
  if (missing.length > 0) throw new PhotoStorageUnconfiguredError(missing.join(', '))

  if (!_storage) {
    const service = connectionString
      ? BlobServiceClient.fromConnectionString(connectionString)
      : new BlobServiceClient(
          process.env.STORAGE_ACCOUNT_URL ?? '',
          new ManagedIdentityCredential({ clientId: process.env.STORAGE_IDENTITY_CLIENT_ID ?? '' }),
        )
    _storage = {
      service,
      container: service.getContainerClient(process.env.STORAGE_PHOTOS_CONTAINER ?? ''),
      sharedKey: service.credential instanceof StorageSharedKeyCredential ? service.credential : null,
      linkBaseUrl: (process.env.STORAGE_LINK_BASE_URL || service.url).replace(/\/$/, ''),
    }
  }
  return _storage
}

export function assertPhotoStorageConfigured(): void {
  photoStorage()
}

export async function putPhoto(key: string, body: Buffer, contentType: string): Promise<void> {
  const storage = photoStorage()
  // Azurite starts empty. On Azure the container is created by
  // scripts/azure-provision.sh step 7, so the api never creates it there.
  if (storage.sharedKey && !_containerCreated) {
    await storage.container.createIfNotExists()
    _containerCreated = true
  }
  await storage.container.getBlockBlobClient(key).uploadData(body, {
    blobHTTPHeaders: { blobContentType: contentType },
  })
}

export async function deletePhoto(key: string): Promise<void> {
  await photoStorage().container.getBlobClient(key).deleteIfExists()
}

// The promise is cached, not the key: an admin buddy list signs every photo at
// once, and caching only the resolved key would send each of those callers to
// Entra for a key of its own. One round trip per replica per day instead.
function delegationKey(storage: PhotoStorage, linkExpiresOn: Date): Promise<UserDelegationKey> {
  if (_delegationKey && _delegationKey.expiresOn >= linkExpiresOn) return _delegationKey.key

  const now = Date.now()
  const cached: CachedDelegationKey = {
    expiresOn: new Date(now + DELEGATION_KEY_LIFETIME_MS),
    key: storage.service.getUserDelegationKey(
      new Date(now - CLOCK_SKEW_MS),
      new Date(now + DELEGATION_KEY_LIFETIME_MS),
    ),
  }
  _delegationKey = cached
  cached.key.then(
    (key) => {
      cached.expiresOn = key.signedExpiresOn
    },
    // A rejected key must not stay cached, or one Entra blip would keep this
    // replica from ever signing a link again.
    () => {
      if (_delegationKey === cached) _delegationKey = null
    },
  )
  return cached.key
}

// A read-only link to one photo, valid until the end of tomorrow, UTC.
// Photos are not worth failing a profile read over: every way signing can fail
// renders initials instead. Missing environment variables are one; a delegation
// key Entra or Blob will not hand out is the other, and it is the one that can
// happen in production, where `GET /me` and the admin buddy list would
// otherwise 500 over a photo.
export async function photoLink(key: string | null): Promise<string | null> {
  if (!key) return null

  try {
    return await signLink(key)
  } catch (e) {
    if (e instanceof PhotoStorageUnconfiguredError) {
      console.error(`photo link: missing photo storage environment variables: ${e.message}`)
    } else {
      console.error(`photo link: could not sign a link for ${key}:`, e)
    }
    return null
  }
}

async function signLink(key: string): Promise<string> {
  const storage = photoStorage()

  // Every link to a photo signed on the same UTC day is identical — no start
  // time, and an expiry pinned to the end of tomorrow — so browsers and the
  // next/image optimizer fetch and resize each photo once a day, not on every
  // page load. A fresh signature per response would change the URL every time
  // and miss both caches. A link therefore lives between 24 and 48 hours. Each
  // api replica holds its own delegation key, so each signs its own variant.
  // See docs/decisions.md 2026-09-13, "Photos are stored as blob names".
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS
  const values = {
    containerName: storage.container.containerName,
    blobName: key,
    permissions: BlobSASPermissions.parse('r'),
    expiresOn: new Date(today + 2 * DAY_MS),
  }
  const sas = storage.sharedKey
    ? generateBlobSASQueryParameters(values, storage.sharedKey)
    : generateBlobSASQueryParameters(
        values,
        await delegationKey(storage, values.expiresOn),
        storage.service.accountName,
      )
  return `${storage.linkBaseUrl}/${storage.container.containerName}/${key}?${sas.toString()}`
}

// Swaps the stored blob name for a signed link, the shape every response uses.
export async function withPhotoLink<T extends { photoKey: string | null }>(
  row: T,
): Promise<Omit<T, 'photoKey'> & { photoUrl: string | null }> {
  const { photoKey, ...rest } = row
  return { ...rest, photoUrl: await photoLink(photoKey) }
}

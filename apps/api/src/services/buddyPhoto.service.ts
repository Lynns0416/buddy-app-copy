import { randomUUID } from 'crypto'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { db } from '../lib/db'
import { buddyProfileSelect } from './buddy.service'
import type { BuddyProfileResponse } from '@peace-buddy/types'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export class PhotoTooLargeError extends Error {}
export class PhotoInvalidTypeError extends Error {}
export class BuddyNotFoundError extends Error {}
export class PhotoStorageUnconfiguredError extends Error {}

const R2_ENV_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
] as const

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicUrl: string
}

// A Cloud Run revision has shipped without these before. Reading them straight
// off process.env made the AWS SDK fail with "No value provided for input HTTP
// label: Bucket", which names neither the service nor the deploy step, so every
// upload was an opaque 500. Fail with the variable names instead.
function r2Config(): R2Config {
  const missing = R2_ENV_VARS.filter((name) => !process.env[name])
  if (missing.length > 0) throw new PhotoStorageUnconfiguredError(missing.join(', '))

  return {
    accountId: process.env.R2_ACCOUNT_ID ?? '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.R2_BUCKET_NAME ?? '',
    publicUrl: process.env.R2_PUBLIC_URL ?? '',
  }
}

let _client: S3Client | null = null
function r2Client(config: R2Config): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // R2 only routes path-style requests on the API endpoint; virtual-hosted style
      // ({bucket}.{account}.r2.cloudflarestorage.com) fails TLS. Do not remove.
      forcePathStyle: true,
    })
  }
  return _client
}

function publicUrl(config: R2Config, key: string): string {
  return `${config.publicUrl}/${key}`
}

function keyFromUrl(config: R2Config, url: string): string | null {
  if (!url.startsWith(`${config.publicUrl}/`)) return null
  return url.slice(config.publicUrl.length + 1)
}

// Verify actual file contents match declared MIME type via magic bytes.
// Prevents storing arbitrary content (e.g. HTML labelled as image/webp) in a public bucket.
function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'image/png'
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'image/webp'
  return null
}

async function deleteR2Object(url: string | null): Promise<void> {
  if (!url) return
  try {
    const config = r2Config()
    const key = keyFromUrl(config, url)
    if (!key) return
    await r2Client(config).send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }))
  } catch {
    // best-effort
  }
}

export async function uploadBuddyPhoto(
  userId: string,
  file: File,
): Promise<BuddyProfileResponse> {
  const config = r2Config()

  if (file.size > MAX_BYTES) throw new PhotoTooLargeError()
  if (!ALLOWED_MIME.has(file.type)) throw new PhotoInvalidTypeError()

  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { id: true, photoUrl: true },
  })
  if (!existing) throw new BuddyNotFoundError()

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectMimeFromBytes(buffer)
  if (detected !== file.type) throw new PhotoInvalidTypeError()

  const ext = MIME_TO_EXT[file.type]
  const key = `buddy-photos/${existing.id}/${randomUUID()}.${ext}`

  await r2Client(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  const photoUrl = publicUrl(config, key)

  // DB update first, then delete the previous object: if the delete fails we orphan
  // ~KB in R2 (best-effort, swallowed); the inverse order would point the DB at a 404.
  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoUrl },
    select: buddyProfileSelect,
  })

  await deleteR2Object(existing.photoUrl)

  return updated as unknown as BuddyProfileResponse
}

export async function deleteBuddyPhoto(userId: string): Promise<BuddyProfileResponse> {
  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { photoUrl: true },
  })
  if (!existing) throw new BuddyNotFoundError()

  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoUrl: null },
    select: buddyProfileSelect,
  })

  await deleteR2Object(existing.photoUrl)

  return updated as unknown as BuddyProfileResponse
}

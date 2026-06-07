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

let _client: S3Client | null = null
function r2Client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      },
    })
  }
  return _client
}

function publicUrl(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`
}

function keyFromUrl(url: string | null): string | null {
  if (!url) return null
  const base = process.env.R2_PUBLIC_URL ?? ''
  if (!url.startsWith(`${base}/`)) return null
  return url.slice(base.length + 1)
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
  const key = keyFromUrl(url)
  if (!key) return
  try {
    await r2Client().send(new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
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

  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  }))

  const photoUrl = publicUrl(key)

  await deleteR2Object(existing.photoUrl)

  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoUrl },
    select: buddyProfileSelect,
  })

  return updated as unknown as BuddyProfileResponse
}

export async function deleteBuddyPhoto(userId: string): Promise<BuddyProfileResponse> {
  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { photoUrl: true },
  })
  if (!existing) throw new BuddyNotFoundError()

  await deleteR2Object(existing.photoUrl)

  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoUrl: null },
    select: buddyProfileSelect,
  })

  return updated as unknown as BuddyProfileResponse
}

import { randomUUID } from 'crypto'
import { db } from '../lib/db'
import { assertPhotoStorageConfigured, deletePhoto, putPhoto, withPhotoLink } from '../lib/photoStorage'
import { buddyProfileSelect } from './buddy.service'
import type { BuddyProfileResponse } from '@peace-buddy/types'

export { PhotoStorageUnconfiguredError } from '../lib/photoStorage'

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

// Verify actual file contents match declared MIME type via magic bytes.
// Prevents storing arbitrary content (e.g. HTML labelled as image/webp) that a
// signed link would then serve to other members.
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

async function deleteStoredPhoto(key: string | null): Promise<void> {
  if (!key) return
  try {
    await deletePhoto(key)
  } catch {
    // best-effort
  }
}

export async function uploadBuddyPhoto(
  userId: string,
  file: File,
): Promise<BuddyProfileResponse> {
  assertPhotoStorageConfigured()

  if (file.size > MAX_BYTES) throw new PhotoTooLargeError()
  if (!ALLOWED_MIME.has(file.type)) throw new PhotoInvalidTypeError()

  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { id: true, photoKey: true },
  })
  if (!existing) throw new BuddyNotFoundError()

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectMimeFromBytes(buffer)
  if (detected !== file.type) throw new PhotoInvalidTypeError()

  // The same shape the R2 object keys had, so photos copied off R2 keep their names.
  const ext = MIME_TO_EXT[file.type]
  const key = `buddy-photos/${existing.id}/${randomUUID()}.${ext}`

  await putPhoto(key, buffer, file.type)

  // DB update first, then delete the previous blob: if the delete fails we orphan
  // ~KB in storage (best-effort, swallowed); the inverse order would point the DB at a 404.
  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoKey: key },
    select: buddyProfileSelect,
  })

  await deleteStoredPhoto(existing.photoKey)

  return (await withPhotoLink(updated)) as unknown as BuddyProfileResponse
}

export async function deleteBuddyPhoto(userId: string): Promise<BuddyProfileResponse> {
  const existing = await db.buddyProfile.findUnique({
    where: { userId },
    select: { photoKey: true },
  })
  if (!existing) throw new BuddyNotFoundError()

  const updated = await db.buddyProfile.update({
    where: { userId },
    data: { photoKey: null },
    select: buddyProfileSelect,
  })

  await deleteStoredPhoto(existing.photoKey)

  return (await withPhotoLink(updated)) as unknown as BuddyProfileResponse
}

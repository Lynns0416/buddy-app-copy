import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { UpdateBuddyProfileSchema } from '@peace-buddy/types'
import { getBuddyProfile, updateBuddyProfile } from '../services/buddy.service'
import { uploadBuddyPhoto, deleteBuddyPhoto, PhotoTooLargeError, PhotoInvalidTypeError, PhotoStorageUnconfiguredError, BuddyNotFoundError } from '../services/buddyPhoto.service'
import { listMyBookings } from '../services/booking.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

// 2MB photo + multipart envelope overhead
const PHOTO_BODY_LIMIT = 3 * 1024 * 1024

const buddyRoutes = new Hono<AuthEnv>()

buddyRoutes.get('/profile', async (c) => {
  const { id } = c.get('user')

  const profile = await getBuddyProfile(id)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)

  return c.json(profile)
})

buddyRoutes.put('/profile', async (c) => {
  const { id } = c.get('user')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  let data
  try {
    data = UpdateBuddyProfileSchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const profile = await updateBuddyProfile(id, data)
  if (!profile) return c.json({ error: 'Profile not found' }, 404)

  return c.json(profile)
})

buddyRoutes.post(
  '/profile/photo',
  bodyLimit({
    maxSize: PHOTO_BODY_LIMIT,
    onError: (c) => c.json(apiError('payload_too_large'), 413),
  }),
  async (c) => {
    const { id } = c.get('user')

    const body = await c.req.parseBody()
    const file = body['photo']
    if (!(file instanceof File)) return c.json(apiError('invalid_request'), 400)

    try {
      return c.json(await uploadBuddyPhoto(id, file))
    } catch (e) {
      if (e instanceof PhotoTooLargeError) return c.json(apiError('payload_too_large'), 413)
      if (e instanceof PhotoInvalidTypeError) return c.json(apiError('invalid_request'), 400)
      if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
      if (e instanceof PhotoStorageUnconfiguredError) {
        console.error(`photo upload: missing R2 environment variables: ${e.message}`)
        return c.json(apiError('unknown'), 500)
      }
      throw e
    }
  }
)

buddyRoutes.delete('/profile/photo', async (c) => {
  const { id } = c.get('user')

  try {
    return c.json(await deleteBuddyPhoto(id))
  } catch (e) {
    if (e instanceof BuddyNotFoundError) return c.json(apiError('not_found'), 404)
    throw e
  }
})

buddyRoutes.get('/bookings', async (c) => {
  const { id } = c.get('user')
  const bookings = await listMyBookings(id)
  return c.json(bookings)
})

export { buddyRoutes }

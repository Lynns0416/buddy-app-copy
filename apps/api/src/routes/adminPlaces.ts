import { Hono } from 'hono'
import { CreatePlaceSchema, UpdatePlaceSchema, CreateSpotSchema, UpdateSpotSchema } from '@peace-buddy/types'
import { listPlaces, createPlace, updatePlace, getPlace, createSpot, updateSpot } from '../services/place.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminPlaceRoutes = new Hono<AuthEnv>()

adminPlaceRoutes.get('/', async (c) => {
  return c.json(await listPlaces())
})

adminPlaceRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreatePlaceSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  return c.json(await createPlace(parsed.data), 201)
})

adminPlaceRoutes.get('/:id', async (c) => {
  const place = await getPlace(c.req.param('id'))
  if (!place) return c.json(apiError('not_found'), 404)
  return c.json(place)
})

adminPlaceRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdatePlaceSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const place = await updatePlace(id, parsed.data)
  if (!place) return c.json(apiError('not_found'), 404)
  return c.json(place)
})

adminPlaceRoutes.post('/:id/spots', async (c) => {
  const placeId = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateSpotSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const spot = await createSpot(placeId, parsed.data)
  if (!spot) return c.json(apiError('not_found'), 404)
  return c.json(spot, 201)
})

adminPlaceRoutes.put('/:id/spots/:spotId', async (c) => {
  const placeId = c.req.param('id')
  const spotId = c.req.param('spotId')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateSpotSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const spot = await updateSpot(placeId, spotId, parsed.data)
  if (!spot) return c.json(apiError('not_found'), 404)
  return c.json(spot)
})

export { adminPlaceRoutes }

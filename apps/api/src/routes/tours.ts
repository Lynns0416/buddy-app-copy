import { Hono } from 'hono'
import { z } from 'zod'
import { TourStatusSchema, UpdateBookingBodySchema } from '@peace-buddy/types'
import { listTours, getTour } from '../services/tour.service'
import { createBooking, updateBooking } from '../services/booking.service'
import type { AuthEnv } from '../types'

const ToursQuerySchema = z.object({
  status: TourStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

const tourRoutes = new Hono<AuthEnv>()

tourRoutes.get('/', async (c) => {
  let params
  try {
    params = ToursQuerySchema.parse(c.req.query())
  } catch {
    return c.json({ error: 'Invalid query params' }, 400)
  }

  const tours = await listTours(params)
  return c.json(tours)
})

tourRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('user').id
  const tour = await getTour(id, userId)
  if (!tour) return c.json({ error: 'Tour not found' }, 404)
  return c.json(tour)
})

tourRoutes.post('/:id/bookings', async (c) => {
  const tourId = c.req.param('id')
  const userId = c.get('user').id
  const result = await createBooking(tourId, userId)
  if (!result.ok) {
    if (result.code === 'TOUR_NOT_FOUND') return c.json({ error: 'Tour not found' }, 404)
    if (result.code === 'ALREADY_BOOKED') return c.json({ error: 'Already booked' }, 409)
    return c.json({ error: 'Tour is not open for booking' }, 422)
  }
  return c.json(result.booking, 201)
})

tourRoutes.put('/:id/bookings/me', async (c) => {
  const tourId = c.req.param('id')
  const userId = c.get('user').id
  let body
  try {
    body = UpdateBookingBodySchema.parse(await c.req.json())
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }
  const result = await updateBooking(tourId, userId, body.status)
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return c.json({ error: 'Booking not found' }, 404)
    if (result.code === 'TOUR_FULL') return c.json({ error: 'Tour is full' }, 409)
    return c.json({ error: 'Buddy profile not found' }, 422)
  }
  return c.json(result.booking)
})

export { tourRoutes }

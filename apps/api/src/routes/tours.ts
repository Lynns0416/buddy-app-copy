import { Hono } from 'hono'
import { z } from 'zod'
import { TourStatusSchema, BookingStatusSchema, UpdateBookingBodySchema, CancellationReasonBodySchema } from '@peace-buddy/types'
import { listTours, getTour } from '../services/tour.service'
import { createBooking, updateBooking, reportCantGo } from '../services/booking.service'
import type { AuthEnv } from '../types'

const ToursQuerySchema = z.object({
  status: TourStatusSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

const CreateBookingBodySchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal(BookingStatusSchema.enum.maybe).optional(),
})

const tourRoutes = new Hono<AuthEnv>()

tourRoutes.get('/', async (c) => {
  const userId = c.get('user').id
  let params
  try {
    params = ToursQuerySchema.parse(c.req.query())
  } catch {
    return c.json({ error: 'Invalid query params' }, 400)
  }

  const tours = await listTours(userId, params)
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

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const parsed = CreateBookingBodySchema.safeParse(body)
  if (!parsed.success) return c.json({ error: 'Invalid request body' }, 400)

  const result = await createBooking(tourId, parsed.data.sessionId, userId, parsed.data.status)
  if (!result.ok) {
    if (result.code === 'TOUR_NOT_FOUND' || result.code === 'SESSION_NOT_FOUND') return c.json({ error: 'Tour not found' }, 404)
    if (result.code === 'ALREADY_BOOKED') return c.json({ error: 'Already booked' }, 409)
    if (result.code === 'NOT_ELIGIBLE') return c.json({ error: 'Not eligible to book' }, 403)
    if (result.code === 'BUDDY_NOT_FOUND') return c.json({ error: 'Buddy profile not found' }, 404)
    if (result.code === 'DEADLINE_PASSED') return c.json({ error: 'Cancellation deadline has passed' }, 422)
    if (result.code === 'MAYBE_DEADLINE_PASSED') return c.json({ error: 'Maybe deadline has passed' }, 422)
    return c.json({ error: 'Tour is not open for booking' }, 422)
  }
  return c.json(result.booking, 201)
})

tourRoutes.put('/:tourId/sessions/:sessionId/bookings/me', async (c) => {
  const sessionId = c.req.param('sessionId')
  const userId = c.get('user').id
  let body
  try {
    body = UpdateBookingBodySchema.parse(await c.req.json())
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }
  const result = await updateBooking(sessionId, userId, body.status, body.reason)
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return c.json({ error: 'Booking not found' }, 404)
    if (result.code === 'TOUR_FULL') return c.json({ error: 'Tour is full' }, 409)
    if (result.code === 'DEADLINE_PASSED') return c.json({ error: 'Cancellation deadline has passed' }, 422)
    if (result.code === 'MAYBE_DEADLINE_PASSED') return c.json({ error: 'Maybe deadline has passed' }, 422)
    if (result.code === 'REASON_REQUIRED') return c.json({ error: 'Cancellation reason required' }, 400)
    return c.json({ error: 'Buddy profile not found' }, 422)
  }
  return c.json(result.booking)
})

tourRoutes.post('/:tourId/sessions/:sessionId/bookings/me/cant-go', async (c) => {
  const tourId = c.req.param('tourId')
  const sessionId = c.req.param('sessionId')
  const userId = c.get('user').id
  let body
  try {
    body = CancellationReasonBodySchema.parse(await c.req.json())
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }
  const result = await reportCantGo(tourId, sessionId, userId, body)
  if (!result.ok) {
    if (result.code === 'NOT_FOUND') return c.json({ error: 'Booking not found' }, 404)
    if (result.code === 'BUDDY_NOT_FOUND') return c.json({ error: 'Buddy profile not found' }, 404)
    if (result.code === 'DEADLINE_NOT_PASSED') return c.json({ error: 'Cancellation deadline has not passed yet' }, 422)
    if (result.code === 'INVALID_STATUS') return c.json({ error: 'Booking status does not allow this action' }, 422)
    return c.json({ error: 'Unknown error' }, 500)
  }
  return c.json(result.booking)
})

export { tourRoutes }

import { Hono } from 'hono'
import { z } from 'zod'
import { TourStatusSchema } from '@peace-buddy/types'
import { listTours } from '../services/tour.service'
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

export { tourRoutes }

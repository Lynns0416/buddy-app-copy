import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../types'
import { BuddyTierSchema } from '@peace-buddy/types'
import { createApplication, cancelApplication, getApplicationStatus } from '../services/tourApplication.service'
import { db } from '../lib/db'

const CreateApplicationSchema = z.object({
  tourId: z.string().uuid(),
})

const TourIdParamSchema = z.object({
  tourId: z.string().uuid(),
})

export const applicationsRoutes = new Hono<AuthEnv>()

// POST /applications - Create an application
applicationsRoutes.post('/', async (c) => {
  const user = c.get('user')

  if (user.role !== 'buddy') {
    return c.json({ code: 'forbidden' }, 403)
  }

  try {
    const body = await c.req.json() as unknown
    const result = CreateApplicationSchema.safeParse(body)

    if (!result.success) {
      return c.json({ code: 'invalid_request', detail: 'Invalid request body' }, 400)
    }

    const { tourId } = result.data

    const buddyProfile = await db.buddyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, tier: true },
    })

    if (!buddyProfile) {
      return c.json({ code: 'not_found', detail: 'Buddy profile not found' }, 404)
    }

    if (!buddyProfile.tier) {
      return c.json({ code: 'invalid_request', detail: 'Buddy tier is not set' }, 400)
    }

    if (buddyProfile.tier === BuddyTierSchema.enum.trainee) {
      return c.json({ code: 'forbidden', detail: 'Trainee buddies cannot apply to tours' }, 403)
    }

    const tour = await db.tour.findUnique({
      where: { id: tourId },
      select: { id: true, status: true },
    })

    if (!tour) {
      return c.json({ code: 'not_found', detail: 'Tour not found' }, 404)
    }

    if (tour.status !== 'published') {
      return c.json({ code: 'invalid_request', detail: 'Tour is not open for applications' }, 400)
    }

    const createResult = await createApplication(tourId, buddyProfile.id, buddyProfile.tier)

    if (!createResult.ok) {
      if (createResult.code === 'conflict') {
        return c.json({ code: 'conflict', detail: 'Application already exists for this tour' }, 409)
      }
      return c.json({ code: 'unknown' }, 500)
    }

    const applicationId = createResult.data

    const application = await db.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        tourId: true,
        status: true,
        createdAt: true,
        approvedAt: true,
      },
    })

    return c.json(
      {
        id: application?.id,
        tourId: application?.tourId,
        status: application?.status,
        createdAt: application?.createdAt?.toISOString(),
        approvedAt: application?.approvedAt?.toISOString() || null,
      },
      201,
    )
  } catch (error) {
    console.error('Failed to create application:', error)
    return c.json({ code: 'unknown' }, 500)
  }
})

// DELETE /applications/:id - Cancel an application
applicationsRoutes.delete('/:id', async (c) => {
  const user = c.get('user')

  if (user.role !== 'buddy') {
    return c.json({ code: 'forbidden' }, 403)
  }

  try {
    const applicationId = c.req.param('id')

    const application = await db.application.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        buddyId: true,
        buddy: { select: { userId: true } },
      },
    })

    if (!application) {
      return c.json({ code: 'not_found', detail: 'Application not found' }, 404)
    }

    if (application.buddy.userId !== user.id) {
      return c.json({ code: 'forbidden' }, 403)
    }

    await cancelApplication(applicationId)

    return c.json({ status: 'success' }, 200)
  } catch (error) {
    console.error('Failed to cancel application:', error)
    return c.json({ code: 'unknown' }, 500)
  }
})

// GET /applications/:tourId/status - Get application status for a tour
applicationsRoutes.get('/:tourId/status', async (c) => {
  const user = c.get('user')

  if (user.role !== 'buddy') {
    return c.json({ code: 'forbidden' }, 403)
  }

  try {
    const paramResult = TourIdParamSchema.safeParse({ tourId: c.req.param('tourId') })
    if (!paramResult.success) {
      return c.json({ code: 'invalid_request', detail: 'Invalid tour ID' }, 400)
    }
    const tourId = paramResult.data.tourId

    const buddyProfile = await db.buddyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!buddyProfile) {
      return c.json({ code: 'not_found', detail: 'Buddy profile not found' }, 404)
    }

    const applicationStatus = await getApplicationStatus(tourId, buddyProfile.id)

    if (!applicationStatus) {
      return c.json(null, 200)
    }

    return c.json(
      {
        id: applicationStatus.id,
        status: applicationStatus.status,
        createdAt: applicationStatus.createdAt.toISOString(),
        approvedAt: applicationStatus.approvedAt?.toISOString() || null,
      },
      200,
    )
  } catch (error) {
    console.error('Failed to get application status:', error)
    return c.json({ code: 'unknown' }, 500)
  }
})

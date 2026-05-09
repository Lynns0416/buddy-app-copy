import { describe, it } from 'vitest'

// TODO: add tests for listAdminTours, createTour, getAdminTourDetail,
// updateTour, transitionTourStatus, deleteTour.
// Session and tier-capacity tests live in adminSession.service.test.ts.

describe('adminTour.service', () => {
  it.todo('listAdminTours returns mapped summaries')
  it.todo('createTour creates tour with sessions')
  it.todo('updateTour throws TourNotFoundError when not found')
  it.todo('updateTour throws TourImmutableError when cancelled or completed')
  it.todo('transitionTourStatus throws TourTransitionError on invalid transition')
  it.todo('deleteTour throws TourNotDraftError when not in draft')
})

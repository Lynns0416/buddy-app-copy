import type { AdminTourSummaryResponse } from '@peace-buddy/types'

/**
 * A complete admin tour summary. Shared so the list tests and the calendar
 * tests cannot drift apart on the shape they assume the API returns; each
 * suite pins the fields it cares about via `overrides`.
 */
export const adminTourSummary = (overrides: Partial<AdminTourSummaryResponse> = {}): AdminTourSummaryResponse => ({
  id: 't1',
  tourDate: '2025-06-01',
  group: { id: 'g1', name: 'Alpha', type: 'school' },
  location: 'Tokyo',
  capacity: 10,
  confirmedCount: 5,
  participantCount: 0,
  status: 'draft',
  bookingOpen: false,
  sessions: [],
  createdAt: '2025-01-01T00:00:00Z',
  description: null,
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
} as AdminTourSummaryResponse)

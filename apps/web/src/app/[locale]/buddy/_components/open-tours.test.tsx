import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { OpenTours } from './open-tours'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ locale: 'en' }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { BookingStatusSchema, GroupTypeSchema, TourStatusSchema } from '@peace-buddy/types'
import type { TourResponse, TourListSessionResponse } from '@peace-buddy/types'

function makeSession(
  i: number,
  overrides: Partial<TourListSessionResponse> = {},
): TourListSessionResponse {
  return {
    id: `session-${i}`,
    order: i,
    label: null,
    meetingTime: `1970-01-01T0${i}:00:00.000Z`,
    startTime: null,
    endTime: null,
    capacity: 10,
    minBuddies: null,
    participantCount: 0,
    belowMinimum: false,
    myBookingStatus: null,
    place: { id: 'place-1', nameJa: 'Tokyo Station', nameEn: 'Tokyo Station' },
    ...overrides,
  }
}

function makeTour(sessions: TourListSessionResponse[], overrides: Partial<TourResponse> = {}): TourResponse {
  return {
    id: 'tour-1',
    groupId: 'group-1',
    group: { id: 'group-1', name: 'School A', type: GroupTypeSchema.enum.school },
    status: TourStatusSchema.enum.published,
    tourDate: '2099-05-01T00:00:00.000Z',
    bookingOpen: true,
    places: [{ id: 'place-1', nameJa: 'Tokyo Station', nameEn: 'Tokyo Station' }],
    participantCount: 0,
    description: null,
    cancellationDeadline: '2099-04-25T00:00:00.000Z',
    maybeDeadline: null,
    notificationOffsets: [],
    sessions,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function card(): HTMLElement {
  return screen.getByRole('link')
}

describe('OpenTours', () => {
  it('renders one section per session, each with its own numbers', () => {
    render(
      <OpenTours
        tours={[
          makeTour([
            makeSession(1, { label: 'Morning', minBuddies: 3, capacity: 10, participantCount: 30 }),
            makeSession(2, { label: 'Afternoon', minBuddies: 5, capacity: 8, participantCount: 40 }),
          ]),
        ]}
        error={false}
      />,
    )

    const text = card().textContent ?? ''
    // Never a sum: 3 + 5 = 8 and 30 + 40 = 70 must not appear as one number.
    expect(text).toContain('buddyCount: 3')
    expect(text).toContain('buddyCount: 5')
    expect(text).toContain('participantCount: 30')
    expect(text).toContain('participantCount: 40')
    expect(text).not.toContain('buddyCount: 18')
    expect(text).not.toContain('participantCount: 70')

    expect(within(card()).getByText('Morning')).toBeTruthy()
    expect(within(card()).getByText('Afternoon')).toBeTruthy()
    expect(text).toContain('01:00')
    expect(text).toContain('02:00')
  })

  it('shows the location once for a two-session tour', () => {
    render(
      <OpenTours tours={[makeTour([makeSession(1), makeSession(2)])]} error={false} />,
    )

    expect(within(card()).getAllByText('Tokyo Station')).toHaveLength(1)
  })

  it('falls back to capacity when the session has no minBuddies', () => {
    render(
      <OpenTours
        tours={[makeTour([makeSession(1, { minBuddies: null, capacity: 7 })])]}
        error={false}
      />,
    )

    expect(card().textContent).toContain('buddyCount: 7')
  })

  it('renders a single section for a one-session tour', () => {
    render(
      <OpenTours
        tours={[makeTour([makeSession(1, { minBuddies: 2, participantCount: 25 })])]}
        error={false}
      />,
    )

    const text = card().textContent ?? ''
    expect(text).toContain('buddyCount: 2')
    expect(text).toContain('participantCount: 25')
    expect(text).toContain('01:00')
  })

  it('badges a booked session and leaves a declined one unbadged', () => {
    render(
      <OpenTours
        tours={[
          makeTour([
            makeSession(1, { myBookingStatus: BookingStatusSchema.enum.confirmed }),
            makeSession(2, { myBookingStatus: BookingStatusSchema.enum.declined }),
          ]),
        ]}
        error={false}
      />,
    )

    expect(within(card()).getByText(BookingStatusSchema.enum.confirmed)).toBeTruthy()
    expect(within(card()).queryByText(BookingStatusSchema.enum.declined)).toBeNull()
  })

  it('shows the load error instead of the list', () => {
    render(<OpenTours tours={null} error />)

    expect(screen.getByRole('alert').textContent).toBe('loadError')
    expect(screen.queryByRole('link')).toBeNull()
  })
})

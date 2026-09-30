import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { OpenTours } from './open-tours'

// Echoes the key, and its values when there are any, so a number passed to a
// message can be asserted without the message text.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}))

vi.mock('../tours/[id]/buddy.booking', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../tours/[id]/buddy.booking')>()),
  createInitialBooking: vi.fn(),
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
import { createInitialBooking } from '../tours/[id]/buddy.booking'

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
    confirmedCount: 0,
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

// The group name links to the tour; the card is what holds it.
function card(): HTMLElement {
  return screen.getByRole('link').parentElement as HTMLElement
}

const onBooked = vi.fn()

describe('OpenTours', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one section per session, each with its own numbers', () => {
    render(
      <OpenTours
        tours={[
          makeTour([
            makeSession(1, { label: 'Morning', minBuddies: 3, confirmedCount: 3, capacity: 10, participantCount: 30 }),
            makeSession(2, { label: 'Afternoon', minBuddies: 5, confirmedCount: 5, capacity: 8, participantCount: 40 }),
          ]),
        ]}
        error={false}
        onBooked={onBooked}
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
      <OpenTours tours={[makeTour([makeSession(1), makeSession(2)])]} error={false} onBooked={onBooked} />,
    )

    expect(within(card()).getAllByText('Tokyo Station')).toHaveLength(1)
  })

  it('falls back to capacity when the session has no minBuddies', () => {
    render(
      <OpenTours
        tours={[makeTour([makeSession(1, { minBuddies: null, capacity: 7 })])]}
        error={false}
        onBooked={onBooked}
      />,
    )

    expect(card().textContent).toContain('buddyCount: 7')
  })

  it('renders a single section for a one-session tour', () => {
    render(
      <OpenTours
        tours={[makeTour([makeSession(1, { minBuddies: 2, confirmedCount: 2, participantCount: 25 })])]}
        error={false}
        onBooked={onBooked}
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
        onBooked={onBooked}
      />,
    )

    expect(within(card()).getByText(BookingStatusSchema.enum.confirmed)).toBeTruthy()
    expect(within(card()).queryByText(BookingStatusSchema.enum.declined)).toBeNull()
  })

  it('shows the load error instead of the list', () => {
    render(<OpenTours tours={null} error onBooked={onBooked} />)

    expect(screen.getByRole('alert').textContent).toBe('loadError')
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('says how many more buddies each short session needs, per session', () => {
    render(
      <OpenTours
        tours={[
          makeTour([
            makeSession(1, { minBuddies: 10, confirmedCount: 2 }),
            makeSession(2, { minBuddies: 3, confirmedCount: 3 }),
          ]),
        ]}
        error={false}
        onBooked={onBooked}
      />,
    )

    const text = card().textContent ?? ''
    expect(text).toContain('open.needed {"count":8}')
    expect(text).toContain('buddyCount: 3')
  })

  it('books a session after the buddy confirms its time and place', async () => {
    vi.mocked(createInitialBooking).mockResolvedValue({ ok: true, data: undefined })
    render(<OpenTours tours={[makeTour([makeSession(1)])]} error={false} onBooked={onBooked} />)

    fireEvent.click(screen.getByRole('button', { name: /^open\.book / }))
    expect(createInitialBooking).not.toHaveBeenCalled()
    expect(screen.getByText(/^open\.confirm /)).toHaveTextContent('Tokyo Station')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open.confirmBook' }))
    })
    expect(createInitialBooking).toHaveBeenCalledWith('tour-1', 'session-1')
    expect(onBooked).toHaveBeenCalled()
  })

  it('goes back without booking', () => {
    render(<OpenTours tours={[makeTour([makeSession(1)])]} error={false} onBooked={onBooked} />)

    fireEvent.click(screen.getByRole('button', { name: /^open\.book / }))
    fireEvent.click(screen.getByRole('button', { name: 'open.back' }))

    expect(createInitialBooking).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^open\.book / })).toBeInTheDocument()
  })

  it('says why a booking failed', async () => {
    vi.mocked(createInitialBooking).mockResolvedValue({ ok: false, error: { code: 'forbidden' } } as never)
    render(<OpenTours tours={[makeTour([makeSession(1)])]} error={false} onBooked={onBooked} />)

    fireEvent.click(screen.getByRole('button', { name: /^open\.book / }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open.confirmBook' }))
    })

    expect(screen.getByRole('alert')).toHaveTextContent('notEligible')
    expect(onBooked).not.toHaveBeenCalled()
  })

  it('offers booking only on a session the buddy has no booking on', () => {
    render(
      <OpenTours
        tours={[
          makeTour([
            makeSession(1, { myBookingStatus: BookingStatusSchema.enum.confirmed }),
            makeSession(2, { myBookingStatus: BookingStatusSchema.enum.declined }),
            makeSession(3),
          ]),
        ]}
        error={false}
        onBooked={onBooked}
      />,
    )

    expect(screen.getAllByRole('button', { name: /^open\.book / })).toHaveLength(1)
  })
})

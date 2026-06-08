import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourForm } from './tour-form'
import { ApiError } from '@/lib/api'
import type { GroupResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const groups: GroupResponse[] = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Test School', type: 'school', contactName: null, contactEmail: null, contactPhone: null, notes: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
]

const validFields = {
  groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tourDate: '2026-06-01',
  sessionMeetingTime: '09:00',
  location: '平和公園',
  sessionCapacity: '5',
  cancellationDeadline: '2026-05-25',
  notificationOffsets: '3, 1',
}

function fillForm(overrides: Partial<typeof validFields> = {}) {
  const fields = { ...validFields, ...overrides }
  const user = userEvent.setup()
  return { user, fields }
}

function renderForm(onSubmit = vi.fn()) {
  render(
    <TourForm
      groups={groups}
      cancelHref="/admin/tours"
      onSubmit={onSubmit}
    />,
  )
}

async function fillAndSubmit(overrides: Partial<typeof validFields> = {}, onSubmit = vi.fn()) {
  renderForm(onSubmit)
  const { user, fields } = fillForm(overrides)

  await user.selectOptions(screen.getByLabelText('group'), fields.groupId)
  await user.type(screen.getByLabelText('tourDate'), fields.tourDate)
  await user.type(screen.getByLabelText('meetingTime'), fields.sessionMeetingTime)
  await user.type(screen.getByLabelText('location'), fields.location)
  await user.clear(screen.getByLabelText('capacity'))
  await user.type(screen.getByLabelText('capacity'), fields.sessionCapacity)
  await user.type(screen.getByLabelText('cancellationDeadline'), fields.cancellationDeadline)

  await user.click(screen.getByRole('button', { name: 'save' }))
  return { user, onSubmit }
}

describe('TourForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls onSubmit with correctly shaped values on valid input', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await fillAndSubmit({}, onSubmit)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    const values = onSubmit.mock.calls[0][0]
    expect(values.groupId).toBe(validFields.groupId)
    expect(values.tourDate).toBe('2026-06-01')
    expect(values.sessions[0].meetingTime).toBe('09:00')
    expect(values.location).toBe('平和公園')
    expect(values.sessions[0].capacity).toBe(5)
    expect(values.cancellationDeadline).toBe('2026-05-25')
    expect(values.notificationOffsets).toEqual([3, 1])
    expect(values.description).toBeNull()
    expect(values.maybeDeadline).toBeNull()
  })

  it('does not call onSubmit when maybeDeadline is after cancellationDeadline', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('group'), validFields.groupId)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.type(screen.getByLabelText('location'), validFields.location)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('cancellationDeadline'), '2026-05-25')
    await user.type(screen.getByLabelText('maybeDeadline'), '2026-05-26')

    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() =>
      expect(screen.getByText('maybeDeadlineError')).toBeInTheDocument(),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows root error when onSubmit throws a plain Error', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'))
    await fillAndSubmit({}, onSubmit)

    await waitFor(() =>
      expect(screen.getByText('Network error')).toBeInTheDocument(),
    )
  })

  it('maps ApiError field errors to the correct fields', async () => {
    const apiError = new ApiError('Invalid request body', 400, {
      formErrors: [],
      fieldErrors: { location: ['Location is required'] },
    })
    const onSubmit = vi.fn().mockRejectedValue(apiError)
    await fillAndSubmit({}, onSubmit)

    await waitFor(() =>
      expect(screen.getByText('Location is required')).toBeInTheDocument(),
    )
  })

  it('shows formErrors as root error from ApiError', async () => {
    const apiError = new ApiError('Invalid request body', 400, {
      formErrors: ['Something went wrong globally'],
      fieldErrors: {},
    })
    const onSubmit = vi.fn().mockRejectedValue(apiError)
    await fillAndSubmit({}, onSubmit)

    await waitFor(() =>
      expect(screen.getByText('Something went wrong globally')).toBeInTheDocument(),
    )
  })

  it('disables save button while submitting', async () => {
    let resolve!: () => void
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => { resolve = r }))
    renderForm(onSubmit)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('group'), validFields.groupId)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.type(screen.getByLabelText('location'), validFields.location)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)

    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'save' })).toBeDisabled(),
    )
    resolve()
  })

  it('submits minBuddies as null when the input is empty', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    await fillAndSubmit({}, onSubmit)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    const values = onSubmit.mock.calls[0][0]
    expect(values.sessions[0].minBuddies).toBeNull()
  })

  it('submits minBuddies as a number when filled', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    renderForm(onSubmit)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('group'), validFields.groupId)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.type(screen.getByLabelText('location'), validFields.location)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('minBuddies'), '2')
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    const values = onSubmit.mock.calls[0][0]
    expect(values.sessions[0].minBuddies).toBe(2)
  })

  it('shows error and blocks submit when minBuddies exceeds capacity', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText('group'), validFields.groupId)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.type(screen.getByLabelText('location'), validFields.location)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), '5')
    await user.type(screen.getByLabelText('minBuddies'), '10')
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() =>
      expect(screen.getByText('minBuddiesExceedsCapacity')).toBeInTheDocument(),
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders defaultValues in edit mode', () => {
    render(
      <TourForm
        defaultValues={{
          id: 'tour-1',
          group: { id: groups[0].id, name: groups[0].name, type: 'school' },
          status: 'draft',
          tourDate: '2026-06-01T00:00:00.000Z',
          bookingOpen: false,
          location: 'Nagasaki',
          capacity: 10,
          participantCount: 0,
          description: 'A tour',
          confirmedCount: 0,
          adminMemo: null,
          cancellationDeadline: '2026-05-25T00:00:00.000Z',
          maybeDeadline: null,
          notificationOffsets: [3, 1],
          sessions: [{
            id: 's1',
            order: 1,
            label: null,
            meetingTime: '1970-01-01T09:30:00.000Z',
            startTime: null,
            endTime: null,
            capacity: 10,
            minBuddies: null,
            participantCount: 0,
            belowMinimum: false,
          }],
          bookings: [],
          assignedAdmins: [],
          staffInChargeId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        groups={groups}
        cancelHref="/admin/tours/tour-1"
        onSubmit={vi.fn()}
      />,
    )

    expect((screen.getByLabelText('location') as HTMLInputElement).value).toBe('Nagasaki')
    expect((screen.getByLabelText('capacity') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('meetingTime') as HTMLInputElement).value).toBe('09:30')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourForm } from './tour-form'
import { ApiError } from '@/lib/api'
import type { GroupResponse, PlaceResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const groups: GroupResponse[] = [
  { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', name: 'Test School', type: 'school', contactName: 'Hana Sato', contactEmail: 'hana@example.com', contactPhone: null, notes: 'Arrives by bus', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
]

const places: PlaceResponse[] = [
  { id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park', sortOrder: 1, active: true },
]

const validFields = {
  groupId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  tourDate: '2026-06-01',
  sessionMeetingTime: '09:00',
  sessionCapacity: '5',
  cancellationDeadline: '2026-05-25',
  notificationOffsets: '3, 1',
}

function fillForm(overrides: Partial<typeof validFields> = {}) {
  const fields = { ...validFields, ...overrides }
  const user = userEvent.setup()
  return { user, fields }
}

function renderForm(onSubmit = vi.fn(), initialGroupId?: string) {
  render(
    <TourForm
      groups={groups}
      places={places}
      initialGroupId={initialGroupId}
      cancelHref="/admin/tours"
      onSubmit={onSubmit}
    />,
  )
}

async function selectGroup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText('group'))
  await user.click(screen.getByRole('option', { name: groups[0].name }))
}

async function selectPlace(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText('location'), places[0].id)
}

async function fillAndSubmit(overrides: Partial<typeof validFields> = {}, onSubmit = vi.fn()) {
  renderForm(onSubmit)
  const { user, fields } = fillForm(overrides)

  await selectGroup(user)
  await selectPlace(user)
  await user.type(screen.getByLabelText('tourDate'), fields.tourDate)
  await user.type(screen.getByLabelText('meetingTime'), fields.sessionMeetingTime)
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
    expect(values.sessions[0].placeId).toBe('place-1')
    expect(values.sessions[0].capacity).toBe(5)
    expect(values.cancellationDeadline).toBe('2026-05-25')
    expect(values.notificationOffsets).toEqual([3, 1])
    expect(values.description).toBeNull()
    expect(values.maybeDeadline).toBeNull()
  })

  it('renders no group summary until a group is picked', async () => {
    renderForm()
    const user = userEvent.setup()

    expect(screen.queryByRole('link', { name: /groupSummary\.viewGroup/ })).not.toBeInTheDocument()

    await selectGroup(user)

    expect(screen.getByText(groups[0].contactName!)).toBeInTheDocument()
    expect(screen.getByText(groups[0].contactEmail!)).toBeInTheDocument()
    expect(screen.getByText(groups[0].notes!)).toBeInTheDocument()
  })

  it('preselects the group and shows its summary when initialGroupId is given', () => {
    renderForm(vi.fn(), groups[0].id)

    expect(screen.getByLabelText('group')).toHaveValue(groups[0].name)
    expect(screen.getByText(groups[0].contactName!)).toBeInTheDocument()
    expect(screen.getByText(groups[0].contactEmail!)).toBeInTheDocument()
  })

  it('submits the preselected group without the picker being touched', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit, groups[0].id)
    const user = userEvent.setup()

    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)

    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(onSubmit.mock.calls[0][0].groupId).toBe(groups[0].id)
  })

  it('leaves the picker empty when initialGroupId matches no group', () => {
    renderForm(vi.fn(), '00000000-0000-4000-8000-000000000000')

    expect(screen.getByLabelText('group')).toHaveValue('')
    expect(screen.queryByText(groups[0].contactName!)).not.toBeInTheDocument()
  })

  it('shows a translated error and does not submit when no group is picked', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    const user = userEvent.setup()

    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)

    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('groupRequired')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows a translated error and does not submit when a session has no place', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    const user = userEvent.setup()

    await selectGroup(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
    await user.clear(screen.getByLabelText('capacity'))
    await user.type(screen.getByLabelText('capacity'), validFields.sessionCapacity)
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)

    await user.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('placeRequired')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('does not call onSubmit when maybeDeadline is after cancellationDeadline', async () => {
    const onSubmit = vi.fn()
    renderForm(onSubmit)
    const user = userEvent.setup()

    await selectGroup(user)
    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
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
      fieldErrors: { tourDate: ['Invalid date'] },
    })
    const onSubmit = vi.fn().mockRejectedValue(apiError)
    await fillAndSubmit({}, onSubmit)

    await waitFor(() =>
      expect(screen.getByText('Invalid date')).toBeInTheDocument(),
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

    await selectGroup(user)
    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
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

    await selectGroup(user)
    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
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

    await selectGroup(user)
    await selectPlace(user)
    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.type(screen.getByLabelText('meetingTime'), validFields.sessionMeetingTime)
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
          places: [{ id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park' }],
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
            place: { id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park' },
          }],
          bookings: [],
          assignedAdmins: [],
          staffInChargeId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        groups={groups}
        places={places}
        cancelHref="/admin/tours/tour-1"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('location')).toHaveValue('place-1')
    expect((screen.getByLabelText('capacity') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('meetingTime') as HTMLInputElement).value).toBe('09:30')
    expect(screen.getByRole('link', { name: /groupSummary\.viewGroup/ })).toHaveAttribute(
      'href',
      `/en/admin/groups/${groups[0].id}`,
    )
  })

  it('keeps a place already on a session selectable even after it is deactivated', () => {
    render(
      <TourForm
        defaultValues={{
          id: 'tour-1',
          group: { id: groups[0].id, name: groups[0].name, type: 'school' },
          status: 'draft',
          tourDate: '2026-06-01T00:00:00.000Z',
          bookingOpen: false,
          places: [{ id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral' }],
          capacity: 10,
          participantCount: 0,
          description: null,
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
            place: { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral' },
          }],
          bookings: [],
          assignedAdmins: [],
          staffInChargeId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        groups={groups}
        places={[
          ...places,
          { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', sortOrder: 2, active: false },
        ]}
        cancelHref="/admin/tours/tour-1"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('location')).toHaveValue('place-2')
    expect(screen.getByRole('option', { name: /Urakami Cathedral/ })).toBeInTheDocument()
  })

  it('does not offer a deactivated place no session is on', () => {
    render(
      <TourForm
        groups={groups}
        places={[
          ...places,
          { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', sortOrder: 2, active: false },
        ]}
        cancelHref="/admin/tours"
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.queryByRole('option', { name: /Urakami Cathedral/ })).not.toBeInTheDocument()
  })

  it('submits each session with its own place', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <TourForm
        groups={groups}
        places={[
          ...places,
          { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', sortOrder: 2, active: true },
        ]}
        initialGroupId={groups[0].id}
        cancelHref="/admin/tours"
        onSubmit={onSubmit}
      />,
    )
    const user = userEvent.setup()

    await user.type(screen.getByLabelText('tourDate'), validFields.tourDate)
    await user.click(screen.getByRole('button', { name: 'session.add' }))
    const [first, second] = screen.getAllByLabelText('location')
    await user.selectOptions(first, 'place-1')
    await user.selectOptions(second, 'place-2')
    const [firstTime, secondTime] = screen.getAllByLabelText('meetingTime')
    await user.type(firstTime, '09:00')
    await user.type(secondTime, '13:00')
    for (const input of screen.getAllByLabelText('capacity')) {
      await user.type(input, '5')
    }
    await user.type(screen.getByLabelText('cancellationDeadline'), validFields.cancellationDeadline)
    await user.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit.mock.calls[0][0].sessions.map((s: { placeId: string }) => s.placeId)).toEqual(['place-1', 'place-2'])
  })

  it('shows only each session\'s place when session management is hidden', () => {
    render(
      <TourForm
        defaultValues={{
          id: 'tour-1',
          group: { id: groups[0].id, name: groups[0].name, type: 'school' },
          status: 'draft',
          tourDate: '2026-06-01T00:00:00.000Z',
          bookingOpen: false,
          places: [{ id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park' }],
          capacity: 10,
          participantCount: 0,
          description: null,
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
            place: { id: 'place-1', nameJa: '平和公園', nameEn: 'Peace Park' },
          }],
          bookings: [],
          assignedAdmins: [],
          staffInChargeId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }}
        groups={groups}
        places={places}
        cancelHref="/admin/tours/tour-1"
        onSubmit={vi.fn()}
        hideSessionManagement
      />,
    )

    expect(screen.getByLabelText('location')).toHaveValue('place-1')
    expect(screen.queryByLabelText('capacity')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'session.add' })).not.toBeInTheDocument()
  })
})
